"use client"

import Link from "next/link"
import { useActionState, useState } from "react"

import {
  EmergencyContactsFormFields,
  MultiSelectSectionFields,
} from "@/components/crisis-plan/form-fields"
import type { CrisisPlanFormState } from "@/app/clients/[client_id]/crisis-plan/actions"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  BECOMING_UNWELL_OPTIONS,
  CRISIS_RESPONSE_OPTIONS,
  DOING_WELL_OPTIONS,
  EMERGENCY_NUMBERS_OPTIONS,
  GET_BETTER_OPTIONS,
  STAY_WELL_OPTIONS,
  UNWELL_OPTIONS,
} from "@/lib/crisis-plans/fields"
import { formatDateForInput, todayDateInput } from "@/lib/crisis-plans/serialize"
import type {
  CrisisPlanRow,
  EmergencyContactInput,
  EmergencyContactRow,
} from "@/lib/crisis-plans/types"

const emptyMulti = { selected: [], other: [] }

export function CrisisPlanForm({
  action,
  initialPlan,
  initialContacts,
  submitLabel,
  cancelHref,
}: {
  action: (
    prevState: CrisisPlanFormState,
    formData: FormData
  ) => Promise<CrisisPlanFormState>
  initialPlan?: CrisisPlanRow
  initialContacts: EmergencyContactRow[]
  submitLabel: string
  cancelHref: string
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const [emergencyContacts, setEmergencyContacts] = useState<
    EmergencyContactInput[]
  >(
    initialContacts.map((contact) => ({
      contactId: contact.contactId,
      role: contact.role ?? "",
      name: contact.name,
      phone: contact.phone ?? "",
      email: contact.email ?? "",
    }))
  )

  const plan = initialPlan

  return (
    <form action={formAction} className="space-y-6">
      <input
        type="hidden"
        name="emergency_contacts_json"
        value={JSON.stringify(emergencyContacts)}
      />

      <Card>
        <CardHeader>
          <CardTitle>Crisis plan details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs space-y-2">
            <Label htmlFor="date_of_plan">Date of plan</Label>
            <Input
              id="date_of_plan"
              name="date_of_plan"
              type="date"
              required
              defaultValue={
                formatDateForInput(plan?.dateOfPlan ?? null) || todayDateInput()
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Emergency contacts</CardTitle>
        </CardHeader>
        <CardContent>
          <EmergencyContactsFormFields
            initialContacts={initialContacts}
            onChange={setEmergencyContacts}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Emergency numbers</CardTitle>
        </CardHeader>
        <CardContent>
          <MultiSelectSectionFields
            prefix="en"
            options={EMERGENCY_NUMBERS_OPTIONS}
            value={plan?.emergencyNumbersJson ?? emptyMulti}
            includeOther={false}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Doing well / Staying well</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-3 text-sm font-semibold">
              Signs that I am doing well
            </h3>
            <MultiSelectSectionFields
              prefix="dw"
              options={DOING_WELL_OPTIONS}
              value={plan?.doingWellJson ?? emptyMulti}
            />
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold">
              Things I need to do to stay well
            </h3>
            <MultiSelectSectionFields
              prefix="sw"
              options={STAY_WELL_OPTIONS}
              value={plan?.stayWellJson ?? emptyMulti}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Becoming unwell / Getting better</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-3 text-sm font-semibold">
              Signs that I am becoming unwell
            </h3>
            <MultiSelectSectionFields
              prefix="bu"
              options={BECOMING_UNWELL_OPTIONS}
              value={plan?.becomingUnwellJson ?? emptyMulti}
            />
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold">
              Things I need to do to get better
            </h3>
            <MultiSelectSectionFields
              prefix="gb"
              options={GET_BETTER_OPTIONS}
              value={plan?.getBetterJson ?? emptyMulti}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Unwell / Crisis response</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-3 text-sm font-semibold">
              Signs that I am unwell or in crisis
            </h3>
            <MultiSelectSectionFields
              prefix="uw"
              options={UNWELL_OPTIONS}
              value={plan?.unwellJson ?? emptyMulti}
            />
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold">
              Things to do when I am unwell — Crisis response
            </h3>
            <MultiSelectSectionFields
              prefix="cr"
              options={CRISIS_RESPONSE_OPTIONS}
              value={plan?.crisisResponseJson ?? emptyMulti}
            />
          </div>
        </CardContent>
      </Card>

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
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
