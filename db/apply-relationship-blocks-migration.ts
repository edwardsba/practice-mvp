import { randomUUID } from "crypto"
import { config } from "dotenv"
import { readFileSync } from "fs"
import { join } from "path"
import { Pool } from "pg"

import { mapRelationshipsToBlocks } from "../lib/client-background/relationship-blocks"
import { sanitizePartnership, sanitizeRelationship } from "../lib/client-background/sanitize"

config({ path: ".env.local" })

type PersonRow = Record<string, string | number | boolean | null>

function text(value: string) {
  return value.trim() ? value : null
}

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error("DATABASE_URL is not set. Add it to .env.local")

  const sqlPath = join(__dirname, "migrations", "0069_relationship_blocks.sql")
  const sql = readFileSync(sqlPath, "utf8")
  const statements = sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean)

  const pool = new Pool({ connectionString })
  for (const statement of statements) {
    await pool.query(statement)
  }

  const clients = await pool.query<{ client_id: string; practice_id: string }>(`
    SELECT DISTINCT client_id, practice_id
    FROM client_relationship_records
    WHERE NOT EXISTS (
      SELECT 1 FROM client_relationship_blocks blocks
      WHERE blocks.client_id = client_relationship_records.client_id
    )
  `)

  const placedByKind = new Map<string, number>()
  const unplaced: { name: string; role: string }[] = []

  for (const client of clients.rows) {
    const people = await pool.query<PersonRow>(
      "SELECT * FROM client_relationship_records WHERE client_id = $1 AND practice_id = $2 ORDER BY display_order",
      [client.client_id, client.practice_id]
    )
    const partnerships = await pool.query<PersonRow>(
      "SELECT * FROM client_partnership_records WHERE client_id = $1 AND practice_id = $2",
      [client.client_id, client.practice_id]
    )
    const status = await pool.query<{ relationship_status: string | null }>(
      "SELECT relationship_status FROM client_backgrounds WHERE client_id = $1 AND practice_id = $2",
      [client.client_id, client.practice_id]
    )
    const mapped = mapRelationshipsToBlocks({
      clientStatus: status.rows[0]?.relationship_status ?? "",
      id: () => randomUUID(),
      people: people.rows.map((row) =>
        sanitizeRelationship({
          relationshipRecordId: row.relationship_record_id,
          relationshipToClient: row.relationship_to_client,
          sex: row.sex ?? "",
          givenName: row.given_name ?? "",
          displayOrder: row.display_order ?? 0,
          dateOfBirth: row.date_of_birth ?? "",
          healthStatus: row.health_status ?? "",
          deceased: row.deceased,
          howEnded: row.how_ended ?? "",
          laterRelationships: row.later_relationships ?? "",
          childType: row.child_type ?? "",
          relationshipStatus: row.relationship_status ?? "",
          partnerType: row.partner_type ?? "",
          parentType: row.parent_type ?? "",
          adoptedOn: row.adopted_on ?? "",
          notKnown: row.not_known,
          otherParentKind: row.other_parent_kind ?? "",
          otherParentDetail: row.other_parent_detail ?? "",
          linkedPartnerRecordId: row.linked_partner_record_id,
          partnershipRecordId: row.partnership_record_id,
          startedOn: row.started_on ?? "",
          endedOn: row.ended_on ?? "",
          caregiverRelationship: row.caregiver_relationship ?? "",
          caregiverRelationshipDetail: row.caregiver_relationship_detail ?? "",
        })
      ),
      partnerships: partnerships.rows.map((row) =>
        sanitizePartnership({
          partnershipRecordId: row.partnership_record_id,
          partnerAId: row.partner_a_id,
          partnerBId: row.partner_b_id,
          relationshipStatus: row.relationship_status ?? "",
          started: row.started ?? "",
          ended: row.ended ?? "",
          qualityOfRelationship: row.quality_of_relationship ?? "",
        })
      ),
    })

    const dbClient = await pool.connect()
    try {
      await dbClient.query("BEGIN")
      for (const block of mapped.blocks) {
        await dbClient.query(
          `INSERT INTO client_relationship_blocks (
            relationship_block_id, client_id, practice_id, kind, parent_record_id, parent_side,
            status, status_detail, arrangement_type, arrangement_detail, started_on, ended_on,
            no_children, display_order
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [
            block.relationshipBlockId,
            client.client_id,
            client.practice_id,
            block.kind,
            block.parentRecordId,
            text(block.parentSide),
            text(block.status),
            text(block.statusDetail),
            text(block.arrangementType),
            text(block.arrangementDetail),
            text(block.startedOn),
            text(block.endedOn),
            block.noChildren,
            block.displayOrder,
          ]
        )
        placedByKind.set(block.kind, (placedByKind.get(block.kind) ?? 0) + 1)
      }
      for (const member of mapped.membership) {
        await dbClient.query(
          `UPDATE client_relationship_records
           SET relationship_block_id = $1, block_role = $2, block_role_type = $3, placement_review = $4, updated_at = now()
           WHERE relationship_record_id = $5 AND client_id = $6 AND practice_id = $7 AND relationship_block_id IS NULL`,
          [
            member.relationshipBlockId,
            text(member.blockRole),
            text(member.blockRoleType),
            text(member.placementReview),
            member.relationshipRecordId,
            client.client_id,
            client.practice_id,
          ]
        )
        if (member.placementReview === "unplaced") {
          const person = people.rows.find((row) => row.relationship_record_id === member.relationshipRecordId)
          unplaced.push({
            name: String(person?.given_name ?? "").trim() || "(no name)",
            role: String(person?.relationship_to_client ?? ""),
          })
        }
      }
      const answers = mapped.answers
      const updated = await dbClient.query(
        `UPDATE client_backgrounds
         SET previous_relationships = $2, other_children = $3, mother_other_relationships = $4,
             father_other_relationships = $5, caregiver_arrangements = $6, updated_at = now()
         WHERE client_id = $1 AND practice_id = $7`,
        [
          client.client_id,
          answers.previousRelationships,
          answers.otherChildren,
          answers.motherOtherRelationships,
          answers.fatherOtherRelationships,
          answers.caregiverArrangements,
          client.practice_id,
        ]
      )
      if (updated.rowCount === 0) {
        await dbClient.query(
          `INSERT INTO client_backgrounds (
            client_id, practice_id, previous_relationships, other_children, mother_other_relationships,
            father_other_relationships, caregiver_arrangements
          ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            client.client_id,
            client.practice_id,
            answers.previousRelationships,
            answers.otherChildren,
            answers.motherOtherRelationships,
            answers.fatherOtherRelationships,
            answers.caregiverArrangements,
          ]
        )
      }
      await dbClient.query("COMMIT")
    } catch (error) {
      await dbClient.query("ROLLBACK")
      throw error
    } finally {
      dbClient.release()
    }
  }

  console.log("relationship blocks migration applied.")
  console.log(`Clients mapped: ${clients.rows.length}`)
  for (const [kind, count] of [...placedByKind.entries()].sort()) {
    console.log(`  ${kind}: ${count}`)
  }
  console.log(`Unplaced people: ${unplaced.length}`)
  for (const person of unplaced) console.log(`  ${person.role}: ${person.name}`)
  await pool.end()
}

main().catch((error) => {
  console.error("Migration failed:", error)
  process.exit(1)
})
