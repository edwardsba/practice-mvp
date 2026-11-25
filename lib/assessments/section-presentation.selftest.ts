import assert from "node:assert/strict"

import {
  hasLetterSectionPrefix,
  presentSectionLabels,
  UNGROUPED_SECTION_KEY,
} from "@/lib/assessments/section-presentation"

function check(name: string, actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected, name)
  console.log(`ok — ${name}`)
}

check("A. Reason… has letter prefix", hasLetterSectionPrefix("A. Reason for completing"), true)
check("Depression has no letter prefix", hasLetterSectionPrefix("Depression"), false)
check("empty has no letter prefix", hasLetterSectionPrefix(""), false)

check(
  "no labels → one ungrouped section, no progress bar",
  presentSectionLabels([]),
  {
    showProgressBar: false,
    sections: [
      { groupLabel: UNGROUPED_SECTION_KEY, badge: "1", title: "" },
    ],
  }
)

check(
  "lettered LRAMP-style labels",
  presentSectionLabels([
    "A. Reason for completing",
    "B. Type of assessment conducted",
  ]),
  {
    showProgressBar: true,
    sections: [
      {
        groupLabel: "A. Reason for completing",
        badge: "A",
        title: "Reason for completing",
      },
      {
        groupLabel: "B. Type of assessment conducted",
        badge: "B",
        title: "Type of assessment conducted",
      },
    ],
  }
)

check(
  "plain labels → numbers and full title",
  presentSectionLabels(["Mood", "Anxiety", "Sleep"]),
  {
    showProgressBar: true,
    sections: [
      { groupLabel: "Mood", badge: "1", title: "Mood" },
      { groupLabel: "Anxiety", badge: "2", title: "Anxiety" },
      { groupLabel: "Sleep", badge: "3", title: "Sleep" },
    ],
  }
)

check(
  "mixed: lettered keep letter; plain get index number",
  presentSectionLabels(["A. First", "Other topics", "C. Third"]),
  {
    showProgressBar: true,
    sections: [
      { groupLabel: "A. First", badge: "A", title: "First" },
      { groupLabel: "Other topics", badge: "2", title: "Other topics" },
      { groupLabel: "C. Third", badge: "C", title: "Third" },
    ],
  }
)

console.log("section-presentation.selftest.ts: ok")
