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

let n = 0
const plan = planConditionBackfill(
  events.map((event) => ({ clientId: "tom", event })),
  () => `group-${n++}`
)
assert.equal(plan.groupsMade, 6)
const depressionIds = plan.assignments.filter((row) => row.eventRecordId.startsWith("tom-depression")).map((row) => row.conditionGroupId)
assert.equal(depressionIds.length, 2)
assert.equal(depressionIds[0], depressionIds[1])
const alcohol = plan.assignments.find((row) => row.eventRecordId === "tom-alcohol")
const leg = plan.assignments.find((row) => row.eventRecordId === "tom-leg")
assert.ok(alcohol && leg)
assert.notEqual(alcohol.conditionGroupId, leg.conditionGroupId)
assert.notEqual(depressionIds[0], alcohol.conditionGroupId)
assert.equal(plan.byClient[0]?.groups, 6)

console.log("condition groups selftest passed")
