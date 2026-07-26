import Link from "next/link"

import { EmailTemplateForm } from "@/components/email-templates/email-template-form"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { ListPageHeader } from "@/components/ui/list-page-header"
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
      <ListPageHeader
        heading="Email Templates"
        action={
          <Button asChild>
            <Link href="/settings/email-templates/new">Add Template</Link>
          </Button>
        }
      />

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
              templates.map((template) => {
                const templateHref = `/settings/email-templates/${template.emailTemplateId}/edit`

                return (
                  <TableRow
                    key={template.emailTemplateId}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell>
                      <Link href={templateHref} className="block font-medium text-primary hover:underline">
                        {template.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={templateHref} className="block">
                        {template.subject.trim()
                          ? truncate(template.subject)
                          : "—"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={templateHref} className="block">
                        {template.hasActionButton ? "Yes" : "No"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={templateHref} className="block">
                        {template.isActive ? "Active" : "Inactive"}
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  )
}
