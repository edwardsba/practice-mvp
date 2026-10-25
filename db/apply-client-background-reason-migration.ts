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

  const sqlPath = join(__dirname, "migrations", "0064_client_background_reason.sql")
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
       AND column_name = 'reason_for_attending_json'`
  )
  const already = before.rows.length > 0

  for (const statement of statements) {
    await pool.query(statement)
  }

  const after = await pool.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'client_backgrounds'
       AND column_name = 'reason_for_attending_json'`
  )

  console.log("client background reason migration applied.")
  console.log(
    `columns added: ${!already && after.rows.length > 0 ? "reason_for_attending_json" : "none (reason_for_attending_json already present)"}`
  )
  await pool.end()
}

main().catch((error) => {
  console.error("Migration failed:", error)
  process.exit(1)
})
