export type SeverityCase =
  | { kind: "contained_single"; band: string }
  | { kind: "contained_double"; group: "lower" | "higher"; bandA: string; bandB: string }
  | { kind: "linear"; startBand: string; endBand: string }
  | {
      kind: "u_shape"
      startBand: string
      midBand: string
      endBand: string
      firstDirection: "dip" | "rise"
    }
  | { kind: "random"; lowestBand: string; highestBand: string }

/**
 * Classifies the shape of severity-band movement across a period's results
 * (as opposed to trend.ts, which classifies the shape of the raw numbers).
 *
 * `bands` must be in chronological order, one entry per result.
 * `bandOrder` is the tool's full ordered list of band/rating names (lowest to
 * highest).
 * `bottomTwo`/`topTwo` are optional — when provided, a result set touching
 * exactly those two adjacent bands (and no others) is reported as "contained"
 * rather than "linear". Omit both for tools with no such grouping (e.g.
 * ASSIST, which uses its own bespoke sentence builder instead).
 */
export function classifySeverityPattern(
  bands: string[],
  bandOrder: string[],
  bottomTwo?: [string, string],
  topTwo?: [string, string]
): SeverityCase {
  const uniqueBands = Array.from(new Set(bands))

  if (uniqueBands.length === 1) {
    return { kind: "contained_single", band: uniqueBands[0] }
  }

  if (uniqueBands.length === 2 && bottomTwo && topTwo) {
    const uniqueSet = new Set(uniqueBands)
    const bottomSet = new Set(bottomTwo)
    const topSet = new Set(topTwo)
    const matchesBottom =
      uniqueSet.size === bottomSet.size &&
      [...uniqueSet].every((b) => bottomSet.has(b))
    const matchesTop =
      uniqueSet.size === topSet.size &&
      [...uniqueSet].every((b) => topSet.has(b))
    if (matchesBottom || matchesTop) {
      const sorted = [...uniqueBands].sort(
        (a, b) => bandOrder.indexOf(a) - bandOrder.indexOf(b)
      )
      return {
        kind: "contained_double",
        group: matchesBottom ? "lower" : "higher",
        bandA: sorted[0],
        bandB: sorted[1],
      }
    }
  }

  const idxs = bands.map((b) => bandOrder.indexOf(b))
  const diffs: number[] = []
  for (let i = 1; i < idxs.length; i++) {
    const d = idxs[i] - idxs[i - 1]
    if (d !== 0) diffs.push(d)
  }
  const signs = diffs.map((d) => (d > 0 ? 1 : -1))
  let signChanges = 0
  for (let i = 1; i < signs.length; i++) {
    if (signs[i] !== signs[i - 1]) signChanges++
  }

  if (signChanges === 0) {
    return { kind: "linear", startBand: bands[0], endBand: bands[bands.length - 1] }
  }

  if (signChanges === 1) {
    const firstDirection: "dip" | "rise" = signs[0] > 0 ? "rise" : "dip"
    const midBandIndex =
      firstDirection === "rise" ? Math.max(...idxs) : Math.min(...idxs)
    return {
      kind: "u_shape",
      startBand: bands[0],
      midBand: bandOrder[midBandIndex],
      endBand: bands[bands.length - 1],
      firstDirection,
    }
  }

  const sortedIdxs = [...idxs].sort((a, b) => a - b)
  return {
    kind: "random",
    lowestBand: bandOrder[sortedIdxs[0]],
    highestBand: bandOrder[sortedIdxs[sortedIdxs.length - 1]],
  }
}

/**
 * Shared Severity sentence builder for PHQ-9, GAD-7, and BTP.
 * labelNoun is "severity rating" for PHQ-9/GAD-7, or "rating" for BTP.
 */
export function buildSeveritySentence(
  severityCase: SeverityCase,
  labelNoun: "severity rating" | "rating"
): string {
  switch (severityCase.kind) {
    case "contained_single":
      return `The results were contained within the ${severityCase.band} ${labelNoun}.`
    case "contained_double":
      return `The results were contained within the ${severityCase.group} ${labelNoun}s, between ${severityCase.bandA} and ${severityCase.bandB}.`
    case "linear":
      return `The results moved from the ${severityCase.startBand} ${labelNoun} to the ${severityCase.endBand} ${labelNoun}.`
    case "u_shape": {
      const firstVerb = severityCase.firstDirection === "dip" ? "dipped" : "rose"
      const secondVerb = severityCase.firstDirection === "dip" ? "rose" : "dropped"
      return `The results started in the ${severityCase.startBand} ${labelNoun}, ${firstVerb} into the ${severityCase.midBand} ${labelNoun}, then ${secondVerb} to the ${severityCase.endBand} ${labelNoun}.`
    }
    case "random":
      return `The results were distributed across several ${labelNoun}s, from ${severityCase.lowestBand} at the lowest to ${severityCase.highestBand} at the highest.`
  }
}

/**
 * Bespoke Severity sentence builder for ASSIST (3 bands only, no
 * contained-double case, and specific wording per risk level).
 */
export function buildAssistSeveritySentence(severityCase: SeverityCase): string {
  switch (severityCase.kind) {
    case "contained_single":
      if (severityCase.band === "Lower Risk") {
        return "The results were all contained within the Lower Risk rating."
      }
      if (severityCase.band === "Moderate Risk") {
        return "The results all remained within the Moderate Risk rating, without reaching High Risk."
      }
      return "The results were all within the High Risk rating."
    case "linear":
      return `The results moved from the ${severityCase.startBand} rating to the ${severityCase.endBand} rating.`
    case "u_shape": {
      const firstVerb = severityCase.firstDirection === "dip" ? "dipped" : "rose"
      const secondVerb = severityCase.firstDirection === "dip" ? "rose" : "dropped"
      return `The results started in the ${severityCase.startBand} rating, ${firstVerb} into the ${severityCase.midBand} rating, then ${secondVerb} to the ${severityCase.endBand} rating.`
    }
    case "random":
      return `The results were distributed across several risk ratings, from ${severityCase.lowestBand} at the lowest to ${severityCase.highestBand} at the highest.`
    case "contained_double":
      return `The results were contained within the ${severityCase.group} ratings, between ${severityCase.bandA} and ${severityCase.bandB}.`
  }
}
