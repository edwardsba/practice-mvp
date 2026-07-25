import Link from "next/link"
import { notFound } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
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
import {
  formatAppointmentTypeMode,
  formatAppointmentTypeStatus,
  formatCurrency,
  formatDisplayDate,
} from "@/lib/appointment-types/format"
import { getAppointmentTypeById } from "@/lib/actions/appointment-types"
import { formatAppointmentDuration } from "@/lib/appointments/format"
import { requirePractitionerContext } from "@/lib/auth"

export default async function AppointmentTypeDetailPage({
  params,
}: {
  params: Promise<{ type_id: string }>
}) {
  const { type_id: typeId } = await params
  const context = await requirePractitionerContext()
  const type = await getAppointmentTypeById(context.practiceId, typeId)

  if (!type) {
    notFound()
  }

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref="/settings/appointment-types"
          label="← Back to appointment types"
        />
        <EntityPageHeader
          kicker="Appointment type"
          name={type.nickname}
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href={`/settings/appointment-types/${typeId}/edit`}>
                Edit
              </Link>
            </Button>
          }
        />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Nickname</dt>
              <dd className="font-medium">{type.nickname}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Name</dt>
              <dd className="font-medium">{type.name}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">
                Reference number
              </dt>
              <dd className="font-medium">{type.referenceNumber ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Claim type</dt>
              <dd className="font-medium">{type.claimTypeName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Mode</dt>
              <dd className="font-medium">
                {formatAppointmentTypeMode(type.mode)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Duration</dt>
              <dd className="font-medium">
                {formatAppointmentDuration(type.durationMinutes)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Status</dt>
              <dd className="font-medium">
                {formatAppointmentTypeStatus(type.status)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">No-show fee type</dt>
              <dd className="font-medium">
                {type.isNoShowType ? "Yes — used for no-show appointments" : "No"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fee details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fee</TableHead>
                  <TableHead>Tax</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {type.fees.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-16 text-center text-muted-foreground"
                    >
                      No fee rows configured.
                    </TableCell>
                  </TableRow>
                ) : (
                  type.fees.map((fee) => (
                    <TableRow key={fee.feeId}>
                      <TableCell>{formatCurrency(fee.fee)}</TableCell>
                      <TableCell>{formatCurrency(fee.tax)}</TableCell>
                      <TableCell>{formatCurrency(fee.total)}</TableCell>
                      <TableCell>{formatDisplayDate(fee.startDate)}</TableCell>
                      <TableCell>
                        {fee.endDate ? (
                          formatDisplayDate(fee.endDate)
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                            Current
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {formatAppointmentTypeStatus(fee.status)}
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
