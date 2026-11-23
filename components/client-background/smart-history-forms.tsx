"use client"

import {
  PartialDatePicker,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/client-background/fields"
import { storedPartial } from "@/lib/client-background/partial-date"
import {
  fieldsForSmartKind,
  eventTypeForSmartKind,
  treatmentTypeChoiceForEventType,
} from "@/lib/client-background/smart-event-fields"
import { personName } from "@/lib/client-background/tree"
import {
  ADMISSION_TYPES,
  ADMISSION_TYPE_LABELS,
  CONDITION_EVENT_TYPES,
  CONDITION_CATEGORY_LABELS,
  SMART_EVENT_KIND_LABELS,
  SMART_EVENT_KINDS,
  SUBSTANCE_STATUSES,
  SUBSTANCE_STATUS_LABELS,
  TREATMENT_ANSWERS,
  TREATMENT_ANSWER_LABELS,
  TREATMENT_TYPE_CHOICE_LABELS,
  TREATMENT_TYPE_CHOICES,
  emptyEvent,
  emptyHistoryIssue,
  type ConditionEventType,
  type EventRecord,
  type HistoryIssue,
  type RelationshipRecord,
  type SmartEventKind,
  type TreatmentAnswer,
  type TreatmentTypeChoice,
} from "@/lib/client-background/types"
import { PrescriberField } from "@/components/medical-contacts/prescriber-field"
import type { ProfessionalOption } from "@/lib/client-background/professionals"

export function NewIssueForm({
  draft,
  firstEpisode,
  dateOfBirth,
  relationships,
  onIssueChange,
  onEpisodeChange,
  onAddPerson,
}: {
  draft: HistoryIssue
  firstEpisode: EventRecord
  dateOfBirth: string | null
  relationships: RelationshipRecord[]
  onIssueChange: (issue: HistoryIssue) => void
  onEpisodeChange: (event: EventRecord) => void
  onAddPerson?: () => void
}) {
  const whoValue = draft.relationshipRecordId
    ? draft.relationshipRecordId
    : draft.about === "significant_other"
      ? "other"
      : ""

  return (
    <div className="min-w-0 space-y-4">
      {draft.about === "significant_other" ? (
        <>
          <SelectField
            id="new_issue_who"
            label="Who"
            value={whoValue}
            onChange={(value) => {
              if (value === "other") {
                onIssueChange({ ...draft, relationshipRecordId: null })
                return
              }
              onIssueChange({ ...draft, relationshipRecordId: value || null, aboutOther: "" })
            }}
          >
            <option value="">Select…</option>
            {relationships.map((person) => (
              <option key={person.relationshipRecordId} value={person.relationshipRecordId}>
                {personName(person)}
              </option>
            ))}
            <option value="other">Other (describe)</option>
          </SelectField>
          {whoValue === "other" ? (
            <TextField
              id="new_issue_who_other"
              label="Describe"
              value={draft.aboutOther}
              onChange={(aboutOther) => onIssueChange({ ...draft, relationshipRecordId: null, aboutOther })}
            />
          ) : null}
          {onAddPerson ? (
            <button type="button" className="text-sm text-primary underline-offset-2 hover:underline" onClick={onAddPerson}>
              + Add person
            </button>
          ) : null}
        </>
      ) : null}
      <TextField
        id="new_issue_title"
        label="Issue"
        value={draft.title}
        onChange={(title) => onIssueChange({ ...draft, title })}
        placeholder="e.g. Depression, Alcohol"
      />
      <div className="space-y-3 rounded-md border border-dashed p-3">
        <p className="text-xs font-medium text-muted-foreground">First episode (optional)</p>
        <PartialDatePicker
          id="new_issue_start"
          dateLabel="Started"
          ageLabel="Client age at start"
          mode="client-at-event"
          clientDateOfBirth={dateOfBirth}
          value={firstEpisode.startPrecision === "age" ? "" : firstEpisode.startValue}
          legacyAge={firstEpisode.startPrecision === "age" ? firstEpisode.startValue : ""}
          onChange={(startValue) => {
            const next = storedPartial(startValue)
            onEpisodeChange({ ...firstEpisode, startPrecision: next.precision, startValue: next.value })
          }}
        />
        {firstEpisode.resolvedOrOngoing === "ongoing" ? (
          <p className="text-xs text-muted-foreground">End date stays blank while this is ongoing.</p>
        ) : (
          <PartialDatePicker
            id="new_issue_end"
            dateLabel="Ended"
            ageLabel="Client age at end"
            mode="client-at-event"
            clientDateOfBirth={dateOfBirth}
            value={firstEpisode.endPrecision === "age" ? "" : firstEpisode.endValue}
            legacyAge={firstEpisode.endPrecision === "age" ? firstEpisode.endValue : ""}
            onChange={(endValue) => {
              const next = storedPartial(endValue)
              onEpisodeChange({ ...firstEpisode, endPrecision: next.precision, endValue: next.value })
            }}
          />
        )}
        <SelectField
          id="new_issue_ongoing"
          label="Ended / ongoing"
          value={firstEpisode.resolvedOrOngoing === "ongoing" ? "ongoing" : firstEpisode.endValue ? "ended" : ""}
          onChange={(value) => {
            if (value === "ongoing") {
              onEpisodeChange({
                ...firstEpisode,
                resolvedOrOngoing: "ongoing",
                endOngoing: true,
                endPrecision: "",
                endValue: "",
              })
              return
            }
            onEpisodeChange({ ...firstEpisode, resolvedOrOngoing: value === "ended" ? "resolved" : "", endOngoing: false })
          }}
        >
          <option value="">Not recorded</option>
          <option value="ended">Ended</option>
          <option value="ongoing">Ongoing</option>
        </SelectField>
      </div>
      <SelectField
        id="new_issue_treatment"
        label="Treatment"
        value={draft.treatmentAnswer || ""}
        onChange={(value) =>
          onIssueChange({
            ...draft,
            treatmentAnswer: value === "yes" || value === "none" || value === "not_asked" ? value : "",
          })
        }
      >
        <option value="">Select…</option>
        {TREATMENT_ANSWERS.map((option) => (
          <option key={option} value={option}>
            {TREATMENT_ANSWER_LABELS[option]}
          </option>
        ))}
      </SelectField>
    </div>
  )
}

export function NewEventForm({
  draft,
  kind,
  treatmentType,
  category,
  dateOfBirth,
  clientId,
  medicalContacts,
  professionals,
  onKindChange,
  onTreatmentTypeChange,
  onChange,
}: {
  draft: EventRecord
  kind: SmartEventKind
  treatmentType: TreatmentTypeChoice | ""
  category: EventRecord["eventType"] | null
  dateOfBirth: string | null
  clientId: string
  medicalContacts: ProfessionalOption[]
  professionals: ProfessionalOption[]
  onKindChange: (kind: SmartEventKind) => void
  onTreatmentTypeChange: (value: TreatmentTypeChoice | "") => void
  onChange: (event: EventRecord) => void
}) {
  const fields = fieldsForSmartKind(kind, { category, treatmentType })

  function patch(partial: Partial<EventRecord>) {
    const next = { ...draft, ...partial }
    if (next.resolvedOrOngoing === "ongoing") {
      next.endPrecision = ""
      next.endValue = ""
      next.endOngoing = true
    } else {
      next.endOngoing = false
    }
    onChange(next)
  }

  return (
    <div className="min-w-0 space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-xs text-muted-foreground">Event type</legend>
        <div className="flex flex-wrap gap-2">
          {SMART_EVENT_KINDS.map((option) => (
            <button
              key={option}
              type="button"
              className={
                kind === option
                  ? "rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
                  : "rounded-md border px-3 py-2 text-sm hover:bg-muted"
              }
              onClick={() => {
                onKindChange(option)
                const nextType = eventTypeForSmartKind(option, {
                  category,
                  treatmentType: option === "treatment" ? treatmentType || "hospital_admission" : "",
                })
                patch({
                  eventType: nextType,
                  title: option === "treatment" && treatmentType === "therapy" ? draft.title : option === "other" ? draft.title : "",
                })
              }}
            >
              {SMART_EVENT_KIND_LABELS[option]}
            </button>
          ))}
        </div>
      </fieldset>

      {fields.includes("treatment_type") ? (
        <SelectField
          id="new_event_tx_type"
          label="Treatment type"
          value={treatmentType}
          onChange={(value) => {
            const next = (TREATMENT_TYPE_CHOICES as readonly string[]).includes(value)
              ? (value as TreatmentTypeChoice)
              : ""
            onTreatmentTypeChange(next)
            const eventType = eventTypeForSmartKind("treatment", { treatmentType: next })
            patch({
              eventType,
              admissionType: next === "hospital_admission" ? draft.admissionType : "",
              facility: next === "hospital_admission" ? draft.facility : "",
              admissionLength: next === "hospital_admission" ? draft.admissionLength : "",
              title: next === "therapy" || next === "medication" || next === "other" ? draft.title : "",
            })
          }}
        >
          <option value="">Select…</option>
          {TREATMENT_TYPE_CHOICES.map((option) => (
            <option key={option} value={option}>
              {TREATMENT_TYPE_CHOICE_LABELS[option]}
            </option>
          ))}
        </SelectField>
      ) : null}

      {fields.includes("admission_type") ? (
        <SelectField
          id="new_event_admission"
          label="Admission type"
          value={draft.admissionType}
          onChange={(admissionType) => patch({ admissionType: admissionType as EventRecord["admissionType"] })}
        >
          <option value="">Not recorded</option>
          {ADMISSION_TYPES.map((option) => (
            <option key={option} value={option}>
              {ADMISSION_TYPE_LABELS[option]}
            </option>
          ))}
        </SelectField>
      ) : null}
      {fields.includes("facility") ? (
        <TextField
          id="new_event_facility"
          label="Facility"
          value={draft.facility}
          onChange={(facility) => patch({ facility })}
        />
      ) : null}
      {fields.includes("admission_length") ? (
        <TextField
          id="new_event_length"
          label="Length"
          value={draft.admissionLength}
          onChange={(admissionLength) => patch({ admissionLength })}
        />
      ) : null}
      {fields.includes("therapy_provider") ? (
        <TextField
          id="new_event_therapy"
          label="Who provided it"
          value={draft.title}
          onChange={(title) => patch({ title })}
          placeholder="e.g. psychologist"
        />
      ) : null}
      {fields.includes("medication_name") ? (
        <TextField
          id="new_event_med"
          label="Medication name"
          value={draft.title}
          onChange={(title) => patch({ title })}
        />
      ) : null}
      {fields.includes("prescriber") ? (
        <PrescriberField
          clientId={clientId}
          value={draft.prescriberProfessionalId}
          freeTextFallback={draft.prescriberName}
          medicalContacts={medicalContacts}
          professionals={professionals}
          onChange={(prescriberProfessionalId) =>
            patch({
              prescriberProfessionalId,
              prescriberName: "",
            })
          }
        />
      ) : null}
      {fields.includes("other_title") || fields.includes("title") ? (
        <TextField
          id="new_event_title"
          label="Title"
          value={draft.title}
          onChange={(title) => patch({ title })}
          placeholder={kind === "other" ? "e.g. Lost job" : "Title"}
        />
      ) : null}

      {fields.includes("started") || fields.includes("date") ? (
        <PartialDatePicker
          id="new_event_start"
          dateLabel={fields.includes("date") ? "Date" : "Started"}
          ageLabel="Client age at start"
          mode="client-at-event"
          clientDateOfBirth={dateOfBirth}
          value={draft.startPrecision === "age" ? "" : draft.startValue}
          legacyAge={draft.startPrecision === "age" ? draft.startValue : ""}
          onChange={(startValue) => {
            const next = storedPartial(startValue)
            patch({ startPrecision: next.precision, startValue: next.value })
          }}
        />
      ) : null}
      {fields.includes("ended") ? (
        draft.resolvedOrOngoing === "ongoing" ? (
          <p className="text-xs text-muted-foreground">End date stays blank while this is ongoing.</p>
        ) : (
          <PartialDatePicker
            id="new_event_end"
            dateLabel="Ended"
            ageLabel="Client age at end"
            mode="client-at-event"
            clientDateOfBirth={dateOfBirth}
            value={draft.endPrecision === "age" ? "" : draft.endValue}
            legacyAge={draft.endPrecision === "age" ? draft.endValue : ""}
            onChange={(endValue) => {
              const next = storedPartial(endValue)
              patch({ endPrecision: next.precision, endValue: next.value })
            }}
          />
        )
      ) : null}
      {fields.includes("ended") ? (
        <SelectField
          id="new_event_ongoing"
          label="Ended / ongoing"
          value={draft.resolvedOrOngoing === "ongoing" ? "ongoing" : draft.endValue ? "ended" : ""}
          onChange={(value) => {
            if (value === "ongoing") {
              patch({ resolvedOrOngoing: "ongoing", endOngoing: true, endPrecision: "", endValue: "" })
              return
            }
            patch({ resolvedOrOngoing: value === "ended" ? "resolved" : "", endOngoing: false })
          }}
        >
          <option value="">Not recorded</option>
          <option value="ended">Ended</option>
          <option value="ongoing">Ongoing</option>
        </SelectField>
      ) : null}

      {fields.includes("substance_status") ? (
        <SelectField
          id="new_event_substance"
          label="Status"
          value={draft.substanceStatus}
          onChange={(substanceStatus) => patch({ substanceStatus: substanceStatus as EventRecord["substanceStatus"] })}
        >
          <option value="">Not recorded</option>
          {SUBSTANCE_STATUSES.map((option) => (
            <option key={option} value={option}>
              {SUBSTANCE_STATUS_LABELS[option]}
            </option>
          ))}
        </SelectField>
      ) : null}
      {fields.includes("abstinent_since") && draft.substanceStatus === "abstinent" ? (
        <PartialDatePicker
          id="new_event_abstinent"
          dateLabel="Abstinent since"
          mode="date-only"
          value={draft.abstinentSincePrecision === "age" ? "" : draft.abstinentSinceValue}
          onChange={(value) => {
            const next = storedPartial(value)
            patch({ abstinentSincePrecision: next.precision, abstinentSinceValue: next.value })
          }}
        />
      ) : null}

      {fields.includes("description") ? (
        <TextAreaField
          id="new_event_description"
          label="Description"
          value={draft.description}
          onChange={(description) => patch({ description })}
        />
      ) : null}
    </div>
  )
}

export function blankIssueDraft(
  category: ConditionEventType,
  about: HistoryIssue["about"],
  displayOrder = 0
): HistoryIssue {
  return { issueId: "", ...emptyHistoryIssue(category, about, displayOrder) }
}

export function blankEpisodeForIssue(category: ConditionEventType, about: HistoryIssue["about"]): EventRecord {
  return {
    eventRecordId: "",
    ...emptyEvent(category, 0),
    about,
  }
}

export function categoryOptions(): { value: ConditionEventType; label: string }[] {
  return CONDITION_EVENT_TYPES.map((value) => ({ value, label: CONDITION_CATEGORY_LABELS[value] }))
}

export { treatmentTypeChoiceForEventType, eventTypeForSmartKind }
