import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EMAIL_TEMPLATE_VARIABLE_CHIPS } from "@/lib/email/templates"
import { requirePractitionerContext } from "@/lib/auth"

export default async function EmailVariablesPage() {
  await requirePractitionerContext()

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton fallbackHref="/practice" label="← Back to practice" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Email Variables
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Placeholders you can insert into email template subject and message
            fields.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Email Variables</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Variable</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Example</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {EMAIL_TEMPLATE_VARIABLE_CHIPS.map((chip) => (
                  <TableRow key={chip.variable}>
                    <TableCell className="font-mono text-sm">
                      {chip.variable}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {chip.description}
                    </TableCell>
                    <TableCell>{chip.example}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  )
}
