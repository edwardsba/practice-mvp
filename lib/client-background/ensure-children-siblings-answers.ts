import "server-only"

import { readFileSync } from "fs"
import { join } from "path"

import { pool } from "@/lib/db"

let ensured: Promise<void> | null = null

/**
 * Apply migration 0074 once per process (idempotent ADD COLUMN IF NOT EXISTS + backfill).
 * Safe to call from loaders so preview/production pick up the columns without a local DATABASE_URL.
 */
export function ensureChildrenSiblingsAnswersColumns(): Promise<void> {
  if (!ensured) ensured = applyOnce().catch((error) => {
    ensured = null
    throw error
  })
  return ensured
}

async function applyOnce() {
  const sqlPath = join(process.cwd(), "db/migrations/0074_relationship_children_siblings_answers.sql")
  const sql = readFileSync(sqlPath, "utf8")
  const statements = sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter((statement) => statement.replace(/--.*$/gm, "").trim().length > 0)
  const client = await pool.connect()
  try {
    for (const statement of statements) await client.query(statement)
  } finally {
    client.release()
  }
}
