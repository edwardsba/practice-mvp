import assert from "node:assert/strict"

import { buildMseProgressReportParagraph } from "./mse-template"
import type { MseReportResultRow } from "@/lib/reports/snapshot"

function baseline(value: string) {
  return { value, isBaseline: true as const }
}

function abnormal(value: string) {
  return { value, isBaseline: false as const }
}

function allNormalSession(date: string): MseReportResultRow {
  return {
    date,
    fields: {
      appearance: baseline("Neat"),
      behaviour: baseline("Cooperative"),
      eyeContact: baseline("Normal"),
      motorActivity: baseline("Normal"),
      affect: baseline("Full"),
      hallucination: baseline("None"),
      depersonalisationDerealisation: baseline("None"),
      homicidality: baseline("None"),
      delusions: baseline("None"),
      orientation: baseline("None"),
      memory: baseline("None"),
      attention: baseline("Normal"),
      insight: baseline("Good"),
      judgement: baseline("Good"),
    },
  }
}

function assertParagraph(
  name: string,
  sessions: MseReportResultRow[],
  expected: string | null
) {
  const actual = buildMseProgressReportParagraph(sessions)
  assert.equal(actual, expected, name)
  console.log(`ok — ${name}`)
}

assertParagraph("zero sessions → null (fallback at letter-body layer)", [], null)

assertParagraph(
  "all sessions consistently normal",
  [
    allNormalSession("2026-01-01"),
    allNormalSession("2026-01-08"),
    allNormalSession("2026-01-15"),
  ],
  "Appearance, behaviour, eye contact, motor activity and affect were all consistently within expected limits. Perceptions, thoughts and cognitions were all consistently within expected limits. Insight and judgement were both consistently good."
)

{
  const sessions = [
    allNormalSession("2026-01-01"),
    {
      ...allNormalSession("2026-01-08"),
      fields: {
        ...allNormalSession("2026-01-08").fields,
        appearance: abnormal("Dishevelled"),
      },
    },
    {
      ...allNormalSession("2026-01-15"),
      fields: {
        ...allNormalSession("2026-01-15").fields,
        appearance: abnormal("Dishevelled"),
      },
    },
    allNormalSession("2026-01-22"),
    allNormalSession("2026-01-29"),
    allNormalSession("2026-02-05"),
    allNormalSession("2026-02-12"),
    allNormalSession("2026-02-19"),
    allNormalSession("2026-02-26"),
  ]
  assertParagraph(
    "one Presentation field varying",
    sessions,
    "Behaviour, eye contact, motor activity and affect were all consistently within expected limits. Appearance was dishevelled on 2 of 9 sessions. Perceptions, thoughts and cognitions were all consistently within expected limits. Insight and judgement were both consistently good."
  )
}

{
  const sessions = [
    allNormalSession("2026-01-01"),
    {
      ...allNormalSession("2026-01-08"),
      fields: {
        ...allNormalSession("2026-01-08").fields,
        memory: abnormal("Short-Term"),
      },
    },
    {
      ...allNormalSession("2026-01-15"),
      fields: {
        ...allNormalSession("2026-01-15").fields,
        memory: abnormal("Short-Term"),
      },
    },
    allNormalSession("2026-01-22"),
  ]
  assertParagraph(
    "one Mental Function secondary group with a single member field varying",
    sessions,
    "Appearance, behaviour, eye contact, motor activity and affect were all consistently within expected limits. Perceptions and thoughts were consistently within expected limits. Cognitions included short-term memory impairment on 2 of 4 sessions. Insight and judgement were both consistently good."
  )
}

{
  const sessions = [
    allNormalSession("2026-01-01"),
    {
      ...allNormalSession("2026-01-08"),
      fields: {
        ...allNormalSession("2026-01-08").fields,
        appearance: abnormal("Dishevelled"),
      },
    },
    {
      ...allNormalSession("2026-01-15"),
      fields: {
        ...allNormalSession("2026-01-15").fields,
        appearance: abnormal("Bizarre"),
      },
    },
    {
      ...allNormalSession("2026-01-22"),
      fields: {
        ...allNormalSession("2026-01-22").fields,
        appearance: abnormal("Dishevelled"),
      },
    },
    allNormalSession("2026-01-29"),
    allNormalSession("2026-02-05"),
    allNormalSession("2026-02-12"),
    allNormalSession("2026-02-19"),
    allNormalSession("2026-02-26"),
  ]
  // displayOrder: Dishevelled before Bizarre
  assertParagraph(
    "field with two distinct abnormal values (displayOrder join)",
    sessions,
    "Behaviour, eye contact, motor activity and affect were all consistently within expected limits. Appearance was dishevelled on 2 of 9 sessions and bizarre on 1 of 9 sessions. Perceptions, thoughts and cognitions were all consistently within expected limits. Insight and judgement were both consistently good."
  )
}

{
  const withSuicidalityNoise = allNormalSession("2026-01-01")
  // Suicidality is not part of the typed field set — injecting it must not affect output
  ;(withSuicidalityNoise.fields as Record<string, { value: string; isBaseline: boolean }>).suicidality =
    { value: "Ideation", isBaseline: false }

  assert.equal(
    buildMseProgressReportParagraph([withSuicidalityNoise]),
    buildMseProgressReportParagraph([allNormalSession("2026-01-01")])
  )
  console.log("ok — suicidality noise has zero effect")
}

console.log("\nAll MSE progress-report aggregation checks passed.")
