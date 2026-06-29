"use client"

import Link from "next/link"
import { useState } from "react"

import { EmergencyContactDialog } from "@/components/emergency-contacts/emergency-contact-dialog"
import { Button } from "@/components/ui/button"
import {
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
import type { EmergencyContactRow } from "@/lib/crisis-plans/types"

export function EmergencyContactsSection({
  clientId,
  contacts,
}: {
  clientId: string
  contacts: EmergencyContactRow[]
}) {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Emergency contacts</CardTitle>
        <Button type="button" size="sm" onClick={() => setDialogOpen(true)}>
          Add emergency contact
        </Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-20 text-center text-muted-foreground"
                  >
                    No emergency contacts on file.
                  </TableCell>
                </TableRow>
              ) : (
                contacts.map((contact) => {
                  const editHref = `/clients/${clientId}/emergency-contacts/${contact.contactId}/edit`
                  return (
                    <TableRow
                      key={contact.contactId}
                      className="cursor-pointer hover:bg-muted/50"
                    >
                      <TableCell>
                        <Link href={editHref} className="block">
                          {contact.role ?? "—"}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={editHref} className="block font-medium">
                          {contact.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={editHref} className="block">
                          {contact.phone ?? "—"}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={editHref} className="block">
                          {contact.email ?? "—"}
                        </Link>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <EmergencyContactDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clientId={clientId}
        contact={null}
      />
    </>
  )
}
