import Link from "next/link"

import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { ListPageHeader } from "@/components/ui/list-page-header"
import { OrganisationForm } from "@/components/contacts/organisation-form"
import { saveProfessionalOrganisationAction } from "@/lib/actions/contacts"
import { requirePractitionerContext } from "@/lib/auth"
import { resolveBackNavigation } from "@/lib/navigation/back"

export default async function NewOrganisationPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>
}) {
  const context = await requirePractitionerContext()
  const { returnTo } = await searchParams
  const back = resolveBackNavigation(
    returnTo,
    "/contacts/organisations",
    "← Back to organisations"
  )

  return (
    <AppShell>
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href={back.href}>{back.label}</Link>
        </Button>
      </div>
      <ListPageHeader heading="Add organisation" />
      <OrganisationForm
        action={saveProfessionalOrganisationAction.bind(
          null,
          context.practiceId,
          undefined,
          returnTo ?? null
        )}
        submitLabel="Save organisation"
        cancelHref={back.href}
      />
    </AppShell>
  )
}
