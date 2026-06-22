import type { OrganisationLinkInput } from "@/lib/actions/contacts"

const DRAFT_KEY_PREFIX = "professional-form-draft:"

export type ProfessionalFormDraft = {
  title: string
  firstName: string
  lastName: string
  professionId: string
  links: OrganisationLinkInput[]
}

function draftKey(professionalId: string | undefined) {
  return `${DRAFT_KEY_PREFIX}${professionalId ?? "new"}`
}

export function readProfessionalFormDraft(
  professionalId: string | undefined
): ProfessionalFormDraft | null {
  if (typeof window === "undefined") return null
  const raw = sessionStorage.getItem(draftKey(professionalId))
  if (!raw) return null
  try {
    return JSON.parse(raw) as ProfessionalFormDraft
  } catch {
    return null
  }
}

export function writeProfessionalFormDraft(
  professionalId: string | undefined,
  draft: ProfessionalFormDraft
) {
  if (typeof window === "undefined") return
  sessionStorage.setItem(draftKey(professionalId), JSON.stringify(draft))
}

export function clearProfessionalFormDraft(professionalId: string | undefined) {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(draftKey(professionalId))
}
