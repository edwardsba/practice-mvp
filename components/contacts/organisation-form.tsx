"use client"

import Link from "next/link"
import { useActionState } from "react"

import type { ContactsFormState } from "@/lib/actions/contacts"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type OrganisationInitialValues = {
  organisationName: string
  organisationType: string | null
  streetAddress: string | null
  postalAddress: string | null
  phone: string | null
  fax: string | null
  email: string | null
  claimsEmail: string | null
  secureMessaging: string | null
  website: string | null
}

export function OrganisationForm({
  action,
  initialValues,
  submitLabel,
  cancelHref,
}: {
  action: (
    prevState: ContactsFormState,
    formData: FormData
  ) => Promise<ContactsFormState>
  initialValues?: OrganisationInitialValues
  submitLabel: string
  cancelHref: string
}) {
  const [state, formAction, pending] = useActionState(action, {})

  return (
    <form action={formAction} className="space-y-6">
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Organisation details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="organisation_name">Organisation name</Label>
            <Input
              id="organisation_name"
              name="organisation_name"
              required
              defaultValue={initialValues?.organisationName ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="organisation_type">Organisation type</Label>
            <Input
              id="organisation_type"
              name="organisation_type"
              defaultValue={initialValues?.organisationType ?? ""}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="street_address">Street address</Label>
              <Input
                id="street_address"
                name="street_address"
                defaultValue={initialValues?.streetAddress ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postal_address">Postal address</Label>
              <Input
                id="postal_address"
                name="postal_address"
                defaultValue={initialValues?.postalAddress ?? ""}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                defaultValue={initialValues?.phone ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fax">Fax</Label>
              <Input
                id="fax"
                name="fax"
                defaultValue={initialValues?.fax ?? ""}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={initialValues?.email ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="claims_email">Claims email</Label>
              <Input
                id="claims_email"
                name="claims_email"
                type="email"
                defaultValue={initialValues?.claimsEmail ?? ""}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="secure_messaging">Secure messaging</Label>
              <Input
                id="secure_messaging"
                name="secure_messaging"
                defaultValue={initialValues?.secureMessaging ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                name="website"
                defaultValue={initialValues?.website ?? ""}
              />
            </div>
          </div>
          {state.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}
        </CardContent>
      </Card>

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
