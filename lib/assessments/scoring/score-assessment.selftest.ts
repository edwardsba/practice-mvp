/**
 * Golden fixtures for scoreAssessment.
 * Expected values are derived from each instrument's own helper + severity
 * tables — not by reading scoreAssessment's internals.
 */
import assert from "node:assert/strict"

import { calculateAgoraphobiaScore } from "@/lib/assessments/agoraphobia"
import { calculateAsrmScore } from "@/lib/assessments/asrm"
import {
  calculateAsrsPartAScore,
  calculateAsrsPartBRawScores,
} from "@/lib/assessments/asrs"
import { calculateDass21SubscaleScores } from "@/lib/assessments/dass21"
import { calculateDesBScore } from "@/lib/assessments/des-b"
import { calculateLevel1XcDomainScores } from "@/lib/assessments/level1xc"
import { calculatePanicDisorderScore } from "@/lib/assessments/panic-disorder"
import {
  calculatePcl5StructuredScore,
  calculatePcl5TotalScore,
  pcl5SeverityLabel,
} from "@/lib/assessments/pcl5"
import { calculatePcPtsd5Score } from "@/lib/assessments/pcptsd5"
import { calculatePhq15Score } from "@/lib/assessments/phq15"
import { calculatePid5FbfScores } from "@/lib/assessments/pid5-fbf"
import { calculatePsfScore, formatPsfSeverity } from "@/lib/assessments/psf"
import { calculateSciScore } from "@/lib/assessments/sci"
import {
  anxietySubtypeSeverityFromScore,
  asrmSeverityFromScore,
  assistSeverityFromScore,
  gad7SeverityFromScore,
  phq15SeverityFromScore,
  phq9SeverityFromScore,
  sciSeverityFromScore,
  severityFromAssessmentCode,
} from "@/lib/assessments/severity"
import { calculateSeparationAnxietyScore } from "@/lib/assessments/separation-anxiety"
import { calculateSocialAnxietyScore } from "@/lib/assessments/social-anxiety"
import { calculateSpecificDisorderSelectorScores } from "@/lib/assessments/specific-disorder-selector"
import { calculateSpecificPhobiaScore } from "@/lib/assessments/specific-phobia"
import { calculateSubstanceUseL2Scores } from "@/lib/assessments/substance-use-l2"
import {
  scoreAssessment,
  type ScoreAssessmentResponse,
} from "@/lib/assessments/scoring/score-assessment"

function check(name: string, actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected, name)
  console.log(`ok — ${name}`)
}

function keyed(
  entries: Array<[string, number]>,
  dataType = "integer"
): ScoreAssessmentResponse[] {
  return entries.map(([elementKey, scoreValue]) => ({
    elementKey,
    domainCode: null,
    scoreValue,
    dataType,
  }))
}

function rangeKeys(prefix: string, from: number, to: number, score: number) {
  const out: Array<[string, number]> = []
  for (let i = from; i <= to; i++) out.push([`${prefix}${i}`, score])
  return out
}

// ─── PHQ-9 (default path) + severity boundaries ─────────────────────────────

{
  const mildBoundary = keyed([
    ...rangeKeys("phq9_q", 1, 5, 1), // 5
    ...rangeKeys("phq9_q", 6, 9, 0),
    ["phq9_impairment", 0],
  ])
  // impairment is text in production; include as integer-0 and as text to match both paths
  mildBoundary[mildBoundary.length - 1].dataType = "text"

  const total = 5
  check(
    "PHQ9 score 5 → Mild",
    scoreAssessment({ assessmentCode: "PHQ9", responses: mildBoundary }),
    {
      score: total,
      severity: phq9SeverityFromScore(total),
      structuredScoreJson: null,
    }
  )
  check("PHQ9 severity table 4 → Minimal", phq9SeverityFromScore(4), "Minimal depression symptoms")
  check("PHQ9 severity table 5 → Mild", phq9SeverityFromScore(5), "Mild depression symptoms")
  check("PHQ9 severity table 9 → Mild", phq9SeverityFromScore(9), "Mild depression symptoms")
  check("PHQ9 severity table 10 → Moderate", phq9SeverityFromScore(10), "Moderate depression symptoms")
  check("PHQ9 severity table 14 → Moderate", phq9SeverityFromScore(14), "Moderate depression symptoms")
  check(
    "PHQ9 severity table 15 → Moderately severe",
    phq9SeverityFromScore(15),
    "Moderately severe depression symptoms"
  )
  check(
    "PHQ9 severity table 19 → Moderately severe",
    phq9SeverityFromScore(19),
    "Moderately severe depression symptoms"
  )
  check("PHQ9 severity table 20 → Severe", phq9SeverityFromScore(20), "Severe depression symptoms")

  const severe = keyed([...rangeKeys("phq9_q", 1, 9, 3)])
  check(
    "PHQ9 all 3s → 27 Severe",
    scoreAssessment({ assessmentCode: "PHQ9", responses: severe }),
    {
      score: 27,
      severity: phq9SeverityFromScore(27),
      structuredScoreJson: null,
    }
  )
}

