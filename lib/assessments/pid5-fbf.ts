// PID-5-FBF (100 items, 25 facets, 4 items each). Facet/domain groupings hardcoded here by
// elementKey — same convention as DASS-21's subscale scoring — rather than read from
// groupLabel at scoring time.
//
// Missing-data rule (per-facet): if 2+ of a facet's 4 items are unanswered, that facet's score
// is not calculated (null). If exactly 1 is unanswered, prorate: (partial sum x 4) / 3, rounded
// to the nearest whole number.
//
// Two scores per facet: rawScore (sum of the 4 items, 0-12) and averageScore (rawScore / 4,
// 0-3) — averageScore is the value used for domain scoring and normative comparison against
// Miller et al. 2022 domain/facet cutoffs. PD composite scoring (below) uses rawScore instead
// — composites sum raw facet scores, not averages. Keep that distinction clear; it's easy to
// mix up.
const FACET_ITEM_KEYS: Record<string, string[]> = {
  Anhedonia: ["pid5_fbf_q9", "pid5_fbf_q11", "pid5_fbf_q43", "pid5_fbf_q65"],
  Anxiousness: ["pid5_fbf_q24", "pid5_fbf_q36", "pid5_fbf_q48", "pid5_fbf_q78"],
  "Attention Seeking": ["pid5_fbf_q23", "pid5_fbf_q77", "pid5_fbf_q87", "pid5_fbf_q97"],
  Callousness: ["pid5_fbf_q7", "pid5_fbf_q62", "pid5_fbf_q72", "pid5_fbf_q82"],
  Deceitfulness: ["pid5_fbf_q18", "pid5_fbf_q51", "pid5_fbf_q95", "pid5_fbf_q99"],
  Depressivity: ["pid5_fbf_q26", "pid5_fbf_q60", "pid5_fbf_q70", "pid5_fbf_q74"],
  Distractibility: ["pid5_fbf_q39", "pid5_fbf_q49", "pid5_fbf_q55", "pid5_fbf_q91"],
  Eccentricity: ["pid5_fbf_q10", "pid5_fbf_q22", "pid5_fbf_q61", "pid5_fbf_q94"],
  "Emotional Lability": ["pid5_fbf_q41", "pid5_fbf_q53", "pid5_fbf_q71", "pid5_fbf_q81"],
  Grandiosity: ["pid5_fbf_q14", "pid5_fbf_q37", "pid5_fbf_q85", "pid5_fbf_q90"],
  Hostility: ["pid5_fbf_q12", "pid5_fbf_q31", "pid5_fbf_q66", "pid5_fbf_q75"],
  Impulsivity: ["pid5_fbf_q2", "pid5_fbf_q5", "pid5_fbf_q6", "pid5_fbf_q8"],
  "Intimacy Avoidance": ["pid5_fbf_q29", "pid5_fbf_q40", "pid5_fbf_q56", "pid5_fbf_q93"],
  Irresponsibility: ["pid5_fbf_q47", "pid5_fbf_q64", "pid5_fbf_q68", "pid5_fbf_q76"],
  Manipulativeness: ["pid5_fbf_q35", "pid5_fbf_q44", "pid5_fbf_q69", "pid5_fbf_q100"],
  "Perceptual Dysregulation": ["pid5_fbf_q15", "pid5_fbf_q63", "pid5_fbf_q88", "pid5_fbf_q98"],
  Perseveration: ["pid5_fbf_q19", "pid5_fbf_q25", "pid5_fbf_q32", "pid5_fbf_q46"],
  "Restricted Affectivity": ["pid5_fbf_q28", "pid5_fbf_q30", "pid5_fbf_q73", "pid5_fbf_q83"],
  "Rigid Perfectionism": ["pid5_fbf_q33", "pid5_fbf_q42", "pid5_fbf_q80", "pid5_fbf_q89"],
  "Risk Taking": ["pid5_fbf_q13", "pid5_fbf_q16", "pid5_fbf_q21", "pid5_fbf_q67"],
  "Separation Insecurity": ["pid5_fbf_q17", "pid5_fbf_q45", "pid5_fbf_q58", "pid5_fbf_q79"],
  Submissiveness: ["pid5_fbf_q3", "pid5_fbf_q4", "pid5_fbf_q20", "pid5_fbf_q92"],
  Suspiciousness: ["pid5_fbf_q1", "pid5_fbf_q38", "pid5_fbf_q50", "pid5_fbf_q86"],
  "Unusual Beliefs and Experiences": ["pid5_fbf_q34", "pid5_fbf_q54", "pid5_fbf_q59", "pid5_fbf_q96"],
  Withdrawal: ["pid5_fbf_q27", "pid5_fbf_q52", "pid5_fbf_q57", "pid5_fbf_q84"],
}

