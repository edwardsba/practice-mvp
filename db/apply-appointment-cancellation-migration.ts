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
    "0023_appointment_cancellation.sql"
  )
  const sql = readFileSync(sqlPath, "utf8").trim()

  const pool = new Pool({ connectionString })
  for (const statement of sql.split(";").map((part) => part.trim()).filter(Boolean)) {
    await pool.query(statement)
  }

  console.log("appointment cancellation migration applied successfully.")
  await pool.end()
}

main().catch((error) => {
  console.error("Migration failed:", error)
  process.exit(1)
})
