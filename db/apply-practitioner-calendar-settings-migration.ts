import { config } from "dotenv"
import { readFileSync } from "fs"
import { join } from "path"
import { Pool } from "pg"

config({ path: ".env.local" })

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.")
  }

  const sqlPath = join(
    __dirname,
    "migrations",
    "0017_practitioner_calendar_settings.sql"
  )
  const sql = readFileSync(sqlPath, "utf8").trim()
  const pool = new Pool({ connectionString })
  await pool.query(sql)
  await pool.end()
  console.log("Practitioner calendar settings migration applied successfully.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
