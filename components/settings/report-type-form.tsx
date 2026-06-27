"use client"

import Link from "next/link"
import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { upsertReportType } from "@/lib/actions/report-types"

export function ReportTypeForm({
  practiceId,
  initialValues,
  cancelHref,
}: {
  practiceId: string
  initialValues?: { reportTypeId?: string; name?: string }
  cancelHref: string
}) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(
    upsertReportType.bind(null, practiceId, initialValues?.reportTypeId),
    {}
  )

  useEffect(() => {
    if (state.success && state.reportTypeId) {
      router.push(`/settings/report-types/${state.reportTypeId}`)
      router.refresh()
    }
  }, [state.success, state.reportTypeId, router])

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>
          {initialValues?.reportTypeId ? "Edit report type" : "Add report type"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              required
              defaultValue={initialValues?.name ?? ""}
            />
          </div>

          {state.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href={cancelHref}>Cancel</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
