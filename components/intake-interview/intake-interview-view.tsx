import type { ReactNode } from "react"

import { CollapsibleSection } from "@/components/session-notes/collapsible-section"
import {
  DEPENDENCY_LABELS,
  EVENT_SUB_DOMAIN_LABELS,
  NECESSITY_KEYS,
  NECESSITY_LABELS,
  PARENTS_MARITAL_STATUS_LABELS,
} from "@/lib/intake-interview/constants"
import { relationshipDisplayLabel } from "@/lib/intake-interview/roster"
import type {
  EventRecord,
  IntakeInterviewRow,
  RelationshipRecord,
} from "@/lib/intake-interview/types"

function display(value: string | number | null | undefined, fallback = "—") {
  if (value == null) return fallback
  const text = String(value).trim()
  return text || fallback
}

function yesNo(value: boolean | null | undefined) {
  if (value == null) return "—"
  return value ? "Yes" : "No"
}

function Definition({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium whitespace-pre-wrap">{children}</dd>
    </div>
  )
}

function RelationshipView({ record }: { record: RelationshipRecord }) {
  return (
    <div className="rounded-md border p-3">
      <p className="mb-2 text-sm font-medium">{relationshipDisplayLabel(record)}</p>
      <dl className="grid gap-2 sm:grid-cols-2">
        <Definition label="Age">{display(record.age)}</Definition>
        <Definition label="Deceased">{yesNo(record.deceased)}</Definition>
        {record.deceased ? (
          <>
            <Definition label="Age at death">{display(record.ageAtDeath)}</Definition>
            <Definition label="Health / cause of death">
              {display(record.healthOrCauseOfDeath)}
            </Definition>
          </>
        ) : null}
        <Definition label="Length of relationship">
          {display(record.lengthOfRelationship)}
        </Definition>
        {record.relationshipStatus ? (
          <Definition label="Relationship status">
            {display(record.relationshipStatus)}
          </Definition>
        ) : null}
        {record.timeSinceEnded ? (
          <Definition label="Time since ended">{display(record.timeSinceEnded)}</Definition>
        ) : null}
        {record.qualityOfRelationship ? (
          <Definition label="Quality of relationship">
            {display(record.qualityOfRelationship)}
          </Definition>
        ) : null}
        {record.dependency ? (
          <Definition label="Dependency">
            {DEPENDENCY_LABELS[record.dependency]}
          </Definition>
        ) : null}
        {record.livingSituation ? (
          <Definition label="Living situation">{display(record.livingSituation)}</Definition>
        ) : null}
      </dl>
    </div>
  )
}

function EventView({
  event,
  relationships,
}: {
  event: EventRecord
  relationships: RelationshipRecord[]
}) {
  if (!event.endorsed) return null
  const related =
    event.personKind === "relationship"
      ? relationships.find(
          (record) => record.relationshipRecordId === event.relationshipRecordId
        )
      : null
  const person = related ? relationshipDisplayLabel(related) : "Family member"
  return (
    <div className="rounded-md border p-3">
      <p className="mb-2 text-sm font-medium">
        {EVENT_SUB_DOMAIN_LABELS[event.subDomain]}
        {event.eventCategory === "family" ? ` — ${person}` : ""}
      </p>
      <dl className="grid gap-2 sm:grid-cols-2">
        <Definition label="Description">{display(event.reasonDescription)}</Definition>
        <Definition label="Started">{display(event.ageDateStart)}</Definition>
        <Definition label="Ongoing / resolved">
          {display(event.resolvedOrOngoing)}
        </Definition>
        <Definition label="Currently treated">{yesNo(event.treated)}</Definition>
        {event.severityImpact ? (
          <Definition label="Severity / impact">{display(event.severityImpact)}</Definition>
        ) : null}
        {event.treatmentType ? (
          <Definition label="Treatment type">{display(event.treatmentType)}</Definition>
        ) : null}
        {event.treatmentDetail ? (
          <Definition label="Treatment detail">{display(event.treatmentDetail)}</Definition>
        ) : null}
        {event.outcome ? (
          <Definition label="Outcome">{display(event.outcome)}</Definition>
        ) : null}
      </dl>
    </div>
  )
}

