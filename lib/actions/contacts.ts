"use server"

import { and, asc, eq, notInArray } from "drizzle-orm"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import {
  professionalOrganisationLinks,
  professionalOrganisations,
  professionals,
  professions,
} from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"

export type ContactsFormState = {
  error?: string
}

export type OrganisationLinkInput = {
  linkId?: string
  organisationId: string
  medicareProviderNumber?: string | null
  directPhone?: string | null
  directEmail?: string | null
  directSecureMessaging?: string | null
}

function trimOrNull(value: FormDataEntryValue | null | undefined): string | null {
  const text = String(value ?? "").trim()
  return text || null
}

async function verifyPracticeId(practiceId: string) {
  const context = await requirePractitionerContext()
  if (context.practiceId !== practiceId) {
    throw new Error("Unauthorized practice access.")
  }
  return context
}

export async function getProfessions(practiceId: string) {
  await verifyPracticeId(practiceId)

  return db
    .select({
      professionId: professions.professionId,
      professionName: professions.professionName,
    })
    .from(professions)
    .where(
      and(
        eq(professions.practiceId, practiceId),
        eq(professions.isActive, true)
      )
    )
    .orderBy(asc(professions.professionName))
}

export async function upsertProfession(
  practiceId: string,
  data: { professionId?: string; professionName: string }
) {
  await verifyPracticeId(practiceId)

  const professionName = data.professionName.trim()
  if (!professionName) {
    return { error: "Profession name is required." }
  }

  const now = new Date()

  if (data.professionId) {
    await db
      .update(professions)
      .set({
        professionName,
        updatedAt: now,
      })
      .where(
        and(
          eq(professions.professionId, data.professionId),
          eq(professions.practiceId, practiceId)
        )
      )
  } else {
    await db.insert(professions).values({
      practiceId,
      professionName,
      updatedAt: now,
    })
  }

  revalidatePath("/settings/professions")
  return { success: true as const }
}

export async function getProfessionalOrganisations(practiceId: string) {
  await verifyPracticeId(practiceId)

  return db
    .select({
      organisationId: professionalOrganisations.organisationId,
      organisationName: professionalOrganisations.organisationName,
      streetAddress: professionalOrganisations.streetAddress,
      postalAddress: professionalOrganisations.postalAddress,
      organisationType: professionalOrganisations.organisationType,
    })
    .from(professionalOrganisations)
    .where(
      and(
        eq(professionalOrganisations.practiceId, practiceId),
        eq(professionalOrganisations.isActive, true)
      )
    )
    .orderBy(asc(professionalOrganisations.organisationName))
}

export async function getProfessionalOrganisationById(organisationId: string) {
  const context = await requirePractitionerContext()

  const [organisation] = await db
    .select()
    .from(professionalOrganisations)
    .where(
      and(
        eq(professionalOrganisations.organisationId, organisationId),
        eq(professionalOrganisations.practiceId, context.practiceId),
        eq(professionalOrganisations.isActive, true)
      )
    )
    .limit(1)

  if (!organisation) {
    return null
  }

  const linkedProfessionals = await db
    .select({
      professionalId: professionals.professionalId,
      firstName: professionals.firstName,
      lastName: professionals.lastName,
      title: professionals.title,
      directPhone: professionalOrganisationLinks.directPhone,
      directEmail: professionalOrganisationLinks.directEmail,
    })
    .from(professionalOrganisationLinks)
    .innerJoin(
      professionals,
      eq(
        professionalOrganisationLinks.professionalId,
        professionals.professionalId
      )
    )
    .where(
      and(
        eq(professionalOrganisationLinks.organisationId, organisationId),
        eq(professionalOrganisationLinks.isActive, true),
        eq(professionals.isActive, true)
      )
    )
    .orderBy(asc(professionals.lastName), asc(professionals.firstName))

  return { organisation, linkedProfessionals }
}

export async function getProfessionals(practiceId: string) {
  await verifyPracticeId(practiceId)

  const rows = await db
    .select({
      professionalId: professionals.professionalId,
      firstName: professionals.firstName,
      lastName: professionals.lastName,
      title: professionals.title,
      professionName: professions.professionName,
      organisationName: professionalOrganisations.organisationName,
      streetAddress: professionalOrganisations.streetAddress,
      postalAddress: professionalOrganisations.postalAddress,
    })
    .from(professionals)
    .leftJoin(professions, eq(professionals.professionId, professions.professionId))
    .leftJoin(
      professionalOrganisationLinks,
      and(
        eq(
          professionalOrganisationLinks.professionalId,
          professionals.professionalId
        ),
        eq(professionalOrganisationLinks.isActive, true)
      )
    )
    .leftJoin(
      professionalOrganisations,
      eq(
        professionalOrganisationLinks.organisationId,
        professionalOrganisations.organisationId
      )
    )
    .where(
      and(
        eq(professionals.practiceId, practiceId),
        eq(professionals.isActive, true)
      )
    )
    .orderBy(asc(professionals.lastName), asc(professionals.firstName))

  const byProfessional = new Map<
    string,
    {
      professionalId: string
      firstName: string
      lastName: string
      title: string | null
      professionName: string | null
      organisations: Array<{
        name: string
        streetAddress: string | null
        postalAddress: string | null
      }>
    }
  >()

  for (const row of rows) {
    const existing = byProfessional.get(row.professionalId) ?? {
      professionalId: row.professionalId,
      firstName: row.firstName,
      lastName: row.lastName,
      title: row.title,
      professionName: row.professionName,
      organisations: [],
    }

    if (
      row.organisationName &&
      !existing.organisations.some((org) => org.name === row.organisationName)
    ) {
      existing.organisations.push({
        name: row.organisationName,
        streetAddress: row.streetAddress,
        postalAddress: row.postalAddress,
      })
    }

    byProfessional.set(row.professionalId, existing)
  }

  return Array.from(byProfessional.values())
}

