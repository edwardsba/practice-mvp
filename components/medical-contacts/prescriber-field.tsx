"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

import { ensureMedicalContactAction } from "@/app/clients/[client_id]/medical-contacts/actions"
import { SelectField } from "@/components/client-background/fields"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  professionalOptionLabel,
  type ProfessionalOption,
} from "@/lib/client-background/professionals"

const ADD_VALUE = "__add_medical_contact__"

/**
 * "Prescribed or supervised by" — client's medical contacts only,
 * plus "+ Add medical contact" (adds to the list and selects).
 */
export function PrescriberField({
  clientId,
  value,
  freeTextFallback,
  medicalContacts,
  professionals,
  onChange,
}: {
  clientId: string
  value: string | null
  freeTextFallback?: string
  medicalContacts: ProfessionalOption[]
  /** Full practice professionals list for the add dialog. */
  professionals: ProfessionalOption[]
  onChange: (professionalId: string | null) => void
}) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [pendingId, setPendingId] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const contactIds = useMemo(
    () => new Set(medicalContacts.map((row) => row.professionalId)),
    [medicalContacts]
  )

  const available = professionals.filter(
    (row) => !contactIds.has(row.professionalId)
  )

  const selectValue = value ?? ""

  return (
    <div className="space-y-2">
      <SelectField
        id="prescriber_professional_id"
        label="Prescribed or supervised by"
        value={selectValue}
        onChange={(next) => {
          if (next === ADD_VALUE) {
            setAddOpen(true)
            return
          }
          onChange(next || null)
        }}
      >
        <option value="">
          {freeTextFallback?.trim() && !value
            ? freeTextFallback.trim()
            : "Not recorded"}
        </option>
        {medicalContacts.map((professional) => (
          <option
            key={professional.professionalId}
            value={professional.professionalId}
          >
            {professionalOptionLabel(professional)}
          </option>
        ))}
        <option value={ADD_VALUE}>+ Add medical contact</option>
      </SelectField>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add medical contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="add_medical_professional">Professional</Label>
              <select
                id="add_medical_professional"
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                value={pendingId}
                onChange={(event) => setPendingId(event.target.value)}
              >
                <option value="">Select…</option>
                {available.map((professional) => (
                  <option
                    key={professional.professionalId}
                    value={professional.professionalId}
                  >
                    {professionalOptionLabel(professional)}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-muted-foreground">
              Need someone new?{" "}
              <Link
                href="/contacts/professionals/new"
                className="text-primary hover:underline"
              >
                + Add professional
              </Link>
            </p>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy || !pendingId}
              onClick={() => {
                void (async () => {
                  setBusy(true)
                  setError(null)
                  const result = await ensureMedicalContactAction(
                    clientId,
                    pendingId
                  )
                  setBusy(false)
                  if (result.error) {
                    setError(result.error)
                    return
                  }
                  onChange(pendingId)
                  setAddOpen(false)
                  setPendingId("")
                  router.refresh()
                })()
              }}
            >
              {busy ? "Adding…" : "Add and select"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
