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

/** Parses the "Positive X/10, Negative Y/10" string stored in assessmentResults.severity
 *  for a PSF result (written by formatPsfSeverity above) back into numbers, so a
 *  longitudinal view can work from the already-scored result rather than re-querying
 *  every individual response. Returns null if the string doesn't match the expected shape. */
export function parsePsfSeverity(
  severity: string | null | undefined
): Pick<PsfScoreResult, "positiveFeedback" | "negativeFeedback"> | null {
  if (!severity) return null
  const match = severity.match(/Positive (-?\d+)\/10, Negative (-?\d+)\/10/)
  if (!match) return null
  return {
    positiveFeedback: Number(match[1]),
    negativeFeedback: Number(match[2]),
  }
}

/** Per-session "concern" figure for the Feedback-over-time view: negative feedback is
 *  weighted twice as heavily as positive, so a session with meaningful negative feedback
 *  stands out even against a strongly positive session. Confirmed with Ben — simple and
 *  eyeball-checkable rather than a more elaborate model. Not shown as its own column (the
 *  red highlight on any negative answer covers that at the row level); used internally to
 *  compute calculatePsfFeedbackTrend below. */
export function calculatePsfConcernScore(
  positiveFeedback: number,
  negativeFeedback: number
): number {
  return negativeFeedback * 2 - positiveFeedback
}

/** Default smoothing factor for calculatePsfFeedbackTrend: the most recent session
 *  contributes 40% of the trend value, the remaining 60% carries forward from before.
 *  Chosen as a reasonable starting point — easy to retune once real data is in. */
export const DEFAULT_PSF_TREND_SMOOTHING = 0.4

/** Exponentially-weighted moving average of the per-session concern score, so the trend
 *  reacts to the latest session immediately while older sessions fade out rather than
 *  permanently weighing down the figure. `sessions` need not be pre-sorted — this sorts by
 *  date ascending internally so the recency weighting is always correct regardless of what
 *  order the caller passes them in (e.g. a table displayed newest-first). Returns null when
 *  there are no sessions to compute from. */
export function calculatePsfFeedbackTrend(
  sessions: { date: string; positiveFeedback: number; negativeFeedback: number }[],
  smoothing: number = DEFAULT_PSF_TREND_SMOOTHING
): number | null {
  if (sessions.length === 0) return null

  const ordered = [...sessions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  let trend = calculatePsfConcernScore(
    ordered[0].positiveFeedback,
    ordered[0].negativeFeedback
  )

  for (let i = 1; i < ordered.length; i++) {
    const concern = calculatePsfConcernScore(
      ordered[i].positiveFeedback,
      ordered[i].negativeFeedback
    )
    trend = smoothing * concern + (1 - smoothing) * trend
  }

  return trend
}
