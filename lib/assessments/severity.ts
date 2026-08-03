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

export function phq15SeverityFromScore(score: number): string {
  if (score <= 4) return "Minimal somatic symptom severity"
  if (score <= 9) return "Low somatic symptom severity"
  if (score <= 14) return "Medium somatic symptom severity"
  return "High somatic symptom severity"
}

// IMPORTANT: SCI is reverse-scored — LOW score is the concerning direction here, opposite
// to every other severity function in this file.
export function sciSeverityFromScore(score: number): string {
  if (score <= 16) return "Meets threshold criteria for probable insomnia disorder"
  return "Below insomnia disorder threshold"
}

export function asrmSeverityFromScore(score: number): string {
  if (score >= 6) return "High probability of a manic or hypomanic condition"
  return "Less likely to be associated with significant symptoms of mania"
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
