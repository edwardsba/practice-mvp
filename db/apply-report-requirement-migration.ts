import { config } from "dotenv"
import { Pool } from "pg"

config({ path: ".env.local" })

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.")
  }
  const pool = new Pool({ connectionString })
  try {
    await pool.query(`
      ALTER TABLE simple_reports
        ADD COLUMN IF NOT EXISTS report_requirement_id uuid;
    `)
    console.log("✓ report_requirement_id column added to simple_reports")
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error("Migration failed:", error)
  process.exit(1)
})
