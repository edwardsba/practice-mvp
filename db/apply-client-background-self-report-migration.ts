import { config } from "dotenv"
import { readFileSync } from "fs"
import { join } from "path"
import { Pool } from "pg"

config({ path: ".env.local" })

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local")
  }

  const sqlPath = join(__dirname, "migrations", "0063_client_background_self_report.sql")
  const sql = readFileSync(sqlPath, "utf8")
  const statements = sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean)

  const pool = new Pool({ connectionString })

  const before = await pool.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'client_backgrounds'
       AND column_name IN ('medication_json', 'stressors_json')`
  )
  const already = new Set(before.rows.map((row) => row.column_name))

  let housingRewritten = 0
  let pronounsRewritten = 0

  for (const statement of statements) {
    const result = await pool.query(statement)
    const row = result.rows[0] as { housing_rewritten?: number | string; pronouns_rewritten?: number | string } | undefined
    if (row && row.housing_rewritten != null) housingRewritten = Number(row.housing_rewritten)
    if (row && row.pronouns_rewritten != null) pronounsRewritten = Number(row.pronouns_rewritten)
  }

  const after = await pool.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'client_backgrounds'
       AND column_name IN ('medication_json', 'stressors_json')
     ORDER BY column_name`
  )
  const added = after.rows.map((row) => row.column_name).filter((name) => !already.has(name))

  console.log("client background self-report migration applied.")
  console.log(`columns added: ${added.length > 0 ? added.join(", ") : "none"}`)
  console.log(`housing values rewritten: ${housingRewritten}`)
  console.log(`pronoun values rewritten: ${pronounsRewritten}`)
  await pool.end()
}

main().catch((error) => {
  console.error("Migration failed:", error)
  process.exit(1)
})
