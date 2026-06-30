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
import {
  REPORTING_REQUIREMENT_STATUS_CONFIG,
  REPORTING_OVERALL_STATUS_CONFIG,
  deriveReportingRequirementStatus,
  deriveReportingOverallStatus,
} from "@/lib/funding/reporting-status"
import { FUNDING_APPROVAL_STATUS_CONFIG, APPOINTMENT_STATUS_CONFIG } from "@/lib/status"
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

  const reportingStatuses = approval.typeReports.map((req) => {
    const linked = approval.reportLinks.find(
      (link) =>
        link.appointmentNumber === req.appointmentNumber && link.simpleReportId
    )
    return deriveReportingRequirementStatus({
      hasLinkedReport: Boolean(linked),
      appointmentNumber: req.appointmentNumber,
      appointmentsAttended: approval.appointmentsAttended,
    })
  })

  const reportingOverallStatus = deriveReportingOverallStatus(reportingStatuses)

  const expiryPercent = (() => {
    if (!approval.startDate || !approval.endDate) return null
    const start = new Date(approval.startDate + "T00:00:00").getTime()
    const end = new Date(approval.endDate + "T00:00:00").getTime()
    const now = Date.now()
    const total = end - start
    if (total <= 0) return null
    return Math.min(100, Math.max(0, ((now - start) / total) * 100))
  })()

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
        <p className="mt-1 text-muted-foreground">
          {approval.clientLastName}, {approval.clientFirstName}
          {approval.approvalTypeName ? ` — ${approval.approvalTypeName}` : ""}
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Approval status</dt>
              <dd className="mt-0.5">
                <StatusBadge
                  status={approval.approvalStatus}
                  statusMap={FUNDING_APPROVAL_STATUS_CONFIG}
                />
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Reporting status</dt>
              <dd className="mt-0.5">
                {reportingOverallStatus ? (
                  <StatusBadge
                    status={reportingOverallStatus}
                    statusMap={REPORTING_OVERALL_STATUS_CONFIG}
                  />
                ) : (
                  <span className="text-sm text-muted-foreground">
                    No requirements
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="mb-2 text-sm text-muted-foreground">
                Appointment progress ({progress})
              </dt>
              <dd>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </dd>
            </div>
            <div>
              <dt className="mb-2 text-sm text-muted-foreground">
                Expiry
                {approval.startDate && approval.endDate
                  ? ` (${formatDisplayDate(approval.startDate)} – ${formatDisplayDate(approval.endDate)})`
                  : ""}
              </dt>
              <dd>
                {expiryPercent !== null ? (
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${expiryPercent}%` }}
                    />
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    No end date set
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Approval details</CardTitle>
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
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approval.linkedAppointments.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-16 text-center text-muted-foreground"
                    >
                      No linked appointments.
                    </TableCell>
                  </TableRow>
                ) : (
                  approval.linkedAppointments.map((appointment, index) => (
                    <TableRow
                      key={appointment.appointmentId}
                      className="cursor-pointer hover:bg-muted/50"
                    >
                      <TableCell>
                        <Link
                          href={`/appointments/${appointment.appointmentId}`}
                          className="block"
                        >
                          {index + 1}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/appointments/${appointment.appointmentId}`}
                          className="block"
                        >
                          {formatAppointmentDate(appointment.appointmentDate)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/appointments/${appointment.appointmentId}`}
                          className="block"
                        >
                          {formatAppointmentTime(appointment.appointmentTime)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/appointments/${appointment.appointmentId}`}
                          className="block"
                        >
                          {appointment.location?.trim() || "—"}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/appointments/${appointment.appointmentId}`}
                          className="block"
                        >
                          <StatusBadge
                            status={appointment.status}
                            statusMap={APPOINTMENT_STATUS_CONFIG}
                          />
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

      <Card>
        <CardHeader>
          <CardTitle>Reporting</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session</TableHead>
                  <TableHead>Report Type</TableHead>
                  <TableHead>Linked Report</TableHead>
                  <TableHead>Report Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approval.typeReports.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-16 text-center text-muted-foreground"
                    >
                      No reporting requirements configured for this approval type.
                    </TableCell>
                  </TableRow>
                ) : (
                  approval.typeReports.map((requirement) => {
                    const linked = approval.reportLinks.find(
                      (link) =>
                        link.appointmentNumber === requirement.appointmentNumber &&
                        link.simpleReportId
                    )
                    const status = deriveReportingRequirementStatus({
                      hasLinkedReport: Boolean(linked),
                      appointmentNumber: requirement.appointmentNumber,
                      appointmentsAttended: approval.appointmentsAttended,
                    })
                    return (
                      <TableRow key={requirement.reportRequirementId}>
                        <TableCell>{requirement.appointmentNumber}</TableCell>
                        <TableCell>{requirement.reportType}</TableCell>
                        <TableCell>
                          {linked?.simpleReportId ? (
                            <Link
                              href={`/clients/${approval.clientId}/reports/${linked.simpleReportId}`}
                              className="text-primary hover:underline"
                            >
                              View
                            </Link>
                          ) : (
                            <Button variant="outline" size="sm" asChild>
                              <Link
                                href={`/clients/${approval.clientId}/reports/new?fundingApprovalId=${approval.fundingApprovalId}&reportRequirementId=${requirement.reportRequirementId}`}
                              >
                                Create report
                              </Link>
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            status={status}
                            statusMap={REPORTING_REQUIREMENT_STATUS_CONFIG}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  )
}
