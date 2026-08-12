import { extractSageSrPdfText } from "./extract-pdf-text"

export type SageSrReportKind =
  | "core_clinician"
  | "core_response"
  | "background"
  | "background_response"
  | "personality"
  | "personality_response"
  | "narrative_note"
  | "unknown"

/**
 * Known-good footer version strings, confirmed by inspecting the actual pushed reports
 * (Report ID 20005-1739-560 / 20005-1739-700 / 20005-1740-270, evaluated 8/9–8/11/2026).
 * If TeleSage ships a template update, the footer version bumps and stops matching here —
 * that's intentional. See needsVersionReview below: fail loudly and flag for review rather
 * than silently parsing a changed template with the old field-position assumptions.
 */
const KNOWN_FOOTER_VERSIONS: Record<Exclude<SageSrReportKind, "unknown">, string[]> = {
  core_clinician: ["SAGE-SR Core 1.6.2.1"],
  core_response: ["SAGE-SR Core 1.6.2.1"],
  background: ["SAGE-SR Background 1.0.1.2"],
  background_response: ["SAGE-SR Background 1.0.1.2"],
  personality: ["SAGE-SR Personality 1.0.2.0"],
  personality_response: ["SAGE-SR Personality 1.0.2.0"],
  narrative_note: [], // Narrative Note is reference-only, never parsed — see handover notes. No version check needed since it's not consumed as data.
}

export interface SageSrDetectionResult {
  kind: SageSrReportKind
  clientId: string | null
  evaluationDate: string | null // as printed, e.g. "8/9/2026" — caller converts to a real Date
  footerVersion: string | null
  /** True if a report type was identified but its footer version doesn't match any
   *  known-good string for that type — likely means TeleSage updated the template.
   *  The importer should refuse to auto-parse and flag this file for manual review
   *  rather than guess at a changed layout. */
  needsVersionReview: boolean
}

function findAnchorValue(items: string[], anchorLabel: string): string | null {
  const idx = items.findIndex((s) => s.includes(anchorLabel))
  if (idx === -1) return null
  const sameItemRemainder = items[idx].replace(anchorLabel, "").trim()
  if (sameItemRemainder) return sameItemRemainder
  return items[idx + 1] ?? null
}

function detectKind(flatItems: string[]): SageSrReportKind {
  const headerText = flatItems.slice(0, 8).join(" ")

  // Order matters — check more specific titles before their broader substrings
  // (e.g. "Response Report" must be checked before the bare instrument-name match).
  if (headerText.includes("Narrative Note")) return "narrative_note"
  if (headerText.includes("SAGE-SR Core") && headerText.includes("Response Report")) return "core_response"
  if (headerText.includes("SAGE-SR Core") && headerText.includes("Clinician Report")) return "core_clinician"
  if (headerText.includes("SAGE-SR Background") && headerText.includes("Response Report")) return "background_response"
  if (headerText.includes("Background Report")) return "background"
  if (headerText.includes("SAGE-SR Personality") && headerText.includes("Response Report")) return "personality_response"
  if (headerText.includes("SAGE-SR Personality Report")) return "personality"

  return "unknown"
}

function detectFooterVersion(flatItems: string[]): string | null {
  // Version string always appears in the last handful of items on the last page,
  // in the shape "SAGE-SR <Module> <x.y.z.w>". Scan from the end for reliability
  // regardless of exact page/item count.
  for (let i = flatItems.length - 1; i >= Math.max(0, flatItems.length - 20); i--) {
    const item = flatItems[i]
    if (/^SAGE-SR (Core|Background|Personality) \d+\.\d+\.\d+\.\d+$/.test(item)) {
      return item
    }
  }
  return null
}

export async function detectSageSrReport(buffer: Buffer): Promise<SageSrDetectionResult> {
  const { flatItems } = await extractSageSrPdfText(buffer)

  const kind = detectKind(flatItems)
  const clientId = findAnchorValue(flatItems, "Client ID:")
  const evaluationDate = findAnchorValue(flatItems, "Evaluation Date:")
  const footerVersion = detectFooterVersion(flatItems)

  const knownVersions = kind !== "unknown" ? KNOWN_FOOTER_VERSIONS[kind] : []
  const needsVersionReview =
    kind !== "unknown" &&
    kind !== "narrative_note" &&
    (!footerVersion || !knownVersions.includes(footerVersion))

  return { kind, clientId, evaluationDate, footerVersion, needsVersionReview }
}