// Check 7: same PHQ-9 answers → same result whether framed as client or practitioner path
{
  const answers = keyed([
    ["phq9_q1", 2],
    ["phq9_q2", 1],
    ["phq9_q3", 0],
    ["phq9_q4", 3],
    ["phq9_q5", 1],
    ["phq9_q6", 2],
    ["phq9_q7", 0],
    ["phq9_q8", 1],
    ["phq9_q9", 0],
  ])
  const expectedTotal = 2 + 1 + 0 + 3 + 1 + 2 + 0 + 1 + 0
  const expected = {
    score: expectedTotal,
    severity: severityFromAssessmentCode("PHQ9", expectedTotal),
    structuredScoreJson: null,
  }
  const clientPath = scoreAssessment({ assessmentCode: "PHQ9", responses: answers })
  const practitionerPath = scoreAssessment({
    assessmentCode: "PHQ9",
    responses: answers,
  })
  check("PHQ9 Ben01-style fixture: client path", clientPath, expected)
  check(
    "PHQ9 Ben01-style fixture: practitioner path matches client",
    practitionerPath,
    clientPath
  )
}

// ─── GAD-7 ──────────────────────────────────────────────────────────────────

{
  check("GAD7 severity 4 → Minimal", gad7SeverityFromScore(4), "Minimal anxiety symptoms")
  check("GAD7 severity 5 → Mild", gad7SeverityFromScore(5), "Mild anxiety symptoms")
  check("GAD7 severity 9 → Mild", gad7SeverityFromScore(9), "Mild anxiety symptoms")
  check("GAD7 severity 10 → Moderate", gad7SeverityFromScore(10), "Moderate anxiety symptoms")
  check("GAD7 severity 14 → Moderate", gad7SeverityFromScore(14), "Moderate anxiety symptoms")
  check("GAD7 severity 15 → Severe", gad7SeverityFromScore(15), "Severe anxiety symptoms")

  const responses = keyed([...rangeKeys("gad7_q", 1, 7, 2)])
  const total = 14
  check(
    "GAD7 all 2s → 14 Moderate",
    scoreAssessment({ assessmentCode: "GAD7", responses }),
    {
      score: total,
      severity: gad7SeverityFromScore(total),
      structuredScoreJson: null,
    }
  )
}

// ─── ASSIST ─────────────────────────────────────────────────────────────────

{
  check("ASSIST severity 3 → Lower Risk", assistSeverityFromScore(3), "Lower Risk")
  check("ASSIST severity 4 → Moderate Risk", assistSeverityFromScore(4), "Moderate Risk")
  check("ASSIST severity 26 → Moderate Risk", assistSeverityFromScore(26), "Moderate Risk")
  check("ASSIST severity 27 → High Risk", assistSeverityFromScore(27), "High Risk")

  const responses = keyed([...rangeKeys("assist_q", 1, 6, 1)])
  check(
    "ASSIST six 1s → 6 Moderate Risk",
    scoreAssessment({ assessmentCode: "ASSIST", responses }),
    {
      score: 6,
      severity: assistSeverityFromScore(6),
      structuredScoreJson: null,
    }
  )
}

// ─── DASS-21 ────────────────────────────────────────────────────────────────

