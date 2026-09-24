"use client"

import {
  Field,
  NativeSelect,
  TextAreaField,
  TextField,
  YesNoField,
} from "@/components/intake-interview/fields"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { emptyEventRecord } from "@/lib/intake-interview/defaults"
import { gatingQuestionFor } from "@/lib/intake-interview/constants"
import { RESOLVED_OR_ONGOING } from "@/lib/intake-interview/types"
import type {
  EventCategory,
  EventRecord,
  EventSubDomain,
} from "@/lib/intake-interview/types"

export function EventGatingSection({
  category,
  subDomains,
  personKind,
  relationshipRecordId,
  personLabel,
  events,
  onChange,
  clinicianPass = true,
}: {
  category: EventCategory
  subDomains: readonly EventSubDomain[]
  personKind: EventRecord["personKind"]
  relationshipRecordId: string | null
  personLabel?: string
  events: EventRecord[]
  onChange: (events: EventRecord[]) => void
  clinicianPass?: boolean
}) {
  function findRecord(subDomain: EventSubDomain): EventRecord | undefined {
    return events.find(
      (event) =>
        event.eventCategory === category &&
        event.subDomain === subDomain &&
        event.personKind === personKind &&
        (event.relationshipRecordId ?? null) === relationshipRecordId
    )
  }

  function upsert(next: EventRecord) {
    const exists = events.some(
      (event) => event.eventRecordId === next.eventRecordId
    )
    onChange(
      exists
        ? events.map((event) =>
            event.eventRecordId === next.eventRecordId ? next : event
          )
        : [...events, next]
    )
  }

  return (
    <div className="space-y-4">
      {subDomains.map((subDomain) => {
        const record = findRecord(subDomain)
        const rowId = `${category}-${subDomain}-${relationshipRecordId ?? "self"}`
        const question = gatingQuestionFor(category, subDomain, personLabel)
        return (
          <div key={rowId} className="space-y-3">
            <div className="flex items-start gap-3">
              <Checkbox
                id={`${rowId}_endorsed`}
                checked={record?.endorsed === true}
                onCheckedChange={(value) => {
                  const endorsed = value === true
                  if (record) {
                    upsert({ ...record, endorsed })
                    return
                  }
                  if (endorsed) {
                    upsert(
                      emptyEventRecord({
                        eventCategory: category,
                        subDomain,
                        personKind,
                        relationshipRecordId,
                        endorsed: true,
                      })
                    )
                  }
                }}
              />
              <Label
                htmlFor={`${rowId}_endorsed`}
                className="cursor-pointer font-normal leading-snug"
              >
                {question}
              </Label>
            </div>

            {record?.endorsed ? (
              <div className="ml-7 space-y-4 rounded-md border p-3">
                <TextAreaField
                  id={`${record.eventRecordId}_description`}
                  label="Description"
                  value={record.reasonDescription}
                  onChange={(reasonDescription) =>
                    upsert({ ...record, reasonDescription })
                  }
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    id={`${record.eventRecordId}_start`}
                    label="When did it start"
                    value={record.ageDateStart}
                    onChange={(ageDateStart) =>
                      upsert({ ...record, ageDateStart })
                    }
                    placeholder="Age, year, or period"
                  />
                  <Field label="Ongoing or resolved">
                    <NativeSelect
                      id={`${record.eventRecordId}_resolved`}
                      value={record.resolvedOrOngoing}
                      onChange={(resolvedOrOngoing) =>
                        upsert({
                          ...record,
                          resolvedOrOngoing:
                            resolvedOrOngoing as EventRecord["resolvedOrOngoing"],
                        })
                      }
                    >
                      <option value="">Not recorded</option>
                      {RESOLVED_OR_ONGOING.map((value) => (
                        <option key={value} value={value}>
                          {value === "ongoing" ? "Ongoing" : "Resolved"}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                </div>
                <YesNoField
                  name={`${record.eventRecordId}_treated`}
                  label="Currently treated?"
                  value={record.treated}
                  onChange={(treated) => upsert({ ...record, treated })}
                />

                {clinicianPass ? (
                  <div className="space-y-3 border-t pt-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Clinician notes
                    </p>
                    <TextAreaField
                      id={`${record.eventRecordId}_severity`}
                      label="Severity / impact"
                      value={record.severityImpact}
                      onChange={(severityImpact) =>
                        upsert({ ...record, severityImpact })
                      }
                    />
                    {record.treated ? (
                      <>
                        <TextField
                          id={`${record.eventRecordId}_treatment_type`}
                          label="Treatment type"
                          value={record.treatmentType}
                          onChange={(treatmentType) =>
                            upsert({ ...record, treatmentType })
                          }
                        />
                        <TextAreaField
                          id={`${record.eventRecordId}_treatment_detail`}
                          label="Treatment detail"
                          value={record.treatmentDetail}
                          onChange={(treatmentDetail) =>
                            upsert({ ...record, treatmentDetail })
                          }
                        />
                      </>
                    ) : null}
                    <TextAreaField
                      id={`${record.eventRecordId}_outcome`}
                      label="Outcome"
                      value={record.outcome}
                      onChange={(outcome) => upsert({ ...record, outcome })}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
