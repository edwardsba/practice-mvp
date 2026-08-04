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

  const sqlPath = join(
    __dirname,
    "migrations",
    "0048_assessment_instance_carried_responses.sql"
  )
  const sql = readFileSync(sqlPath, "utf8")
  const statements = sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean)

  const pool = new Pool({ connectionString })

  for (const statement of statements) {
    await pool.query(statement)
  }

  console.log("assessment_instances.carried_responses_json migration applied successfully.")
  await pool.end()
}

main().catch((error) => {
  console.error("Migration failed:", error)
  process.exit(1)
})