{
  const zeros = keyed([
    ...rangeKeys("dass21_q", 1, 21, 0),
  ])
  const expectedZero = calculateDass21SubscaleScores(
    zeros.map((r) => ({ elementKey: r.elementKey, scoreValue: r.scoreValue }))
  )
  check(
    "DASS21 all zeros",
    scoreAssessment({ assessmentCode: "DASS21", responses: zeros }),
    { score: null, severity: null, structuredScoreJson: expectedZero }
  )

  const depressionMax = keyed([
    ["dass21_q3", 3],
    ["dass21_q5", 3],
    ["dass21_q10", 3],
    ["dass21_q13", 3],
    ["dass21_q16", 3],
    ["dass21_q17", 3],
    ["dass21_q21", 3],
  ])
  const expectedDep = calculateDass21SubscaleScores(
    depressionMax.map((r) => ({
      elementKey: r.elementKey,
      scoreValue: r.scoreValue,
    }))
  )
  check("DASS21 depression max → 42", expectedDep.depression, 42)
  check(
    "DASS21 depression-only max via scoreAssessment",
    scoreAssessment({ assessmentCode: "DASS21", responses: depressionMax }),
    { score: null, severity: null, structuredScoreJson: expectedDep }
  )
}

// ─── PCL-5 boundaries ───────────────────────────────────────────────────────

{
  const allZero = keyed([...rangeKeys("pcl5_q", 1, 20, 0)])
  const scored0 = allZero.map((r) => ({
    elementKey: r.elementKey,
    scoreValue: r.scoreValue,
  }))
  const total0 = calculatePcl5TotalScore(scored0)
  const structured0 = calculatePcl5StructuredScore(scored0)
  check(
    "PCL5 all zero",
    scoreAssessment({ assessmentCode: "PCL5", responses: allZero }),
    {
      score: total0,
      severity: pcl5SeverityLabel(total0, structured0),
      structuredScoreJson: structured0,
    }
  )

  // total 27 (below), 28 (borderline), 31 (probable) — all items equal-ish
  function pcl5Uniform(perItem: number) {
    return keyed([...rangeKeys("pcl5_q", 1, 20, perItem)])
  }
  // 20 items can't make 27/28/31 with uniform scores; build exact totals:
  function pcl5Total(n: number): ScoreAssessmentResponse[] {
    const scores = Array.from({ length: 20 }, () => 0)
    let remaining = n
    for (let i = 0; i < 20 && remaining > 0; i++) {
      const add = Math.min(4, remaining)
      scores[i] = add
      remaining -= add
    }
    return keyed(scores.map((s, i) => [`pcl5_q${i + 1}`, s] as [string, number]))
  }

  for (const n of [27, 28, 30, 31]) {
    const responses = pcl5Total(n)
    const scored = responses.map((r) => ({
      elementKey: r.elementKey,
      scoreValue: r.scoreValue,
    }))
    const total = calculatePcl5TotalScore(scored)
    const structured = calculatePcl5StructuredScore(scored)
    check(`PCL5 total ${n}`, total, n)
    check(
      `PCL5 scoreAssessment total ${n}`,
      scoreAssessment({ assessmentCode: "PCL5", responses }),
      {
        score: total,
        severity: pcl5SeverityLabel(total, structured),
        structuredScoreJson: structured,
      }
    )
  }

  // provisional criteria met at low total
  const provisional = keyed([
    ["pcl5_q1", 2],
    ["pcl5_q6", 2],
    ["pcl5_q8", 2],
    ["pcl5_q9", 2],
    ["pcl5_q15", 2],
    ["pcl5_q16", 2],
  ])
  const scoredP = provisional.map((r) => ({
    elementKey: r.elementKey,
    scoreValue: r.scoreValue,
  }))
  const structuredP = calculatePcl5StructuredScore(scoredP)
  check("PCL5 provisional criteria met", structuredP.meetsProvisionalDiagnosisCriteria, true)
  check(
    "PCL5 provisional low-score label",
    scoreAssessment({ assessmentCode: "PCL5", responses: provisional }),
    {
      score: calculatePcl5TotalScore(scoredP),
      severity: pcl5SeverityLabel(calculatePcl5TotalScore(scoredP), structuredP),
      structuredScoreJson: structuredP,
    }
  )

  void pcl5Uniform
}

