import { randomUUID } from "node:crypto"

import { config } from "dotenv"
import { Pool, type PoolClient } from "pg"

import { tomBlocks, tomEvents, tomExampleSource, tomRelationships, tomScreening, TOM_FIRST_NAME, TOM_LAST_NAME } from "../lib/reports/tom-example-fixture"

config({ path: ".env.local" })

function text(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim()
  return trimmed ? trimmed : null
}

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error("DATABASE_URL is not set. Add it to .env.local")
  const pool = new Pool({ connectionString })
  const practitioner = await pool.query<{
    practitioner_profile_id: string
    practice_id: string
    first_name: string
    last_name: string
  }>(`
    SELECT pp.practitioner_profile_id, pp.first_name, pp.last_name, m.practice_id
    FROM practitioner_profiles pp
    JOIN practitioner_practice_memberships m
      ON m.practitioner_profile_id = pp.practitioner_profile_id AND m.is_active = true
    WHERE pp.is_active = true
    ORDER BY CASE WHEN pp.first_name ILIKE 'ben%' THEN 0 ELSE 1 END, pp.created_at
    LIMIT 1
  `)
  const account = practitioner.rows[0]
  if (!account) throw new Error("No active practitioner membership was found.")

  const existing = await pool.query<{ client_id: string }>(
    `SELECT client_id FROM clients
     WHERE practice_id = $1 AND first_name = $2 AND last_name = $3 AND is_active = true
     LIMIT 1`,
    [account.practice_id, TOM_FIRST_NAME, TOM_LAST_NAME]
  )
  if (existing.rows[0]) {
    console.log(`Tom Example already exists: ${existing.rows[0].client_id}`)
    await pool.end()
    return
  }

  const source = tomExampleSource()
  const clientId = randomUUID()
  const ids = new Map<string, string>()
  for (const person of tomRelationships()) ids.set(person.relationshipRecordId, randomUUID())
  for (const block of tomBlocks()) ids.set(block.relationshipBlockId, randomUUID())
  for (const event of tomEvents()) ids.set(event.eventRecordId, randomUUID())

  const db = await pool.connect()
  try {
    await db.query("BEGIN")
    await db.query(
      `INSERT INTO clients (client_id, practice_id, first_name, last_name, date_of_birth, background_captured_at)
       VALUES ($1, $2, $3, $4, $5, now())`,
      [clientId, account.practice_id, TOM_FIRST_NAME, TOM_LAST_NAME, source.dateOfBirth]
    )
    const identity = source.data.demographics.identity
    await db.query(
      `INSERT INTO client_backgrounds (
         client_id, practice_id, identity_json, living_situation_json, education_json, occupation_json,
         stressors_json, reason_for_attending_json, relationship_status,
         previous_relationships, other_children, mother_other_relationships, father_other_relationships, caregiver_arrangements,
         sexual_orientation, sexual_orientation_other
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        clientId,
        account.practice_id,
        JSON.stringify(identity),
        JSON.stringify(source.data.demographics.livingSituation),
        JSON.stringify(source.data.demographics.education),
        JSON.stringify(source.data.demographics.occupation),
        JSON.stringify(source.data.stressors),
        JSON.stringify(source.data.reason),
        source.data.relationshipStatus.relationshipStatus,
        source.data.blockAnswers?.previousRelationships,
        source.data.blockAnswers?.otherChildren,
        source.data.blockAnswers?.motherOtherRelationships,
        source.data.blockAnswers?.fatherOtherRelationships,
        source.data.blockAnswers?.caregiverArrangements,
        identity.sexualOrientation || null,
        identity.sexualOrientation === "another" ? text(identity.sexualOrientationOther) : null,
      ]
    )
    for (const block of tomBlocks()) {
      await db.query(
        `INSERT INTO client_relationship_blocks (
           relationship_block_id, client_id, practice_id, kind, parent_side, status, arrangement_type,
           started_on, ended_on, no_children, display_order
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          ids.get(block.relationshipBlockId),
          clientId,
          account.practice_id,
          block.kind,
          text(block.parentSide),
          text(block.status),
          text(block.arrangementType),
          text(block.startedOn),
          text(block.endedOn),
          block.noChildren,
          block.displayOrder,
        ]
      )
    }
    for (const person of tomRelationships()) {
      await insertPerson(db, person, ids, clientId, account.practice_id)
    }
    for (const block of tomBlocks()) {
      if (!block.parentRecordId) continue
      await db.query(
        `UPDATE client_relationship_blocks SET parent_record_id = $2 WHERE relationship_block_id = $1`,
        [ids.get(block.relationshipBlockId), ids.get(block.parentRecordId)]
      )
    }
    for (const event of tomEvents()) {
      await db.query(
        `INSERT INTO client_event_records (
           event_record_id, client_id, practice_id, event_type, title, start_precision, start_value,
           end_precision, end_value, end_ongoing, resolved_or_ongoing, about, about_other, attribution,
           relationship_record_id, condition_event_id, admission_type, admission_length, prescriber_name,
           self_harm_type, substance_status, display_order
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
        [
          ids.get(event.eventRecordId),
          clientId,
          account.practice_id,
          event.eventType,
          text(event.title),
          text(event.startPrecision),
          text(event.startValue),
          text(event.endPrecision),
          text(event.endValue),
          event.endOngoing,
          text(event.resolvedOrOngoing),
          text(event.about),
          text(event.aboutOther),
          text(event.attribution),
          event.relationshipRecordId ? ids.get(event.relationshipRecordId) : null,
          event.conditionEventId ? ids.get(event.conditionEventId) : null,
          text(event.admissionType),
          text(event.admissionLength),
          text(event.prescriberName),
          text(event.selfHarmType),
          text(event.substanceStatus),
          event.displayOrder,
        ]
      )
    }
    await db.query(
      `INSERT INTO client_background_interviews (
         client_id, practice_id, practitioner_profile_id, status, completed_at, screening_json
       ) VALUES ($1,$2,$3,'completed', now(), $4)`,
      [clientId, account.practice_id, account.practitioner_profile_id, JSON.stringify(tomScreening())]
    )
    await db.query("COMMIT")
  } catch (error) {
    await db.query("ROLLBACK")
    throw error
  } finally {
    db.release()
  }

  console.log(`Created ${TOM_FIRST_NAME} ${TOM_LAST_NAME} for ${account.first_name} ${account.last_name}: ${clientId}`)
  await pool.end()
}

async function insertPerson(
  db: PoolClient,
  person: ReturnType<typeof tomRelationships>[number],
  ids: Map<string, string>,
  clientId: string,
  practiceId: string
) {
  await db.query(
    `INSERT INTO client_relationship_records (
       relationship_record_id, client_id, practice_id, relationship_to_client, sex, given_name, display_order,
       date_of_birth, health_status, deceased, date_of_death, child_type, caregiver_relationship,
       caregiver_relationship_detail, relationship_block_id, block_role, block_role_type
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    [
      ids.get(person.relationshipRecordId),
      clientId,
      practiceId,
      person.relationshipToClient,
      text(person.sex),
      text(person.givenName),
      person.displayOrder,
      text(person.dateOfBirth),
      text(person.healthStatus),
      person.deceased,
      text(person.dateOfDeath),
      text(person.childType),
      text(person.caregiverRelationship),
      text(person.caregiverRelationshipDetail),
      person.relationshipBlockId ? ids.get(person.relationshipBlockId) : null,
      text(person.blockRole),
      text(person.blockRoleType),
    ]
  )
}

main().catch((error) => {
  console.error("Seed failed:", error)
  process.exit(1)
})
