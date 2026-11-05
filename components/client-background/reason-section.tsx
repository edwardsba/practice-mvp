"use client"

import { useState } from "react"

import { saveProfessionalAction } from "@/lib/actions/contacts"
import { saveReasonForAttendingAction } from "@/app/clients/[client_id]/background/actions"
import { AddButton, PartialDatePicker, ReadOnlyField, SelectField, TextAreaField, TextField } from "@/components/client-background/fields"
import { EditableBlock } from "@/components/client-background/medication-stressors"
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
import { personRoleLabel } from "@/lib/client-background/tree"
import {
  REFERRAL_TYPE_LABELS,
  REFERRAL_TYPES,
  type ReasonForAttending,
  type ReferralType,
  type RelationshipRecord,
} from "@/lib/client-background/types"

export function ReasonReadOnly({
  value,
  professionals,
  relationships = [],
}: {
  value: ReasonForAttending
  professionals: ProfessionalOption[]
  relationships?: RelationshipRecord[]
}) {
  const lines = reasonReadOnlyLines(value, professionals, relationships)
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
  relationships,
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
  relationships: RelationshipRecord[]
  suggestedProfessionalId: string | null
  onProfessionalsChange?: (professionals: ProfessionalOption[]) => void
  onSuggestionDismissedChange?: (dismissed: boolean) => void
}) {
  const [dismissed, setDismissed] = useState(false)
  const [adding, setAdding] = useState(false)
  const suggestionKnown =
    suggestedProfessionalId != null && professionals.some((item) => item.professionalId === suggestedProfessionalId)
  const showSuggestion =
    value.referralType === "medical" &&
    !dismissed &&
    suggestionKnown &&
    (value.referrerProfessionalId == null || value.referrerProfessionalId === suggestedProfessionalId)
  const selectedId = value.referrerProfessionalId || (showSuggestion ? suggestedProfessionalId : "") || ""
  const who = value.referrerRelationshipId || (value.referrerIsOther ? "other" : "")

  function dismiss(next: boolean) {
    setDismissed(next)
    onSuggestionDismissedChange?.(next)
  }

  function emit(next: ReasonForAttending) {
    onChange(next)
  }

  function setType(next: string) {
    const referralType = (REFERRAL_TYPES as readonly string[]).includes(next) ? (next as ReferralType) : ""
    if (referralType !== "medical") dismiss(false)
    emit({
      ...value,
      referralType,
      ...(referralType === "medical"
        ? { referrerRelationshipId: null, referrerIsOther: false, referrerOther: "", theirConcerns: "" }
        : { referrerProfessionalId: null, referralDate: "", referrerConcerns: "" }),
      ...(referralType === "family_or_friend"
        ? {}
        : { referrerRelationshipId: null, referrerIsOther: false, referrerOther: "", theirConcerns: "" }),
    })
  }

  function chooseProfessional(id: string) {
    dismiss(id === "")
    emit({ ...value, referrerProfessionalId: id || null })
  }

  function chooseWho(id: string) {
    if (id === "other") {
      emit({ ...value, referrerRelationshipId: null, referrerIsOther: true })
      return
    }
    emit({ ...value, referrerRelationshipId: id || null, referrerIsOther: false, referrerOther: "" })
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
      <SelectField
        id={`${idPrefix}_type`}
        label="Referral type"
        value={value.referralType}
        onChange={setType}
      >
        <option value="">Select…</option>
        {REFERRAL_TYPES.map((type) => (
          <option key={type} value={type}>
            {REFERRAL_TYPE_LABELS[type]}
          </option>
        ))}
      </SelectField>
      {value.referralType === "medical" ? (
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
      {value.referralType === "family_or_friend" ? (
        <>
          <SelectField id={`${idPrefix}_who`} label="Who" value={who} onChange={chooseWho}>
            <option value="">Select…</option>
            {relationships.map((person) => {
              const name = person.givenName.trim() || "Unnamed"
              return (
                <option key={person.relationshipRecordId} value={person.relationshipRecordId}>
                  {name} ({personRoleLabel(person)})
                </option>
              )
            })}
            <option value="other">Other (describe)</option>
          </SelectField>
          {value.referrerIsOther ? (
            <TextField
              id={`${idPrefix}_who_other`}
              label="Describe who referred them"
              value={value.referrerOther}
              onChange={(referrerOther) => emit({ ...value, referrerOther })}
            />
          ) : null}
          <TextAreaField
            id={`${idPrefix}_their_concerns`}
            label="Their concerns"
            value={value.theirConcerns}
            onChange={(theirConcerns) => emit({ ...value, theirConcerns })}
          />
        </>
      ) : null}
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
  relationships,
  suggestedProfessionalId,
}: {
  clientId: string
  practiceId: string
  reason: ReasonForAttending
  professionals: ProfessionalOption[]
  professions: ProfessionOption[]
  organisations: OrganisationOption[]
  relationships: RelationshipRecord[]
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
      read={(value) => <ReasonReadOnly value={value} professionals={options} relationships={relationships} />}
      edit={(value, onChange) => (
        <ReasonFields
          idPrefix="background_reason"
          practiceId={practiceId}
          value={value}
          onChange={onChange}
          professionals={options}
          professions={professions}
          organisations={organisations}
          relationships={relationships}
          suggestedProfessionalId={suggestedProfessionalId}
          onProfessionalsChange={setOptions}
          onSuggestionDismissedChange={setDismissed}
        />
      )}
    />
  )
}
