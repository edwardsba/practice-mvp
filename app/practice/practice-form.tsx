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
  updatePractice,
  type PracticeFormState,
} from "@/app/practice/actions"

type Practice = {
  practiceName: string
  timezone: string
  address: string | null
  phone: string | null
  email: string | null
}

const initialState: PracticeFormState = {}

export function PracticeForm({ practice }: { practice: Practice }) {
  const [state, formAction, pending] = useActionState(
    updatePractice,
    initialState
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Practice details</CardTitle>
        <CardDescription>
          Information shown on reports and client communications.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="max-w-xl space-y-4">
          <div className="space-y-2">
            <Label htmlFor="practice_name">Practice name</Label>
            <Input
              id="practice_name"
              name="practice_name"
              defaultValue={practice.practiceName}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Input
              id="timezone"
              name="timezone"
              defaultValue={practice.timezone || "Australia/Sydney"}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              name="address"
              defaultValue={practice.address ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={practice.phone ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={practice.email ?? ""}
            />
          </div>
          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
          {state.success ? (
            <p className="text-sm text-emerald-700">Practice details saved.</p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
