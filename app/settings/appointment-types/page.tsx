import Link from "next/link"

import { AppShell } from "@/components/app-shell"
import { Badge } from "@/components/ui/badge"
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
import {
  formatAppointmentTypeStatus,
  formatCurrency,
} from "@/lib/appointment-types/format"
import { getAppointmentTypes } from "@/lib/actions/appointment-types"
import { formatAppointmentDuration } from "@/lib/appointments/format"
import { requirePractitionerContext } from "@/lib/auth"

export default async function AppointmentTypesPage() {
  const context = await requirePractitionerContext()
  const types = await getAppointmentTypes(context.practiceId)

  return (
    <AppShell>
      <ListPageHeader
        heading="Appointment Types"
        action={
          <Button asChild>
            <Link href="/settings/appointment-types/new">
              Add Appointment Type
            </Link>
          </Button>
        }
      />

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nickname</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Claim Type</TableHead>
              <TableHead>Item No.</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Current Fee</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {types.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-20 text-center text-muted-foreground"
                >
                  No appointment types yet.
                </TableCell>
              </TableRow>
            ) : (
              types.map((type) => {
                const typeHref = `/settings/appointment-types/${type.appointmentTypeId}`

                return (
                  <TableRow
                    key={type.appointmentTypeId}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell>
                      <Link href={typeHref} className="block font-medium text-primary hover:underline">
                        {type.nickname}
                      </Link>
                      {type.isNoShowType ? (
                        <Badge variant="outline" className="mt-1 text-xs">
                          No-show
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Link href={typeHref} className="block">
                        {type.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={typeHref} className="block">
                        {type.claimTypeName ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={typeHref} className="block">
                        {type.referenceNumber ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={typeHref} className="block">
                        {formatAppointmentDuration(type.durationMinutes)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={typeHref} className="block">
                        {type.currentFee
                          ? formatCurrency(type.currentFee.total)
                          : "—"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={typeHref} className="block">
                        {formatAppointmentTypeStatus(type.status)}
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
