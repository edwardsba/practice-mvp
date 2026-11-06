import { randomUUID } from "node:crypto"
import { config } from "dotenv"
import { readFileSync } from "fs"
import { join } from "path"
import { Pool } from "pg"

import { planConditionBackfill } from "@/lib/client-background/condition-groups"
import { emptyEvent, type EventRecord, type EventType } from "@/lib/client-background/types"

config({ path: ".env.local" })

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error("DATABASE_URL is not set. Add it to .env.local")

  const sqlPath = join(__dirname, "migrations", "0072_condition_groups.sql")
  const sql = readFileSync(sqlPath, "utf8")
  const statements = sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean)

  const pool = new Pool({ connectionString })
  try {
    for (const statement of statements) await pool.query(statement)
    const loaded = await pool.query<{
      event_record_id: string
      client_id: string
      first_name: string
      last_name: string
      event_type: string
      title: string | null
      about: string | null
      relationship_record_id: string | null
      about_other: string | null
    }>(
      `SELECT e.event_record_id, e.client_id, c.first_name, c.last_name, e.event_type, e.title,
              e.about, e.relationship_record_id, e.about_other
         FROM client_event_records e
         JOIN clients c ON c.client_id = e.client_id
        WHERE e.condition_group_id IS NULL
          AND e.event_type IN ('emotional_problems', 'substance_use', 'illness_injury')`
    )
    const names = new Map<string, string>()
    const plan = planConditionBackfill(
      loaded.rows.map((row) => {
        names.set(row.client_id, [row.first_name, row.last_name].filter(Boolean).join(" "))
        const event: EventRecord = {
          ...emptyEvent(row.event_type as EventType, 0),
          eventRecordId: row.event_record_id,
          title: row.title ?? "",
          about: row.about === "significant_other" ? "significant_other" : "self",
          relationshipRecordId: row.relationship_record_id,
          aboutOther: row.about_other ?? "",
        }
        return { clientId: row.client_id, event }
      }),
      randomUUID
    )
    for (const assignment of plan.assignments) {
      await pool.query(`UPDATE client_event_records SET condition_group_id = $1 WHERE event_record_id = $2 AND condition_group_id IS NULL`, [
        assignment.conditionGroupId,
        assignment.eventRecordId,
      ])
    }
    console.log(`condition groups made: ${plan.groupsMade}`)
    for (const client of plan.byClient) {
      console.log(`${names.get(client.clientId) || "Client"} (${client.clientId}): ${client.groups}`)
    }
    console.log("condition groups migration applied.")
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error("Migration failed:", error)
  process.exit(1)
})
