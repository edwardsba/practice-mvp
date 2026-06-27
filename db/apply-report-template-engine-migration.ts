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
      ALTER TABLE report_types
        ADD COLUMN IF NOT EXISTS template_key TEXT NOT NULL DEFAULT 'progress_report';

      ALTER TABLE simple_reports
        ADD COLUMN IF NOT EXISTS report_type_id UUID;
    `)
    console.log("✓ template_key and report_type_id columns added")
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error("Migration failed:", error)
  process.exit(1)
})
