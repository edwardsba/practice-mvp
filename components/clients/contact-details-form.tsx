"use client"

import { useRouter } from "next/navigation"
import { useActionState, useEffect } from "react"

import {
  updateClientContactDetails,
  type UpdateClientFormState,
} from "@/app/clients/[client_id]/edit/actions"
import { FormCheckboxField } from "@/components/treatment-plan/form-fields"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { EditDetailsPanelId } from "@/lib/clients/edit-details-panels"
import { formatDateForInput } from "@/lib/dates/practice-time"

const initialState: UpdateClientFormState = {}

export type ContactDetailsClient = {
  firstName: string
  preferredName: string | null
  lastName: string
  dateOfBirth: string | null
  email: string | null
  phone: string | null
  address: string | null
  notes?: string | null
  commsOptOut: boolean
  reminderOptOut: boolean
  preSessionOptOut: boolean
  postSessionOptOut: boolean
  adminCommsOptOut: boolean
  onlineBookingPermitted: boolean
}

export function ContactDetailsForm({
  clientId,
  client,
  mode,
  showNotes = false,
  showSaved = false,
  redirectPanel = "details",
}: {
  clientId: string
  client: ContactDetailsClient
  mode: "page" | "embedded"
  showNotes?: boolean
  showSaved?: boolean
  /** Which Edit details panel to reopen after save (page mode only). */
  redirectPanel?: EditDetailsPanelId
}) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(
    updateClientContactDetails.bind(
      null,
      clientId,
      mode,
      mode === "page" ? redirectPanel : null,
      showNotes
    ),
    initialState
  )

  useEffect(() => {
    if (mode === "embedded" && state.success) {
      router.refresh()
    }
  }, [mode, state.success, router])

  const savedVisible =
    mode === "embedded"
      ? Boolean(state.success && !state.error)
      : showSaved && !state.error

  return (
    <form action={formAction} className="space-y-6">
      <ContactFields client={client} showNotes={showNotes} />

      <fieldset className="space-y-4 border-t pt-6">
        <legend className="text-sm font-semibold">Communication preferences</legend>
        <FormCheckboxField
          id={`${clientId}-comms_opt_out`}
          name="comms_opt_out"
          label="Global contact opt-out"
          defaultChecked={client.commsOptOut}
        />
        <FormCheckboxField
          id={`${clientId}-reminder_opt_out`}
          name="reminder_opt_out"
          label="Opt out of appointment reminder emails"
          defaultChecked={client.reminderOptOut}
        />
        <FormCheckboxField
          id={`${clientId}-pre_session_opt_out`}
          name="pre_session_opt_out"
          label="Opt out of pre-session questionnaire emails"
          defaultChecked={client.preSessionOptOut}
        />
        <FormCheckboxField
          id={`${clientId}-post_session_opt_out`}
          name="post_session_opt_out"
          label="Opt out of post-session questionnaire emails"
          defaultChecked={client.postSessionOptOut}
        />
        <FormCheckboxField
          id={`${clientId}-admin_comms_opt_out`}
          name="admin_comms_opt_out"
          label="Opt out of admin communication emails"
          defaultChecked={client.adminCommsOptOut}
        />
        <FormCheckboxField
          id={`${clientId}-online_booking_permitted`}
          name="online_booking_permitted"
          label="Online booking permitted"
          defaultChecked={client.onlineBookingPermitted}
        />
      </fieldset>

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      {savedVisible ? (
        <p className="text-sm text-muted-foreground" role="status">
          Saved
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  )
}

function ContactFields({
  client,
  showNotes,
}: {
  client: ContactDetailsClient
  showNotes: boolean
}) {
  return (
    <div className="space-y-4">
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
        <Label htmlFor="preferred_name">Preferred name</Label>
        <Input
          id="preferred_name"
          name="preferred_name"
          defaultValue={client.preferredName ?? ""}
          placeholder="Optional — used in headers and interview"
        />
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
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={client.phone ?? ""}
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
        <Label htmlFor="address">Address</Label>
        <Input
          id="address"
          name="address"
          defaultValue={client.address ?? ""}
          placeholder="e.g. 123 Smith St, Sydney NSW 2000"
        />
      </div>

      {showNotes ? (
        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            name="notes"
            rows={4}
            defaultValue={client.notes ?? ""}
            placeholder="General notes about this client..."
          />
        </div>
      ) : null}
    </div>
  )
}