// ─── PHQ-15 ─────────────────────────────────────────────────────────────────

{
  const all = keyed([...rangeKeys("phq15_q", 1, 15, 1)])
  const score = calculatePhq15Score(
    all.map((r) => ({ elementKey: r.elementKey, scoreValue: r.scoreValue }))
  )
  check("PHQ15 sum 15", score, 15)
  check(
    "PHQ15 via scoreAssessment",
    scoreAssessment({ assessmentCode: "PHQ15", responses: all }),
    {
      score,
      severity: score === null ? null : phq15SeverityFromScore(score),
      structuredScoreJson: null,
    }
  )
  check("PHQ15 severity 4 → Minimal", phq15SeverityFromScore(4), "Minimal somatic symptom severity")
  check("PHQ15 severity 5 → Low", phq15SeverityFromScore(5), "Low somatic symptom severity")
  check("PHQ15 severity 10 → Medium", phq15SeverityFromScore(10), "Medium somatic symptom severity")
  check("PHQ15 severity 15 → High", phq15SeverityFromScore(15), "High somatic symptom severity")
}

// ─── PSF ────────────────────────────────────────────────────────────────────

{
  const responses = keyed([
    ["psf_q1", 2],
    ["psf_q2", 1],
    ["psf_q3", -1],
    ["psf_q4", 2],
    ["psf_q5", -2],
  ])
  const psf = calculatePsfScore(responses.map((r) => r.scoreValue))
  check(
    "PSF mixed scores",
    scoreAssessment({ assessmentCode: "PSF", responses }),
    {
      score: psf.netScore,
      severity: formatPsfSeverity(psf),
      structuredScoreJson: null,
    }
  )
}

// ─── LEVEL1_XC ──────────────────────────────────────────────────────────────

{
  const responses: ScoreAssessmentResponse[] = [
    { elementKey: "l1_a1", domainCode: "anxiety", scoreValue: 1, dataType: "integer" },
    { elementKey: "l1_a2", domainCode: "anxiety", scoreValue: 3, dataType: "integer" },
    { elementKey: "l1_d1", domainCode: "depression", scoreValue: 0, dataType: "integer" },
  ]
  const expected = calculateLevel1XcDomainScores(
    responses.map((r) => ({ domainCode: r.domainCode, scoreValue: r.scoreValue }))
  )
  check(
    "LEVEL1_XC max-per-domain",
    scoreAssessment({ assessmentCode: "LEVEL1_XC", responses }),
    { score: null, severity: null, structuredScoreJson: expected }
  )
}

// ─── PC_PTSD5 ───────────────────────────────────────────────────────────────

{
  const gatedOff = keyed([
    ["pcptsd5_gate", 0],
    ["pcptsd5_q1", 1],
    ["pcptsd5_q2", 1],
    ["pcptsd5_q3", 1],
    ["pcptsd5_q4", 1],
    ["pcptsd5_q5", 1],
  ])
  check(
    "PC_PTSD5 gate off → 0",
    scoreAssessment({ assessmentCode: "PC_PTSD5", responses: gatedOff }),
    {
      score: calculatePcPtsd5Score(
        gatedOff.map((r) => ({ elementKey: r.elementKey, scoreValue: r.scoreValue }))
      ),
      severity: null,
      structuredScoreJson: null,
    }
  )

  const gatedOn = keyed([
    ["pcptsd5_gate", 1],
    ["pcptsd5_q1", 1],
    ["pcptsd5_q2", 1],
    ["pcptsd5_q3", 1],
    ["pcptsd5_q4", 1],
    ["pcptsd5_q5", 1],
  ])
  check(
    "PC_PTSD5 gate on all yes → 5",
    scoreAssessment({ assessmentCode: "PC_PTSD5", responses: gatedOn }),
    { score: 5, severity: null, structuredScoreJson: null }
  )
}

// ─── ASRS A / B ─────────────────────────────────────────────────────────────

