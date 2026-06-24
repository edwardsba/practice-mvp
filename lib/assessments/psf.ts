export type PsfScoreResult = {
  positiveFeedback: number
  negativeFeedback: number
  netScore: number
}

export function calculatePsfScore(
  responseScores: number[]
): PsfScoreResult {
  let positiveFeedback = 0
  let negativeFeedback = 0

  for (const score of responseScores) {
    if (score > 0) positiveFeedback += score
    if (score < 0) negativeFeedback += Math.abs(score)
  }

  return {
    positiveFeedback,
    negativeFeedback,
    netScore: positiveFeedback - negativeFeedback,
  }
}

export function formatPsfSeverity(result: PsfScoreResult): string {
  return `Positive ${result.positiveFeedback}/10, Negative ${result.negativeFeedback}/10`
}
