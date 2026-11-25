/**
 * Shared assessment scoring — one entry point used by the client submit route
 * and the practitioner shared form.
 *
 * Logic moved verbatim from app/api/assessments/submit/route.ts (scoring block).
 * Do not change calculations, rounding, thresholds, or wording here without
 * updating both callers' expected behaviour.
 */

import { calculateAsrsPartAScore, calculateAsrsPartBRawScores } from "@/lib/assessments/asrs"
import { calculateDass21SubscaleScores } from "@/lib/assessments/dass21"
import { calculateLevel1XcDomainScores } from "@/lib/assessments/level1xc"
import { calculatePcPtsd5Score } from "@/lib/assessments/pcptsd5"
import { calculatePhq15Score } from "@/lib/assessments/phq15"
import { calculatePsfScore, formatPsfSeverity } from "@/lib/assessments/psf"
import { calculateDesBScore } from "@/lib/assessments/des-b"
import { calculateAsrmScore } from "@/lib/assessments/asrm"
import { calculateSciScore } from "@/lib/assessments/sci"
import { calculateSubstanceUseL2Scores } from "@/lib/assessments/substance-use-l2"
import { calculatePid5FbfScores } from "@/lib/assessments/pid5-fbf"
import { calculateSpecificDisorderSelectorScores } from "@/lib/assessments/specific-disorder-selector"
import { calculatePanicDisorderScore } from "@/lib/assessments/panic-disorder"
import { calculateAgoraphobiaScore } from "@/lib/assessments/agoraphobia"
import { calculateSocialAnxietyScore } from "@/lib/assessments/social-anxiety"
import { calculateSeparationAnxietyScore } from "@/lib/assessments/separation-anxiety"
import { calculateSpecificPhobiaScore } from "@/lib/assessments/specific-phobia"
import {
  calculatePcl5TotalScore,
  calculatePcl5StructuredScore,
  pcl5SeverityLabel,
} from "@/lib/assessments/pcl5"
import {
  asqFlagsFromResponses,
  asqScreenOutcome,
} from "@/lib/assessments/asq"
import {
  anxietySubtypeSeverityFromScore,
  asrmSeverityFromScore,
  phq15SeverityFromScore,
  sciSeverityFromScore,
  severityFromAssessmentCode,
} from "@/lib/assessments/severity"

/**
 * Scored response row in the shape the submit route builds before writing
 * assessment_results (element key/metadata, option score, data type).
 */
export type ScoreAssessmentResponse = {
  elementKey: string
  domainCode: string | null
  scoreValue: number
  dataType: string
  responseValue?: string
  assessmentElementId?: string
}

export type ScoreAssessmentInput = {
  assessmentCode: string
  responses: ScoreAssessmentResponse[]
}

/**
 * Columns the submit route writes onto assessment_results from scoring
 * (assessmentDate / status / FKs are set by the caller, not here).
 *
 * Inventory of result columns the route sets from scoring today:
 * - score
 * - severity
 * - structuredScoreJson
 *
 * acute_risk_rating is a schema column but neither the submit route nor the
 * shared practitioner save sets it (including ASQ — left null unless set
 * elsewhere).
 */
export type ScoreAssessmentResult = {
  score: number | null
  severity: string | null
  structuredScoreJson: Record<string, unknown> | null
}

