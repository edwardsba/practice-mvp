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
import { BackButton } from "@/components/ui/back-button"
import { StatusBadge } from "@/components/ui/status-badge"
import { getFundingApprovalById } from "@/lib/actions/funding"
import {
  formatApprovalProgress,
  formatDisplayDate,
  formatMedicareIdentifier,
  isInsuranceClaimType,
  isMedicareClaimType,
} from "@/lib/funding/format"
import { FUNDING_APPROVAL_STATUS_CONFIG } from "@/lib/status"
import {
  formatAppointmentDate,
  formatAppointmentTime,
} from "@/lib/appointments/format"
function displayValue(value: string | null | undefined) {
  return value?.trim() || "—"
}

export default async function FundingApprovalDetailPage({
  params,
}: {
  params: Promise<{ approval_id: string }>
}) {
  const { approval_id: approvalId } = await params
  const approval = await getFundingApprovalById(approvalId)

  if (!approval) {
    notFound()
  }

  const progress = formatApprovalProgress(
    approval.appointmentsAttended,
    approval.appointmentsApproved
  )
  const progressPercent =
    approval.appointmentsApproved && approval.appointmentsApproved > 0
      ? Math.min(
          100,
          (approval.appointmentsAttended / approval.appointmentsApproved) * 100
        )
      : 0

  const showMedicare = isMedicareClaimType(approval.claimTypeName)
  const showInsurance = isInsuranceClaimType(approval.claimTypeName)

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref="/funding/approvals"
          label="← Back to funding approvals"
        />
        <h1 className="text-2xl font-semibold tracking-tight">
          Funding approval
        </h1>
      </div>

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Overview</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/funding/approvals/${approvalId}/edit`}>Edit</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Client</dt>
              <dd className="font-medium">
                <Link
                  href={`/clients/${approval.clientId}`}
                  className="text-primary hover:underline"
                >
                  {approval.clientLastName}, {approval.clientFirstName}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">
                Funding approval type
              </dt>
              <dd className="font-medium">
                {displayValue(approval.approvalTypeName)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Referrer</dt>
              <dd className="font-medium">
                {approval.referrerFirstName
                  ? `${approval.referrerLastName}, ${approval.referrerFirstName}${
                      approval.referrerOrganisationName
                        ? ` — ${approval.referrerOrganisationName}`
                        : ""
                    }`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Start date</dt>
              <dd className="font-medium">
                {formatDisplayDate(approval.startDate)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">End date</dt>
              <dd className="font-medium">
                {formatDisplayDate(approval.endDate)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">
                Appointments approved
              </dt>
              <dd className="font-medium">
                {approval.appointmentsApproved ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">
                Appointments attended
              </dt>
              <dd className="font-medium">{approval.appointmentsAttended}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="mb-2 text-sm text-muted-foreground">
                Appointment progress ({progress})
              </dt>
              <dd>
                <div className="h-2 w-full max-w-md overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Approval status</dt>
              <dd className="font-medium">
                <StatusBadge
                  status={approval.approvalStatus}
                  statusMap={FUNDING_APPROVAL_STATUS_CONFIG}
                />
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Claim details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Claim type</dt>
              <dd className="font-medium">
                {displayValue(approval.claimTypeName)}
              </dd>
            </div>
            {showMedicare ? (
              <div>
                <dt className="text-sm text-muted-foreground">Medicare card no.</dt>
                <dd className="font-medium">
                  {displayValue(
                    formatMedicareIdentifier(
                      approval.medicareCardNumber,
                      approval.medicareIrn
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
                    {displayValue(approval.insuranceOrganisationName)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">
                    Insurance reference no.
                  </dt>
                  <dd className="font-medium">
                    {displayValue(approval.insuranceReferenceNumber)}
                  </dd>
                </div>
              </>
            ) : null}
          </dl>
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
                  <TableHead>No.</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approval.linkedAppointments.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-16 text-center text-muted-foreground"
                    >
                      No linked appointments.
                    </TableCell>
                  </TableRow>
                ) : (
                  approval.linkedAppointments.map((appointment, index) => (
                    <TableRow key={index}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        {formatAppointmentDate(appointment.appointmentDate)}
                      </TableCell>
                      <TableCell>
                        {formatAppointmentTime(appointment.appointmentTime)}
                      </TableCell>
                      <TableCell>
                        {appointment.location?.trim() || "—"}
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
                {approval.reportLinks.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-16 text-center text-muted-foreground"
                    >
                      No reports yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  approval.reportLinks.map((report) => (
                    <TableRow key={report.linkId}>
                      <TableCell>
                        {report.createdAt
                          ? formatDisplayDate(
                              report.createdAt.toString().slice(0, 10)
                            )
                          : "—"}
                      </TableCell>
                      <TableCell>{report.reportType}</TableCell>
                      <TableCell>{report.reportStatus ?? "—"}</TableCell>
                      <TableCell>
                        {report.simpleReportId ? (
                          <Link
                            href={`/clients/${approval.clientId}/reports/${report.simpleReportId}`}
                            className="text-primary hover:underline"
                          >
                            View
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
    </AppShell>
  )
}