// Domain scoring uses only 3 of the facets per domain, not every facet conceptually related to
// it — this is the official updated scoring protocol (matches the footnote in Miller et al.
// 2022), not an oversight. The other 22 facets still get their own raw/average scores above;
// they just don't feed into a domain average.
const DOMAIN_FACETS: Record<string, string[]> = {
  "Negative Affect": ["Emotional Lability", "Anxiousness", "Separation Insecurity"],
  Detachment: ["Withdrawal", "Anhedonia", "Intimacy Avoidance"],
  Antagonism: ["Manipulativeness", "Deceitfulness", "Grandiosity"],
  Disinhibition: ["Irresponsibility", "Impulsivity", "Distractibility"],
  Psychoticism: ["Unusual Beliefs and Experiences", "Eccentricity", "Perceptual Dysregulation"],
}

// PD composite raw score = SUM of raw facet scores (not averages) for the facets listed below —
// different math from domain scoring, which averages. Easy to mix up; kept clearly separate
// from DOMAIN_FACETS above. "Antisocial with Psychopathy specifier" reuses all 7 Antisocial
// facets plus 3 more, two of which (Anxiousness, Withdrawal) are reverse-scored specifically
// within this one composite — reversal doesn't apply to those facets' normal scoring anywhere
// else (not in their own facet score, not in the domains that use them).
const PD_COMPOSITE_FACETS: Record<string, string[]> = {
  Schizotypal: [
    "Perceptual Dysregulation",
    "Unusual Beliefs and Experiences",
    "Eccentricity",
    "Restricted Affectivity",
    "Withdrawal",
    "Suspiciousness",
  ],
  Antisocial: [
    "Manipulativeness",
    "Callousness",
    "Deceitfulness",
    "Hostility",
    "Risk Taking",
    "Impulsivity",
    "Irresponsibility",
  ],
  "Antisocial with Psychopathy": [
    "Manipulativeness",
    "Callousness",
    "Deceitfulness",
    "Hostility",
    "Risk Taking",
    "Impulsivity",
    "Irresponsibility",
    "Attention Seeking",
    "Anxiousness",
    "Withdrawal",
  ],
  Borderline: [
    "Emotional Lability",
    "Anxiousness",
    "Separation Insecurity",
    "Depressivity",
    "Impulsivity",
    "Risk Taking",
    "Hostility",
  ],
  Narcissistic: ["Attention Seeking", "Grandiosity"],
  Avoidant: ["Anxiousness", "Withdrawal", "Anhedonia", "Intimacy Avoidance"],
  "Obsessive-Compulsive (OCPD)": [
    "Rigid Perfectionism",
    "Perseveration",
    "Intimacy Avoidance",
    "Restricted Affectivity",
  ],
}

// Facets reverse-scored within a specific composite only (low anxiousness/withdrawal
// contributing to psychopathy makes conceptual sense — fearlessness and social boldness are
// part of the psychopathy construct). Reversed raw facet score = 12 - rawScore (facet raw
// range is 0-12, same logic as reversing a single 0-3 item: 3 - value, summed across 4 items).
const COMPOSITE_REVERSE_SCORED_FACETS: Record<string, string[]> = {
  "Antisocial with Psychopathy": ["Anxiousness", "Withdrawal"],
}