export async function getProfessionalById(professionalId: string) {
  const context = await requirePractitionerContext()

  const [professional] = await db
    .select({
      professionalId: professionals.professionalId,
      firstName: professionals.firstName,
      lastName: professionals.lastName,
      title: professionals.title,
      professionId: professionals.professionId,
      professionName: professions.professionName,
    })
    .from(professionals)
    .leftJoin(professions, eq(professionals.professionId, professions.professionId))
    .where(
      and(
        eq(professionals.professionalId, professionalId),
        eq(professionals.practiceId, context.practiceId),
        eq(professionals.isActive, true)
      )
    )
    .limit(1)

  if (!professional) {
    return null
  }

  const organisationLinks = await db
    .select({
      linkId: professionalOrganisationLinks.linkId,
      organisationId: professionalOrganisations.organisationId,
      organisationName: professionalOrganisations.organisationName,
      streetAddress: professionalOrganisations.streetAddress,
      postalAddress: professionalOrganisations.postalAddress,
      medicareProviderNumber:
        professionalOrganisationLinks.medicareProviderNumber,
      directPhone: professionalOrganisationLinks.directPhone,
      directEmail: professionalOrganisationLinks.directEmail,
      directSecureMessaging:
        professionalOrganisationLinks.directSecureMessaging,
    })
    .from(professionalOrganisationLinks)
    .innerJoin(
      professionalOrganisations,
      eq(
        professionalOrganisationLinks.organisationId,
        professionalOrganisations.organisationId
      )
    )
    .where(
      and(
        eq(professionalOrganisationLinks.professionalId, professionalId),
        eq(professionalOrganisationLinks.isActive, true)
      )
    )
    .orderBy(asc(professionalOrganisations.organisationName))

  return {
    professional,
    organisationLinks,
    referrals: [] as Array<{
      dateStart: string
      clientLastName: string
      clientFirstName: string
      claimType: string
    }>,
  }
}

function parseOrganisationLinksFromForm(formData: FormData): OrganisationLinkInput[] {
  const raw = String(formData.get("organisation_links_json") ?? "").trim()
  if (!raw) {
    return []
  }

  const parsed = JSON.parse(raw) as OrganisationLinkInput[]
  return parsed.filter((link) => link.organisationId)
}

export async function upsertProfessionalOrganisation(
  practiceId: string,
  data: {
    organisationId?: string
    organisationName: string
    organisationType?: string | null
    streetAddress?: string | null
    postalAddress?: string | null
    phone?: string | null
    fax?: string | null
    email?: string | null
    claimsEmail?: string | null
    secureMessaging?: string | null
    website?: string | null
  }
) {
  await verifyPracticeId(practiceId)

  const organisationName = data.organisationName.trim()
  if (!organisationName) {
    return { error: "Organisation name is required." }
  }

  const now = new Date()
  const values = {
    organisationName,
    organisationType: data.organisationType?.trim() || null,
    streetAddress: data.streetAddress?.trim() || null,
    postalAddress: data.postalAddress?.trim() || null,
    phone: data.phone?.trim() || null,
    fax: data.fax?.trim() || null,
    email: data.email?.trim() || null,
    claimsEmail: data.claimsEmail?.trim() || null,
    secureMessaging: data.secureMessaging?.trim() || null,
    website: data.website?.trim() || null,
    updatedAt: now,
  }

  if (data.organisationId) {
    await db
      .update(professionalOrganisations)
      .set(values)
      .where(
        and(
          eq(professionalOrganisations.organisationId, data.organisationId),
          eq(professionalOrganisations.practiceId, practiceId)
        )
      )

    revalidatePath("/contacts/organisations")
    revalidatePath(`/contacts/organisations/${data.organisationId}`)
    return { organisationId: data.organisationId }
  }

  const [created] = await db
    .insert(professionalOrganisations)
    .values({
      practiceId,
      ...values,
    })
    .returning({
      organisationId: professionalOrganisations.organisationId,
    })

  revalidatePath("/contacts/organisations")
  return { organisationId: created.organisationId }
}

