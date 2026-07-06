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
  variabilityBands: VariabilityBand[]
}

export const NUMERIC_TOOL_CONFIG: Record<NumericToolCode, NumericToolConfig> = {
  PHQ9: {
    toolCode: "PHQ9",
    toolName: "PHQ-9",
    maxScore: 27,
    symptomDomain: "depressive symptoms",
    severityFromScore: phq9SeverityFromScore,
    variabilityBands: [
      { label: "Consistent", maxSd: 2 },
      { label: "Some fluctuation", maxSd: 4 },
      { label: "Considerable fluctuation", maxSd: Infinity },
    ],
  },
  GAD7: {
    toolCode: "GAD7",
    toolName: "GAD-7",
    maxScore: 21,
    symptomDomain: "anxiety symptoms",
    severityFromScore: gad7SeverityFromScore,
    variabilityBands: [
      { label: "Consistent", maxSd: 2 },
      { label: "Some fluctuation", maxSd: 4 },
      { label: "Considerable fluctuation", maxSd: Infinity },
    ],
  },
  ASSIST: {
    toolCode: "ASSIST",
    toolName: "ASSIST",
    maxScore: 39,
    symptomDomain: "substance use risk",
    severityFromScore: assistSeverityFromScore,
    variabilityBands: [
      { label: "Consistent", maxSd: 3 },
      { label: "Some fluctuation", maxSd: 6 },
      { label: "Considerable fluctuation", maxSd: Infinity },
    ],
  },
}

export type BtpToolConfig = {
  toolName: string
  maxScore: number
  symptomDomain: string // used as "effectiveness applying this strategy"
  ratingFromScore: (score: number) => string
  variabilityBands: VariabilityBand[]
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
}
