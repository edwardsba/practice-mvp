"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export type ClientRow = {
  clientId: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  dateOfBirth: string | null
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
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Date of birth</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  {clients.length === 0
                    ? "No clients yet. Add your first client to get started."
                    : "No clients match your search."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((client) => (
                <TableRow key={client.clientId}>
                  <TableCell>
                    <Link
                      href={`/clients/${client.clientId}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {client.firstName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/clients/${client.clientId}`}
                      className="hover:underline"
                    >
                      {client.lastName}
                    </Link>
                  </TableCell>
                  <TableCell>{client.email ?? "—"}</TableCell>
                  <TableCell>{client.phone ?? "—"}</TableCell>
                  <TableCell>{formatDate(client.dateOfBirth)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
