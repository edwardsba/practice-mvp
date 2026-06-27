import { notFound } from "next/navigation"

import { ReportTypeForm } from "@/components/settings/report-type-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { EntityDeleteSection } from "@/components/entity-delete-section"
import {
  deleteReportType,
  getReportTypeById,
  getReportTypeDeleteStatus,
} from "@/lib/actions/report-types"
import { requirePractitionerContext } from "@/lib/auth"

export default async function EditReportTypePage({
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

  const deleteStatus = await getReportTypeDeleteStatus(
    context.practiceId,
    typeId
  )

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref={`/settings/report-types/${typeId}`}
          label="← Back to report type"
        />
        <h1 className="text-2xl font-semibold tracking-tight">
          Edit report type
        </h1>
      </div>

      <ReportTypeForm
        practiceId={context.practiceId}
        initialValues={{
          reportTypeId: reportType.reportTypeId,
          name: reportType.name,
        }}
        cancelHref={`/settings/report-types/${typeId}`}
      />

      <EntityDeleteSection
        entityName="Report Type"
        blockedReason={deleteStatus.blockedReason}
        deleteAction={deleteReportType.bind(null, typeId, context.practiceId)}
      />
    </AppShell>
  )
}
