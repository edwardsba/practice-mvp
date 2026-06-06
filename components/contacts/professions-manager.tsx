"use client"

import { useActionState } from "react"

import {
  saveProfessionAction,
  type ContactsFormState,
} from "@/lib/actions/contacts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function ProfessionsManager({
  practiceId,
  professions,
}: {
  practiceId: string
  professions: Array<{ professionId: string; professionName: string }>
}) {
  const [state, formAction, pending] = useActionState(
    saveProfessionAction.bind(null, practiceId, undefined),
    {} as ContactsFormState
  )

  return (
    <div className="space-y-6">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1 space-y-2">
          <label htmlFor="profession_name" className="text-sm font-medium">
            Profession name
          </label>
          <Input
            id="profession_name"
            name="profession_name"
            required
            placeholder="e.g. GP, Caseworker"
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add profession"}
        </Button>
      </form>

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Profession</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {professions.length === 0 ? (
              <TableRow>
                <TableCell className="h-20 text-center text-muted-foreground">
                  No professions yet.
                </TableCell>
              </TableRow>
            ) : (
              professions.map((profession) => (
                <TableRow key={profession.professionId}>
                  <TableCell>{profession.professionName}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
