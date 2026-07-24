import assert from "node:assert/strict"

import { buildBtpSummaryParagraphs } from "./btp-template"
import type { BtpReportResultRow } from "@/lib/reports/snapshot"

function row(date: string, target: string, score: number): BtpReportResultRow {
  return {
    assessmentResultId: `result-${date}`,
    date,
    targets: [{ target, score, ratingLabel: String(score) }],
  }
}

function check(name: string, actual: string | undefined, expected: string) {
  assert.equal(actual, expected, name)
  console.log(`ok — ${name}`)
}

{
  const result = buildBtpSummaryParagraphs(
    [row("2026-01-01", "Weekly NA attendance", 4)],
    "Ben"
  )
  check(
    "n=1",
    result[0]?.paragraph,
    "For the behavioural target: Weekly NA attendance. Ben rated their effectiveness at 4/5 (Effective most of the time) at the only submission during this period."
  )
}

{
  const result = buildBtpSummaryParagraphs(
    [
      row("2026-01-01", "Weekly NA attendance", 5),
      row("2026-01-08", "Weekly NA attendance", 5),
      row("2026-01-15", "Weekly NA attendance", 5),
      row("2026-01-22", "Weekly NA attendance", 5),
    ],
    "Ben"
  )
  check(
    "all identical, n=4",
    result[0]?.paragraph,
    "For the behavioural target: Weekly NA attendance. Ben rated their effectiveness at a consistent 5/5 (Always effective) across all 4 submissions during this period."
  )
}

{
  const result = buildBtpSummaryParagraphs(
    [
      row("2026-01-01", "Complete abstinence from methamphetamines", 5),
      row("2026-01-08", "Complete abstinence from methamphetamines", 3),
      row("2026-01-15", "Complete abstinence from methamphetamines", 5),
    ],
    "Ben"
  )
  check(
    "varying, n=3, median band now shown",
    result[0]?.paragraph,
    "For the behavioural target: Complete abstinence from methamphetamines. Across the referral period, Ben rated their effectiveness between 3/5 (Effective about half the time) and 5/5 (Always effective), with a mean rating of 4.3/5 (Effective most of the time) and a median rating of 5/5 (Always effective) (n = 3). These ratings demonstrate moderate variability, dipping midway through the referral period and then rising again. The results started in the Always effective rating, dipped into the Effective about half the time rating, then rose to the Always effective rating."
  )
}

console.log("\nAll BTP summary paragraph checks passed.")
