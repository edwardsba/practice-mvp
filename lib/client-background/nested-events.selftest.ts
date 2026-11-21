import assert from "node:assert/strict"

import { buildHistoryTree } from "@/lib/client-background/history-tree"
import { mixedIssueEvents, otherEventsForIssue } from "@/lib/client-background/history-issues"
import { emptyEvent, emptyHistoryIssue, type EventRecord } from "@/lib/client-background/types"

function event(partial: Partial<EventRecord> & Pick<EventRecord, "eventRecordId" | "eventType">): EventRecord {
  return { ...emptyEvent(partial.eventType, partial.displayOrder ?? 0), ...partial }
}

const overdose = event({
  eventRecordId: "od",
  eventType: "self_harm",
  title: "Overdose",
  startPrecision: "year",
  startValue: "1988",
  about: "self",
})
const edVisit = event({
  eventRecordId: "ed",
  eventType: "psychiatric_admission",
  title: "",
  admissionType: "emergency_department",
  startPrecision: "year",
  startValue: "1988",
  parentEventId: "od",
  about: "self",
})
const lostJob = event({
  eventRecordId: "job",
  eventType: "other_event",
  title: "Lost job",
  startPrecision: "year",
  startValue: "2001",
  conditionGroupId: "issue-dep",
  about: "self",
})
const depEpisode = event({
  eventRecordId: "ep1",
  eventType: "emotional_problems",
  title: "Depression",
  startPrecision: "year",
  startValue: "2000",
  conditionGroupId: "issue-dep",
  about: "self",
})

const mixed = mixedIssueEvents([depEpisode, lostJob], "issue-dep", "1970-03-12")
assert.equal(mixed.length, 2)
assert.equal(mixed[0].kind, "episode")
assert.equal(mixed[1].kind, "other")
assert.equal(otherEventsForIssue([lostJob], "issue-dep").length, 1)

const tree = buildHistoryTree({
  events: [overdose, edVisit, depEpisode, lostJob],
  relationships: [],
  dateOfBirth: "1970-03-12",
  screening: { self_harm: "yes", emotional_problems: "yes" },
  issues: [{ issueId: "issue-dep", ...emptyHistoryIssue("emotional_problems", "self", 0), title: "Depression" }],
})

const selfHarm = tree.client.children.find((node) => node.kind === "section" && node.title === "Self-harm")
assert.ok(selfHarm && selfHarm.kind === "section")
const odRow = selfHarm.children.find((node) => node.kind === "row" && node.id === "od")
assert.ok(odRow && odRow.kind === "row")
const nested = odRow.children.find((node) => node.kind === "row" && node.id === "ed")
assert.ok(nested && nested.kind === "row")
assert.equal(nested.tag, "Treatment")

const mental = tree.client.children.find((node) => node.kind === "section" && node.title === "Mental health")
assert.ok(mental && mental.kind === "section")
const band = mental.children.find((node) => node.kind === "band" && node.id === "issue-dep")
assert.ok(band && band.kind === "band")
const otherRow = band.children.find((node) => node.kind === "row" && node.tag === "Other")
assert.ok(otherRow)

console.log("nested-events.selftest.ts: ok")