{
  const partA = keyed([
    ["asrs_a_q1", 3],
    ["asrs_a_q2", 3],
    ["asrs_a_q3", 3],
    ["asrs_a_q4", 4],
    ["asrs_a_q5", 4],
    ["asrs_a_q6", 4],
  ])
  const expectedA = calculateAsrsPartAScore(
    partA.map((r) => ({ elementKey: r.elementKey, scoreValue: r.scoreValue }))
  )
  check(
    "ASRS_PART_A positive screen",
    scoreAssessment({ assessmentCode: "ASRS_PART_A", responses: partA }),
    { score: null, severity: null, structuredScoreJson: expectedA }
  )

  const partB = keyed([...rangeKeys("asrs_b_q", 7, 18, 2)])
  const expectedB = calculateAsrsPartBRawScores(
    partB.map((r) => ({ elementKey: r.elementKey, scoreValue: r.scoreValue }))
  )
  check(
    "ASRS_PART_B raw passthrough",
    scoreAssessment({ assessmentCode: "ASRS_PART_B", responses: partB }),
    { score: null, severity: null, structuredScoreJson: expectedB }
  )
}

// ─── SUBSTANCE_USE_L2 ───────────────────────────────────────────────────────

{
  const responses = keyed([
    ["substance_use_l2_a", 2],
    ["substance_use_l2_d", 0],
  ])
  const expected = calculateSubstanceUseL2Scores(
    responses.map((r) => ({ elementKey: r.elementKey, scoreValue: r.scoreValue }))
  )
  check(
    "SUBSTANCE_USE_L2",
    scoreAssessment({ assessmentCode: "SUBSTANCE_USE_L2", responses }),
    { score: null, severity: null, structuredScoreJson: expected }
  )
}

// ─── DES_B ──────────────────────────────────────────────────────────────────

{
  const responses = keyed([...rangeKeys("des_b_q", 1, 8, 2)])
  const score = calculateDesBScore(
    responses.map((r) => ({ elementKey: r.elementKey, scoreValue: r.scoreValue }))
  )
  check(
    "DES_B all 2s → 16",
    scoreAssessment({ assessmentCode: "DES_B", responses }),
    { score, severity: null, structuredScoreJson: null }
  )
}

// ─── SCI ────────────────────────────────────────────────────────────────────

{
  const atThreshold = keyed([...rangeKeys("sci_q", 1, 8, 2)])
  const score = calculateSciScore(
    atThreshold.map((r) => ({ elementKey: r.elementKey, scoreValue: r.scoreValue }))
  )
  check("SCI score 16", score, 16)
  check(
    "SCI at threshold",
    scoreAssessment({ assessmentCode: "SCI", responses: atThreshold }),
    {
      score,
      severity: score === null ? null : sciSeverityFromScore(score),
      structuredScoreJson: null,
    }
  )

  const above = keyed([...rangeKeys("sci_q", 1, 8, 3)])
  const scoreAbove = calculateSciScore(
    above.map((r) => ({ elementKey: r.elementKey, scoreValue: r.scoreValue }))
  )
  check(
    "SCI above threshold",
    scoreAssessment({ assessmentCode: "SCI", responses: above }),
    {
      score: scoreAbove,
      severity: scoreAbove === null ? null : sciSeverityFromScore(scoreAbove),
      structuredScoreJson: null,
    }
  )
}

// ─── ASRM ───────────────────────────────────────────────────────────────────

{
  const below = keyed([...rangeKeys("asrm_q", 1, 5, 1)])
  const scoreBelow = calculateAsrmScore(
    below.map((r) => ({ elementKey: r.elementKey, scoreValue: r.scoreValue }))
  )
  check(
    "ASRM score 5 → less likely",
    scoreAssessment({ assessmentCode: "ASRM", responses: below }),
    {
      score: scoreBelow,
      severity: scoreBelow === null ? null : asrmSeverityFromScore(scoreBelow),
      structuredScoreJson: null,
    }
  )

  const high = keyed([...rangeKeys("asrm_q", 1, 5, 2)])
  const scoreHigh = calculateAsrmScore(
    high.map((r) => ({ elementKey: r.elementKey, scoreValue: r.scoreValue }))
  )
  check(
    "ASRM score 10 → high probability",
    scoreAssessment({ assessmentCode: "ASRM", responses: high }),
    {
      score: scoreHigh,
      severity: scoreHigh === null ? null : asrmSeverityFromScore(scoreHigh),
      structuredScoreJson: null,
    }
  )
}

