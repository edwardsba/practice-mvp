"use client"

import Link from "next/link"
import { useActionState } from "react"

import {
  updateClient,
  type UpdateClientFormState,
} from "@/app/clients/[client_id]/edit/actions"
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
