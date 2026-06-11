"use client"

import Link from "next/link"
import { useActionState } from "react"

import {
  updateClient,
  type UpdateClientFormState,
} from "@/app/clients/[client_id]/edit/actions"
import { FormCheckboxField } from "@/components/treatment-plan/form-fields"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const initialState: UpdateClientFormState = {}

function formatDateForInput(value: string | null): string {
  if (!value) return ""
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ""
  return date.toISOString().slice(0, 10)
}

export function EditClientForm({
  clientId,
  client,
}: {
  clientId: string
  client: {
    firstName: string
    lastName: string
    dateOfBirth: string | null
    email: string | null
    phone: string | null
    commsOptOut: boolean
    reminderOptOut: boolean
    preSessionOptOut: boolean
    postSessionOptOut: boolean
    adminCommsOptOut: boolean
    onlineBookingPermitted: boolean
  }
}) {
  const [state, formAction, pending] = useActionState(
    updateClient.bind(null, clientId),
    initialState
  )

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="first_name">First name</Label>
          <Input
            id="first_name"
            name="first_name"
            required
            defaultValue={client.firstName}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="last_name">Last name</Label>
          <Input
            id="last_name"
            name="last_name"
            required
            defaultValue={client.lastName}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="date_of_birth">Date of birth</Label>
        <Input
          id="date_of_birth"
          name="date_of_birth"
          type="date"
          defaultValue={formatDateForInput(client.dateOfBirth)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          defaultValue={client.email ?? ""}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={client.phone ?? ""}
        />
      </div>

      <div id="communication-preferences" className="space-y-4 border-t pt-6">
        <div>
          <h2 className="text-lg font-medium">Communication Preferences</h2>
          <p className="text-sm text-muted-foreground">
            Manage how this client receives communications from your practice.
          </p>
        </div>

        <FormCheckboxField
          id="comms_opt_out"
          name="comms_opt_out"
          label="Global contact opt-out"
          defaultChecked={client.commsOptOut}
        />
        <FormCheckboxField
          id="reminder_opt_out"
          name="reminder_opt_out"
          label="Opt out of appointment reminder emails"
          defaultChecked={client.reminderOptOut}
        />
        <FormCheckboxField
          id="pre_session_opt_out"
          name="pre_session_opt_out"
          label="Opt out of pre-session questionnaire emails"
          defaultChecked={client.preSessionOptOut}
        />
        <FormCheckboxField
          id="post_session_opt_out"
          name="post_session_opt_out"
          label="Opt out of post-session questionnaire emails"
          defaultChecked={client.postSessionOptOut}
        />
        <FormCheckboxField
          id="admin_comms_opt_out"
          name="admin_comms_opt_out"
          label="Opt out of admin communication emails"
          defaultChecked={client.adminCommsOptOut}
        />
        <FormCheckboxField
          id="online_booking_permitted"
          name="online_booking_permitted"
          label="Online booking permitted"
          defaultChecked={client.onlineBookingPermitted}
        />
      </div>

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href={`/clients/${clientId}`}>Cancel</Link>
        </Button>
      </div>
    </form>
  )
}
