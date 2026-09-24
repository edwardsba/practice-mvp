"use client"

import { NumberField, SummarySentence } from "@/components/intake-interview/fields"
import { RelationshipRecordFields } from "@/components/intake-interview/relationship-record-fields"
import { RELATIONSHIP_TO_CLIENT_LABELS } from "@/lib/intake-interview/constants"
import {
  buildPartnersChildrenSlots,
  mergeRosterRecords,
  relationshipDisplayLabel,
} from "@/lib/intake-interview/roster"
import { summarisePartnersAndChildren } from "@/lib/intake-interview/summaries"
import type {
  PartnersChildrenRosterInput,
  RelationshipRecord,
} from "@/lib/intake-interview/types"

export function PartnersChildrenGroup({
  roster,
  relationships,
  onRosterChange,
  onRelationshipsChange,
}: {
  roster: PartnersChildrenRosterInput
  relationships: RelationshipRecord[]
  onRosterChange: (roster: PartnersChildrenRosterInput) => void
  onRelationshipsChange: (relationships: RelationshipRecord[]) => void
}) {
  const partnerSection = relationships
    .filter((record) => record.section === "partners_and_children")
    .sort((a, b) => a.displayOrder - b.displayOrder)
  const otherRecords = relationships.filter(
    (record) => record.section !== "partners_and_children"
  )
  const partners = partnerSection.filter(
    (record) =>
      record.relationshipToClient === "current_partner" ||
      record.relationshipToClient === "prior_partner"
  )

  function applyRoster(next: PartnersChildrenRosterInput) {
    onRosterChange(next)
    const slots = buildPartnersChildrenSlots(next, partnerSection)
    onRelationshipsChange([
      ...otherRecords,
      ...mergeRosterRecords(partnerSection, slots),
    ])
  }

  function patchRoster(partial: Partial<PartnersChildrenRosterInput>) {
    applyRoster({ ...roster, ...partial })
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

  function updatePartnerChildren(
    partnerId: string,
    partial: { biological?: number | null; step?: number | null }
  ) {
    const current = roster.childrenByPartnerId[partnerId] ?? {
      biological: null,
      step: null,
    }
    applyRoster({
      ...roster,
      childrenByPartnerId: {
        ...roster.childrenByPartnerId,
        [partnerId]: { ...current, ...partial },
      },
    })
  }

  const childrenOf = (partnerId: string) =>
    partnerSection.filter((record) => record.linkedPartnerRecordId === partnerId)
  const unlinkedChildren = partnerSection.filter(
    (record) =>
      (record.relationshipToClient === "child_biological" ||
        record.relationshipToClient === "child_step") &&
      !record.linkedPartnerRecordId
  )

  const summary = summarisePartnersAndChildren(roster, partnerSection)

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Enter partnership and children counts first (blank means not applicable).
        Child records are generated per relationship after that partner exists.
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <NumberField
          id="current_partner_count"
          label="Current partners"
          value={roster.currentPartnerCount}
          min={0}
          onChange={(currentPartnerCount) => patchRoster({ currentPartnerCount })}
        />
        <NumberField
          id="prior_partner_count"
          label="Prior partners"
          value={roster.priorPartnerCount}
          min={0}
          onChange={(priorPartnerCount) => patchRoster({ priorPartnerCount })}
        />
        <NumberField
          id="unlinked_child_count"
          label="Children not linked to a listed partner"
          value={roster.unlinkedChildCount}
          min={0}
          onChange={(unlinkedChildCount) => patchRoster({ unlinkedChildCount })}
        />
      </div>

      {partners.length === 0 && unlinkedChildren.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No partner or child records yet. Fill a count above to create them.
        </p>
      ) : null}

      {partners.map((partner, index) => {
        const counts = roster.childrenByPartnerId[partner.relationshipRecordId] ?? {
          biological: null,
          step: null,
        }
        const kids = childrenOf(partner.relationshipRecordId)
        return (
          <div key={partner.relationshipRecordId} className="space-y-4">
            <RelationshipRecordFields
              record={partner}
              heading={`${index + 1}. ${RELATIONSHIP_TO_CLIENT_LABELS[partner.relationshipToClient]}`}
              onChange={updateRecord}
            />
            <div className="ml-2 grid gap-4 rounded-md border border-dashed p-4 sm:grid-cols-2">
              <NumberField
                id={`${partner.relationshipRecordId}_bio_children`}
                label={`Biological children with ${relationshipDisplayLabel(partner)}`}
                value={counts.biological}
                min={0}
                onChange={(biological) =>
                  updatePartnerChildren(partner.relationshipRecordId, {
                    biological,
                  })
                }
              />
              <NumberField
                id={`${partner.relationshipRecordId}_step_children`}
                label="Step-children in this relationship"
                value={counts.step}
                min={0}
                onChange={(step) =>
                  updatePartnerChildren(partner.relationshipRecordId, { step })
                }
              />
            </div>
            {kids.map((child) => (
              <div key={child.relationshipRecordId} className="ml-4">
                <RelationshipRecordFields
                  record={child}
                  heading={RELATIONSHIP_TO_CLIENT_LABELS[child.relationshipToClient]}
                  onChange={updateRecord}
                />
              </div>
            ))}
          </div>
        )
      })}

      {unlinkedChildren.map((child) => (
        <RelationshipRecordFields
          key={child.relationshipRecordId}
          record={child}
          heading="Child (not linked to a listed partner)"
          onChange={updateRecord}
        />
      ))}

      <div className="space-y-2">
        <p className="text-sm font-medium">Summary</p>
        <SummarySentence text={summary} />
      </div>
    </div>
  )
}
