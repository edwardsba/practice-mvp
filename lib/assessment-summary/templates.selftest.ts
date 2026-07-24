import assert from "node:assert/strict"

import { buildAssessmentSummaryParagraph } from "./templates"
import { AssessmentPoint } from "./stats"

function pts(scores: number[]): AssessmentPoint[] {
  return scores.map((score, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, "0")}`,
    score,
    sessionIndex: i + 1,
  }))
}

function check(name: string, actual: string | null, expected: string | null) {
  assert.equal(actual, expected, name)
  console.log(`ok — ${name}`)
}

check(
  "PHQ-9: zero submissions → null",
  buildAssessmentSummaryParagraph("PHQ9", pts([]), "Ben"),
  null
)

check(
  "PHQ-9: n=1",
  buildAssessmentSummaryParagraph("PHQ9", pts([10]), "Ben"),
  "Ben reported a PHQ-9 score of 10/27 (Moderate) at the only submission during this period."
)

check(
  "PHQ-9: all identical, n=4",
  buildAssessmentSummaryParagraph("PHQ9", pts([10, 10, 10, 10]), "Ben"),
  "Ben reported a consistent PHQ-9 score of 10/27 (Moderate) across all 4 submissions during this period."
)

check(
  "GAD-7: n=1",
  buildAssessmentSummaryParagraph("GAD7", pts([6]), "Ben"),
  "Ben reported a GAD-7 score of 6/21 (Mild) at the only submission during this period."
)

check(
  "GAD-7: all identical, n=3",
  buildAssessmentSummaryParagraph("GAD7", pts([6, 6, 6]), "Ben"),
  "Ben reported a consistent GAD-7 score of 6/21 (Mild) across all 3 submissions during this period."
)

check(
  "ASSIST: n=1 (uses 'an' article)",
  buildAssessmentSummaryParagraph("ASSIST", pts([2]), "Ben"),
  "Ben reported an ASSIST score of 2/39 (Lower Risk) at the only submission during this period."
)

check(
  "ASSIST: all identical, n=5 ('a consistent', not 'an consistent')",
  buildAssessmentSummaryParagraph("ASSIST", pts([2, 2, 2, 2, 2]), "Ben"),
  "Ben reported a consistent ASSIST score of 2/39 (Lower Risk) across all 5 submissions during this period."
)

// Same band, different score (8 and 9 are both "Mild") must NOT collapse —
// this should still go through the normal 3-sentence varying-scores path.
{
  const result = buildAssessmentSummaryParagraph(
    "PHQ9",
    pts([8, 9, 8, 9]),
    "Ben"
  )
  assert.ok(result !== null, "same-band-different-score should not be null")
  assert.ok(
    !result!.startsWith("Ben reported a consistent"),
    "same-band-different-score must not collapse to the identical-score sentence"
  )
  console.log("ok — PHQ-9: same band, different scores does not collapse")
}

check(
  "PHQ-9: n=2, real difference, no contradiction (regression test)",
  buildAssessmentSummaryParagraph("PHQ9", pts([9, 10]), "Ben"),
  "Ben reported PHQ-9 scores between 9/27 (Mild depression symptoms) and 10/27 (Moderate depression symptoms) across the referral period, with a mean score of 9.5/27 (Moderate depression symptoms) and a median score of 9.5/27 (Moderate depression symptoms) (n = 2). These scores were relatively consistent. The results moved from the Mild severity rating to the Moderate severity rating."
)

console.log("\nAll assessment-summary paragraph checks passed.")
