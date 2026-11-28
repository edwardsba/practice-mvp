/**
 * Guard: no assessment-specific radio UIs outside the allow-list.
 * Reads repo files only (no database). See AGENTS.md —
 * "Assessments: one shared form, one shared results view."
 */

import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const REPO_ROOT = join(import.meta.dirname, "../..")

const AGENTS_HINT =
  "Read AGENTS.md — Assessments: one shared form, one shared results view."

/** Paths relative to repo root → one-line reason. */
const RADIO_ALLOWLIST: Record<string, string> = {
  "components/assessments/form/radio-option-list.tsx":
    "Shared assessment radio list",
  "components/assessments/form/element-control.tsx":
    "Shared form control (delegates to radio-option-list)",
  "components/assessments/form/list-entry-input.tsx":
    "Shared person_list / history_list entry editor (uses radio-option-list)",
  "components/ui/radio-group.tsx": "shadcn RadioGroup primitive",
  "components/ui/dropdown-menu.tsx":
    "shadcn DropdownMenuRadioGroup primitive (non-assessment)",
  "components/treatment-plan/form-fields.tsx":
    "Treatment-plan single-select fields (non-assessment)",
  "components/funding/funding-approval-form.tsx":
    "Funding approval form radios (non-assessment)",
  "components/client-background/relationship-panel-shared.tsx":
    "Relationship panel radios (non-assessment)",
  "app/clients/[client_id]/reports/new/report-form.tsx":
    "Report form recipient radios (non-assessment)",
  "app/q/[token]/background-questionnaire-form.tsx":
    "Held: Background self-report moves later",
}

const RADIO_PATTERN =
  /\bRadioGroup\b|type\s*=\s*["']radio["']|type:\s*["']radio["']/

function walkTsx(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === "public") {
      continue
    }
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) {
      walkTsx(full, out)
      continue
    }
    if (name.endsWith(".tsx")) out.push(full)
  }
  return out
}

const scopes = [join(REPO_ROOT, "app"), join(REPO_ROOT, "components")]
const offenders: string[] = []

for (const scope of scopes) {
  for (const file of walkTsx(scope)) {
    const rel = relative(REPO_ROOT, file).replace(/\\/g, "/")
    const source = readFileSync(file, "utf8")
    if (!RADIO_PATTERN.test(source)) continue
    if (RADIO_ALLOWLIST[rel]) continue
    offenders.push(rel)
  }
}

assert.deepEqual(
  offenders,
  [],
  `Radio UI outside allow-list:\n${offenders.map((f) => `  - ${f}`).join("\n")}\n${AGENTS_HINT}`
)
console.log("ok — no unexpected radio UI under app/ or components/")

for (const [path, reason] of Object.entries(RADIO_ALLOWLIST)) {
  assert.ok(reason.trim().length > 0, `allow-list reason required for ${path}`)
}
console.log(`ok — allow-list has ${Object.keys(RADIO_ALLOWLIST).length} entries with reasons`)

console.log("\nshared-form-guard.selftest.ts: ok")
