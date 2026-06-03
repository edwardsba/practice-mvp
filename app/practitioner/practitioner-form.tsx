"use client"

import { useActionState } from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  updatePractitionerProfile,
  type PractitionerFormState,
} from "@/app/practitioner/actions"

type Profile = {
  title: string | null
  fullName: string
  registrationNumber: string | null
  registrationBody: string | null
}

const initialState: PractitionerFormState = {}

export function PractitionerForm({ profile }: { profile: Profile }) {
  const [state, formAction, pending] = useActionState(
    updatePractitionerProfile,
    initialState
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Practitioner profile</CardTitle>
        <CardDescription>
          Your professional details for reports and correspondence.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="max-w-xl space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              placeholder="Dr"
              defaultValue={profile.title ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="full_name">Full name</Label>
            <Input
              id="full_name"
              name="full_name"
              defaultValue={profile.fullName}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="registration_number">Registration number</Label>
            <Input
              id="registration_number"
              name="registration_number"
              defaultValue={profile.registrationNumber ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="registration_body">Registration body</Label>
            <Input
              id="registration_body"
              name="registration_body"
              placeholder="AHPRA"
              defaultValue={profile.registrationBody ?? ""}
            />
          </div>
          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
          {state.success ? (
            <p className="text-sm text-emerald-700">Profile saved.</p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