export function scoreAssessment(
  input: ScoreAssessmentInput
): ScoreAssessmentResult {
  const { assessmentCode, responses } = input

  const isBtp = assessmentCode === "BTP"
  const isPsf = assessmentCode === "PSF"
  const isLevel1Xc = assessmentCode === "LEVEL1_XC"
  const isPcPtsd5 = assessmentCode === "PC_PTSD5"
  const isAsrsPartA = assessmentCode === "ASRS_PART_A"
  const isAsrsPartB = assessmentCode === "ASRS_PART_B"
  const isDass21 = assessmentCode === "DASS21"
  const isPhq15 = assessmentCode === "PHQ15"
  const isSubstanceUseL2 = assessmentCode === "SUBSTANCE_USE_L2"
  const isDesB = assessmentCode === "DES_B"
  const isSci = assessmentCode === "SCI"
  const isAsrm = assessmentCode === "ASRM"
  const isPid5Fbf = assessmentCode === "PID5_FBF"
  const isSpecificDisorderSelector =
    assessmentCode === "SPECIFIC_DISORDER_SELECTOR"
  const isPanicDisorder = assessmentCode === "PANIC_DISORDER"
  const isAgoraphobia = assessmentCode === "AGORAPHOBIA"
  const isSocialAnxiety = assessmentCode === "SOCIAL_ANXIETY"
  const isSeparationAnxiety = assessmentCode === "SEPARATION_ANXIETY"
  const isSpecificPhobia = assessmentCode === "SPECIFIC_PHOBIA"
  const isPcl5 = assessmentCode === "PCL5"
  const isAsq = assessmentCode === "ASQ"

  let totalScore = 0
  const psfResponseScores: number[] = []

  for (const row of responses) {
    if (
      !isBtp &&
      !isPsf &&
      !isLevel1Xc &&
      !isPcPtsd5 &&
      !isAsrsPartA &&
      !isAsrsPartB &&
      !isDass21 &&
      !isPhq15 &&
      !isSubstanceUseL2 &&
      !isDesB &&
      !isSci &&
      !isAsrm &&
      !isPid5Fbf &&
      !isSpecificDisorderSelector &&
      !isPanicDisorder &&
      !isAgoraphobia &&
      !isSocialAnxiety &&
      !isSeparationAnxiety &&
      !isSpecificPhobia &&
      !isPcl5 &&
      row.dataType === "integer"
    ) {
      // ASQ included: sum of integer option scores (Yes = 1), same as legacy save.
      totalScore += row.scoreValue
    }

    if (isPsf && row.dataType === "integer") {
      psfResponseScores.push(row.scoreValue)
    }
  }

  const scoredResponses = responses.map((row) => ({
    elementKey: row.elementKey,
    domainCode: row.domainCode,
    scoreValue: row.scoreValue,
  }))

  let resultScore: number | null
  let severity: string | null
  let structuredScore: Record<string, unknown> | null = null

  if (isBtp) {
    resultScore = 0
    severity = null
  } else if (isPsf) {
    const psfResult = calculatePsfScore(psfResponseScores)
    resultScore = psfResult.netScore
    severity = formatPsfSeverity(psfResult)
  } else if (isLevel1Xc) {
    resultScore = null
    severity = null
    structuredScore = calculateLevel1XcDomainScores(scoredResponses)
  } else if (isPcPtsd5) {
    resultScore = calculatePcPtsd5Score(scoredResponses)
    severity = null
  } else if (isAsrsPartA) {
    resultScore = null
    severity = null
    structuredScore = calculateAsrsPartAScore(scoredResponses)
  } else if (isAsrsPartB) {
    resultScore = null
    severity = null
    structuredScore = calculateAsrsPartBRawScores(scoredResponses)
  } else if (isDass21) {
    resultScore = null
    severity = null
    structuredScore = calculateDass21SubscaleScores(scoredResponses)
  } else if (isPhq15) {
    resultScore = calculatePhq15Score(scoredResponses)
    severity = resultScore === null ? null : phq15SeverityFromScore(resultScore)
  } else if (isSubstanceUseL2) {
    resultScore = null
    severity = null
    structuredScore = calculateSubstanceUseL2Scores(scoredResponses)
  } else if (isDesB) {
    resultScore = calculateDesBScore(scoredResponses)
    severity = null
  } else if (isSci) {
    resultScore = calculateSciScore(scoredResponses)
    severity = resultScore === null ? null : sciSeverityFromScore(resultScore)
  } else if (isAsrm) {
    resultScore = calculateAsrmScore(scoredResponses)
    severity = resultScore === null ? null : asrmSeverityFromScore(resultScore)
  } else if (isPid5Fbf) {
    resultScore = null
    severity = null
    structuredScore = calculatePid5FbfScores(scoredResponses)
  } else if (isSpecificDisorderSelector) {
    resultScore = null
    severity = null
    structuredScore = calculateSpecificDisorderSelectorScores(scoredResponses)
  } else if (isPanicDisorder) {
    resultScore = calculatePanicDisorderScore(scoredResponses)
    severity =
      resultScore === null ? null : anxietySubtypeSeverityFromScore(resultScore)
  } else if (isAgoraphobia) {
    resultScore = calculateAgoraphobiaScore(scoredResponses)
    severity =
      resultScore === null ? null : anxietySubtypeSeverityFromScore(resultScore)
  } else if (isSocialAnxiety) {
    resultScore = calculateSocialAnxietyScore(scoredResponses)
    severity =
      resultScore === null ? null : anxietySubtypeSeverityFromScore(resultScore)
  } else if (isSeparationAnxiety) {
    resultScore = calculateSeparationAnxietyScore(scoredResponses)
    severity =
      resultScore === null ? null : anxietySubtypeSeverityFromScore(resultScore)
  } else if (isSpecificPhobia) {
    resultScore = calculateSpecificPhobiaScore(scoredResponses)
    severity =
      resultScore === null ? null : anxietySubtypeSeverityFromScore(resultScore)
  } else if (isPcl5) {
    const pcl5Total = calculatePcl5TotalScore(scoredResponses)
    const pcl5Structured = calculatePcl5StructuredScore(scoredResponses)
    resultScore = pcl5Total
    severity = pcl5SeverityLabel(pcl5Total, pcl5Structured)
    structuredScore = pcl5Structured
  } else if (isAsq) {
    resultScore = totalScore
    severity = asqScreenOutcome(asqFlagsFromResponses(responses))
    structuredScore = null
  } else {
    resultScore = totalScore
    severity = severityFromAssessmentCode(assessmentCode, totalScore)
  }

  return {
    score: resultScore,
    severity,
    structuredScoreJson: structuredScore,
  }
}
