import { config } from "dotenv"
import { readFileSync } from "fs"
import { join } from "path"
import { Pool } from "pg"

config({ path: ".env.local" })

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error("DATABASE_URL is not set. Add it to .env.local")

  const sqlPath = join(__dirname, "migrations", "0071_referral_type.sql")
  const sql = readFileSync(sqlPath, "utf8")
  const statements = sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean)

  const pool = new Pool({ connectionString })
  for (const statement of statements) {
    await pool.query(statement)
  }
  const counts = await pool.query<{
    medical: string
    family_or_friend: string
    self: string
    blank: string
  }>(`
    SELECT
      count(*) FILTER (WHERE reason_for_attending_json->>'referralType' = 'medical') AS medical,
      count(*) FILTER (WHERE reason_for_attending_json->>'referralType' = 'family_or_friend') AS family_or_friend,
      count(*) FILTER (WHERE reason_for_attending_json->>'referralType' = 'self') AS self,
      count(*) FILTER (
        WHERE reason_for_attending_json IS NULL
           OR COALESCE(reason_for_attending_json->>'referralType', '') = ''
      ) AS blank
    FROM client_backgrounds
  `)
  console.log("referral type migration applied.")
  console.log(counts.rows[0])
  await pool.end()
}

main().catch((error) => {
  console.error("Migration failed:", error)
  process.exit(1)
})
