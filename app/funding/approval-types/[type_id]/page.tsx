import Link from "next/link"
import { notFound } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { EntityPageHeader } from "@/components/ui/entity-page-header"
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
import { BackButton } from "@/components/ui/back-button"
import { getFundingApprovalTypeById } from "@/lib/actions/funding"
import { requirePractitionerContext } from "@/lib/auth"

export default async function FundingApprovalTypeDetailPage({
  params,
}: {
  params: Promise<{ type_id: string }>
}) {
  const { type_id: typeId } = await params
  const context = await requirePractitionerContext()
  const type = await getFundingApprovalTypeById(context.practiceId, typeId)

  if (!type) {
    notFound()
  }

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref="/funding/approval-types"
          label="← Back to approval types"
        />
      </div>
      <EntityPageHeader
        kicker="Funding approval type"
        name={type.name}
        subheading={type.claimTypeName ?? "No claim type set"}
        subheadingAction={
          <Button variant="outline" size="sm" asChild>
            <Link href={`/funding/approval-types/${typeId}/edit`}>Edit</Link>
          </Button>
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">
                Approval type name
              </dt>
              <dd className="font-medium">{type.name}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Claim type</dt>
              <dd className="font-medium">{type.claimTypeName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">
                Duration to expiry
              </dt>
              <dd className="font-medium">
                {type.durationMonths
                  ? `${type.durationMonths} months`
                  : "No limit"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">
                No. of appointments
              </dt>
              <dd className="font-medium">
                {type.appointmentsApproved ?? "—"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reporting requirements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Appointment no.</TableHead>
                  <TableHead>Report type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {type.reports.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={2}
                      className="h-16 text-center text-muted-foreground"
                    >
                      No reporting requirements configured.
                    </TableCell>
                  </TableRow>
                ) : (
                  type.reports.map((report) => (
                    <TableRow key={report.reportRequirementId}>
                      <TableCell>{report.appointmentNumber}</TableCell>
                      <TableCell>{report.reportType}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  )
}
