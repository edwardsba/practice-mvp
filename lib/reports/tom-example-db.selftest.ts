import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"

import { config } from "dotenv"
import { Pool } from "pg"

const require = createRequire(import.meta.url)
const Module = require("node:module") as {
  _resolveFilename: (request: string, parent: unknown, isMain: boolean, options: unknown) => string
}
const resolveFilename = Module._resolveFilename
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === "server-only") return path.join(process.cwd(), "scripts", "empty-module.cjs")
  return resolveFilename.call(this, request, parent, isMain, options)
}

import { generateBackgroundReport, numberedLetterOutline } from "@/lib/reports/generate-background-report"
import { TOM_REPORT_DATE } from "@/lib/reports/tom-example-fixture"

config({ path: ".env.local" })

const TOM_ID = "0a546f0c-a164-46a1-a766-47f36216a229"

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error("DATABASE_URL is not set. Add it to .env.local")
  const pool = new Pool({ connectionString })
  const account = await pool.query<{ practice_id: string; practitioner_profile_id: string }>(
    `SELECT c.practice_id, m.practitioner_profile_id
     FROM clients c
     JOIN practitioner_practice_memberships m
       ON m.practice_id = c.practice_id AND m.is_active = true
     JOIN practitioner_profiles p
       ON p.practitioner_profile_id = m.practitioner_profile_id AND p.is_active = true
     WHERE c.client_id = $1
     ORDER BY CASE WHEN p.first_name ILIKE 'ben%' THEN 0 ELSE 1 END, p.created_at
     LIMIT 1`,
    [TOM_ID]
  )
  await pool.end()
  const row = account.rows[0]
  if (!row) throw new Error(`Tom Example was not found: ${TOM_ID}`)

  const { loadBackgroundReportSource } = await import("@/lib/reports/load-background-report-source")
  const source = await loadBackgroundReportSource({
    clientId: TOM_ID,
    practiceId: row.practice_id,
    practitionerProfileId: row.practitioner_profile_id,
    reportDate: TOM_REPORT_DATE,
  })
  if (!source) throw new Error("The report loader returned no source for Tom.")
  const letter = numberedLetterOutline(generateBackgroundReport(source).document).join("\n")
  const expected = readFileSync(new URL("./tom-example-report.txt", import.meta.url), "utf8").trim()
  assert.equal(letter.replaceAll("\r\n", "\n"), expected.replaceAll("\r\n", "\n"))
  console.log(letter)
  console.log("tom example database selftest passed")
  const shared = (globalThis as { pool?: { end: () => Promise<void> } }).pool
  await shared?.end()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
