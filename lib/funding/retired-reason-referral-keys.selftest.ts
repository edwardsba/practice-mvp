/**
 * After Round N, no application code may read the referral fields that lived in
 * reason_for_attending_json. Those keys are only touched by migration 0075
 * (and the pure move helper that mirrors it for tests).
 *
 * Keys that also exist on funding_approvals (referralDate, referrerRelationshipId,
 * referrerOther) are only flagged when accessed via reason / reason_for_attending.
 */
import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const ROOT = join(__dirname, "../..")

const ALLOWED_PATH_PREFIXES = [
  "db/migrations/",
  "db/apply-",
  "lib/funding/referral.ts",
  "lib/funding/referral.selftest.ts",
  "lib/funding/retired-reason-referral-keys.selftest.ts",
]

/** Unique to the old JSON — must not appear in app code at all. */
const JSON_ONLY_KEYS = [
  "referralType",
  "referrerProfessionalId",
  "referrerConcerns",
  "referrerIsOther",
  "theirConcerns",
] as const

/** Shared names: only illegal when reached through reason_for_attending / reason. */
const REASON_SCOPED_PATTERNS = [
  /\breason_for_attending_json\s*->>\s*['"]referralDate['"]/,
  /\breason_for_attending_json\s*->>\s*['"]referrerRelationshipId['"]/,
  /\breason_for_attending_json\s*->>\s*['"]referrerOther['"]/,
  /\breason\.referralDate\b/,
  /\breason\.referrerRelationshipId\b/,
  /\breason\.referrerOther\b/,
  /\breason\.referralType\b/,
  /\breason\.referrerProfessionalId\b/,
  /\breason\.referrerConcerns\b/,
  /\breason\.referrerIsOther\b/,
  /\breason\.theirConcerns\b/,
  /\bdata\.reason\.(referral|referrer|theirConcerns)/,
]

const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"])

function walk(dir: string, out: string[]) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === "public" || name === ".git") continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, out)
    else out.push(full)
  }
}

function isAllowed(rel: string): boolean {
  return ALLOWED_PATH_PREFIXES.some(
    (prefix) => rel === prefix || rel.startsWith(prefix)
  )
}

function hasExtension(rel: string): boolean {
  const dot = rel.lastIndexOf(".")
  if (dot < 0) return false
  return CODE_EXTENSIONS.has(rel.slice(dot))
}

const files: string[] = []
walk(ROOT, files)

const offenders: string[] = []
for (const file of files) {
  const rel = relative(ROOT, file).replace(/\\/g, "/")
  if (!hasExtension(rel) || isAllowed(rel)) continue
  const text = readFileSync(file, "utf8")
  for (const key of JSON_ONLY_KEYS) {
    const pattern = new RegExp(`(['"\`])${key}\\1|\\.${key}\\b`)
    if (pattern.test(text)) {
      offenders.push(`${rel} → ${key}`)
      break
    }
  }
  if (offenders.some((row) => row.startsWith(`${rel} →`))) continue
  for (const pattern of REASON_SCOPED_PATTERNS) {
    if (pattern.test(text)) {
      offenders.push(`${rel} → ${pattern}`)
      break
    }
  }
}

assert.deepEqual(
  offenders,
  [],
  `Retired reason_for_attending referral keys must not be read outside migration 0075. Offenders:\n${offenders.join("\n")}`
)

console.log("retired-reason-referral-keys.selftest.ts: ok")
