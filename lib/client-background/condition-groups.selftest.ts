import assert from "node:assert/strict"

import { conditionGroups, matchingConditionGroup, planConditionBackfill } from "@/lib/client-background/condition-groups"
import { emptyEvent, type EventRecord } from "@/lib/client-background/types"
import { tomEvents } from "@/lib/reports/tom-example-fixture"

const events = tomEvents()
const groups = conditionGroups(events, "1970-03-12")
const depression = groups.find((group) => group.title === "Depression" && group.personKey === "self")
assert.ok(depression)
assert.deepEqual(
  depression.episodes.map((episode) => episode.eventRecordId),
  ["tom-depression-1", "tom-depression-2"]
)
assert.equal(groups.filter((group) => group.title === "Alcohol" && group.personKey === "self").length, 1)
assert.equal(groups.filter((group) => group.title === "Broken leg").length, 1)

const draft: EventRecord = { ...emptyEvent("emotional_problems", 0), eventRecordId: "new", title: "depression" }
const match = matchingConditionGroup(events, draft, "1970-03-12")
assert.equal(match?.id, depression.id)

const separate: EventRecord = { ...emptyEvent("emotional_problems", 0), eventRecordId: "new-anxiety", title: "Anxiety" }
assert.equal(matchingConditionGroup(events, separate, "1970-03-12"), null)

// Tom fixture already has condition_group_id / issue ids — nothing left to backfill.
let n = 0
const plan = planConditionBackfill(
  events.map((event) => ({ clientId: "tom", event })),
  () => `group-${n++}`
)
assert.equal(plan.groupsMade, 0)
assert.equal(plan.assignments.length, 0)

const ungrouoped = events.map((event) => ({
  ...event,
  conditionGroupId: null as string | null,
}))
n = 0
const refill = planConditionBackfill(
  ungrouoped.map((event) => ({ clientId: "tom", event })),
  () => `group-${n++}`
)
assert.equal(refill.groupsMade, 5)
const depressionIds = refill.assignments
  .filter((row) => row.eventRecordId.startsWith("tom-depression"))
  .map((row) => row.conditionGroupId)
assert.equal(depressionIds.length, 2)
assert.equal(depressionIds[0], depressionIds[1])
const alcohol = refill.assignments.find((row) => row.eventRecordId === "tom-alcohol")
const leg = refill.assignments.find((row) => row.eventRecordId === "tom-leg")
assert.ok(alcohol && leg)
assert.notEqual(alcohol.conditionGroupId, leg.conditionGroupId)
assert.notEqual(depressionIds[0], alcohol.conditionGroupId)
assert.equal(refill.byClient[0]?.groups, 5)

console.log("condition groups selftest passed")
