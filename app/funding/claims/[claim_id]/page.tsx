import Link from "next/link"
import { notFound } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
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
import { getClaimById } from "@/lib/actions/funding"
import {
  formatAppointmentDate,
  formatAppointmentStatus,
  formatAppointmentTime,
} from "@/lib/appointments/format"
import {
  APPROVAL_STATUS_LABELS,
  formatApprovalProgress,
  formatDisplayDate,
  formatMedicareIdentifier,
  isInsuranceClaimType,
  isMedicareClaimType,
} from "@/lib/funding/format"
import { formatReportType } from "@/lib/reports/snapshot"
import { BackButton } from "@/components/ui/back-button"

function displayValue(value: string | null | undefined) {
  return value?.trim() || "—"
}

export default async function ClaimDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ claim_id: string }>
  searchParams: Promise<{ returnTo?: string }>
}) {
  const { claim_id: claimId } = await params
  const { returnTo } = await searchParams
  const claim = await getClaimById(claimId)

  if (!claim) {
    notFound()
  }

  const claimUrl = returnTo
    ? `/funding/claims/${claimId}?returnTo=${encodeURIComponent(returnTo)}`
    : `/funding/claims/${claimId}`

  const showMedicare = isMedicareClaimType(claim.claimTypeName)
  const showInsurance = isInsuranceClaimType(claim.claimTypeName)
  const approvalNameById = new Map(
    claim.fundingApprovals.map((approval) => [
      approval.fundingApprovalId,
      approval.approvalTypeName ?? "Funding approval",
    ])
  )

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton fallbackHref="/funding/claims" label="← Back to claims" />
        <h1 className="text-2xl font-semibold tracking-tight">Claim</h1>
      </div>

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Overview</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/funding/claims/${claimId}/edit`}>Edit</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Client</dt>
              <dd className="font-medium">
                <Link
                  href={`/clients/${claim.clientId}`}
                  className="text-primary hover:underline"
                >
                  {claim.clientLastName}, {claim.clientFirstName}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Claim type</dt>
              <dd className="font-medium">{claim.claimTypeName}</dd>
            </div>
            {showMedicare ? (
              <div>
                <dt className="text-sm text-muted-foreground">Medicare card no.</dt>
                <dd className="font-medium">
                  {displayValue(
                    formatMedicareIdentifier(
                      claim.medicareCardNumber,
                      claim.medicareIrn
                    )
                  )}
                </dd>
              </div>
            ) : null}
            {showInsurance ? (
              <>
                <div>
                  <dt className="text-sm text-muted-foreground">
                    Insurance organisation
                  </dt>
                  <dd className="font-medium">
                    {displayValue(claim.insuranceOrganisationName)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">
                    Insurance reference no.
                  </dt>
                  <dd className="font-medium">
                    {displayValue(claim.insuranceReferenceNumber)}
                  </dd>
                </div>
              </>
            ) : null}
            <div>
              <dt className="text-sm text-muted-foreground">Start date</dt>
              <dd className="font-medium">
                {formatDisplayDate(claim.startDate)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">End date</dt>
              <dd className="font-medium">
                {formatDisplayDate(claim.endDate)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Funding approvals</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link
              href={`/funding/approvals/new?claimId=${claimId}&returnTo=/funding/claims/${claimId}`}
            >
              Add Funding Approval
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Start date</TableHead>
                  <TableHead>Approval type</TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claim.fundingApprovals.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-16 text-center text-muted-foreground"
                    >
                      No funding approvals linked to this claim.
                    </TableCell>
                  </TableRow>
                ) : (
                  claim.fundingApprovals.map((approval) => (
                    <TableRow key={approval.fundingApprovalId}>
                      <TableCell>
                        <Link
                          href={`/funding/approvals/${approval.fundingApprovalId}`}
                          className="text-primary hover:underline"
                        >
                          {formatDisplayDate(approval.startDate)}
                        </Link>
                      </TableCell>
                      <TableCell>{approval.approvalTypeName ?? "—"}</TableCell>
                      <TableCell>
                        {formatApprovalProgress(
                          approval.appointmentsAttended,
                          approval.appointmentsApproved
                        )}
                      </TableCell>
                      <TableCell>
                        {APPROVAL_STATUS_LABELS[
                          approval.approvalStatus as keyof typeof APPROVAL_STATUS_LABELS
                        ] ?? approval.approvalStatus}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Appointments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Approval</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claim.linkedAppointments.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-16 text-center text-muted-foreground"
                    >
                      No appointments linked yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  claim.linkedAppointments.map((appointment) => (
                    <TableRow key={appointment.appointmentId}>
                      <TableCell>
                        <Link
                          href={`/appointments/${appointment.appointmentId}?returnTo=${encodeURIComponent(claimUrl)}`}
                          className="text-primary hover:underline"
                        >
                          {formatAppointmentDate(appointment.appointmentDate)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {formatAppointmentTime(appointment.appointmentTime)}
                      </TableCell>
                      <TableCell>{appointment.location?.trim() || "—"}</TableCell>
                      <TableCell>
                        {formatAppointmentStatus(appointment.status)}
                      </TableCell>
                      <TableCell>
                        {appointment.fundingApprovalId ? (
                          <Link
                            href={`/funding/approvals/${appointment.fundingApprovalId}`}
                            className="text-primary hover:underline"
                          >
                            {approvalNameById.get(appointment.fundingApprovalId) ??
                              "View"}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reporting</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Report</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claim.reports.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-16 text-center text-muted-foreground"
                    >
                      No reports yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  claim.reports.map((report) => (
                    <TableRow key={report.simpleReportId}>
                      <TableCell>
                        {formatDisplayDate(
                          report.createdAt.toISOString().slice(0, 10)
                        )}
                      </TableCell>
                      <TableCell>{formatReportType(report.reportTypeName)}</TableCell>
                      <TableCell>{report.reportStatus}</TableCell>
                      <TableCell>
                        <Link
                          href={`/clients/${claim.clientId}/reports/${report.simpleReportId}`}
                          className="text-primary hover:underline"
                        >
                          View
                        </Link>
                      </TableCell>
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
