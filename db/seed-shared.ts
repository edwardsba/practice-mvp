export const LIKERT_RESPONSE_OPTIONS = [
  { label: "Not at all", value: "0", score: 0, order: 1 },
  { label: "Several days", value: "1", score: 1, order: 2 },
  { label: "More than half the days", value: "2", score: 2, order: 3 },
  { label: "Nearly every day", value: "3", score: 3, order: 4 },
] as const

export const IMPAIRMENT_QUESTION_TEXT =
  "How difficult have these problems made it for you to do your work, take care of things at home, or get along with other people?"

export const IMPAIRMENT_OPTIONS = [
  { label: "Not difficult at all", value: "not_difficult", score: 0, order: 1 },
  { label: "Somewhat difficult", value: "somewhat_difficult", score: 0, order: 2 },
  { label: "Very difficult", value: "very_difficult", score: 0, order: 3 },
  { label: "Extremely difficult", value: "extremely_difficult", score: 0, order: 4 },
] as const