// Normative cutoffs — Miller, Bagby, Hopwood, Simms, & Lynam (2022), based on the Krueger et
// al. (2012) representative sample (N=264). The paper recommends 1.5 SD as a reasonable
// clinical-elevation threshold (roughly T-65 equivalent). PD composite means aren't comparable
// across composites (2 facets for Narcissistic vs. 10 for Antisocial w/ Psychopathy) — each
// composite is only ever compared against its own threshold below, never another composite's.
const PD_COMPOSITE_NORMS: Record<string, { mean: number; sd: number; threshold1_5sd: number }> = {
  Schizotypal: { mean: 4.83, sd: 2.87, threshold1_5sd: 9.13 },
  Antisocial: { mean: 4.84, sd: 3.01, threshold1_5sd: 9.35 },
  "Antisocial with Psychopathy": { mean: 9.62, sd: 2.9, threshold1_5sd: 13.97 },
  Borderline: { mean: 6.02, sd: 3.25, threshold1_5sd: 10.9 },
  Narcissistic: { mean: 1.63, sd: 1.09, threshold1_5sd: 3.26 },
  Avoidant: { mean: 3.53, sd: 2.24, threshold1_5sd: 6.89 },
  "Obsessive-Compulsive (OCPD)": { mean: 3.45, sd: 1.82, threshold1_5sd: 6.18 },
}

export type Pid5FbfFacetScore = {
  rawScore: number | null
  averageScore: number | null
}

export type Pid5PdCompositeScore = {
  rawScore: number | null
  // Whether rawScore meets or exceeds the 1.5 SD normative threshold — the source paper's
  // recommended clinical-elevation cut, not a diagnosis. Null if rawScore couldn't be computed.
  elevated: boolean | null
}

export type Pid5FbfScores = {
  facets: Record<string, Pid5FbfFacetScore>
  domains: Record<string, number | null>
  pdComposites: Record<string, Pid5PdCompositeScore>
}

function calculateFacetScore(
  scoreByKey: Map<string, number>,
  itemKeys: string[]
): Pid5FbfFacetScore {
  const answeredScores = itemKeys
    .map((key) => scoreByKey.get(key))
    .filter((value): value is number => value !== undefined)

  const itemsMissing = itemKeys.length - answeredScores.length

  if (itemsMissing >= 2) {
    return { rawScore: null, averageScore: null }
  }

  const partialSum = answeredScores.reduce((sum, value) => sum + value, 0)
  const rawScore =
    itemsMissing === 0 ? partialSum : Math.round((partialSum * 4) / 3)

  return { rawScore, averageScore: rawScore / 4 }
}

function calculatePdCompositeScore(
  facets: Record<string, Pid5FbfFacetScore>,
  compositeName: string,
  facetNames: string[]
): Pid5PdCompositeScore {
  const reversedFacets = COMPOSITE_REVERSE_SCORED_FACETS[compositeName] ?? []

  const rawScores = facetNames.map((name) => {
    const raw = facets[name]?.rawScore ?? null
    if (raw === null) return null
    return reversedFacets.includes(name) ? 12 - raw : raw
  })

  // Same cascading rule as domain scoring: if any contributing facet couldn't be computed
  // (2+ missing items in that facet), the composite isn't computed either.
  if (rawScores.some((value) => value === null)) {
    return { rawScore: null, elevated: null }
  }

  const rawScore = (rawScores as number[]).reduce((sum, value) => sum + value, 0)
  const norms = PD_COMPOSITE_NORMS[compositeName]
  const elevated = norms ? rawScore >= norms.threshold1_5sd : null

  return { rawScore, elevated }
}

export function calculatePid5FbfScores(
  responses: { elementKey: string; scoreValue: number }[]
): Pid5FbfScores {
  const scoreByKey = new Map(responses.map((r) => [r.elementKey, r.scoreValue]))

  const facets: Record<string, Pid5FbfFacetScore> = {}
  for (const [facetName, itemKeys] of Object.entries(FACET_ITEM_KEYS)) {
    facets[facetName] = calculateFacetScore(scoreByKey, itemKeys)
  }

  const domains: Record<string, number | null> = {}
  for (const [domainName, facetNames] of Object.entries(DOMAIN_FACETS)) {
    const facetAverages = facetNames.map((name) => facets[name]?.averageScore ?? null)

    // Domain score isn't computed if any of its 3 contributing facets couldn't be computed.
    if (facetAverages.some((value) => value === null)) {
      domains[domainName] = null
      continue
    }

    const sum = (facetAverages as number[]).reduce((total, value) => total + value, 0)
    domains[domainName] = sum / facetAverages.length
  }

  const pdComposites: Record<string, Pid5PdCompositeScore> = {}
  for (const [compositeName, facetNames] of Object.entries(PD_COMPOSITE_FACETS)) {
    pdComposites[compositeName] = calculatePdCompositeScore(facets, compositeName, facetNames)
  }

  return { facets, domains, pdComposites }
}
