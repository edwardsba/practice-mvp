/**
 * Guard: no Tailwind palette colour classes outside the shared status colours module.
 * Reads repo files only (no database). See AGENTS.md — "Colours: one meaning each."
 */

import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const REPO_ROOT = join(import.meta.dirname, "../..")

const AGENTS_HINT = 'Read AGENTS.md — "Colours: one meaning each."'

/**
 * Paths relative to repo root → one-line reason.
 * Keep this list short.
 */
const ALLOWLIST: Record<string, string> = {
  "lib/ui/status-colours.ts": "Single source of status colour class strings",
  "lib/ui/status-colours-guard.selftest.ts": "This guard (may mention palette families in patterns)",
}

/**
 * shadcn primitives under components/ui that only use theme tokens
 * (primary, destructive, muted, …) are exempt — they never match PALETTE_PATTERN.
 * If a ui primitive gains a palette class, either move it into status-colours.ts
 * or add an allow-list entry with a one-line reason.
 */

const PALETTE_FAMILIES =
  "amber|yellow|orange|green|emerald|lime|teal|red|rose|blue|sky|indigo|cyan|violet|purple|fuchsia|pink"

const PALETTE_PATTERN = new RegExp(
  `\\b(?:bg|text|border|ring|fill|stroke|from|to|via)-(?:${PALETTE_FAMILIES})-\\d{2,3}\\b`
)

function walkTs(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === "public") {
      continue
    }
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) {
      walkTs(full, out)
      continue
    }
    if (name.endsWith(".ts") || name.endsWith(".tsx")) out.push(full)
  }
  return out
}

const scopes = [
  join(REPO_ROOT, "app"),
  join(REPO_ROOT, "components"),
  join(REPO_ROOT, "lib"),
]
const offenders: string[] = []

for (const scope of scopes) {
  for (const file of walkTs(scope)) {
    const rel = relative(REPO_ROOT, file).replace(/\\/g, "/")
    if (ALLOWLIST[rel]) continue
    const source = readFileSync(file, "utf8")
    if (!PALETTE_PATTERN.test(source)) continue
    offenders.push(rel)
  }
}

assert.deepEqual(
  offenders,
  [],
  `Tailwind palette colour classes outside status-colours.ts:\n${offenders
    .map((f) => `  - ${f}`)
    .join("\n")}\n${AGENTS_HINT}`
)
console.log("ok — no unexpected palette colour classes under app/, components/, or lib/")

for (const [path, reason] of Object.entries(ALLOWLIST)) {
  assert.ok(reason.trim().length > 0, `allow-list reason required for ${path}`)
}
console.log(`ok — allow-list has ${Object.keys(ALLOWLIST).length} entries with reasons`)

console.log("\nstatus-colours-guard.selftest.ts: ok")
