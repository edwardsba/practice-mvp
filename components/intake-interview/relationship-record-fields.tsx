"use client"

import {
  Field,
  NativeSelect,
  NumberField,
  TextAreaField,
  TextField,
} from "@/components/intake-interview/fields"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { DEPENDENCY_LABELS } from "@/lib/intake-interview/constants"
import { DEPENDENCY_VALUES } from "@/lib/intake-interview/types"
import type { RelationshipRecord } from "@/lib/intake-interview/types"
import { applyRelationshipVisibilityDefaults, relationshipFieldVisibility } from "@/lib/intake-interview/visibility"
import { RELATIONSHIP_TO_CLIENT_LABELS } from "@/lib/intake-interview/constants"

export function RelationshipRecordFields({
  record,
  onChange,
  heading,
}: {
  record: RelationshipRecord
  onChange: (record: RelationshipRecord) => void
  heading?: string
}) {
  const visibility = relationshipFieldVisibility(record)
  const typeLabel = RELATIONSHIP_TO_CLIENT_LABELS[record.relationshipToClient]

  function patch(partial: Partial<RelationshipRecord>) {
    const next = applyRelationshipVisibilityDefaults({ ...record, ...partial })
    onChange(next)
  }

  return (
    <div className="space-y-4 rounded-md border p-4">
      <div>
        <p className="text-sm font-medium">{heading ?? typeLabel}</p>
        <p className="text-xs text-muted-foreground">{typeLabel}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id={`${record.relationshipRecordId}_name`}
          label="Name (optional)"
          value={record.givenName}
          onChange={(givenName) => patch({ givenName })}
          placeholder="Given name or how they are referred to"
        />
        <NumberField
          id={`${record.relationshipRecordId}_age`}
          label="Age"
          value={record.age}
          min={0}
          onChange={(age) => patch({ age })}
        />
      </div>

      <div className="flex items-start gap-3">
        <Checkbox
          id={`${record.relationshipRecordId}_deceased`}
          checked={record.deceased}
          onCheckedChange={(value) => patch({ deceased: value === true })}
        />
        <Label
          htmlFor={`${record.relationshipRecordId}_deceased`}
          className="cursor-pointer font-normal"
        >
          Deceased
        </Label>
      </div>

      {record.deceased ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            id={`${record.relationshipRecordId}_age_at_death`}
            label="Age at death"
            value={record.ageAtDeath}
            min={0}
            onChange={(ageAtDeath) => patch({ ageAtDeath })}
          />
          <TextField
            id={`${record.relationshipRecordId}_cause`}
            label="Health or cause of death"
            value={record.healthOrCauseOfDeath}
            onChange={(healthOrCauseOfDeath) => patch({ healthOrCauseOfDeath })}
          />
        </div>
      ) : null}

      <TextField
        id={`${record.relationshipRecordId}_length`}
        label="Length of relationship"
        value={record.lengthOfRelationship}
        onChange={(lengthOfRelationship) => patch({ lengthOfRelationship })}
        placeholder="e.g. since birth, 8 years"
      />

      {record.relationshipToClient === "current_partner" ||
      record.relationshipToClient === "prior_partner" ? (
        <TextField
          id={`${record.relationshipRecordId}_status`}
          label="Relationship status"
          value={record.relationshipStatus}
          onChange={(relationshipStatus) => patch({ relationshipStatus })}
          placeholder="e.g. married, de facto, separated"
        />
      ) : null}

      {visibility.timeSinceEnded ? (
        <TextField
          id={`${record.relationshipRecordId}_ended`}
          label="Time since ended"
          value={record.timeSinceEnded}
          onChange={(timeSinceEnded) => patch({ timeSinceEnded })}
        />
      ) : null}

      {visibility.qualityOfRelationship ? (
        <TextAreaField
          id={`${record.relationshipRecordId}_quality`}
          label="Quality of relationship"
          value={record.qualityOfRelationship}
          onChange={(qualityOfRelationship) => patch({ qualityOfRelationship })}
        />
      ) : null}

      {visibility.dependency ? (
        <Field label="Dependency">
          <NativeSelect
            id={`${record.relationshipRecordId}_dependency`}
            value={record.dependency}
            onChange={(dependency) =>
              patch({ dependency: dependency as RelationshipRecord["dependency"] })
            }
          >
            <option value="">Not recorded</option>
            {DEPENDENCY_VALUES.map((value) => (
              <option key={value} value={value}>
                {DEPENDENCY_LABELS[value]}
              </option>
            ))}
          </NativeSelect>
        </Field>
      ) : isMinorChildHint(record) ? (
        <p className="text-xs text-muted-foreground">
          Dependency is recorded as “they depend on the client” for children under 18.
        </p>
      ) : null}

      {visibility.livingSituation ? (
        <TextField
          id={`${record.relationshipRecordId}_living`}
          label="Living situation"
          value={record.livingSituation}
          onChange={(livingSituation) => patch({ livingSituation })}
          placeholder="e.g. lives with client, independently"
        />
      ) : null}
    </div>
  )
}

function isMinorChildHint(record: RelationshipRecord) {
  return (
    (record.relationshipToClient === "child_biological" ||
      record.relationshipToClient === "child_step") &&
    record.age != null &&
    record.age < 18
  )
}
