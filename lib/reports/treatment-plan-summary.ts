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
