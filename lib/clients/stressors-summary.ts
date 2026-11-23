import {
  STRESSOR_ITEMS,
  type StressorsRecord,
} from "@/lib/client-background/types"

/** Short labels for the Progress panel Stressors line. */
const STRESSOR_SUMMARY_LABELS: Record<
  (typeof STRESSOR_ITEMS)[number]["key"],
  string
> = {
  family: "Family",
  socialLife: "Social life",
  intimateRelationships: "Intimate relationships",
  workStudy: "Work",
  financial: "finances",
  ownHealth: "Your health",
  othersHealth: "Others' health",
  lossOfLovedOne: "Loss of a loved one",
  legalPoliceAccidents: "Legal matters",
}

/**
 * Read-only Stressors summary for the client Progress panel.
 * Lists stressors answered "yes", e.g. "Work, finances", or "None recorded".
 */
export function formatStressorsSummary(
  stressors: Pick<StressorsRecord, (typeof STRESSOR_ITEMS)[number]["key"]> | null | undefined
): string {
  if (!stressors) return "None recorded"

  const active = STRESSOR_ITEMS.filter((item) => stressors[item.key] === "yes").map(
    (item) => STRESSOR_SUMMARY_LABELS[item.key]
  )

  if (active.length === 0) return "None recorded"
  return active.join(", ")
}
