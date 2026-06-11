import Link from "next/link"

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
import { cn } from "@/lib/utils"

function formatOptOut(value: boolean) {
  return value ? "Yes" : "No"
}

export function CommunicationPreferencesCard({
  clientId,
  preferences,
}: {
  clientId: string
  preferences: {
    commsOptOut: boolean
    reminderOptOut: boolean
    preSessionOptOut: boolean
    postSessionOptOut: boolean
    adminCommsOptOut: boolean
    onlineBookingPermitted: boolean
  }
}) {
  const communicationRows = [
    {
      type: "Appointment Reminder",
      modality: "Email",
      optedOut: preferences.reminderOptOut,
    },
    {
      type: "Pre-Session Questionnaire",
      modality: "Email",
      optedOut: preferences.preSessionOptOut,
    },
    {
      type: "Post-Session Questionnaire",
      modality: "Email",
      optedOut: preferences.postSessionOptOut,
    },
    {
      type: "Admin Communication",
      modality: "Email",
      optedOut: preferences.adminCommsOptOut,
    },
  ]

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Communication Preferences</CardTitle>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/clients/${clientId}/edit#communication-preferences`}>
            Edit
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium">Global contact opt-out</p>
            <p
              className={cn(
                "text-sm font-medium",
                preferences.commsOptOut && "text-destructive"
              )}
            >
              {formatOptOut(preferences.commsOptOut)}
            </p>
          </div>
          {preferences.commsOptOut ? (
            <p
              className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              role="status"
            >
              This client has opted out of all communications
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Modality</TableHead>
                <TableHead>Opted Out</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {communicationRows.map((row) => (
                <TableRow key={row.type}>
                  <TableCell>{row.type}</TableCell>
                  <TableCell>{row.modality}</TableCell>
                  <TableCell>{formatOptOut(row.optedOut)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Online booking permitted</p>
              <p className="text-sm text-muted-foreground">
                Practice permission for client to use online booking
              </p>
            </div>
            <p className="text-sm font-medium">
              {preferences.onlineBookingPermitted ? "Yes" : "No"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
