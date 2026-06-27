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
import {
  DEFAULT_TEMPLATE_KEY,
  REPORT_TEMPLATE_LABELS,
  REPORT_TEMPLATE_KEYS,
} from "@/lib/reports/templates"
import { cn } from "@/lib/utils"

const selectClassName = cn(
  "flex h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
)

export function ReportTypeForm({
  practiceId,
  initialValues,
  cancelHref,
}: {
  practiceId: string
  initialValues?: { reportTypeId?: string; name?: string; templateKey?: string }
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

          <div className="space-y-2">
            <Label htmlFor="template_key">Template</Label>
            <select
              id="template_key"
              name="template_key"
              defaultValue={initialValues?.templateKey ?? DEFAULT_TEMPLATE_KEY}
              className={selectClassName}
            >
              {REPORT_TEMPLATE_KEYS.map((key) => (
                <option key={key} value={key}>
                  {REPORT_TEMPLATE_LABELS[key]}
                </option>
              ))}
            </select>
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
