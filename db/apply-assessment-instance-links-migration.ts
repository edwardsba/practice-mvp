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
    "0020_assessment_instance_links.sql"
  )
  const sql = readFileSync(sqlPath, "utf8").trim()
  const pool = new Pool({ connectionString })
  await pool.query(sql)
  await pool.end()
  console.log("Assessment instance links migration applied successfully.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
