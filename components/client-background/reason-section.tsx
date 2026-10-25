"use client"

import { useState } from "react"

import { saveProfessionalAction } from "@/lib/actions/contacts"
import { saveReasonForAttendingAction } from "@/app/clients/[client_id]/background/actions"
import { AddButton, PartialDatePicker, ReadOnlyField, SelectField, TextAreaField } from "@/components/client-background/fields"
import { EditableBlock, TriStateField } from "@/components/client-background/medication-stressors"
import { ProfessionalForm } from "@/components/contacts/professional-form"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  professionalOptionLabel,
  sortProfessionals,
  type OrganisationOption,
  type ProfessionOption,
  type ProfessionalOption,
} from "@/lib/client-background/professionals"
import { applyKeptSuggestion, reasonReadOnlyLines } from "@/lib/client-background/reason"
import {
  type ReasonForAttending,
  type TriStateAnswer,
  type WillingnessAnswer,
} from "@/lib/client-background/types"

export function ReasonReadOnly({
  value,
  professionals,
}: {
  value: ReasonForAttending
  professionals: ProfessionalOption[]
}) {
  const lines = reasonReadOnlyLines(value, professionals)
  if (lines.length === 0) return <p className="text-sm text-muted-foreground">Nothing recorded</p>
  return (
    <div className="space-y-3">
      {lines.map((line) => (
        <ReadOnlyField key={line.label} label={line.label} value={line.value} />
      ))}
    </div>
  )
}

