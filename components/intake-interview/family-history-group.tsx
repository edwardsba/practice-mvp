"use client"

import { EventGatingSection } from "@/components/intake-interview/event-gating-section"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { FAMILY_HISTORY_SUB_DOMAINS } from "@/lib/intake-interview/types"
import { relationshipDisplayLabel } from "@/lib/intake-interview/roster"
import type { EventRecord, RelationshipRecord } from "@/lib/intake-interview/types"

export function FamilyHistoryGroup({
  relationships,
  selectedIds,
  events,
  onSelectedIdsChange,
  onEventsChange,
}: {
  relationships: RelationshipRecord[]
  selectedIds: string[]
  events: EventRecord[]
  onSelectedIdsChange: (ids: string[]) => void
  onEventsChange: (events: EventRecord[]) => void
}) {
  function toggle(id: string, selected: boolean) {
    if (selected) {
      onSelectedIdsChange([...new Set([...selectedIds, id])])
      return
    }
    onSelectedIdsChange(selectedIds.filter((item) => item !== id))
    onEventsChange(
      events.filter(
        (event) =>
          !(
            event.eventCategory === "family" &&
            event.relationshipRecordId === id
          )
      )
    )
  }

  const selectedRecords = relationships.filter((record) =>
    selectedIds.includes(record.relationshipRecordId)
  )

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Select family members captured in Family of Origin or Partners and
        Children whose history is clinically relevant, then complete the same
        adulthood history domains for each.
      </p>

      {relationships.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No family members recorded yet. Complete Groups 2 and 3 first.
        </p>
      ) : (
        <div className="space-y-2">
          {relationships.map((record) => (
            <div key={record.relationshipRecordId} className="flex items-start gap-3">
              <Checkbox
                id={`family_hist_${record.relationshipRecordId}`}
                checked={selectedIds.includes(record.relationshipRecordId)}
                onCheckedChange={(value) =>
                  toggle(record.relationshipRecordId, value === true)
                }
              />
              <Label
                htmlFor={`family_hist_${record.relationshipRecordId}`}
                className="cursor-pointer font-normal"
              >
                {relationshipDisplayLabel(record)}
              </Label>
            </div>
          ))}
        </div>
      )}

      {selectedRecords.map((record) => (
        <div
          key={record.relationshipRecordId}
          className="space-y-3 rounded-md border p-4"
        >
          <p className="text-sm font-medium">
            History — {relationshipDisplayLabel(record)}
          </p>
          <EventGatingSection
            category="family"
            subDomains={FAMILY_HISTORY_SUB_DOMAINS}
            personKind="relationship"
            relationshipRecordId={record.relationshipRecordId}
            personLabel={relationshipDisplayLabel(record)}
            events={events}
            onChange={onEventsChange}
          />
        </div>
      ))}
    </div>
  )
}
