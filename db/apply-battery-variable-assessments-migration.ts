import { config } from "dotenv"
import { Pool } from "pg"

config({ path: ".env.local" })

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local")
  }

  const pool = new Pool({ connectionString })

  try {
    await pool.query(`
      ALTER TABLE battery_instances
        ADD COLUMN IF NOT EXISTS btp_instance_id uuid REFERENCES assessment_instances(assessment_instance_id),
        ADD COLUMN IF NOT EXISTS btp_link_id uuid REFERENCES assessment_access_links(assessment_access_link_id),
        ADD COLUMN IF NOT EXISTS assist_instance_id uuid REFERENCES assessment_instances(assessment_instance_id),
        ADD COLUMN IF NOT EXISTS assist_link_id uuid REFERENCES assessment_access_links(assessment_access_link_id),
        ADD COLUMN IF NOT EXISTS first_link_id uuid REFERENCES assessment_access_links(assessment_access_link_id),
        ADD COLUMN IF NOT EXISTS last_link_id uuid REFERENCES assessment_access_links(assessment_access_link_id);
    `)
    console.log("✓ Columns added")

    const result = await pool.query(`
      UPDATE battery_instances
      SET
        first_link_id = phq9_link_id,
        last_link_id = gad7_link_id,
        updated_at = NOW()
      WHERE first_link_id IS NULL;
    `)
    console.log(
      `✓ Backfilled first_link_id and last_link_id on ${result.rowCount} existing batteries`
    )

    const { rows } = await pool.query(`
      SELECT COUNT(*) as count FROM battery_instances WHERE first_link_id IS NULL;
    `)
    const remaining = Number(rows[0].count)
    if (remaining > 0) {
      console.error(
        `✗ ${remaining} batteries still have null first_link_id — check manually`
      )
      process.exit(1)
    }

    console.log(
      "✓ Migration complete — all batteries have first_link_id and last_link_id"
    )
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error("Migration failed:", error)
  process.exit(1)
})