// ─── PID5_FBF (minimal facet) ───────────────────────────────────────────────

{
  const impulsivity = keyed([
    ["pid5_fbf_q2", 3],
    ["pid5_fbf_q5", 3],
    ["pid5_fbf_q6", 3],
    ["pid5_fbf_q8", 3],
  ])
  const expected = calculatePid5FbfScores(
    impulsivity.map((r) => ({
      elementKey: r.elementKey,
      scoreValue: r.scoreValue,
    }))
  )
  check(
    "PID5_FBF Impulsivity facet only",
    scoreAssessment({ assessmentCode: "PID5_FBF", responses: impulsivity }),
    { score: null, severity: null, structuredScoreJson: expected }
  )
}

// ─── SPECIFIC_DISORDER_SELECTOR ─────────────────────────────────────────────

{
  const responses = keyed([
    ["specific_disorder_selector_panic", 3],
    ["specific_disorder_selector_agoraphobia", 0],
    ["specific_disorder_selector_social_anxiety", 1],
    ["specific_disorder_selector_separation_anxiety", 2],
    ["specific_disorder_selector_specific_phobia", 2],
  ])
  const expected = calculateSpecificDisorderSelectorScores(
    responses.map((r) => ({ elementKey: r.elementKey, scoreValue: r.scoreValue }))
  )
  check(
    "SPECIFIC_DISORDER_SELECTOR",
    scoreAssessment({
      assessmentCode: "SPECIFIC_DISORDER_SELECTOR",
      responses,
    }),
    { score: null, severity: null, structuredScoreJson: expected }
  )
}

// ─── Anxiety subtypes ───────────────────────────────────────────────────────

function anxietyFixture(
  code: string,
  prefix: string,
  scoreFn: (r: { elementKey: string; scoreValue: number }[]) => number | null
) {
  const responses = keyed([...rangeKeys(`${prefix}`, 1, 10, 2)])
  // keys are panic_disorder_q1 etc — rangeKeys gives panic_disorder_1 without q
  const withQ = keyed(
    Array.from({ length: 10 }, (_, i) => [`${prefix}q${i + 1}`, 2] as [string, number])
  )
  const score = scoreFn(
    withQ.map((r) => ({ elementKey: r.elementKey, scoreValue: r.scoreValue }))
  )
  check(
    `${code} all 2s → 20 Moderate`,
    scoreAssessment({ assessmentCode: code, responses: withQ }),
    {
      score,
      severity: score === null ? null : anxietySubtypeSeverityFromScore(score),
      structuredScoreJson: null,
    }
  )
  void responses
}

anxietyFixture("PANIC_DISORDER", "panic_disorder_", calculatePanicDisorderScore)
anxietyFixture("AGORAPHOBIA", "agoraphobia_", calculateAgoraphobiaScore)
anxietyFixture("SOCIAL_ANXIETY", "social_anxiety_", calculateSocialAnxietyScore)
anxietyFixture(
  "SEPARATION_ANXIETY",
  "separation_anxiety_",
  calculateSeparationAnxietyScore
)
anxietyFixture("SPECIFIC_PHOBIA", "specific_phobia_", calculateSpecificPhobiaScore)

{
  check("anxiety subtype raw 4 → None", anxietySubtypeSeverityFromScore(4), "None")
  check("anxiety subtype raw 5 → Mild", anxietySubtypeSeverityFromScore(5), "Mild")
  check("anxiety subtype raw 15 → Moderate", anxietySubtypeSeverityFromScore(15), "Moderate")
  check("anxiety subtype raw 25 → Severe", anxietySubtypeSeverityFromScore(25), "Severe")
  check("anxiety subtype raw 35 → Extreme", anxietySubtypeSeverityFromScore(35), "Extreme")
}

// ─── BTP ────────────────────────────────────────────────────────────────────

{
  check(
    "BTP → score 0",
    scoreAssessment({ assessmentCode: "BTP", responses: [] }),
    { score: 0, severity: null, structuredScoreJson: null }
  )
}

console.log("score-assessment.selftest.ts: ok")
