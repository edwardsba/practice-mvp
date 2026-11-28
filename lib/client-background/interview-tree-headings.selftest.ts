import assert from "node:assert/strict"

import { INTERVIEW_SECTIONS, isQuestionKind } from "@/lib/client-background/interview-answers"
import { HISTORY_QUESTION_KEYS } from "@/lib/client-background/interview-history"
import {
  headingAddNeedsYes,
  interviewItemKeyForTreeHeading,
  interviewYesItemForTreeHeading,
  RELATIONSHIP_TREE_HEADINGS,
} from "@/lib/client-background/interview-tree-headings"

function check(name: string, actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected, name)
  console.log(`ok — ${name}`)
}

check(
  "relationship heading map",
  Object.fromEntries(
    RELATIONSHIP_TREE_HEADINGS.map((heading) => [
      heading,
      interviewItemKeyForTreeHeading({ tree: "relationships", heading }),
    ])
  ),
  {
    current: "s5_current",
    previous: "s5_previous",
    children: "s5_children",
    biological_parents: "s6_biological_parents",
    mother_other: "s6_mother_other",
    father_other: "s6_father_other",
    caregiver: "s6_caregiver",
    siblings: "s6_siblings",
  }
)

check(
  "history client heading → s8",
  interviewItemKeyForTreeHeading({ tree: "history", screeningKey: "self_harm" }),
  "s8_self_harm"
)
check(
  "history family heading → s9",
  interviewItemKeyForTreeHeading({ tree: "history", screeningKey: "family_substance_use" }),
  "s9_family_substance_use"
)

function sectionItemKeys(number: number): string[] {
  return INTERVIEW_SECTIONS.find((section) => section.number === number)!.items.map((item) => item.key)
}

// Sections 5, 6, 8 and 9 have no flat item list: every item needs a heading.
const relationshipKeys = RELATIONSHIP_TREE_HEADINGS.map((heading) =>
  interviewItemKeyForTreeHeading({ tree: "relationships", heading })
)
check(
  "every section 5 and 6 item has a relationship heading",
  [...sectionItemKeys(5), ...sectionItemKeys(6)].sort(),
  [...relationshipKeys].sort()
)
const historyKeys = HISTORY_QUESTION_KEYS.map((screeningKey) =>
  interviewItemKeyForTreeHeading({ tree: "history", screeningKey })
)
check(
  "every section 8 and 9 item has a history heading",
  [...sectionItemKeys(8), ...sectionItemKeys(9)].sort(),
  [...historyKeys].sort()
)

check(
  "⊕ under Current answers s5_current",
  interviewYesItemForTreeHeading({ tree: "relationships", heading: "current" }),
  "s5_current"
)
check(
  "⊕ under Mother · other answers s6_mother_other",
  interviewYesItemForTreeHeading({ tree: "relationships", heading: "mother_other" }),
  "s6_mother_other"
)
check(
  "Biological parents is details — no Yes",
  interviewYesItemForTreeHeading({ tree: "relationships", heading: "biological_parents" }),
  null
)
check(
  "⊕ under a history heading answers its item",
  interviewYesItemForTreeHeading({ tree: "history", screeningKey: "family_illness" }),
  "s9_family_illness"
)

for (const heading of RELATIONSHIP_TREE_HEADINGS) {
  const key = interviewItemKeyForTreeHeading({ tree: "relationships", heading })!
  const item = INTERVIEW_SECTIONS.flatMap((section) => section.items).find((row) => row.key === key)!
  const yes = interviewYesItemForTreeHeading({ tree: "relationships", heading })
  assert.equal(yes !== null, isQuestionKind(item.kind), `Yes item only for questions (${heading})`)
}
console.log("ok — Yes item only for question kinds")

check("no answer → ⊕ writes Yes", headingAddNeedsYes(undefined), true)
check("No → ⊕ writes Yes", headingAddNeedsYes({ value: "no", confirmed: true }), true)
check("pre-filled Yes → ⊕ confirms it", headingAddNeedsYes({ value: "yes", confirmed: false }), true)
check("confirmed Yes → nothing to write", headingAddNeedsYes({ value: "yes", confirmed: true }), false)

console.log("\ninterview-tree-headings.selftest.ts: ok")