export function ReasonFields({
  idPrefix,
  practiceId,
  value,
  onChange,
  onCommit,
  professionals,
  professions,
  organisations,
  suggestedProfessionalId,
  onProfessionalsChange,
  onSuggestionDismissedChange,
}: {
  idPrefix: string
  practiceId: string
  value: ReasonForAttending
  onChange: (value: ReasonForAttending) => void
  onCommit?: () => void
  professionals: ProfessionalOption[]
  professions: ProfessionOption[]
  organisations: OrganisationOption[]
  suggestedProfessionalId: string | null
  onProfessionalsChange?: (professionals: ProfessionalOption[]) => void
  onSuggestionDismissedChange?: (dismissed: boolean) => void
}) {
  const [dismissed, setDismissed] = useState(false)
  const [adding, setAdding] = useState(false)
  const suggestionKnown =
    suggestedProfessionalId != null && professionals.some((item) => item.professionalId === suggestedProfessionalId)
  const showSuggestion =
    value.referredByMedicalProfessional === "yes" &&
    !value.referrerProfessionalId &&
    !dismissed &&
    suggestionKnown
  const selectedId = value.referrerProfessionalId || (showSuggestion ? suggestedProfessionalId : "") || ""

  function dismiss(next: boolean) {
    setDismissed(next)
    onSuggestionDismissedChange?.(next)
  }

  function emit(next: ReasonForAttending) {
    onChange(next)
  }

  function setReferred(next: TriStateAnswer | null) {
    if (next !== "yes") dismiss(false)
    emit({
      ...value,
      referredByMedicalProfessional: next,
      ...(next === "yes"
        ? {}
        : { referrerProfessionalId: null, referralDate: "", referrerConcerns: "" }),
    })
  }

  function setFamily(next: TriStateAnswer | null) {
    emit({
      ...value,
      familyInvolved: next,
      ...(next === "yes" ? {} : { familyInvolvement: "" }),
    })
  }

  function chooseProfessional(id: string) {
    dismiss(id === "")
    emit({ ...value, referrerProfessionalId: id || null })
  }

  function onProfessionalSaved(professional: ProfessionalOption) {
    const next = sortProfessionals(
      professionals.some((item) => item.professionalId === professional.professionalId)
        ? professionals
        : [...professionals, professional]
    )
    onProfessionalsChange?.(next)
    dismiss(false)
    emit({ ...value, referrerProfessionalId: professional.professionalId })
    onCommit?.()
    setAdding(false)
  }

  return (
    <>
      <TriStateField
        id={`${idPrefix}_referred`}
        label="Referred by a medical professional"
        value={value.referredByMedicalProfessional}
        onChange={setReferred}
      />
      {value.referredByMedicalProfessional === "yes" ? (
        <>
          <SelectField
            id={`${idPrefix}_professional`}
            label="Medical professional"
            value={selectedId}
            hint={showSuggestion ? "Suggested from the funding referral." : undefined}
            onChange={chooseProfessional}
          >
            <option value="">Select…</option>
            {professionals.map((professional) => (
              <option key={professional.professionalId} value={professional.professionalId}>
                {professionalOptionLabel(professional)}
              </option>
            ))}
          </SelectField>
          <AddButton label="+ Add professional" onClick={() => setAdding(true)} />
          <PartialDatePicker
            id={`${idPrefix}_referral_date`}
            dateLabel="Referral date"
            value={value.referralDate}
            mode="date-only"
            onChange={(referralDate) => emit({ ...value, referralDate })}
          />
          <TextAreaField
            id={`${idPrefix}_concerns`}
            label="Referrer's concerns"
            value={value.referrerConcerns}
            onChange={(referrerConcerns) => emit({ ...value, referrerConcerns })}
          />
        </>
      ) : null}
      <TriStateField
        id={`${idPrefix}_family`}
        label="Family involved in them attending"
        value={value.familyInvolved}
        onChange={setFamily}
      />
      {value.familyInvolved === "yes" ? (
        <TextAreaField
          id={`${idPrefix}_family_how`}
          label="How were they involved?"
          value={value.familyInvolvement}
          onChange={(familyInvolvement) => emit({ ...value, familyInvolvement })}
        />
      ) : null}
      <TriStateField
        id={`${idPrefix}_initiative`}
        label="Came on their own initiative"
        value={value.ownInitiative}
        onChange={(ownInitiative) => emit({ ...value, ownInitiative })}
      />
      <WillingnessField
        id={`${idPrefix}_willingly`}
        value={value.attendedWillingly}
        onChange={(attendedWillingly) => emit({ ...value, attendedWillingly })}
      />
      <TextAreaField
        id={`${idPrefix}_motivation`}
        label="Client's motivation (optional)"
        value={value.clientMotivation}
        onChange={(clientMotivation) => emit({ ...value, clientMotivation })}
      />
      <Sheet open={adding} onOpenChange={(next) => !next && setAdding(false)}>
        <SheetContent className="h-full w-full overflow-y-auto sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle>Add professional</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">
            {adding ? (
              <ProfessionalForm
                action={saveProfessionalAction.bind(null, practiceId, undefined, null)}
                professions={professions}
                organisations={organisations}
                submitLabel="Save professional"
                onSaved={onProfessionalSaved}
                onCancel={() => setAdding(false)}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

export function ReasonSection({
  clientId,
  practiceId,
  reason,
  professionals,
  professions,
  organisations,
  suggestedProfessionalId,
}: {
  clientId: string
  practiceId: string
  reason: ReasonForAttending
  professionals: ProfessionalOption[]
  professions: ProfessionOption[]
  organisations: OrganisationOption[]
  suggestedProfessionalId: string | null
}) {
  const [options, setOptions] = useState(professionals)
  const [dismissed, setDismissed] = useState(false)

  return (
    <EditableBlock
      title=""
      saved={reason}
      save={async (draft) => {
        const next = applyKeptSuggestion(draft, { suggestedProfessionalId, dismissed })
        return saveReasonForAttendingAction(clientId, next)
      }}
      read={(value) => <ReasonReadOnly value={value} professionals={options} />}
      edit={(value, onChange) => (
        <ReasonFields
          idPrefix="background_reason"
          practiceId={practiceId}
          value={value}
          onChange={onChange}
          professionals={options}
          professions={professions}
          organisations={organisations}
          suggestedProfessionalId={suggestedProfessionalId}
          onProfessionalsChange={setOptions}
          onSuggestionDismissedChange={setDismissed}
        />
      )}
    />
  )
}

function WillingnessField({
  id,
  value,
  onChange,
}: {
  id: string
  value: WillingnessAnswer | null
  onChange: (value: WillingnessAnswer | null) => void
}) {
  return (
    <SelectField
      id={id}
      label="Attended willingly"
      value={value ?? ""}
      onChange={(next) =>
        onChange(next === "yes" || next === "somewhat" || next === "no" || next === "not_asked" ? next : null)
      }
    >
      <option value="">Select…</option>
      <option value="yes">Yes</option>
      <option value="somewhat">Somewhat</option>
      <option value="no">No</option>
      <option value="not_asked">Not asked</option>
    </SelectField>
  )
}
