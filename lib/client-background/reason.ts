import { formatPartialDateLabel } from "@/lib/client-background/age"
import { professionalSummary, type ProfessionalOption } from "@/lib/client-background/professionals"
import { REFERRAL_TYPE_LABELS, type ReasonForAttending, type RelationshipRecord } from "@/lib/client-background/types"
import { personRoleLabel } from "@/lib/client-background/tree"

export function applyKeptSuggestion(
  reason: ReasonForAttending,
  options: { suggestedProfessionalId: string | null; dismissed: boolean }
): ReasonForAttending {
  if (reason.referralType !== "medical") return reason
  if (reason.referrerProfessionalId || options.dismissed || !options.suggestedProfessionalId) return reason
  return { ...reason, referrerProfessionalId: options.suggestedProfessionalId }
}

export function reasonReadOnlyLines(
  reason: ReasonForAttending,
  professionals: ProfessionalOption[],
  relationships: RelationshipRecord[] = []
): { label: string; value: string }[] {
  const lines: { label: string; value: string }[] = []
  if (reason.referralType) {
    lines.push({ label: "Referral type", value: REFERRAL_TYPE_LABELS[reason.referralType] })
  }
  if (reason.referralType === "medical") {
    const referred = referredLine(reason, professionals)
    if (referred) lines.push({ label: "Medical professional", value: referred })
    if (reason.referrerConcerns.trim()) {
      lines.push({ label: "Referrer's concerns", value: reason.referrerConcerns.trim() })
    }
  }
  if (reason.referralType === "family_or_friend") {
    const who = referrerWho(reason, relationships)
    if (who) lines.push({ label: "Who", value: who })
    if (reason.theirConcerns.trim()) {
      lines.push({ label: "Their concerns", value: reason.theirConcerns.trim() })
    }
  }
  return lines
}

function referredLine(reason: ReasonForAttending, professionals: ProfessionalOption[]): string | null {
  const professional = professionals.find((item) => item.professionalId === reason.referrerProfessionalId)
  const detail = [
    professional ? professionalSummary(professional) : "",
    formatPartialDateLabel(reason.referralDate),
  ].filter(Boolean)
  return detail.length > 0 ? detail.join(" · ") : null
}

function referrerWho(reason: ReasonForAttending, relationships: RelationshipRecord[]): string | null {
  if (reason.referrerIsOther) return reason.referrerOther.trim() || "Other"
  const person = relationships.find((item) => item.relationshipRecordId === reason.referrerRelationshipId)
  if (!person) return null
  const name = person.givenName.trim() || "Unnamed"
  return `${name} (${personRoleLabel(person)})`
}
