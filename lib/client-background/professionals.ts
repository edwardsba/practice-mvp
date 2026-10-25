export type ProfessionalOption = {
  professionalId: string
  title: string | null
  firstName: string
  lastName: string
  professionName: string | null
}

export type ProfessionOption = {
  professionId: string
  professionName: string
}

export type OrganisationOption = {
  organisationId: string
  organisationName: string
}

function professionalName(professional: ProfessionalOption): string {
  return [professional.title?.trim(), professional.firstName.trim(), professional.lastName.trim()]
    .filter(Boolean)
    .join(" ")
}

/** Dropdown label: "{title} {first} {last} — {profession}". */
export function professionalOptionLabel(professional: ProfessionalOption): string {
  const name = professionalName(professional)
  const profession = professional.professionName?.trim() ?? ""
  return profession ? `${name} — ${profession}` : name
}

/** Read-only name: "Dr Jane Smith, General practitioner". */
export function professionalSummary(professional: ProfessionalOption): string {
  const name = professionalName(professional)
  const profession = professional.professionName?.trim() ?? ""
  return profession ? `${name}, ${profession}` : name
}

export function sortProfessionals(professionals: ProfessionalOption[]): ProfessionalOption[] {
  return [...professionals].sort(
    (a, b) =>
      a.lastName.localeCompare(b.lastName, "en-AU") ||
      a.firstName.localeCompare(b.firstName, "en-AU") ||
      a.professionalId.localeCompare(b.professionalId)
  )
}
