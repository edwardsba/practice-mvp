import Link from "next/link"
import { notFound } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { Button } from "@/components/ui/button"
import { EntityPageHeader } from "@/components/ui/entity-page-header"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getReportTypeById } from "@/lib/actions/report-types"
import { requirePractitionerContext } from "@/lib/auth"
import { REPORT_TEMPLATE_LABELS, resolveTemplateKey } from "@/lib/reports/templates"

export default async function ReportTypeDetailPage({
  params,
}: {
  params: Promise<{ type_id: string }>
}) {
  const { type_id: typeId } = await params
  const context = await requirePractitionerContext()
  const reportType = await getReportTypeById(context.practiceId, typeId)

  if (!reportType) {
    notFound()
  }

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref="/settings/report-types"
          label="← Back to report types"
        />
      </div>
      <EntityPageHeader
        kicker="Report type"
        name={reportType.name}
        subheading={REPORT_TEMPLATE_LABELS[resolveTemplateKey(reportType.templateKey)]}
        subheadingAction={
          <Button variant="outline" size="sm" asChild>
            <Link href={`/settings/report-types/${typeId}/edit`}>Edit</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Name</dt>
              <dd className="font-medium">{reportType.name}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Template</dt>
              <dd className="font-medium">
                {REPORT_TEMPLATE_LABELS[resolveTemplateKey(reportType.templateKey)]}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </AppShell>
  )
}
