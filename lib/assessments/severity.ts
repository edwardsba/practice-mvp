export function phq9SeverityFromScore(score: number): string {
  if (score <= 4) return "Minimal depression symptoms"
  if (score <= 9) return "Mild depression symptoms"
  if (score <= 14) return "Moderate depression symptoms"
  if (score <= 19) return "Moderately severe depression symptoms"
  return "Severe depression symptoms"
}

export function gad7SeverityFromScore(score: number): string {
  if (score <= 4) return "Minimal anxiety symptoms"
  if (score <= 9) return "Mild anxiety symptoms"
  if (score <= 14) return "Moderate anxiety symptoms"
  return "Severe anxiety symptoms"
}

export function assistSeverityFromScore(score: number): string {
  if (score <= 3) return "Lower Risk"
  if (score <= 26) return "Moderate Risk"
  return "High Risk"
}

export function severityFromAssessmentCode(
  assessmentCode: string,
  score: number
): string {
  if (assessmentCode === "GAD7") return gad7SeverityFromScore(score)
  if (assessmentCode === "PHQ9") return phq9SeverityFromScore(score)
  if (assessmentCode === "ASSIST") return assistSeverityFromScore(score)
  return `Score ${score}`
}
