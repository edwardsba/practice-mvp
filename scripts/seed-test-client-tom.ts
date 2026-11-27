import { randomUUID } from "node:crypto"

import { config } from "dotenv"
import { Pool, type PoolClient } from "pg"

import { tomBlocks, tomEvents, tomExampleSource, tomIssues, tomRelationships, tomScreening, TOM_FIRST_NAME, TOM_LAST_NAME } from "../lib/reports/tom-example-fixture"

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

  const knownId = "0a546f0c-a164-46a1-a766-47f36216a229"
  const known = await pool.query<{ client_id: string }>(
    `SELECT client_id FROM clients WHERE client_id = $1 AND practice_id = $2`,
    [knownId, account.practice_id]
  )
  if (known.rows[0]) {
    await repairTom(pool, knownId, account.practice_id)
    console.log(`Repaired ${TOM_FIRST_NAME} ${TOM_LAST_NAME}: ${knownId}`)
    await pool.end()
    return
  }

  const existing = await pool.query<{ client_id: string }>(
    `SELECT client_id FROM clients
     WHERE practice_id = $1 AND first_name = $2 AND last_name = $3 AND is_active = true
     LIMIT 1`,
    [account.practice_id, TOM_FIRST_NAME, TOM_LAST_NAME]
  )
  if (existing.rows[0]) {
    console.log(`Tom Example already exists and was not the repair target: ${existing.rows[0].client_id}`)
    await pool.end()
    return
  }

  const harry = await findHarry(pool, account.practice_id)
  const source = tomExampleSource()
  const clientId = randomUUID()
  const ids = new Map<string, string>()
  for (const person of tomRelationships()) ids.set(person.relationshipRecordId, randomUUID())
  for (const block of tomBlocks()) ids.set(block.relationshipBlockId, randomUUID())
  for (const issue of tomIssues()) ids.set(issue.issueId, randomUUID())
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
         stressors_json, relationship_status,
         previous_relationships, other_children, mother_other_relationships, father_other_relationships, caregiver_arrangements
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        clientId,
        account.practice_id,
        JSON.stringify(identity),
        JSON.stringify(source.data.demographics.livingSituation),
        JSON.stringify(source.data.demographics.education),
        JSON.stringify(source.data.demographics.occupation),
        JSON.stringify(source.data.stressors),
        source.data.relationshipStatus.relationshipStatus,
        source.data.blockAnswers?.previousRelationships,
        source.data.blockAnswers?.otherChildren,
        source.data.blockAnswers?.motherOtherRelationships,
        source.data.blockAnswers?.fatherOtherRelationships,
        source.data.blockAnswers?.caregiverArrangements,
      ]
    )
    for (const block of tomBlocks()) {
      await db.query(
        `INSERT INTO client_relationship_blocks (
           relationship_block_id, client_id, practice_id, kind, parent_side, status, arrangement_type,
           started_on, ended_on, children_answer, siblings_answer, display_order
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
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
          text(block.childrenAnswer),
          text(block.siblingsAnswer),
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
    for (const issue of tomIssues()) {
      await db.query(
        `INSERT INTO client_history_issues (
           issue_id, client_id, practice_id, category, about, relationship_record_id, about_other, title,
           treatment_answer, display_order
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          ids.get(issue.issueId),
          clientId,
          account.practice_id,
          issue.category,
          issue.about,
          issue.relationshipRecordId ? ids.get(issue.relationshipRecordId) : null,
          text(issue.aboutOther),
          text(issue.title),
          text(issue.treatmentAnswer),
          issue.displayOrder,
        ]
      )
    }
    for (const event of tomEvents()) {
      await db.query(
        `INSERT INTO client_event_records (
           event_record_id, client_id, practice_id, event_type, title, start_precision, start_value,
           end_precision, end_value, end_ongoing, resolved_or_ongoing, about, about_other,
           relationship_record_id, condition_group_id, parent_event_id, admission_type, admission_length,
           prescriber_name, prescriber_professional_id, self_harm_type, substance_status, display_order
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
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
          event.relationshipRecordId ? ids.get(event.relationshipRecordId) : null,
          event.conditionGroupId ? ids.get(event.conditionGroupId) : null,
          event.parentEventId ? ids.get(event.parentEventId) : null,
          text(event.admissionType),
          text(event.admissionLength),
          text(event.prescriberName),
          event.prescriberProfessionalId === "tom-prescriber" ? harry : event.prescriberProfessionalId,
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
    if (harry) {
      await ensureTomMedicareApproval(db, clientId, account.practice_id, harry)
    }
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
       date_of_birth, health_status, deceased, date_of_death, child_type_detail, caregiver_relationship,
       caregiver_relationship_detail, living_situation, relationship_block_id, block_role, block_role_type
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
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
      text(person.childTypeDetail),
      text(person.caregiverRelationship),
      text(person.caregiverRelationshipDetail),
      text(person.livingSituation),
      person.relationshipBlockId ? ids.get(person.relationshipBlockId) : null,
      text(person.blockRole),
      text(person.blockRoleType),
    ]
  )
}

async function findHarry(pool: Pool, practiceId: string): Promise<string | null> {
  const professional = await pool.query<{ professional_id: string }>(
    `SELECT professional_id FROM professionals
     WHERE practice_id = $1 AND first_name = 'Harry' AND last_name = 'TestDoc'
     ORDER BY created_at
     LIMIT 1`,
    [practiceId]
  )
  return professional.rows[0]?.professional_id ?? null
}

/** Medicare claim + MHTP Initial approval (Harry referrer). Idempotent. */
async function ensureTomMedicareApproval(
  db: PoolClient,
  clientId: string,
  practiceId: string,
  harryProfessionalId: string
) {
  const medicare = await db.query<{ claim_type_id: string }>(
    `SELECT claim_type_id FROM claim_types
     WHERE practice_id = $1 AND claim_type_name = 'Medicare' AND is_active = true
     LIMIT 1`,
    [practiceId]
  )
  const mhtp = await db.query<{
    funding_approval_type_id: string
    appointments_approved: number | null
  }>(
    `SELECT funding_approval_type_id, appointments_approved FROM funding_approval_types
     WHERE practice_id = $1 AND name = 'MHTP Initial' AND is_active = true
     LIMIT 1`,
    [practiceId]
  )
  const medicareTypeId = medicare.rows[0]?.claim_type_id
  const mhtpType = mhtp.rows[0]
  if (!medicareTypeId || !mhtpType) return

  let claimId: string | null = null
  const existingClaim = await db.query<{ claim_id: string }>(
    `SELECT claim_id FROM claims
     WHERE client_id = $1 AND practice_id = $2 AND claim_type_id = $3 AND is_active = true
     ORDER BY created_at
     LIMIT 1`,
    [clientId, practiceId, medicareTypeId]
  )
  if (existingClaim.rows[0]) {
    claimId = existingClaim.rows[0].claim_id
  } else {
    claimId = randomUUID()
    await db.query(
      `INSERT INTO claims (claim_id, practice_id, client_id, claim_type_id, is_active)
       VALUES ($1, $2, $3, $4, true)`,
      [claimId, practiceId, clientId, medicareTypeId]
    )
  }

  const existingApproval = await db.query<{ funding_approval_id: string }>(
    `SELECT funding_approval_id FROM funding_approvals
     WHERE client_id = $1 AND practice_id = $2
       AND funding_approval_type_id = $3 AND is_active = true
     ORDER BY created_at
     LIMIT 1`,
    [clientId, practiceId, mhtpType.funding_approval_type_id]
  )

  const appointmentsApproved = mhtpType.appointments_approved ?? 6
  let approvalId: string
  if (existingApproval.rows[0]) {
    approvalId = existingApproval.rows[0].funding_approval_id
    await db.query(
      `UPDATE funding_approvals
       SET claim_id = $2,
           referrer_id = $3,
           start_date = '2026-10-03',
           end_date = '2027-10-03',
           appointments_approved = $4,
           approval_status = 'active',
           referral_date = '2026-10-03',
           referrer_comments = 'low mood and stress',
           referral_source = NULL,
           referrer_relationship_id = NULL,
           referrer_other = NULL,
           is_active = true,
           updated_at = now()
       WHERE funding_approval_id = $1`,
      [approvalId, claimId, harryProfessionalId, appointmentsApproved]
    )
  } else {
    approvalId = randomUUID()
    await db.query(
      `INSERT INTO funding_approvals (
         funding_approval_id, practice_id, client_id, claim_id, funding_approval_type_id,
         referrer_id, start_date, end_date, appointments_approved, approval_status,
         referral_date, referrer_comments, is_active
       ) VALUES ($1,$2,$3,$4,$5,$6,'2026-10-03','2027-10-03',$7,'active','2026-10-03','low mood and stress', true)`,
      [
        approvalId,
        practiceId,
        clientId,
        claimId,
        mhtpType.funding_approval_type_id,
        harryProfessionalId,
        appointmentsApproved,
      ]
    )
  }

  const typeReports = await db.query<{
    appointment_number: number
    report_type: string
    report_type_id: string | null
  }>(
    `SELECT appointment_number, report_type, report_type_id
     FROM funding_approval_type_reports
     WHERE funding_approval_type_id = $1
     ORDER BY appointment_number`,
    [mhtpType.funding_approval_type_id]
  )
  for (const row of typeReports.rows) {
    const linked = await db.query<{ link_id: string }>(
      `SELECT link_id FROM funding_approval_report_links
       WHERE funding_approval_id = $1 AND appointment_number = $2
       LIMIT 1`,
      [approvalId, row.appointment_number]
    )
    if (linked.rows[0]) {
      await db.query(
        `UPDATE funding_approval_report_links
         SET report_type = $2, report_type_id = $3, updated_at = now()
         WHERE link_id = $1`,
        [linked.rows[0].link_id, row.report_type, row.report_type_id]
      )
    } else {
      await db.query(
        `INSERT INTO funding_approval_report_links (
           funding_approval_id, appointment_number, report_type, report_type_id
         ) VALUES ($1, $2, $3, $4)`,
        [approvalId, row.appointment_number, row.report_type, row.report_type_id]
      )
    }
  }
}

async function repairTom(pool: Pool, clientId: string, practiceId: string) {
  const harry = await findHarry(pool, practiceId)
  if (!harry) throw new Error("Dr Harry TestDoc was not found in this practice.")
  const db = await pool.connect()
  try {
    await db.query("BEGIN")
    await ensureTomMedicareApproval(db, clientId, practiceId, harry)
    await db.query(
      `UPDATE client_relationship_records
       SET caregiver_relationship = 'grandparent',
           caregiver_relationship_detail = 'maternal grandmother',
           block_role_type = 'grandparent',
           updated_at = now()
       WHERE client_id = $1 AND practice_id = $2 AND given_name = 'Joan'`,
      [clientId, practiceId]
    )
    await db.query(
      `UPDATE client_relationship_records
       SET living_situation = 'lives_with_client_full_time', updated_at = now()
       WHERE client_id = $1 AND practice_id = $2 AND given_name = ANY($3::text[])`,
      [clientId, practiceId, ["Jordan", "Henry", "Lily", "Max", "Sam"]]
    )
    await db.query(
      `UPDATE client_relationship_records
       SET date_of_birth = '1950-01-01', updated_at = now()
       WHERE client_id = $1 AND practice_id = $2 AND given_name = 'Phil'`,
      [clientId, practiceId]
    )
    await db.query(
      `UPDATE client_event_records
       SET prescriber_professional_id = $3, updated_at = now()
       WHERE client_id = $1 AND practice_id = $2 AND title = 'Sertraline'`,
      [clientId, practiceId, harry]
    )
    // Round M: Jordan Yes, Pam None, Kim Yes; bio/Phil siblings Yes; Larry/Joan None.
    await db.query(
      `UPDATE client_relationship_blocks
       SET children_answer = 'yes', updated_at = now()
       WHERE client_id = $1 AND practice_id = $2 AND kind = 'client_current'`,
      [clientId, practiceId]
    )
    await db.query(
      `UPDATE client_relationship_blocks
       SET children_answer = 'none', updated_at = now()
       WHERE client_id = $1 AND practice_id = $2 AND kind = 'client_previous' AND status = 'defacto_separated'`,
      [clientId, practiceId]
    )
    await db.query(
      `UPDATE client_relationship_blocks
       SET children_answer = 'yes', updated_at = now()
       WHERE client_id = $1 AND practice_id = $2 AND kind = 'client_previous' AND status = 'divorced'`,
      [clientId, practiceId]
    )
    await db.query(
      `UPDATE client_relationship_blocks
       SET siblings_answer = 'yes', updated_at = now()
       WHERE client_id = $1 AND practice_id = $2 AND kind = 'biological_parents'`,
      [clientId, practiceId]
    )
    await db.query(
      `UPDATE client_relationship_blocks
       SET siblings_answer = 'yes', updated_at = now()
       WHERE client_id = $1 AND practice_id = $2 AND kind = 'parent_other' AND status = 'divorced'`,
      [clientId, practiceId]
    )
    await db.query(
      `UPDATE client_relationship_blocks
       SET siblings_answer = 'none', updated_at = now()
       WHERE client_id = $1 AND practice_id = $2 AND kind = 'parent_other' AND status = 'defacto'`,
      [clientId, practiceId]
    )
    await db.query(
      `UPDATE client_relationship_blocks
       SET siblings_answer = 'none', updated_at = now()
       WHERE client_id = $1 AND practice_id = $2 AND kind = 'caregiver_arrangement'`,
      [clientId, practiceId]
    )
    await db.query("COMMIT")
  } catch (error) {
    await db.query("ROLLBACK")
    throw error
  } finally {
    db.release()
  }
}

main().catch((error) => {
  console.error("Seed failed:", error)
  process.exit(1)
})