async function syncOrganisationLinks(
  professionalId: string,
  links: OrganisationLinkInput[]
) {
  const now = new Date()
  const keptLinkIds = links
    .map((link) => link.linkId)
    .filter((id): id is string => Boolean(id))

  if (keptLinkIds.length > 0) {
    await db
      .delete(professionalOrganisationLinks)
      .where(
        and(
          eq(professionalOrganisationLinks.professionalId, professionalId),
          notInArray(professionalOrganisationLinks.linkId, keptLinkIds)
        )
      )
  } else {
    await db
      .delete(professionalOrganisationLinks)
      .where(eq(professionalOrganisationLinks.professionalId, professionalId))
  }

  for (const link of links) {
    const linkValues = {
      organisationId: link.organisationId,
      medicareProviderNumber: link.medicareProviderNumber?.trim() || null,
      directPhone: link.directPhone?.trim() || null,
      directEmail: link.directEmail?.trim() || null,
      directSecureMessaging: link.directSecureMessaging?.trim() || null,
      updatedAt: now,
    }

    if (link.linkId) {
      await db
        .update(professionalOrganisationLinks)
        .set(linkValues)
        .where(eq(professionalOrganisationLinks.linkId, link.linkId))
    } else {
      await db.insert(professionalOrganisationLinks).values({
        professionalId,
        ...linkValues,
      })
    }
  }
}

export async function upsertProfessional(
  practiceId: string,
  data: {
    professionalId?: string
    firstName: string
    lastName: string
    title?: string | null
    professionId?: string | null
    organisationLinks: OrganisationLinkInput[]
  }
) {
  await verifyPracticeId(practiceId)

  const firstName = data.firstName.trim()
  const lastName = data.lastName.trim()
  if (!firstName || !lastName) {
    return { error: "First name and last name are required." }
  }

  const now = new Date()
  const values = {
    firstName,
    lastName,
    title: data.title?.trim() || null,
    professionId: data.professionId || null,
    updatedAt: now,
  }

  let professionalId = data.professionalId

  if (professionalId) {
    await db
      .update(professionals)
      .set(values)
      .where(
        and(
          eq(professionals.professionalId, professionalId),
          eq(professionals.practiceId, practiceId)
        )
      )
  } else {
    const [created] = await db
      .insert(professionals)
      .values({
        practiceId,
        ...values,
      })
      .returning({ professionalId: professionals.professionalId })

    professionalId = created.professionalId
  }

  await syncOrganisationLinks(professionalId!, data.organisationLinks)

  revalidatePath("/contacts/professionals")
  revalidatePath(`/contacts/professionals/${professionalId}`)
  return { professionalId: professionalId! }
}

export async function saveProfessionalOrganisationAction(
  practiceId: string,
  organisationId: string | undefined,
  _prevState: ContactsFormState,
  formData: FormData
): Promise<ContactsFormState> {
  let savedOrganisationId: string | undefined

  try {
    const result = await upsertProfessionalOrganisation(practiceId, {
      organisationId: organisationId || undefined,
      organisationName: String(formData.get("organisation_name") ?? ""),
      organisationType: trimOrNull(formData.get("organisation_type")),
      streetAddress: trimOrNull(formData.get("street_address")),
      postalAddress: trimOrNull(formData.get("postal_address")),
      phone: trimOrNull(formData.get("phone")),
      fax: trimOrNull(formData.get("fax")),
      email: trimOrNull(formData.get("email")),
      claimsEmail: trimOrNull(formData.get("claims_email")),
      secureMessaging: trimOrNull(formData.get("secure_messaging")),
      website: trimOrNull(formData.get("website")),
    })

    if ("error" in result && result.error) {
      return { error: result.error }
    }

    savedOrganisationId = result.organisationId
  } catch {
    return { error: "Unable to save organisation. Please try again." }
  }

  redirect(`/contacts/organisations/${savedOrganisationId}`)
}

export async function saveProfessionalAction(
  practiceId: string,
  professionalId: string | undefined,
  _prevState: ContactsFormState,
  formData: FormData
): Promise<ContactsFormState> {
  let savedProfessionalId: string | undefined

  try {
    const professionId = trimOrNull(formData.get("profession_id"))
    const links = parseOrganisationLinksFromForm(formData)

    const result = await upsertProfessional(practiceId, {
      professionalId: professionalId || undefined,
      firstName: String(formData.get("first_name") ?? ""),
      lastName: String(formData.get("last_name") ?? ""),
      title: trimOrNull(formData.get("title")),
      professionId,
      organisationLinks: links,
    })

    if ("error" in result && result.error) {
      return { error: result.error }
    }

    savedProfessionalId = result.professionalId
  } catch {
    return { error: "Unable to save professional. Please try again." }
  }

  redirect(`/contacts/professionals/${savedProfessionalId}`)
}

export async function saveProfessionAction(
  practiceId: string,
  professionId: string | undefined,
  _prevState: ContactsFormState,
  formData: FormData
): Promise<ContactsFormState> {
  const result = await upsertProfession(practiceId, {
    professionId: professionId || undefined,
    professionName: String(formData.get("profession_name") ?? ""),
  })

  if ("error" in result && result.error) {
    return { error: result.error }
  }

  revalidatePath("/settings/professions")
  return {}
}
