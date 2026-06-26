"use client"

import Link from "next/link"
import { useActionState, useEffect, useState } from "react"

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
import { formatTimeForInput } from "@/lib/calendar/time-slots"
import { cn } from "@/lib/utils"

const selectClassName = cn(
  "flex h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
)

const timeInputClassName = cn(
  "block h-9 w-full max-w-full min-w-0 appearance-none py-1",
  "[&::-webkit-date-and-time-value]:min-w-0 [&::-webkit-date-and-time-value]:text-left"
)

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
  signatureImagePath: string | null
  calendarStartTime: string
  calendarEndTime: string
  calendarIntervalMinutes: number
}

const initialState: PractitionerFormState = {}

export function PractitionerForm({ profile }: { profile: Profile }) {
  const [state, formAction, pending] = useActionState(
    updatePractitionerProfile,
    initialState
  )
  const [sigPreviewUrl, setSigPreviewUrl] = useState<string | null>(null)
  const [sigUploading, setSigUploading] = useState(false)
  const [sigError, setSigError] = useState<string | null>(null)

  useEffect(() => {
    if (!profile.signatureImagePath) return
    fetch("/api/practitioner/signature")
      .then((r) => r.json())
      .then((data: { dataUrl?: string }) => {
        if (data.dataUrl) setSigPreviewUrl(data.dataUrl)
      })
      .catch(() => {})
  }, [profile.signatureImagePath])

  async function handleSignatureUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSigUploading(true)
    setSigError(null)
    const fd = new FormData()
    fd.append("file", file)
    const res = await fetch("/api/practitioner/signature", {
      method: "POST",
      body: fd,
    })
    const data = (await res.json()) as { ok?: boolean; error?: string }
    if (data.ok) {
      const preview = await fetch("/api/practitioner/signature")
      const pd = (await preview.json()) as { dataUrl?: string }
      if (pd.dataUrl) setSigPreviewUrl(pd.dataUrl)
    } else {
      setSigError(data.error ?? "Upload failed")
    }
    setSigUploading(false)
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Practitioner details</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-6">
          <div className="space-y-4">
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
            <div className="space-y-2">
              <Label>Signature image</Label>
              {sigPreviewUrl ? (
                <div className="space-y-2">
                  <img
                    src={sigPreviewUrl}
                    alt="Signature preview"
                    className="h-16 w-auto rounded border object-contain p-1"
                  />
                  <p className="text-xs text-muted-foreground">
                    Upload a new image to replace.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No signature image uploaded.
                </p>
              )}
              <Input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleSignatureUpload}
                disabled={sigUploading}
              />
              {sigUploading ? (
                <p className="text-xs text-muted-foreground">Uploading…</p>
              ) : null}
              {sigError ? (
                <p className="text-xs text-destructive">{sigError}</p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                PNG, JPEG or WebP, max 2MB. White or transparent background
                recommended.
              </p>
            </div>
          </div>

          <div className="space-y-4 border-t pt-6">
            <h3 className="text-sm font-medium">Calendar Settings</h3>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <div className="min-w-0 space-y-2">
                <Label htmlFor="calendar_start_time">Calendar start time</Label>
                <Input
                  id="calendar_start_time"
                  name="calendar_start_time"
                  type="time"
                  required
                  defaultValue={formatTimeForInput(profile.calendarStartTime)}
                  className={timeInputClassName}
                />
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="calendar_end_time">Calendar end time</Label>
                <Input
                  id="calendar_end_time"
                  name="calendar_end_time"
                  type="time"
                  required
                  defaultValue={formatTimeForInput(profile.calendarEndTime)}
                  className={timeInputClassName}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="calendar_interval_minutes">Time interval</Label>
              <select
                id="calendar_interval_minutes"
                name="calendar_interval_minutes"
                defaultValue={String(profile.calendarIntervalMinutes)}
                className={selectClassName}
              >
                <option value="15">15 min</option>
                <option value="30">30 min</option>
                <option value="60">60 min</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Desktop time interval (mobile is always 60 minutes)
              </p>
            </div>
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
