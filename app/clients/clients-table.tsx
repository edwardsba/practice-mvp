"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

import { Input } from "@/components/ui/input"
import { StatusBadge } from "@/components/ui/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CLIENT_STATUS_CONFIG } from "@/lib/status"
import {
  formatAppointmentDate,
  formatAppointmentTime,
} from "@/lib/appointments/format"

export type ClientRow = {
  clientId: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  dateOfBirth: string | null
  clientStatus: string
  nextAppointmentDate: string | null
  nextAppointmentTime: string | null
}

function formatDate(value: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function ClientsTable({ clients }: { clients: ClientRow[] }) {
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return clients

    return clients.filter((client) => {
      const fullName = `${client.firstName} ${client.lastName}`.toLowerCase()
      return fullName.includes(normalized)
    })
  }, [clients, query])

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search by name…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-sm"
        aria-label="Search clients by name"
      />
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>First name</TableHead>
              <TableHead>Last name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Next appointment</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Date of birth</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  {clients.length === 0
                    ? "No clients yet. Add your first client to get started."
                    : "No clients match your search."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((client) => {
                const clientHref = `/clients/${client.clientId}`

                return (
                  <TableRow
                    key={client.clientId}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell>
                      <Link href={clientHref} className="block font-medium text-primary hover:underline">
                        {client.firstName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={clientHref} className="block hover:underline">
                        {client.lastName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={clientHref} className="block">
                        <StatusBadge
                          status={client.clientStatus}
                          statusMap={CLIENT_STATUS_CONFIG}
                        />
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={clientHref} className="block">
                        {client.nextAppointmentDate
                          ? `${formatAppointmentDate(client.nextAppointmentDate)} at ${formatAppointmentTime(client.nextAppointmentTime)}`
                          : "—"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={clientHref} className="block">
                        {client.email ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={clientHref} className="block">
                        {client.phone ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={clientHref} className="block">
                        {formatDate(client.dateOfBirth)}
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
