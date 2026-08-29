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
    "0052_sage_sr_diagnostic_reports.sql"
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

  console.log("sage_sr_diagnostic_reports table created successfully.")
  await pool.end()
}

main().catch((error) => {
  console.error("Migration failed:", error)
  process.exit(1)
})
