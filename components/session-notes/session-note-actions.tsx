"use client"

import Link from "next/link"

import { createNewSessionNoteVersionAction } from "@/app/session-notes/actions"
import { AsqStatusBadge } from "@/components/session-notes/asq-status-badge"
import { PsqStatusBadge } from "@/components/session-notes/psq-status-badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { appendReturnTo } from "@/lib/navigation/back"
import {
  formatSessionNoteDate,
  formatSessionNoteTime,
} from "@/lib/session-notes/format"

export function SessionNoteActions({
  sessionNoteId,
  sessionNoteUrl,
  clientId,
  clientName,
  isFinalised,
  pdfStoragePath,
  appointmentId,
  sessionDate,
  sessionTime,
  nextAppointment,
  preSessionBatterySentAt,
  psqBatteryStatus,
  asqCompleted,
  versionNumber,
  previousVersionId,
}: {
  sessionNoteId: string
  sessionNoteUrl: string
  clientId: string
  clientName: string
  status: string
  isFinalised: boolean
  pdfStoragePath: string | null
  appointmentId: string | null
  sessionDate: string
  sessionTime: string | null
  nextAppointment: { appointmentId: string; label: string } | null
  preSessionBatterySentAt: Date | null
  psqBatteryStatus: string | null
  asqCompleted: boolean
  versionNumber: number
  previousVersionId: string | null
}) {
  const sessionDateTime = (
    <>
      {formatSessionNoteDate(sessionDate)}
      {sessionTime ? `, ${formatSessionNoteTime(sessionTime)}` : ""}
    </>
  )

  return (
    <Card className="no-print">
      <CardHeader>
        <CardTitle>Status</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4">
          <div>
            <dt className="text-sm text-muted-foreground">Client</dt>
            <dd className="mt-0.5 text-sm font-medium">
              <Link
                href={`/clients/${clientId}`}
                className="text-primary hover:underline"
              >
                {clientName}
              </Link>
            </dd>
          </div>

          {isFinalised ? (
            <div>
              <dt className="mb-2 text-sm text-muted-foreground">
                Session note
              </dt>
              <dd className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/api/session-notes/${sessionNoteId}/pdf`} download>
                      Download PDF
                    </a>
                  </Button>
                  <form
                    action={createNewSessionNoteVersionAction.bind(
                      null,
                      sessionNoteId
                    )}
                  >
                    <Button variant="outline" size="sm" type="submit">
                      Edit / Create new version
                    </Button>
                  </form>
                </div>
                <p className="text-xs text-muted-foreground">
                  Version {versionNumber}
                  {previousVersionId ? (
                    <>
                      {" · "}
                      <Link
                        href={`/session-notes/${previousVersionId}`}
                        className="text-primary hover:underline"
                      >
                        View previous version
                      </Link>
                    </>
                  ) : null}
                </p>
              </dd>
            </div>
          ) : null}

          <div>
            <dt className="text-sm text-muted-foreground">Appointment</dt>
            <dd className="mt-0.5 text-sm font-medium">
              {appointmentId ? (
                <Link
                  href={appendReturnTo(
                    `/appointments/${appointmentId}`,
                    sessionNoteUrl
                  )}
                  className="text-primary hover:underline"
                >
                  {sessionDateTime}
                </Link>
              ) : (
                <span>{sessionDateTime}</span>
              )}
            </dd>
          </div>

          <div>
            <dt className="text-sm text-muted-foreground">
              Next appointment
            </dt>
            <dd className="mt-0.5 text-sm font-medium">
              {nextAppointment ? (
                <Link
                  href={appendReturnTo(
                    `/appointments/${nextAppointment.appointmentId}`,
                    sessionNoteUrl
                  )}
                  className="text-primary hover:underline"
                >
                  {nextAppointment.label}
                </Link>
              ) : (
                <Link
                  href={`/calendar?view=month&clientId=${clientId}&returnTo=${encodeURIComponent(sessionNoteUrl)}`}
                  className="text-primary hover:underline"
                >
                  Schedule appointment →
                </Link>
              )}
            </dd>
          </div>

          <div>
            <dt className="text-sm text-muted-foreground">Questionnaires</dt>
            <dd className="mt-0.5 flex flex-row flex-nowrap items-center gap-3">
              <span className="flex flex-row flex-nowrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">PSQ</span>
                <PsqStatusBadge
                  sentAt={preSessionBatterySentAt}
                  psqBatteryStatus={psqBatteryStatus}
                />
              </span>
              <span className="flex flex-row flex-nowrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">ASQ</span>
                <AsqStatusBadge asqCompleted={asqCompleted} />
              </span>
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}
