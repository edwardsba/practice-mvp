export function asqAcuteRiskRating(q5ResponseValue: string): string {
  return q5ResponseValue === "yes" ? "Acute risk indicated" : "Not indicated"
}

export function asqScreenOutcome(totalScore: number, q5ResponseValue: string): string {
  if (q5ResponseValue === "yes") return "Acute positive screen"
  if (totalScore === 0) return "Negative screen"
  return "Non-acute positive screen"
}

export const ASQ_Q5_ELEMENT_KEY = "asq_q5"
