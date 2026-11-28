/**
 * Guard (PH-7): dialogs and panels under app/ and components/ use dvh, never vh,
 * so Safari toolbars never hide their bottom. Reads repo files only (no database).
 */

import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const REPO_ROOT = join(import.meta.dirname, "../..")

const AGENTS_HINT =
  "Read docs/design-guide.md — PH-7 Pop-ups fit the visible screen."

/**
 * Paths relative to repo root → one-line reason.
 * Known gaps (Appendix A) PH-7: Background interview still uses vh.
 */
const ALLOWLIST: Record<string, string> = {
  // Known gaps row PH-7 — Background interview still uses vh heights
  "components/client-background/interview-page.tsx":
    "Known gaps PH-7: Background interview still uses vh; change with Ben when next worked on",
  // Known gaps row PH-7 — Background interview still uses vh heights
  "components/client-background/history-section.tsx":
    "Known gaps PH-7: Background interview still uses vh; change with Ben when next worked on",
}

/** Tailwind arbitrary value containing classic `vh` (not dvh / svh / lvh). */
const VH_ARBITRARY = /\[[^\]]*(?<![dsl])vh[^\]]*\]/g

/** Bare `100vh` (not `100dvh`). */
const BARE_100VH = /(?<![\w-])100vh(?![\w-])/g

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

const scopes = [join(REPO_ROOT, "app"), join(REPO_ROOT, "components")]
const offenders: { path: string; matches: string[] }[] = []

for (const scope of scopes) {
  for (const file of walkTs(scope)) {
    const rel = relative(REPO_ROOT, file).replace(/\\/g, "/")
    if (ALLOWLIST[rel]) continue
    const source = readFileSync(file, "utf8")
    const matches = [
      ...(source.match(VH_ARBITRARY) ?? []),
      ...(source.match(BARE_100VH) ?? []),
    ]
    if (matches.length === 0) continue
    offenders.push({ path: rel, matches })
  }
}

assert.deepEqual(
  offenders,
  [],
  `Classic vh viewport units under app/ or components/ (use dvh — PH-7):\n${offenders
    .map((o) => `  - ${o.path}: ${o.matches.join(", ")}`)
    .join("\n")}\n${AGENTS_HINT}`
)
console.log("ok — no unexpected vh viewport units under app/ or components/")

for (const [path, reason] of Object.entries(ALLOWLIST)) {
  assert.ok(reason.trim().length > 0, `allow-list reason required for ${path}`)
}
console.log(`ok — ${Object.keys(ALLOWLIST).length} allow-list entries have reasons`)
