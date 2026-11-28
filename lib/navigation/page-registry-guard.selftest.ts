/**
 * Guard: every typed page is registered; NV-2 default parents; no returnTo-era back API.
 * See design guide section 13 (NV-8).
 */

import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

import {
  listRegistryEntries,
  listRegistryKeys,
  matchRegistryKey,
  type PageRegistryKey,
} from "@/lib/navigation/page-registry"
import {
  parentRuleFor,
  type PageType,
} from "@/lib/navigation/page-types"

const REPO_ROOT = join(import.meta.dirname, "../..")

const EXCLUDED_PAGE_PATHS = new Set([
  "app/page.tsx",
  "app/login/page.tsx",
  "app/q/[token]/page.tsx",
  "app/clients/[client_id]/intake-interview/page.tsx",
])

function walkFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === "public") continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) {
      walkFiles(full, out)
      continue
    }
    out.push(full)
  }
  return out
}

function routeFromPageFile(rel: string): string {
  // app/clients/[client_id]/page.tsx → /clients/[client_id]
  const without = rel
    .replace(/^app/, "")
    .replace(/\/page\.tsx$/, "")
  return without === "" ? "/" : without
}

function findAppPages(): { rel: string; route: string }[] {
  const appDir = join(REPO_ROOT, "app")
  return walkFiles(appDir)
    .filter((f) => f.endsWith("/page.tsx") || f.endsWith("\\page.tsx"))
    .map((full) => {
      const rel = relative(REPO_ROOT, full).replace(/\\/g, "/")
      return { rel, route: routeFromPageFile(rel) }
    })
}

// --- 1 & 2: pages ↔ registry ---
{
  const pages = findAppPages()
  const registryKeys = new Set(listRegistryKeys())

  for (const { rel, route } of pages) {
    if (EXCLUDED_PAGE_PATHS.has(rel)) continue
    assert.ok(
      registryKeys.has(route as PageRegistryKey),
      `Page ${rel} (route ${route}) has no registry entry (NV-8)`
    )
  }

  const pageRoutes = new Set(
    pages
      .filter((p) => !EXCLUDED_PAGE_PATHS.has(p.rel))
      .map((p) => p.route)
  )
  for (const key of listRegistryKeys()) {
    assert.ok(
      pageRoutes.has(key),
      `Registry entry ${key} has no matching app/**/page.tsx`
    )
  }
}

// --- 3: default parent type matches NV-2 (with † exceptions) ---
{
  const sampleData = {
    clientId: "00000000-0000-0000-0000-000000000001",
    clientName: "Sample Client",
    appointmentId: "appt",
    appointmentDate: "2026-11-12",
    sessionNoteId: "note",
    sessionNoteDate: "2026-11-12",
    resultId: "res",
    resultDate: "2026-11-12",
    reportId: "rep",
    reportDate: "2026-11-12",
    claimId: "claim",
    approvalId: "approval",
    professionalId: "pro",
    professionalName: "Dr Sample",
    organisationId: "org",
    organisationName: "Sample Org",
    typeId: "type",
    typeName: "Standard",
    assessmentCode: "phq9",
    assessmentName: "PHQ-9",
    planId: "plan",
    membershipId: "mem",
    contactId: "contact",
    templateId: "tmpl",
    queryClientId: "00000000-0000-0000-0000-000000000001",
  }

  for (const entry of listRegistryEntries()) {
    const parent = entry.defaultParent(sampleData)
    if (!parent) {
      assert.ok(
        entry.type === "home" ||
          entry.type === "main-list" ||
          entry.menuEntity === true,
        `${entry.route}: missing default parent but type ${entry.type} requires one`
      )
      continue
    }

    const parentPath = parent.href.split("?")[0] ?? parent.href
    const parentKey = matchRegistryKey(parentPath)
    assert.ok(
      parentKey,
      `${entry.route}: default parent href ${parent.href} matches no registry page`
    )
    const parentEntry = listRegistryEntries().find((e) => e.route === parentKey)!
    const parentType: PageType = parentEntry.type
    const rule = parentRuleFor(entry.type, {
      formMode: entry.formMode,
      menuEntity: entry.menuEntity,
    })

    const allowed =
      rule.defaultParentTypes.includes(parentType) ||
      // New record-form may default to a list / entity / record the created item hangs from.
      (entry.formMode === "new" && rule.alsoAllowed.includes(parentType))

    if (!allowed) {
      assert.ok(
        entry.knownGapDefaultParent,
        `${entry.route}: default parent type "${parentType}" is not allowed by NV-2 for "${entry.type}"` +
          ` (mark knownGapDefaultParent if this is a † interim from 13B)`
      )
    }

    assert.notEqual(
      parent.label.trim(),
      "← Back",
      `${entry.route}: bare "← Back" label (NV-5)`
    )
    assert.ok(
      parent.label.startsWith("← Back to "),
      `${entry.route}: label must be "← Back to …" (NV-5), got ${parent.label}`
    )
  }
}

// --- 4: no router.back / history.back / old BackButton props ---
{
  const roots = [join(REPO_ROOT, "app"), join(REPO_ROOT, "components")]
  const files = roots.flatMap((dir) =>
    walkFiles(dir).filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
  )

  const banned = [
    { re: /\brouter\.back\s*\(/, msg: "router.back(" },
    { re: /\bhistory\.back\s*\(/, msg: "history.back(" },
    { re: /\bfallbackHref\s*=/, msg: "fallbackHref=" },
    {
      // BackButton … label=  (not other components)
      re: /<BackButton\b[^>]*\blabel\s*=/,
      msg: "BackButton label=",
    },
  ]

  const violations: string[] = []
  for (const full of files) {
    const rel = relative(REPO_ROOT, full).replace(/\\/g, "/")
    // The guard itself and docs may mention these.
    if (rel.includes("page-registry-guard.selftest.ts")) continue
    if (rel.includes("parent-memory.selftest.ts")) continue
    const text = readFileSync(full, "utf8")
    for (const { re, msg } of banned) {
      if (re.test(text)) {
        violations.push(`${rel}: ${msg}`)
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Forbidden back navigation patterns (NV-3.7 / NV-8):\n${violations.join("\n")}`
  )
}

console.log("page-registry-guard.selftest.ts: ok")
