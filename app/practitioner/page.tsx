import Link from "next/link"

import { getPractitionerProfile } from "@/app/practitioner/actions"
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
import {
  formatAvailabilityMode,
  formatDayOfWeek,
  formatPractitionerRegistration,
  formatPractitionerViewName,
  formatTimeForDisplay,
} from "@/lib/practitioner/format"

function displayValue(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed || "—"
}

export default async function PractitionerPage() {
  const profile = await getPractitionerProfile()

  if (!profile) {
    return (
      <AppShell>
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">Practitioner profile not found.</p>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Profile</h1>

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Practitioner details</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/practitioner/edit">Edit</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-sm text-muted-foreground">Name</dt>
              <dd className="font-medium">
                {displayValue(formatPractitionerViewName(profile))}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Registration</dt>
              <dd className="font-medium">
                {displayValue(
                  formatPractitionerRegistration(
                    profile.registrationBody,
                    profile.registrationNumber
                  )
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Phone</dt>
              <dd className="font-medium">{displayValue(profile.phone)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Email</dt>
              <dd className="font-medium">{displayValue(profile.email)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm text-muted-foreground">Report signature</dt>
              <dd className="font-medium whitespace-pre-line">
                {displayValue(profile.reportSignature)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Calendar Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Calendar hours</dt>
              <dd className="font-medium">
                {formatTimeForDisplay(profile.calendarStartTime)} –{" "}
                {formatTimeForDisplay(profile.calendarEndTime)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Desktop interval</dt>
              <dd className="font-medium">
                {profile.calendarIntervalMinutes} minutes
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Practice memberships</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {profile.memberships.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No practice memberships yet.
            </p>
          ) : (
            profile.memberships.map((membership) => (
              <div
                key={membership.membershipId}
                className="rounded-lg border p-4"
              >
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <dl className="grid flex-1 gap-3 sm:grid-cols-2">
                    <div>
                      <dt className="text-sm text-muted-foreground">Practice</dt>
                      <dd className="font-medium">
                        <Link
                          href="/practice"
                          className="text-primary hover:underline"
                        >
                          {membership.practiceName}
                        </Link>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">Role</dt>
                      <dd className="font-medium">
                        {displayValue(membership.role)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">
                        Medicare provider number
                      </dt>
                      <dd className="font-medium">
                        {displayValue(membership.medicareProviderNumber)}
                      </dd>
                    </div>
                  </dl>
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      href={`/practitioner/memberships/${membership.membershipId}/edit`}
                    >
                      Edit
                    </Link>
                  </Button>
                </div>

                {membership.availabilityBlocks.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Day</TableHead>
                        <TableHead>Start time</TableHead>
                        <TableHead>End time</TableHead>
                        <TableHead>Mode</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {membership.availabilityBlocks.map((block) => (
                        <TableRow key={block.blockId}>
                          <TableCell>
                            {formatDayOfWeek(block.dayOfWeek)}
                          </TableCell>
                          <TableCell>
                            {formatTimeForDisplay(block.startTime)}
                          </TableCell>
                          <TableCell>
                            {formatTimeForDisplay(block.endTime)}
                          </TableCell>
                          <TableCell>
                            {formatAvailabilityMode(block.mode)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No availability blocks configured.
                  </p>
                )}
              </div>
            ))
          )}

          <Button variant="outline" asChild>
            <Link href="/practitioner/memberships/new">Add Practice</Link>
          </Button>
        </CardContent>
      </Card>
    </AppShell>
  )
}
