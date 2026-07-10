import { formatShortDate } from "@/lib/reports/format-date"

export function buildCrisisPlanSummarySentence(
  clientFirstName: string,
  crisisPlanDate: string | null
): string {
  if (!crisisPlanDate) {
    return `${clientFirstName} does not have a crisis plan in place.`
  }

  return `${clientFirstName} has a crisis plan in place, dated ${formatShortDate(crisisPlanDate)}.`
}
