import Link from "next/link"

import { EmailTemplateForm } from "@/components/email-templates/email-template-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getEmailTemplates } from "@/lib/actions/email-templates"
import { requirePractitionerContext } from "@/lib/auth"

function truncate(value: string, maxLength = 48) {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength)}…`
}

export default async function EmailTemplatesPage() {
  const context = await requirePractitionerContext()
  const templates = await getEmailTemplates(context.practiceId)

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton fallbackHref="/practice" label="← Back to practice" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Email Templates
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage email templates for client communications.
            </p>
          </div>
          <Button asChild>
            <Link href="/settings/email-templates/new">Add Template</Link>
          </Button>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Has action button</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-20 text-center text-muted-foreground"
                >
                  No email templates yet.
                </TableCell>
              </TableRow>
            ) : (
              templates.map((template) => (
                <TableRow key={template.emailTemplateId}>
                  <TableCell>
                    <Link
                      href={`/settings/email-templates/${template.emailTemplateId}/edit`}
                      className="font-medium text-primary hover:underline"
                    >
                      {template.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {template.subject.trim()
                      ? truncate(template.subject)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {template.hasActionButton ? "Yes" : "No"}
                  </TableCell>
                  <TableCell>
                    {template.isActive ? "Active" : "Inactive"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  )
}
