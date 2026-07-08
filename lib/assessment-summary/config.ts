import {
  assistSeverityFromScore,
  gad7SeverityFromScore,
  phq9SeverityFromScore,
} from "@/lib/assessments/severity"

const BTP_RATING_LABELS_LOCAL: Record<number, string> = {
  1: "Not effective at all",
  2: "Effective sometimes",
  3: "Effective about half the time",
  4: "Effective most of the time",
  5: "Always effective",
}

function btpRatingLabelLocal(score: number): string {
  return BTP_RATING_LABELS_LOCAL[score] ?? String(score)
}

function phq9ShortSeverityBand(score: number): string {
  if (score <= 4) return "Minimal"
  if (score <= 9) return "Mild"
  if (score <= 14) return "Moderate"
  if (score <= 19) return "Moderately severe"
  return "Severe"
}

function gad7ShortSeverityBand(score: number): string {
  if (score <= 4) return "Minimal"
  if (score <= 9) return "Mild"
  if (score <= 14) return "Moderate"
  return "Severe"
}

export type NumericToolCode = "PHQ9" | "GAD7" | "ASSIST"

export type VariabilityLabel =
  | "Consistent"
  | "Some fluctuation"
  | "Considerable fluctuation"

export type VariabilityBand = {
  label: VariabilityLabel
  maxSd: number // inclusive upper bound; last band should be Infinity
}

export type NumericToolConfig = {
  toolCode: NumericToolCode
  toolName: string
  maxScore: number
  symptomDomain: string
  severityFromScore: (score: number) => string
  severityPatternBandFromScore: (score: number) => string
  variabilityBands: VariabilityBand[]
  bandOrder: string[]
  bottomTwoBands?: [string, string]
  topTwoBands?: [string, string]
}

export const NUMERIC_TOOL_CONFIG: Record<NumericToolCode, NumericToolConfig> = {
  PHQ9: {
    toolCode: "PHQ9",
    toolName: "PHQ-9",
    maxScore: 27,
    symptomDomain: "depressive symptoms",
    severityFromScore: phq9SeverityFromScore,
    severityPatternBandFromScore: phq9ShortSeverityBand,
    variabilityBands: [
      { label: "Consistent", maxSd: 2 },
      { label: "Some fluctuation", maxSd: 4 },
      { label: "Considerable fluctuation", maxSd: Infinity },
    ],
    bandOrder: ["Minimal", "Mild", "Moderate", "Moderately severe", "Severe"],
    bottomTwoBands: ["Minimal", "Mild"],
    topTwoBands: ["Moderately severe", "Severe"],
  },
  GAD7: {
    toolCode: "GAD7",
    toolName: "GAD-7",
    maxScore: 21,
    symptomDomain: "anxiety symptoms",
    severityFromScore: gad7SeverityFromScore,
    severityPatternBandFromScore: gad7ShortSeverityBand,
    variabilityBands: [
      { label: "Consistent", maxSd: 2 },
      { label: "Some fluctuation", maxSd: 4 },
      { label: "Considerable fluctuation", maxSd: Infinity },
    ],
    bandOrder: ["Minimal", "Mild", "Moderate", "Severe"],
    bottomTwoBands: ["Minimal", "Mild"],
    topTwoBands: ["Moderate", "Severe"],
  },
  ASSIST: {
    toolCode: "ASSIST",
    toolName: "ASSIST",
    maxScore: 39,
    symptomDomain: "substance use risk",
    severityFromScore: assistSeverityFromScore,
    severityPatternBandFromScore: assistSeverityFromScore,
    variabilityBands: [
      { label: "Consistent", maxSd: 3 },
      { label: "Some fluctuation", maxSd: 6 },
      { label: "Considerable fluctuation", maxSd: Infinity },
    ],
    bandOrder: ["Lower Risk", "Moderate Risk", "High Risk"],
  },
}

export type BtpToolConfig = {
  toolName: string
  maxScore: number
  symptomDomain: string // used as "effectiveness applying this strategy"
  ratingFromScore: (score: number) => string
  variabilityBands: VariabilityBand[]
  bandOrder: string[]
  bottomTwoBands: [string, string]
  topTwoBands: [string, string]
}

export const BTP_TOOL_CONFIG: BtpToolConfig = {
  toolName: "Behavioural Target",
  maxScore: 5,
  symptomDomain: "effectiveness applying this strategy",
  ratingFromScore: btpRatingLabelLocal,
  variabilityBands: [
    { label: "Consistent", maxSd: 0.6 },
    { label: "Some fluctuation", maxSd: 1.2 },
    { label: "Considerable fluctuation", maxSd: Infinity },
  ],
  bandOrder: [
    "Not effective at all",
    "Effective sometimes",
    "Effective about half the time",
    "Effective most of the time",
    "Always effective",
  ],
  bottomTwoBands: ["Not effective at all", "Effective sometimes"],
  topTwoBands: ["Effective most of the time", "Always effective"],
}
