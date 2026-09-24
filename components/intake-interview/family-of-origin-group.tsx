"use client"

import {
  Field,
  NativeSelect,
  NumberField,
  SummarySentence,
} from "@/components/intake-interview/fields"
import { RelationshipRecordFields } from "@/components/intake-interview/relationship-record-fields"
import {
  CLIENT_BIRTH_ORDER_LABELS,
  PARENTS_MARITAL_STATUS_LABELS,
  RELATIONSHIP_TO_CLIENT_LABELS,
} from "@/lib/intake-interview/constants"
import {
  CLIENT_BIRTH_ORDERS,
  PARENTS_MARITAL_STATUSES,
} from "@/lib/intake-interview/types"
import type {
  FamilyOfOriginRosterInput,
  RelationshipRecord,
} from "@/lib/intake-interview/types"
import {
  buildFamilyOfOriginSlots,
  mergeRosterRecords,
  suggestedParentCount,
} from "@/lib/intake-interview/roster"
import { summariseFamilyOfOrigin } from "@/lib/intake-interview/summaries"

export function FamilyOfOriginGroup({
  roster,
  relationships,
  onRosterChange,
  onRelationshipsChange,
}: {
  roster: FamilyOfOriginRosterInput
  relationships: RelationshipRecord[]
  onRosterChange: (roster: FamilyOfOriginRosterInput) => void
  onRelationshipsChange: (relationships: RelationshipRecord[]) => void
}) {
  const familyRecords = relationships
    .filter((record) => record.section === "family_of_origin")
    .sort((a, b) => a.displayOrder - b.displayOrder)
  const otherRecords = relationships.filter(
    (record) => record.section !== "family_of_origin"
  )

  function applyRoster(next: FamilyOfOriginRosterInput) {
    onRosterChange(next)
    const slots = buildFamilyOfOriginSlots(next)
    onRelationshipsChange([
      ...otherRecords,
      ...mergeRosterRecords(familyRecords, slots),
    ])
  }

  function patchRoster(partial: Partial<FamilyOfOriginRosterInput>) {
    const next = { ...roster, ...partial }
    if (
      partial.parentsMaritalStatus &&
      roster.parentCount == null &&
      suggestedParentCount(partial.parentsMaritalStatus) != null
    ) {
      next.parentCount = suggestedParentCount(partial.parentsMaritalStatus)
    }
    applyRoster(next)
  }

  function updateRecord(updated: RelationshipRecord) {
    onRelationshipsChange(
      relationships.map((record) =>
        record.relationshipRecordId === updated.relationshipRecordId
          ? updated
          : record
      )
    )
  }

  const summary = summariseFamilyOfOrigin(roster)

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Enter counts first (blank means not applicable). Records are created
        from those counts before you fill them in.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Parents' marital status" htmlFor="parents_marital">
          <NativeSelect
            id="parents_marital"
            value={roster.parentsMaritalStatus}
            onChange={(parentsMaritalStatus) =>
              patchRoster({
                parentsMaritalStatus:
                  parentsMaritalStatus as FamilyOfOriginRosterInput["parentsMaritalStatus"],
              })
            }
          >
            <option value="">Not recorded</option>
            {PARENTS_MARITAL_STATUSES.map((status) => (
              <option key={status} value={status}>
                {PARENTS_MARITAL_STATUS_LABELS[status]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {roster.parentsMaritalStatus === "other" ? (
          <Field label="Marital status (specify)" htmlFor="parents_marital_other">
            <input
              id="parents_marital_other"
              className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs"
              value={roster.parentsMaritalStatusOther}
              onChange={(event) =>
                patchRoster({ parentsMaritalStatusOther: event.target.value })
              }
            />
          </Field>
        ) : null}
        <NumberField
          id="parent_count"
          label="Number of parents"
          value={roster.parentCount}
          min={0}
          onChange={(parentCount) => patchRoster({ parentCount })}
        />
        <NumberField
          id="step_parent_count"
          label="Number of step-parents"
          value={roster.stepParentCount}
          min={0}
          onChange={(stepParentCount) => patchRoster({ stepParentCount })}
          hint={
            roster.parentsMaritalStatus === "remarried"
              ? "Remarried families often include one or more step-parents."
              : undefined
          }
        />
        <NumberField
          id="full_sibling_count"
          label="Number of full siblings"
          value={roster.fullSiblingCount}
          min={0}
          onChange={(fullSiblingCount) => patchRoster({ fullSiblingCount })}
        />
        <NumberField
          id="half_sibling_count"
          label="Number of half-siblings"
          value={roster.halfSiblingCount}
          min={0}
          onChange={(halfSiblingCount) => patchRoster({ halfSiblingCount })}
        />
        <NumberField
          id="step_sibling_count"
          label="Number of step-siblings"
          value={roster.stepSiblingCount}
          min={0}
          onChange={(stepSiblingCount) => patchRoster({ stepSiblingCount })}
        />
        <Field label="Client's birth order" htmlFor="birth_order">
          <NativeSelect
            id="birth_order"
            value={roster.clientBirthOrder}
            onChange={(clientBirthOrder) =>
              patchRoster({
                clientBirthOrder:
                  clientBirthOrder as FamilyOfOriginRosterInput["clientBirthOrder"],
              })
            }
          >
            <option value="">Not recorded</option>
            {CLIENT_BIRTH_ORDERS.map((order) => (
              <option key={order} value={order}>
                {CLIENT_BIRTH_ORDER_LABELS[order]}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>

      {familyRecords.length > 0 ? (
        <div className="space-y-4">
          <p className="text-sm font-medium">Family members</p>
          {familyRecords.map((record, index) => {
            const sameTypeCount = familyRecords.filter(
              (item) => item.relationshipToClient === record.relationshipToClient
            ).length
            const typeIndex =
              familyRecords
                .filter(
                  (item) =>
                    item.relationshipToClient === record.relationshipToClient
                )
                .findIndex(
                  (item) =>
                    item.relationshipRecordId === record.relationshipRecordId
                ) + 1
            const heading =
              sameTypeCount > 1
                ? `${RELATIONSHIP_TO_CLIENT_LABELS[record.relationshipToClient]} ${typeIndex}`
                : RELATIONSHIP_TO_CLIENT_LABELS[record.relationshipToClient]
            return (
              <RelationshipRecordFields
                key={record.relationshipRecordId}
                record={record}
                heading={`${index + 1}. ${heading}`}
                onChange={updateRecord}
              />
            )
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No family-of-origin records yet. Fill a count above to create them.
        </p>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium">Summary</p>
        <SummarySentence text={summary} />
      </div>
    </div>
  )
}
