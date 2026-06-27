import Link from "next/link"

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
import { getReportTypes } from "@/lib/actions/report-types"
import { requirePractitionerContext } from "@/lib/auth"

export default async function ReportTypesPage() {
  const context = await requirePractitionerContext()
  const types = await getReportTypes(context.practiceId)

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton fallbackHref="/practice" label="← Back to practice" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Report Types
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage report types used in funding approval requirements.
            </p>
          </div>
          <Button asChild>
            <Link href="/settings/report-types/new">Add Report Type</Link>
          </Button>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {types.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={1}
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
