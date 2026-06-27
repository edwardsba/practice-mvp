import { ReportTypeForm } from "@/components/settings/report-type-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { requirePractitionerContext } from "@/lib/auth"

export default async function NewReportTypePage() {
  const context = await requirePractitionerContext()

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref="/settings/report-types"
          label="← Back to report types"
        />
        <h1 className="text-2xl font-semibold tracking-tight">
          Add report type
        </h1>
      </div>
      <ReportTypeForm
        practiceId={context.practiceId}
        cancelHref="/settings/report-types"
      />
    </AppShell>
  )
}
