import assert from "node:assert/strict"

import {
  dependantTickFromDependency,
  dependencyAfterDependantTick,
  householdFromLivesWith,
} from "@/lib/client-background/household"
import { householdAloneContradiction } from "@/lib/client-background/interview-contradictions"
import type { DependencyValue, RelationshipRecord } from "@/lib/client-background/types"
import { formatReportLivesWithClause } from "@/lib/clients/background-summary"
import { tomExampleSource } from "@/lib/reports/tom-example-fixture"

function check(name: string, actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected, name)
  console.log(`ok — ${name}`)
}

function person(
  partial: Partial<RelationshipRecord> &
    Pick<RelationshipRecord, "relationshipRecordId" | "relationshipToClient">
): RelationshipRecord {
  return {
    relationshipBlockId: null,
    blockRole: "",
    blockRoleType: "",
    sex: "",
    displayOrder: 0,
    givenName: "",
    dateOfBirth: "",
    healthStatus: "",
    deceased: false,
    ageAtDeath: null,
    dateOfDeath: "",
    healthOrCauseOfDeath: "",
    childTypeDetail: "",
    supportive: "",
    conflict: "",
    qualityOfRelationship: "",
    dependency: "",
    livingSituation: "",
    caregiverRelationship: "",
    caregiverRelationshipDetail: "",
    notKnown: false,
    ...partial,
  }
}

// --- Household backfill (mirrors migration 0087) ---

check("backfill alone", householdFromLivesWith("alone"), "alone")
check("backfill no_fixed_address", householdFromLivesWith("no_fixed_address"), "no_fixed_address")
check(
  "backfill partner+children → with_others",
  householdFromLivesWith("with_partner_and_children"),
  "with_others"
)
check("backfill other → with_others", householdFromLivesWith("other"), "with_others")
check("backfill empty", householdFromLivesWith(""), "")
check("backfill null", householdFromLivesWith(null), "")

// --- Dependant tick mapping (all four starting values, tick and untick) ---

const DEPENDENCY_STARTS: DependencyValue[] = [
  "neither",
  "they_depend_on_me",
  "i_depend_on_them",
  "mutual",
]

for (const start of DEPENDENCY_STARTS) {
  const shown = dependantTickFromDependency(start)
  check(
    `tick shown for ${start}`,
    shown,
    start === "they_depend_on_me" || start === "mutual"
  )
  const afterTick = dependencyAfterDependantTick(start, true)
  const afterUntick = dependencyAfterDependantTick(start, false)
  if (start === "neither") {
    check("neither → tick → they_depend_on_me", afterTick, "they_depend_on_me")
    check("neither → untick → neither", afterUntick, "neither")
  } else if (start === "i_depend_on_them") {
    check("i_depend_on_them → tick → mutual", afterTick, "mutual")
    check("i_depend_on_them → untick → i_depend_on_them", afterUntick, "i_depend_on_them")
  } else if (start === "they_depend_on_me") {
    check("they_depend_on_me → tick → they_depend_on_me", afterTick, "they_depend_on_me")
    check("they_depend_on_me → untick → neither", afterUntick, "neither")
  } else {
    check("mutual → tick → mutual", afterTick, "mutual")
    check("mutual → untick → i_depend_on_them", afterUntick, "i_depend_on_them")
  }
}

check("empty dependency tick false", dependantTickFromDependency(""), false)
check("empty → tick → they_depend_on_me", dependencyAfterDependantTick("", true), "they_depend_on_me")

// --- Lives-with sentence from people + othersInHome ---

const tom = tomExampleSource()
const tomClause = formatReportLivesWithClause(
  tom.data.relationships,
  tom.data.relationshipBlocks ?? [],
  tom.data.demographics.livingSituation.othersInHome ?? [],
  tom.data.relationshipStatus.relationshipStatus
)
check("Tom lives-with clause", tomClause, "wife and children")

const othersOnly = formatReportLivesWithClause([], [], [
  { who: "Flatmate, Sam" },
  { who: "  " },
  { who: "Boarder" },
])
check("others only clause", othersOnly, "Flatmate, Sam and Boarder")

const partnerAndOther = formatReportLivesWithClause(
  [
    person({
      relationshipRecordId: "p1",
      relationshipToClient: "current_partner",
      sex: "Female",
      blockRole: "partner",
      livingSituation: "lives_with_client_full_time",
    }),
  ],
  [],
  [{ who: "Flatmate, Sam" }],
  "married"
)
check("partner + other in home", partnerAndOther, "wife and Flatmate, Sam")

// --- Section 7 contradiction rule ---

check(
  "alone + someone living",
  householdAloneContradiction({
    household: "alone",
    someoneLivesWithClient: true,
    othersInHomeCount: 0,
  }),
  true
)
check(
  "alone + others in home",
  householdAloneContradiction({
    household: "alone",
    someoneLivesWithClient: false,
    othersInHomeCount: 1,
  }),
  true
)
check(
  "alone + nobody",
  householdAloneContradiction({
    household: "alone",
    someoneLivesWithClient: false,
    othersInHomeCount: 0,
  }),
  false
)
check(
  "with_others + someone living is fine",
  householdAloneContradiction({
    household: "with_others",
    someoneLivesWithClient: true,
    othersInHomeCount: 0,
  }),
  false
)
check(
  "empty household no contradiction",
  householdAloneContradiction({
    household: "",
    someoneLivesWithClient: true,
    othersInHomeCount: 2,
  }),
  false
)

console.log("household.selftest.ts: ok")
