"use client"

import { useActionState, useState } from "react"
import Link from "next/link"

import {
  saveIntakeInterview,
  type SaveIntakeInterviewState,
} from "@/app/clients/[client_id]/intake-interview/actions"
import { EducationGroup } from "@/components/intake-interview/education-group"
import { EventGatingSection } from "@/components/intake-interview/event-gating-section"
import { FamilyHistoryGroup } from "@/components/intake-interview/family-history-group"
import { FamilyOfOriginGroup } from "@/components/intake-interview/family-of-origin-group"
import { FinancialGroup } from "@/components/intake-interview/financial-group"
import { IdentityGroup } from "@/components/intake-interview/identity-group"
import { LivingSituationGroup } from "@/components/intake-interview/living-situation-group"
import { OccupationGroup } from "@/components/intake-interview/occupation-group"
import { PartnersChildrenGroup } from "@/components/intake-interview/partners-children-group"
import { SocialSupportGroup } from "@/components/intake-interview/social-support-group"
import { CollapsibleSection } from "@/components/session-notes/collapsible-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { emptyPayload } from "@/lib/intake-interview/defaults"
import { sanitizePayload } from "@/lib/intake-interview/sanitize"
import {
  ADULTHOOD_SUB_DOMAINS,
  CHILDHOOD_SUB_DOMAINS,
} from "@/lib/intake-interview/types"
import type { IntakeInterviewPayload } from "@/lib/intake-interview/types"

export function IntakeInterviewForm({
  clientId,
  sourceInterviewId,
  initialPayload,
  cancelHref,
}: {
  clientId: string
  sourceInterviewId: string | null
  initialPayload?: IntakeInterviewPayload
  cancelHref: string
}) {
  const [payload, setPayload] = useState<IntakeInterviewPayload>(
    () => initialPayload ?? emptyPayload("")
  )
  const [saveState, saveAction, savePending] = useActionState(
    saveIntakeInterview.bind(null, clientId, sourceInterviewId),
    {} as SaveIntakeInterviewState
  )

  function patch(partial: Partial<IntakeInterviewPayload>) {
    setPayload((current) => ({ ...current, ...partial }))
  }

  const serialized = JSON.stringify(sanitizePayload(payload))

  return (
    <form
      action={saveAction}
      className="space-y-2"
      onSubmit={(event) => {
        const payloadInput = event.currentTarget.elements.namedItem(
          "payload_json"
        ) as HTMLInputElement | null
        const dateInput = event.currentTarget.elements.namedItem(
          "interview_date"
        ) as HTMLInputElement | null
        if (payloadInput) payloadInput.value = JSON.stringify(sanitizePayload(payload))
        if (dateInput) dateInput.value = payload.interviewDate
      }}
    >
      <input type="hidden" name="payload_json" defaultValue={serialized} />
      <input type="hidden" name="interview_date" defaultValue={payload.interviewDate} />

      {saveState.error ? (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {saveState.error}
        </div>
      ) : null}

      <div className="mb-6 max-w-sm space-y-2">
        <Label htmlFor="interview_date_visible">Interview date</Label>
        <Input
          id="interview_date_visible"
          type="date"
          value={payload.interviewDate}
          onChange={(event) => patch({ interviewDate: event.target.value })}
        />
      </div>

      <CollapsibleSection title="1. Identity" defaultOpen>
        <IdentityGroup
          value={payload.identity}
          onChange={(identity) => patch({ identity })}
        />
      </CollapsibleSection>

      <CollapsibleSection title="2. Family of origin" defaultOpen={false}>
        <FamilyOfOriginGroup
          roster={payload.familyOfOriginRoster}
          relationships={payload.relationships}
          onRosterChange={(familyOfOriginRoster) =>
            patch({ familyOfOriginRoster })
          }
          onRelationshipsChange={(relationships) => patch({ relationships })}
        />
      </CollapsibleSection>

      <CollapsibleSection title="3. Partners and children" defaultOpen={false}>
        <PartnersChildrenGroup
          roster={payload.partnersChildrenRoster}
          relationships={payload.relationships}
          onRosterChange={(partnersChildrenRoster) =>
            patch({ partnersChildrenRoster })
          }
          onRelationshipsChange={(relationships) => patch({ relationships })}
        />
      </CollapsibleSection>

      <CollapsibleSection title="4. Living situation" defaultOpen={false}>
        <LivingSituationGroup
          value={payload.livingSituation}
          onChange={(livingSituation) => patch({ livingSituation })}
        />
      </CollapsibleSection>

      <CollapsibleSection title="5. Education" defaultOpen={false}>
        <EducationGroup
          value={payload.education}
          onChange={(education) => patch({ education })}
        />
      </CollapsibleSection>

      <CollapsibleSection title="6. Occupation" defaultOpen={false}>
        <OccupationGroup
          value={payload.occupation}
          onChange={(occupation) => patch({ occupation })}
        />
      </CollapsibleSection>

      <CollapsibleSection title="7. Financial situation" defaultOpen={false}>
        <FinancialGroup
          value={payload.financial}
          onChange={(financial) => patch({ financial })}
        />
      </CollapsibleSection>

      <CollapsibleSection title="8. Social support" defaultOpen={false}>
        <SocialSupportGroup
          value={payload.socialSupport}
          onChange={(socialSupport) => patch({ socialSupport })}
        />
      </CollapsibleSection>

      <CollapsibleSection title="9. History — childhood" defaultOpen={false}>
        <EventGatingSection
          category="childhood"
          subDomains={CHILDHOOD_SUB_DOMAINS}
          personKind="self"
          relationshipRecordId={null}
          events={payload.events}
          onChange={(events) => patch({ events })}
        />
      </CollapsibleSection>

      <CollapsibleSection title="10. History — adulthood" defaultOpen={false}>
        <EventGatingSection
          category="adulthood"
          subDomains={ADULTHOOD_SUB_DOMAINS}
          personKind="self"
          relationshipRecordId={null}
          events={payload.events}
          onChange={(events) => patch({ events })}
        />
      </CollapsibleSection>

      <CollapsibleSection title="11. History — others (family)" defaultOpen={false}>
        <FamilyHistoryGroup
          relationships={payload.relationships}
          selectedIds={payload.familyHistory.selectedRelationshipIds}
          events={payload.events}
          onSelectedIdsChange={(selectedRelationshipIds) =>
            patch({ familyHistory: { selectedRelationshipIds } })
          }
          onEventsChange={(events) => patch({ events })}
        />
      </CollapsibleSection>

      <div className="flex flex-wrap items-center gap-2 pt-4">
        <Button type="submit" name="intent" value="draft" disabled={savePending}>
          {savePending ? "Saving…" : "Save draft"}
        </Button>
        <Button
          type="submit"
          name="intent"
          value="finalise"
          variant="outline"
          disabled={savePending}
        >
          {savePending ? "Saving…" : "Save and finalise"}
        </Button>
        <Button type="button" variant="ghost" asChild>
          <Link href={cancelHref}>Cancel</Link>
        </Button>
      </div>
    </form>
  )
}
