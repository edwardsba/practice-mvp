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
import { Textarea } from "@/components/ui/textarea"

type Profile = {
  title: string | null
  firstName: string
  preferredName: string | null
  lastName: string
  registrationNumber: string | null
  registrationBody: string | null
  phone: string | null
  email: string | null
  reportSignature: string | null
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="first_name">First name</Label>
              <Input
                id="first_name"
                name="first_name"
                defaultValue={profile.firstName}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preferred_name">Preferred name</Label>
              <Input
                id="preferred_name"
                name="preferred_name"
                defaultValue={profile.preferredName ?? ""}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="last_name">Last name</Label>
            <Input
              id="last_name"
              name="last_name"
              defaultValue={profile.lastName}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
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
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={profile.phone ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={profile.email ?? ""}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="report_signature">Report signature</Label>
            <Textarea
              id="report_signature"
              name="report_signature"
              rows={4}
              placeholder="Benjamin Edwards MAPS FCCLP"
              defaultValue={profile.reportSignature ?? ""}
            />
            <p className="text-xs text-muted-foreground">
              Used in report footers e.g. Benjamin Edwards MAPS FCCLP
            </p>
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
