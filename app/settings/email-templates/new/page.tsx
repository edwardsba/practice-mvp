import { EmailTemplateForm } from "@/components/email-templates/email-template-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { requirePractitionerContext } from "@/lib/auth"

export default async function NewEmailTemplatePage() {
  const context = await requirePractitionerContext()

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref="/settings/email-templates"
          label="← Back to email templates"
        />
        <h1 className="text-2xl font-semibold tracking-tight">
          Add email template
        </h1>
      </div>

      <EmailTemplateForm
        practiceId={context.practiceId}
        cancelHref="/settings/email-templates"
      />
    </AppShell>
  )
}
