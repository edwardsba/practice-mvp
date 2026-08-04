// Specific Disorder Selector Assessment. Tier 2 — triggered alongside DASS-21 by the same
// Level 1 XC anxiety domain flag (both fire off one Level 1 XC submission's anxiety >= 2, not
// one gating the other). 5 questions: 4 use the same 0-4 scale as their corresponding severity
// scale's own item 1 (Panic, Agoraphobia, Social Anxiety, Separation Anxiety), so the answer
// given here can later be carried forward as that scale's item 1 (Pass 3, not yet built — for
// now each severity scale still asks its own item 1 fresh). The 5th (Specific Phobia) is
// structurally different: a single-select cluster picker, not a 0-4 frequency rating — it
// serves both as the endorsement trigger AND identifies which cluster "these situations" refers
// to in the Specific Phobia severity scale (no separate cluster-picker module needed).
const SPECIFIC_PHOBIA_CLUSTER_LABELS: Record<number, string> = {
  0: "None of these",
  1: "Driving, flying, tunnels, bridges, or enclosed spaces",
  2: "Animals or insects",
  3: "Heights, storms, or water",
  4: "Blood, needles, or injections",
  5: "Choking or vomiting",
}

export type SpecificDisorderSelectorScores = {
  panic: number
  agoraphobia: number
  social_anxiety: number
  separation_anxiety: number
  // 0 = "None of these" (no phobia endorsed), 1-5 = which cluster was selected. Kept numeric
  // so the trigger engine (which requires a number to compare against a threshold) can read it
  // directly — specific_phobia_cluster_label alongside it is for clinical/report display only,
  // never read by the trigger engine.
  specific_phobia_cluster: number
  specific_phobia_cluster_label: string | null
}

export function calculateSpecificDisorderSelectorScores(
  responses: { elementKey: string; scoreValue: number }[]
): SpecificDisorderSelectorScores {
  const scores: SpecificDisorderSelectorScores = {
    panic: 0,
    agoraphobia: 0,
    social_anxiety: 0,
    separation_anxiety: 0,
    specific_phobia_cluster: 0,
    specific_phobia_cluster_label: SPECIFIC_PHOBIA_CLUSTER_LABELS[0],
  }

  for (const response of responses) {
    switch (response.elementKey) {
      case "specific_disorder_selector_panic":
        scores.panic = response.scoreValue
        break
      case "specific_disorder_selector_agoraphobia":
        scores.agoraphobia = response.scoreValue
        break
      case "specific_disorder_selector_social_anxiety":
        scores.social_anxiety = response.scoreValue
        break
      case "specific_disorder_selector_separation_anxiety":
        scores.separation_anxiety = response.scoreValue
        break
      case "specific_disorder_selector_specific_phobia":
        scores.specific_phobia_cluster = response.scoreValue
        scores.specific_phobia_cluster_label =
          SPECIFIC_PHOBIA_CLUSTER_LABELS[response.scoreValue] ?? null
        break
    }
  }

  return scores
}
