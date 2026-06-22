"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useActionState, useEffect, useState } from "react"

import type {
  ContactsFormState,
  OrganisationLinkInput,
} from "@/lib/actions/contacts"
import {
  clearProfessionalFormDraft,
  readProfessionalFormDraft,
  writeProfessionalFormDraft,
  type ProfessionalFormDraft,
} from "@/lib/contacts/professional-form-draft"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const selectClassName = cn(
  "flex h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
)

type OrganisationOption = {
  organisationId: string
  organisationName: string
}

type ProfessionOption = {
  professionId: string
  professionName: string
}

type ProfessionalInitialValues = {
  title: string | null
  firstName: string
  lastName: string
  professionId: string | null
  organisationLinks: OrganisationLinkInput[]
}

function emptyLink(): OrganisationLinkInput {
  return {
    organisationId: "",
    medicareProviderNumber: "",
    directSecureMessaging: "",
    directPhone: "",
    directEmail: "",
  }
}

export function ProfessionalForm({
  action,
  professionalId,
  professions,
  organisations,
  initialValues,
  submitLabel,
  cancelHref,
}: {
  action: (
    prevState: ContactsFormState,
    formData: FormData
  ) => Promise<ContactsFormState>
  professionalId?: string
  professions: ProfessionOption[]
  organisations: OrganisationOption[]
  initialValues?: ProfessionalInitialValues
  submitLabel: string
  cancelHref: string
}) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(action, {})
  const [organisationOptions, setOrganisationOptions] =
    useState<OrganisationOption[]>(organisations)
  const [title, setTitle] = useState(initialValues?.title ?? "")
  const [firstName, setFirstName] = useState(initialValues?.firstName ?? "")
  const [lastName, setLastName] = useState(initialValues?.lastName ?? "")
  const [professionId, setProfessionId] = useState(
    initialValues?.professionId ?? ""
  )
  const [links, setLinks] = useState<OrganisationLinkInput[]>(
    initialValues?.organisationLinks.length
      ? initialValues.organisationLinks
      : [emptyLink()]
  )

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const createdOrganisationId = params.get("created_organisation_id")
    const draft = readProfessionalFormDraft(professionalId)

    function applyCreatedOrganisation(
      currentLinks: OrganisationLinkInput[]
    ): OrganisationLinkInput[] {
      if (!createdOrganisationId) return currentLinks
      const emptyIndex = currentLinks.findIndex((link) => !link.organisationId)
      if (emptyIndex !== -1) {
        return currentLinks.map((link, i) =>
          i === emptyIndex
            ? { ...link, organisationId: createdOrganisationId }
            : link
        )
      }
      return [
        ...currentLinks,
        { ...emptyLink(), organisationId: createdOrganisationId },
      ]
    }

    if (draft) {
      setTitle(draft.title)
      setFirstName(draft.firstName)
      setLastName(draft.lastName)
      setProfessionId(draft.professionId)
      setLinks(applyCreatedOrganisation(draft.links))
      clearProfessionalFormDraft(professionalId)
    } else if (createdOrganisationId) {
      setLinks((current) => applyCreatedOrganisation(current))
    }

    if (createdOrganisationId) {
      params.delete("created_organisation_id")
      const newSearch = params.toString()
      router.replace(
        `${window.location.pathname}${newSearch ? `?${newSearch}` : ""}`
      )
    }
    // Intentionally run once on mount only — this reads the current URL and
    // any saved draft a single time when the form first loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateLink = (
    index: number,
    field: keyof OrganisationLinkInput,
    value: string
  ) => {
    setLinks((current) =>
      current.map((link, i) =>
        i === index ? { ...link, [field]: value } : link
      )
    )
  }

  const addLink = () => {
    setLinks((current) => [...current, emptyLink()])
  }

  const removeLink = (index: number) => {
    setLinks((current) =>
      current.length === 1 ? [emptyLink()] : current.filter((_, i) => i !== index)
    )
  }

  function handleCreateOrganisationClick() {
    const draft: ProfessionalFormDraft = {
      title,
      firstName,
      lastName,
      professionId,
      links,
    }
    writeProfessionalFormDraft(professionalId, draft)

    const currentUrl = `${window.location.pathname}${window.location.search}`
    router.push(
      `/contacts/organisations/new?returnTo=${encodeURIComponent(currentUrl)}`
    )
  }

  return (
    <form action={formAction} className="space-y-6">
      <input
        type="hidden"
        name="organisation_links_json"
        value={JSON.stringify(links.filter((link) => link.organisationId))}
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Professional details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="first_name">First name</Label>
              <Input
                id="first_name"
                name="first_name"
                required
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last name</Label>
              <Input
                id="last_name"
                name="last_name"
                required
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="profession_id">Profession</Label>
            <select
              id="profession_id"
              name="profession_id"
              value={professionId}
              onChange={(event) => setProfessionId(event.target.value)}
              className={selectClassName}
            >
              <option value="">Select a profession</option>
              {professions.map((profession) => (
                <option
                  key={profession.professionId}
                  value={profession.professionId}
                >
                  {profession.professionName}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-4xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Organisations</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCreateOrganisationClick}
          >
            Create Organisation
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {links.map((link, index) => (
            <div
              key={link.linkId ?? `new-${index}`}
              className="rounded-lg border p-4 space-y-3"
            >
              <div className="space-y-2">
                <Label>Organisation</Label>
                <select
                  value={link.organisationId}
                  onChange={(event) =>
                    updateLink(index, "organisationId", event.target.value)
                  }
                  className={selectClassName}
                  required={links.length === 1}
                >
                  <option value="">Select an organisation</option>
                  {organisationOptions.map((organisation) => (
                    <option
                      key={organisation.organisationId}
                      value={organisation.organisationId}
                    >
                      {organisation.organisationName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Medicare provider no.</Label>
                  <Input
                    value={link.medicareProviderNumber ?? ""}
                    onChange={(event) =>
                      updateLink(
                        index,
                        "medicareProviderNumber",
                        event.target.value
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Direct secure messaging</Label>
                  <Input
                    value={link.directSecureMessaging ?? ""}
                    onChange={(event) =>
                      updateLink(
                        index,
                        "directSecureMessaging",
                        event.target.value
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Direct phone</Label>
                  <Input
                    value={link.directPhone ?? ""}
                    onChange={(event) =>
                      updateLink(index, "directPhone", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Direct email</Label>
                  <Input
                    type="email"
                    value={link.directEmail ?? ""}
                    onChange={(event) =>
                      updateLink(index, "directEmail", event.target.value)
                    }
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => removeLink(index)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
          <div className="flex justify-start">
            <Button type="button" variant="outline" size="sm" onClick={addLink}>
              Add Linked Organisation
            </Button>
          </div>
        </CardContent>
      </Card>

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href={cancelHref}>Cancel</Link>
        </Button>
      </div>
    </form>
  )
}
