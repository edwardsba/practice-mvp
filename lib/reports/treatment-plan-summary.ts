function formatTargetList(targets: string[]): string {
  if (targets.length === 0) return ""
  if (targets.length === 1) return targets[0]

  const numbered = targets.map((t, i) => `(${i + 1}) ${t}`)
  return numbered.slice(0, -1).join(", ") + ", and " + numbered[numbered.length - 1]
}

/**
 * Builds the Treatment Plan Summary paragraph. CBT is hardcoded for now per
 * Ben's instruction (the treatment plan form doesn't yet support selecting
 * other modalities for this purpose) - revisit once that's added.
 */
export function buildTreatmentPlanSummary(
  clientFirstName: string,
  therapeuticTarget: string | null,
  behaviouralTargets: string[]
): string {
  const sentences: string[] = [
    `The treatment plan was designed in collaboration with ${clientFirstName} using the principles of Cognitive Behaviour Therapy (CBT).`,
  ]

  if (therapeuticTarget) {
    sentences.push(
      `${clientFirstName} has chosen a therapeutic target of: ${therapeuticTarget}.`
    )
  }

  if (behaviouralTargets.length > 0) {
    sentences.push(
      `The primary behavioural targets chosen by ${clientFirstName} are: ${formatTargetList(behaviouralTargets)}.`
    )
  }

  return sentences.join(" ")
}

/**
 * Itemized-lines version of the treatment plan summary, used by the
 * current Progress Report letter body. The intro sentence stays a single
 * paragraph; therapeutic target and each behavioural target become their
 * own line, numbered to match the same order used in the Behavioural
 * Targets Summary section later in the report.
 */
export function buildTreatmentPlanSummaryLines(
  clientFirstName: string,
  therapeuticTarget: string | null,
  behaviouralTargets: string[]
): string[] {
  const lines: string[] = [
    `The treatment plan was designed in collaboration with ${clientFirstName} using the principles of Cognitive Behaviour Therapy (CBT).`,
  ]

  if (therapeuticTarget) {
    lines.push(`Therapeutic target: ${therapeuticTarget}`)
  }

  behaviouralTargets.forEach((target, i) => {
    lines.push(`Behavioural target ${i + 1}: ${target}`)
  })

  return lines
}