export function IntakeInterviewView({ interview }: { interview: IntakeInterviewRow }) {
  const { payload } = interview
  const family = payload.relationships.filter(
    (record) => record.section === "family_of_origin"
  )
  const partners = payload.relationships.filter(
    (record) => record.section === "partners_and_children"
  )
  const childhood = payload.events.filter(
    (event) => event.eventCategory === "childhood" && event.endorsed
  )
  const adulthood = payload.events.filter(
    (event) => event.eventCategory === "adulthood" && event.endorsed
  )
  const familyEvents = payload.events.filter(
    (event) => event.eventCategory === "family" && event.endorsed
  )

  return (
    <div>
      <CollapsibleSection title="1. Identity">
        <dl className="grid gap-3 sm:grid-cols-2">
          <Definition label="Sex">{display(payload.identity.sex)}</Definition>
          <Definition label="Pronouns">{display(payload.identity.pronouns)}</Definition>
          {payload.identity.genderDiffersFromSex ? (
            <Definition label="Gender identity">
              {display(payload.identity.genderIdentity)}
            </Definition>
          ) : null}
          <Definition label="Race">{display(payload.identity.race)}</Definition>
          <Definition label="Ethnicity">{display(payload.identity.ethnicity)}</Definition>
          <Definition label="Cultural / religious background">
            {display(payload.identity.culturalReligiousBackground)}
          </Definition>
          <Definition label="Primary language">
            {display(payload.identity.primaryLanguage)}
          </Definition>
          <Definition label="Interpreter needed">
            {yesNo(payload.identity.interpreterNeeded)}
          </Definition>
          {payload.identity.interpreterNeeded ? (
            <Definition label="Interpreter needs">
              {display(payload.identity.interpreterNeeds)}
            </Definition>
          ) : null}
          <Definition label="Disability">{display(payload.identity.disability)}</Definition>
          <Definition label="Accessibility needs">
            {display(payload.identity.accessibilityNeeds)}
          </Definition>
        </dl>
      </CollapsibleSection>

      <CollapsibleSection title="2. Family of origin" defaultOpen={false}>
        <div className="space-y-3">
          <Definition label="Parents' marital status">
            {payload.familyOfOriginRoster.parentsMaritalStatus
              ? PARENTS_MARITAL_STATUS_LABELS[
                  payload.familyOfOriginRoster.parentsMaritalStatus
                ]
              : "—"}
            {payload.familyOfOriginRoster.parentsMaritalStatusOther
              ? ` — ${payload.familyOfOriginRoster.parentsMaritalStatusOther}`
              : ""}
          </Definition>
          {family.map((record) => (
            <RelationshipView key={record.relationshipRecordId} record={record} />
          ))}
          {interview.familyOfOriginSummary ? (
            <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              {interview.familyOfOriginSummary}
            </p>
          ) : null}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="3. Partners and children" defaultOpen={false}>
        <div className="space-y-3">
          {partners.map((record) => (
            <RelationshipView key={record.relationshipRecordId} record={record} />
          ))}
          {interview.partnersChildrenSummary ? (
            <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              {interview.partnersChildrenSummary}
            </p>
          ) : null}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="4. Living situation" defaultOpen={false}>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Definition label="Household composition">
            {display(payload.livingSituation.householdComposition)}
          </Definition>
          <Definition label="Housing type">
            {display(payload.livingSituation.housingType)}
          </Definition>
          <Definition label="Housing stability">
            {display(payload.livingSituation.housingStability)}
          </Definition>
        </dl>
      </CollapsibleSection>

      <CollapsibleSection title="5. Education" defaultOpen={false}>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Definition label="Level">{display(payload.education.level)}</Definition>
          <Definition label="Field of study">
            {display(payload.education.fieldOfStudy)}
          </Definition>
          <Definition label="Currently studying">
            {yesNo(payload.education.currentlyStudying)}
          </Definition>
          {payload.education.currentlyStudying ? (
            <Definition label="Current study">
              {display(payload.education.currentlyStudyingDetail)}
            </Definition>
          ) : null}
          <Definition label="Disruption">{yesNo(payload.education.disruption)}</Definition>
          {payload.education.disruption ? (
            <Definition label="Disruption detail">
              {display(payload.education.disruptionDetail)}
            </Definition>
          ) : null}
        </dl>
        {payload.education.educationalEvents.length > 0 ? (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium">Educational event history</p>
            {payload.education.educationalEvents.map((item) => (
              <p key={item.id} className="text-sm">
                {item.description}
                {item.ageDateStart ? ` (${item.ageDateStart})` : ""}
                {item.completed != null ? ` — ${item.completed ? "completed" : "not completed"}` : ""}
                {item.detail ? `. ${item.detail}` : ""}
              </p>
            ))}
          </div>
        ) : null}
      </CollapsibleSection>

      <CollapsibleSection title="6. Occupation" defaultOpen={false}>
        <div className="space-y-3">
          <p className="text-sm font-medium">Current role</p>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Definition label="Role">{display(payload.occupation.currentJob.title)}</Definition>
            <Definition label="Employer">
              {display(payload.occupation.currentJob.employer)}
            </Definition>
            <Definition label="Start year">
              {display(payload.occupation.currentJob.startYear)}
            </Definition>
            {payload.occupation.currentJob.issues ? (
              <Definition label="Issues">
                {display(payload.occupation.currentJob.issues)}
              </Definition>
            ) : null}
          </dl>
          {payload.occupation.previousJobs.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Previous jobs</p>
              {payload.occupation.previousJobs.map((job) => (
                <div key={job.id} className="rounded-md border p-3 text-sm">
                  <p className="font-medium">
                    {display(job.title)}
                    {job.employer ? ` — ${job.employer}` : ""}
                  </p>
                  <p className="text-muted-foreground">
                    {display(job.startYear)}–{display(job.endYear, "present")}
                  </p>
                  {job.issues ? <p className="mt-1">{job.issues}</p> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="7. Financial situation" defaultOpen={false}>
        <dl className="grid gap-3">
          <Definition label="Financial concerns">
            {display(payload.financial.financialConcerns)}
          </Definition>
          {NECESSITY_KEYS.map((key) => (
            <Definition key={key} label={NECESSITY_LABELS[key]}>
              {payload.financial[key].hasDifficulty
                ? `Concern${payload.financial[key].detail ? ` — ${payload.financial[key].detail}` : ""}`
                : "No difficulty recorded"}
            </Definition>
          ))}
        </dl>
      </CollapsibleSection>

      <CollapsibleSection title="8. Social support" defaultOpen={false}>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Definition label="Family support">
            {yesNo(payload.socialSupport.familySupport.hasSupport)}
            {payload.socialSupport.familySupport.detail
              ? ` — ${payload.socialSupport.familySupport.detail}`
              : ""}
          </Definition>
          <Definition label="Pets">
            {payload.socialSupport.pets.petCount == null
              ? "—"
              : payload.socialSupport.pets.petCount === 0
                ? "None"
                : `${payload.socialSupport.pets.petCount}${payload.socialSupport.pets.types ? ` (${payload.socialSupport.pets.types})` : ""}`}
          </Definition>
          <Definition label="Friendships">
            {yesNo(payload.socialSupport.friendships.hasCloseFriends)}
            {payload.socialSupport.friendships.detail
              ? ` — ${payload.socialSupport.friendships.detail}`
              : ""}
          </Definition>
          <Definition label="Religious engagement">
            {yesNo(payload.socialSupport.religiousEngagement.engaged)}
            {payload.socialSupport.religiousEngagement.tradition
              ? ` — ${payload.socialSupport.religiousEngagement.tradition}`
              : ""}
          </Definition>
          <Definition label="Suicide-protective belief">
            {yesNo(payload.socialSupport.religiousEngagement.suicideProtectiveBelief)}
            {payload.socialSupport.religiousEngagement.suicideProtectiveBeliefDetail
              ? ` — ${payload.socialSupport.religiousEngagement.suicideProtectiveBeliefDetail}`
              : ""}
          </Definition>
          <Definition label="Group membership">
            {payload.socialSupport.groups.length === 0
              ? "—"
              : payload.socialSupport.groups.map((group) => group.name).join(", ")}
          </Definition>
        </dl>
      </CollapsibleSection>

      <CollapsibleSection title="9. History — childhood" defaultOpen={false}>
        {childhood.length === 0 ? (
          <p className="text-sm text-muted-foreground">No childhood history endorsed.</p>
        ) : (
          <div className="space-y-3">
            {childhood.map((event) => (
              <EventView
                key={event.eventRecordId}
                event={event}
                relationships={payload.relationships}
              />
            ))}
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="10. History — adulthood" defaultOpen={false}>
        {adulthood.length === 0 ? (
          <p className="text-sm text-muted-foreground">No adulthood history endorsed.</p>
        ) : (
          <div className="space-y-3">
            {adulthood.map((event) => (
              <EventView
                key={event.eventRecordId}
                event={event}
                relationships={payload.relationships}
              />
            ))}
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="11. History — others (family)" defaultOpen={false}>
        {familyEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No family history endorsed.</p>
        ) : (
          <div className="space-y-3">
            {familyEvents.map((event) => (
              <EventView
                key={event.eventRecordId}
                event={event}
                relationships={payload.relationships}
              />
            ))}
          </div>
        )}
      </CollapsibleSection>
    </div>
  )
}
