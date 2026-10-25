import { formatPartialDateLabel } from "@/lib/client-background/age"
import { professionalSummary, type ProfessionalOption } from "@/lib/client-background/professionals"
import {
  triStateLabel,
  willingnessLabel,
  type ReasonForAttending,
} from "@/lib/client-background/types"

export function applyKeptSuggestion(
  reason: ReasonForAttending,
  options: { suggestedProfessionalId: string | null; dismissed: boolean }
): ReasonForAttending {
  if (reason.referredByMedicalProfessional !== "yes") return reason
  if (reason.referrerProfessionalId || options.dismissed || !options.suggestedProfessionalId) return reason
  return { ...reason, referrerProfessionalId: options.suggestedProfessionalId }
}

export function reasonReadOnlyLines(
  reason: ReasonForAttending,
  professionals: ProfessionalOption[]
): { label: string; value: string }[] {
  const lines: { label: string; value: string }[] = []
  const referred = referredLine(reason, professionals)
  if (referred) lines.push({ label: "Referred by a medical professional", value: referred })
  if (reason.referrerConcerns.trim()) {
    lines.push({ label: "Referrer's concerns", value: reason.referrerConcerns.trim() })
  }
  const family = familyLine(reason)
  if (family) lines.push({ label: "Family involved in them attending", value: family })
  if (reason.ownInitiative) {
    lines.push({ label: "Came on their own initiative", value: triStateLabel(reason.ownInitiative) })
  }
  if (reason.attendedWillingly) {
    lines.push({ label: "Attended willingly", value: willingnessLabel(reason.attendedWillingly) })
  }
  if (reason.clientMotivation.trim()) {
    lines.push({ label: "Client's motivation", value: reason.clientMotivation.trim() })
  }
  return lines
}

function referredLine(reason: ReasonForAttending, professionals: ProfessionalOption[]): string | null {
  const answer = reason.referredByMedicalProfessional
  if (!answer) return null
  if (answer !== "yes") return triStateLabel(answer)
  const professional = professionals.find((item) => item.professionalId === reason.referrerProfessionalId)
  const detail = [
    professional ? professionalSummary(professional) : "",
    formatPartialDateLabel(reason.referralDate),
  ].filter(Boolean)
  return detail.length > 0 ? `Yes — ${detail.join(" · ")}` : "Yes"
}

function familyLine(reason: ReasonForAttending): string | null {
  const answer = reason.familyInvolved
  if (!answer) return null
  if (answer !== "yes") return triStateLabel(answer)
  const how = reason.familyInvolvement.trim()
  return how ? `Yes — ${how}` : "Yes"
}
