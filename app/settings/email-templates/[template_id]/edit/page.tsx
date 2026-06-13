import { notFound } from "next/navigation"

import { EmailTemplateForm } from "@/components/email-templates/email-template-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { getEmailTemplateById } from "@/lib/actions/email-templates"
import { requirePractitionerContext } from "@/lib/auth"

export default async function EditEmailTemplatePage({
  params,
}: {
  params: Promise<{ template_id: string }>
}) {
  const { template_id: templateId } = await params
  const context = await requirePractitionerContext()
  const template = await getEmailTemplateById(context.practiceId, templateId)

  if (!template) {
    notFound()
  }

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref="/settings/email-templates"
          label="← Back to email templates"
        />
        <h1 className="text-2xl font-semibold tracking-tight">
          Edit email template
        </h1>
      </div>

      <EmailTemplateForm
        practiceId={context.practiceId}
        cancelHref="/settings/email-templates"
        initialValues={{
          emailTemplateId: template.emailTemplateId,
          templateKey: template.templateKey,
          name: template.name,
          subject: template.subject,
          message: template.message,
          defaultCc: template.defaultCc,
          defaultBcc: template.defaultBcc,
          hasActionButton: template.hasActionButton,
          actionButtonLabel: template.actionButtonLabel,
        }}
      />
    </AppShell>
  )
}
