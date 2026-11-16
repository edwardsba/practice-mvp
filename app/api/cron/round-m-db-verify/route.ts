import { readFileSync } from "fs"
import { join } from "path"

import { NextResponse } from "next/server"
import { Pool } from "pg"

import { ensureChildrenSiblingsAnswersColumns } from "@/lib/client-background/ensure-children-siblings-answers"
import { generateBackgroundReport, numberedLetterOutline } from "@/lib/reports/generate-background-report"
import { TOM_REPORT_DATE } from "@/lib/reports/tom-example-fixture"

const TOM_ID = "0a546f0c-a164-46a1-a766-47f36216a229"

async function repairTomAnswers(connectionString: string) {
  const pool = new Pool({ connectionString })
  try {
    const account = await pool.query<{ practice_id: string }>(
      `SELECT practice_id FROM clients WHERE client_id = $1 LIMIT 1`,
      [TOM_ID]
    )
    const practiceId = account.rows[0]?.practice_id
    if (!practiceId) return { repaired: false, reason: "Tom Example was not found." }
    await pool.query(
      `UPDATE client_relationship_blocks
       SET children_answer = 'yes', no_children = false, updated_at = now()
       WHERE client_id = $1 AND practice_id = $2 AND kind = 'client_current'`,
      [TOM_ID, practiceId]
    )
    await pool.query(
      `UPDATE client_relationship_blocks
       SET children_answer = 'none', no_children = true, updated_at = now()
       WHERE client_id = $1 AND practice_id = $2 AND kind = 'client_previous' AND status = 'defacto_separated'`,
      [TOM_ID, practiceId]
    )
    await pool.query(
      `UPDATE client_relationship_blocks
       SET children_answer = 'yes', no_children = false, updated_at = now()
       WHERE client_id = $1 AND practice_id = $2 AND kind = 'client_previous' AND status = 'divorced'`,
      [TOM_ID, practiceId]
    )
    await pool.query(
      `UPDATE client_relationship_blocks
       SET siblings_answer = 'yes', updated_at = now()
       WHERE client_id = $1 AND practice_id = $2 AND kind = 'biological_parents'`,
      [TOM_ID, practiceId]
    )
    await pool.query(
      `UPDATE client_relationship_blocks
       SET siblings_answer = 'yes', updated_at = now()
       WHERE client_id = $1 AND practice_id = $2 AND kind = 'parent_other' AND status = 'divorced'`,
      [TOM_ID, practiceId]
    )
    await pool.query(
      `UPDATE client_relationship_blocks
       SET siblings_answer = 'none', updated_at = now()
       WHERE client_id = $1 AND practice_id = $2 AND kind = 'parent_other' AND status = 'defacto'`,
      [TOM_ID, practiceId]
    )
    await pool.query(
      `UPDATE client_relationship_blocks
       SET siblings_answer = 'none', updated_at = now()
       WHERE client_id = $1 AND practice_id = $2 AND kind = 'caregiver_arrangement'`,
      [TOM_ID, practiceId]
    )
    return { repaired: true, practiceId }
  } finally {
    await pool.end()
  }
}

async function handleCron(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 })
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 500 })
  }

  try {
    await ensureChildrenSiblingsAnswersColumns()
    const repair = await repairTomAnswers(process.env.DATABASE_URL)

    const account = await (async () => {
      const pool = new Pool({ connectionString: process.env.DATABASE_URL })
      try {
        const result = await pool.query<{ practice_id: string; practitioner_profile_id: string }>(
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
        return result.rows[0] ?? null
      } finally {
        await pool.end()
      }
    })()

    if (!account) {
      return NextResponse.json({ ok: false, migration: true, repair, error: "Tom Example was not found." }, { status: 404 })
    }

    const { loadBackgroundReportSource } = await import("@/lib/reports/load-background-report-source")
    const source = await loadBackgroundReportSource({
      clientId: TOM_ID,
      practiceId: account.practice_id,
      practitionerProfileId: account.practitioner_profile_id,
      reportDate: TOM_REPORT_DATE,
    })
    if (!source) {
      return NextResponse.json({ ok: false, migration: true, repair, error: "Report loader returned no source." }, { status: 500 })
    }
    const letter = numberedLetterOutline(generateBackgroundReport(source).document).join("\n")
    const expected = readFileSync(join(process.cwd(), "lib/reports/tom-example-report.txt"), "utf8").trim()
    const matches = letter.replaceAll("\r\n", "\n") === expected.replaceAll("\r\n", "\n")
    return NextResponse.json({
      ok: matches,
      migration: true,
      repair,
      reportMatches: matches,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Round M DB verify failed."
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return handleCron(request)
}

export async function POST(request: Request) {
  return handleCron(request)
}
