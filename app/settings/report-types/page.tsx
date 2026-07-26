import Link from "next/link"

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
import { getReportTypes } from "@/lib/actions/report-types"
import { requirePractitionerContext } from "@/lib/auth"
import { REPORT_TEMPLATE_LABELS, resolveTemplateKey } from "@/lib/reports/templates"

export default async function ReportTypesPage() {
  const context = await requirePractitionerContext()
  const types = await getReportTypes(context.practiceId)

  return (
    <AppShell>
      <ListPageHeader
        heading="Report Types"
        action={
          <Button asChild>
            <Link href="/settings/report-types/new">Add Report Type</Link>
          </Button>
        }
      />

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Template</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {types.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={2}
                  className="h-20 text-center text-muted-foreground"
                >
                  No report types yet.
                </TableCell>
              </TableRow>
            ) : (
              types.map((rt) => {
                const typeHref = `/settings/report-types/${rt.reportTypeId}`

                return (
                  <TableRow
                    key={rt.reportTypeId}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell>
                      <Link
                        href={typeHref}
                        className="block font-medium text-primary hover:underline"
                      >
                        {rt.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={typeHref} className="block">
                        {REPORT_TEMPLATE_LABELS[resolveTemplateKey(rt.templateKey)]}
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
