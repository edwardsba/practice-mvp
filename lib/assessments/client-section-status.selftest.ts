import assert from "node:assert/strict"

import { applyClientVisitSectionStatuses } from "@/lib/assessments/client-section-status"
import type { SectionStatus } from "@/lib/section-status"

function section(
  patch: Partial<SectionStatus> & Pick<SectionStatus, "groupLabel" | "letter" | "title" | "status">
): SectionStatus {
  return {
    left: 0,
    toConfirm: 0,
    hasDefaults: false,
    ...patch,
  }
}

const base: SectionStatus[] = [
  section({
    groupLabel: "About you",
    letter: "1",
    title: "About you",
    status: "done",
  }),
  section({
    groupLabel: "Work",
    letter: "2",
    title: "Work",
    status: "done",
  }),
  section({
    groupLabel: "Health",
    letter: "3",
    title: "Health",
    status: "done",
    left: 1,
  }),
  section({
    groupLabel: "Hidden",
    letter: "4",
    title: "Hidden",
    status: "skipped",
  }),
]

// Fresh form on section 1: current amber, others grey (even though base said done).
{
  const next = applyClientVisitSectionStatuses(base, {
    currentGroupLabel: "About you",
    visitedGroupLabels: new Set(),
  })
  assert.equal(next[0]?.status, "left")
  assert.equal(next[1]?.status, "not_started")
  assert.equal(next[2]?.status, "left")
  assert.equal(next[2]?.left, 1)
  assert.equal(next[3]?.status, "skipped")
}

// After leaving section 1 with Next: visited → done; current Work → attention.
{
  const next = applyClientVisitSectionStatuses(base, {
    currentGroupLabel: "Work",
    visitedGroupLabels: new Set(["About you"]),
  })
  assert.equal(next[0]?.status, "done")
  assert.equal(next[1]?.status, "left")
  assert.equal(next[1]?.left, 0)
}

// Visited section with required unanswered stays attention with count.
{
  const next = applyClientVisitSectionStatuses(base, {
    currentGroupLabel: "About you",
    visitedGroupLabels: new Set(["Health"]),
  })
  assert.equal(next[2]?.status, "left")
  assert.equal(next[2]?.left, 1)
}

console.log("client-section-status.selftest: ok")
