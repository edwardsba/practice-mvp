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
        ADD COLUMN IF NOT EXISTS report_date DATE;

      UPDATE simple_reports
      SET report_date = COALESCE(date_range_end, created_at::date)
      WHERE report_date IS NULL;
    `)
    console.log("✓ report_date column added and backfilled")
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error("Migration failed:", error)
  process.exit(1)
})
