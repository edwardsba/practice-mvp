"use client"

import Link from "next/link"
import { useActionState } from "react"

import {
  updatePractitionerProfile,
  type PractitionerFormState,
} from "@/app/practitioner/actions"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Practitioner details</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
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
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p className="text-sm text-emerald-700">Profile saved.</p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/practitioner">Cancel</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
