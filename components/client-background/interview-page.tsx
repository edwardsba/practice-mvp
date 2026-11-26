"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import {
  completeBackgroundInterviewAction,
  saveEducationAction,
  saveIdentityAction,
  saveInterviewAnswersBulkAction,
  saveInterviewItemAnswerAction,
  saveLivingSituationAction,
  saveOccupationAction,
  saveStressorsAction,
} from "@/app/clients/[client_id]/background/actions"
import { InterviewItemRow } from "@/components/client-background/interview-item-row"
import { InterviewNumberedSection } from "@/components/client-background/interview-numbered-section"
import {
  EducationFieldsEditor,
  IdentityFieldsEditor,
  LivingFieldsEditor,
  OccupationFieldsEditor,
} from "@/components/client-background/demographics-section"
import { AutosaveFields, type SavePhase } from "@/components/client-background/interview-autosave"
import {
  InterviewSectionCard,
  readSectionOpenState,
  writeSectionOpenState,
} from "@/components/client-background/interview-section-card"
import { HistoryTreeSection } from "@/components/client-background/history-tree-section"
import { StressorsFields } from "@/components/client-background/medication-stressors"
import { RelationshipBlocksSection } from "@/components/client-background/relationship-blocks-section"
import { scrollToBackgroundCheck, WorthCheckingLinks } from "@/components/client-background/worth-checking"
import { ReferralFundingQuickView } from "@/components/clients/referral-funding-quick-view"
import { InterviewFundingAddPanel } from "@/components/funding/interview-funding-add-panel"
import { ConfirmPrefilledDialog } from "@/components/shared/confirm-prefilled-dialog"
import { SectionProgressChips } from "@/components/shared/section-progress-chips"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { QuickViewLine } from "@/lib/funding/claims-page"
import type { ReferralFundingCardFormOptions } from "@/lib/funding/referral-funding-card-props"
import { backgroundAnswersToClientBackground } from "@/lib/background-questionnaire/to-client-background"
import type { BackgroundSelfReport } from "@/lib/background-questionnaire/types"
import { assessAge, displayedAge } from "@/lib/client-background/age"
import {
  backgroundChecks,
  type BackgroundCheck,
} from "@/lib/client-background/checks"
import type { ReasonSupport } from "@/lib/client-background/load"
import { parsePartialDate } from "@/lib/client-background/partial-date"
import type { ScreeningAnswers } from "@/lib/client-background/interview-history"
import {
  applyNothingToRecord,
  blockAnswersFromInterview,
  formatSectionList,
  INTERVIEW_SECTIONS,
  interviewSectionStatus,
  sectionsWithLeft,
  sectionsWithToConfirm,
  type InterviewAnswerValue,
  type InterviewAnswersJson,
} from "@/lib/client-background/interview-answers"
import type {
  ClientBackgroundData,
  EventRecord,
  RelationshipBlockAnswers,
  RelationshipRecord,
  StressorsRecord,
} from "@/lib/client-background/types"
import { emptyBlockAnswers } from "@/lib/client-background/types"
import { formatCommunicationSummary } from "@/lib/clients/communication-summary"
import { formatEmergencyContactSummary } from "@/lib/clients/emergency-details-summary"
import { todayDateString } from "@/lib/dates/practice-time"
import type { SectionStatus } from "@/lib/section-status"

function clientAge(dateOfBirth: string | null) {
  if (!dateOfBirth) return ""
  return displayedAge(assessAge(parsePartialDate(dateOfBirth), parsePartialDate(todayDateString()), "person"))
}

export type InterviewContactDetails = {
  phone: string | null
  email: string | null
  address: string | null
  comms: {
    commsOptOut: boolean
    reminderOptOut: boolean
    preSessionOptOut: boolean
    postSessionOptOut: boolean
    adminCommsOptOut: boolean
    onlineBookingPermitted: boolean
  }
}

export type InterviewEmergencyContact = {
  name: string
  role: string | null
  phone: string | null
  email: string | null
}

export type InterviewMedicalContactLine = {
  name: string
  professionName: string | null
  isMain: boolean
}

export function InterviewPage({
  clientId,
  practiceId,
  clientName,
  data,
  screening: initialScreening,
  answers: initialAnswers,
  selfReport,
  reasonSupport,
  medicalContacts = [],
  medicalContactLines = [],
  emergencyContacts = [],
  contactDetails,
  referralQuickViewLines,
  referralFormOptions,
  referralRecorded = false,
  lrampStartHref = null,
}: {
  clientId: string
  practiceId: string
  clientName: string
  data: ClientBackgroundData
  screening: ScreeningAnswers
  answers: InterviewAnswersJson
  selfReport: BackgroundSelfReport | null
  reasonSupport: ReasonSupport
  medicalContacts?: import("@/lib/client-background/professionals").ProfessionalOption[]
  medicalContactLines?: InterviewMedicalContactLine[]
  emergencyContacts?: InterviewEmergencyContact[]
  contactDetails: InterviewContactDetails
  referralQuickViewLines: QuickViewLine[]
  referralFormOptions: ReferralFundingCardFormOptions
  referralRecorded?: boolean
  lrampStartHref?: string | null
}) {
  const router = useRouter()
  const [fundingAddOpen, setFundingAddOpen] = useState(false)
  const identityRef = useRef(data.demographics.identity)
  const occupationRef = useRef(data.demographics.occupation)
  const livingRef = useRef(data.demographics.livingSituation)
  const relationshipsRef = useRef(data.relationships)
  const statusRef = useRef(data.relationshipStatus)
  const pendingCheck = useRef<BackgroundCheck | null>(null)
  const [relationships, setRelationships] = useState(data.relationships)
  const professionals = reasonSupport.professionals
  const blocksRef = useRef(data.relationshipBlocks ?? [])
  const answersRef = useRef(data.blockAnswers ?? emptyBlockAnswers())
  const [blockAnswers, setBlockAnswers] = useState<RelationshipBlockAnswers>(
    data.blockAnswers ?? emptyBlockAnswers()
  )
  const [scrollNonce, setScrollNonce] = useState(0)
  const [phases, setPhases] = useState<Record<string, { phase: SavePhase; retry: (() => void) | null }>>({})
  const flushers = useRef(new Set<() => Promise<void>>())
  const [sectionOpen, setSectionOpen] = useState<Record<string, boolean>>({})
  const [interviewAnswers, setInterviewAnswers] = useState(initialAnswers)
  const [screening, setScreening] = useState(initialScreening)
  const [events, setEvents] = useState(data.events)
  const stressorsRef = useRef(data.stressors)
  const [notFinishedOpen, setNotFinishedOpen] = useState(false)
  const [notFinishedSections, setNotFinishedSections] = useState<number[]>([])
  const [confirmPrefilledOpen, setConfirmPrefilledOpen] = useState(false)
  const [confirmPrefilledSections, setConfirmPrefilledSections] = useState<number[]>([])
  const [worthCheckingOpen, setWorthCheckingOpen] = useState(false)
  const [worthChecks, setWorthChecks] = useState<BackgroundCheck[]>([])
  const [completing, setCompleting] = useState(false)
  const [completeError, setCompleteError] = useState<string | null>(null)
  const [confirmAllOnComplete, setConfirmAllOnComplete] = useState(false)
  const answerToken = useRef(0)

  const age = clientAge(data.dateOfBirth)
  const suggestions = selfReport ? backgroundAnswersToClientBackground(selfReport.answers) : null
  const received = selfReport ? formatReceived(selfReport.assessmentDate) : ""

  useEffect(() => {
    // sessionStorage is browser-only; hydrate open state after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional hydrate from sessionStorage
    setSectionOpen(readSectionOpenState(clientId, "interview"))
  }, [clientId])

  function setSection(id: string, open: boolean) {
    setSectionOpen((current) => {
      const next = { ...current, [id]: open }
      writeSectionOpenState(clientId, "interview", next)
      return next
    })
  }

  function toggleSection(id: string) {
    setSection(id, !sectionOpen[id])
  }

  const onPhase = useCallback((id: string, phase: SavePhase, retry: (() => void) | null) => {
    setPhases((current) => ({ ...current, [id]: { phase, retry } }))
  }, [])

  const registerFlush = useCallback((flush: () => Promise<void>) => {
    flushers.current.add(flush)
    return () => {
      flushers.current.delete(flush)
    }
  }, [])

  const onRelationships = useCallback((next: RelationshipRecord[]) => {
    relationshipsRef.current = next
    setRelationships(next)
  }, [])

  const onRelationshipStatus = useCallback((next: ClientBackgroundData["relationshipStatus"]) => {
    statusRef.current = next
  }, [])

  const onBlocks = useCallback((next: NonNullable<ClientBackgroundData["relationshipBlocks"]>) => {
    blocksRef.current = next
  }, [])

  const onBlockAnswers = useCallback((next: RelationshipBlockAnswers) => {
    answersRef.current = next
    setBlockAnswers(next)
  }, [])

  const getChecks = useCallback(
    (current: {
      screening: ScreeningAnswers
      events: EventRecord[]
      stressors: StressorsRecord
    }) =>
      backgroundChecks({
        data: {
          ...data,
          relationshipStatus: statusRef.current,
          relationships: relationshipsRef.current,
          relationshipBlocks: blocksRef.current,
          blockAnswers: answersRef.current,
          demographics: {
            ...data.demographics,
            identity: identityRef.current,
            livingSituation: livingRef.current,
            occupation: occupationRef.current,
          },
          stressors: current.stressors,
          events: current.events,
        },
        numberOfChildren: selfReport?.answers.familyHome.numberOfChildren ?? null,
        screening: current.screening,
        referralRecorded,
      }),
    [data, referralRecorded, selfReport]
  )

  useEffect(() => {
    const check = pendingCheck.current
    if (!check) return
    pendingCheck.current = null
    scrollToBackgroundCheck(check)
  }, [scrollNonce])

  const values = Object.values(phases)
  const saving = values.some((item) => item.phase === "saving")
  const failed = values.filter((item) => item.phase === "error")
  const saveLabel = saving ? "Saving…" : failed.length > 0 ? "Couldn't save — retry" : "Saved"

  async function flushAll() {
    await Promise.all([...flushers.current].map((flush) => flush()))
  }

  function openSections(numbers: number[]) {
    for (const number of numbers) {
      setSection(String(number), true)
    }
    const first = numbers[0]
    if (first) {
      requestAnimationFrame(() => {
        document.getElementById(`interview-section-${first}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
      })
    }
  }

  function jumpToCheck(check: BackgroundCheck) {
    const map: Record<string, string> = {
      reason: "2",
      identity: "3",
      occupation: "3",
      living: "7",
      "relationships-intimate": "5",
      relationships: "5",
      "relationships-caregivers": "6",
      history: "8",
    }
    const sectionId = map[check.target] ?? null
    if (sectionId) setSection(sectionId, true)
    if (check.target === "history") setSection("9", true)
    pendingCheck.current = check
    setScrollNonce((count) => count + 1)
  }

  async function leave() {
    await flushAll()
    router.push(`/clients/${clientId}/background`)
  }

  function applyLocalMirrors(nextAnswers: InterviewAnswersJson, nextScreening?: ScreeningAnswers) {
    setInterviewAnswers(nextAnswers)
    if (nextScreening) setScreening(nextScreening)
    const mirrors = blockAnswersFromInterview(nextAnswers)
    if (Object.keys(mirrors).length > 0) {
      const merged: RelationshipBlockAnswers = { ...answersRef.current }
      if (mirrors.previousRelationships) merged.previousRelationships = mirrors.previousRelationships
      if (mirrors.motherOtherRelationships) {
        merged.motherOtherRelationships = mirrors.motherOtherRelationships
      }
      if (mirrors.fatherOtherRelationships) {
        merged.fatherOtherRelationships = mirrors.fatherOtherRelationships
      }
      if (mirrors.caregiverArrangements) merged.caregiverArrangements = mirrors.caregiverArrangements
      answersRef.current = merged
      setBlockAnswers(merged)
    }
  }

  async function selectAnswer(itemKey: string, value: InterviewAnswerValue) {
    const current = ++answerToken.current
    onPhase("answers", "saving", null)
    const result = await saveInterviewItemAnswerAction(clientId, itemKey, value)
    if (current !== answerToken.current) return
    if (result.error || !result.answers) {
      onPhase("answers", "error", () => void selectAnswer(itemKey, value))
      return
    }
    applyLocalMirrors(result.answers, result.screening)
    onPhase("answers", "saved", null)
  }

  async function nothingToRecord(sectionNumber: number) {
    const next = applyNothingToRecord(interviewAnswers, sectionNumber)
    onPhase("answers", "saving", null)
    const result = await saveInterviewAnswersBulkAction(clientId, next)
    if (result.error || !result.answers) {
      onPhase("answers", "error", () => void nothingToRecord(sectionNumber))
      return
    }
    applyLocalMirrors(result.answers, result.screening)
    onPhase("answers", "saved", null)
  }

  async function beginComplete() {
    await flushAll()
    const left = sectionsWithLeft(interviewAnswers)
    if (left.length > 0) {
      setNotFinishedSections(left)
      setNotFinishedOpen(true)
      return
    }
    const toConfirm = sectionsWithToConfirm(interviewAnswers)
    if (toConfirm.length > 0) {
      setConfirmPrefilledSections(toConfirm)
      setConfirmPrefilledOpen(true)
      return
    }
    openWorthChecking(false)
  }

  function openWorthChecking(confirmAll: boolean) {
    setConfirmAllOnComplete(confirmAll)
    setWorthChecks(
      getChecks({
        screening,
        events,
        stressors: stressorsRef.current,
      })
    )
    setCompleteError(null)
    setWorthCheckingOpen(true)
  }

  async function finishComplete() {
    setCompleting(true)
    setCompleteError(null)
    const result = await completeBackgroundInterviewAction(clientId, selfReport?.resultId ?? null, {
      confirmAllItems: confirmAllOnComplete,
    })
    if (result.error) {
      setCompleting(false)
      setCompleteError(result.error)
      return
    }
    router.push(`/clients/${clientId}/background`)
  }

  function retryFailed() {
    for (const item of failed) item.retry?.()
  }

  const sectionStatuses: SectionStatus[] = useMemo(
    () => INTERVIEW_SECTIONS.map((section) => interviewSectionStatus(section, interviewAnswers)),
    [interviewAnswers]
  )

  const summaries = itemSummaries({
    clientName,
    dateOfBirth: data.dateOfBirth,
    contactDetails,
    data,
    emergencyContacts,
    medicalContactLines,
    blockAnswers,
    relationships,
  })

  return (
    <div className="mx-auto min-w-0 max-w-2xl">
      <header className="sticky top-0 z-30 -mx-4 border-b bg-background px-4">
        <div className="flex items-start justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Background interview</p>
            <p className="truncate text-sm text-muted-foreground">
              {clientName}
              {age ? `, ${age}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
            {lrampStartHref ? (
              <Link
                href={lrampStartHref}
                className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline"
              >
                Start LRAMP
              </Link>
            ) : null}
            <button type="button" className="min-h-11 text-sm underline" onClick={() => void leave()}>
              Save and leave
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 pb-2">
          {failed.length > 0 && !saving ? (
            <button type="button" className="min-h-11 text-sm text-destructive underline" onClick={retryFailed}>
              {saveLabel}
            </button>
          ) : (
            <p className="text-sm text-muted-foreground">{saveLabel}</p>
          )}
          <Button type="button" className="min-h-11" onClick={() => void beginComplete()}>
            Complete
          </Button>
        </div>
        <div className="sticky top-0 z-20 bg-background pb-3">
          <SectionProgressChips
            sections={sectionStatuses}
            onSelect={(section) => {
              setSection(section.letter, true)
              requestAnimationFrame(() => {
                document
                  .getElementById(`interview-section-${section.letter}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              })
            }}
          />
        </div>
      </header>

      {selfReport ? (
        <p className="mt-4 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
          Self-report received {received}. Blue lines show the client&apos;s answers; items without one aren&apos;t in
          the self-report. &quot;Use&quot; copies an answer into the field; nothing is filled in automatically.
        </p>
      ) : null}

      <div className="space-y-4 py-4">
        {INTERVIEW_SECTIONS.map((section) => {
          const status = interviewSectionStatus(section, interviewAnswers)
          const unanswered = section.items.some((item) => !interviewAnswers.items[item.key])
          return (
            <InterviewNumberedSection
              key={section.id}
              section={status}
              open={Boolean(sectionOpen[String(section.number)] ?? section.number <= 2)}
              onToggle={() => toggleSection(String(section.number))}
            >
              {section.nothingToRecord && unanswered ? (
                <button
                  type="button"
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-dashed px-3 text-sm"
                  onClick={() => void nothingToRecord(section.number)}
                >
                  Nothing to record
                </button>
              ) : null}

              <div className="space-y-3">
                {section.items.map((item) => (
                  <InterviewItemRow
                    key={item.key}
                    label={item.label}
                    kind={item.kind}
                    answer={interviewAnswers.items[item.key]}
                    summary={summaries[item.key] ?? null}
                    onSelect={(value) => void selectAnswer(item.key, value)}
                  />
                ))}
              </div>

              {section.number === 1 ? (
                <p className="text-sm">
                  <Link href={`/clients/${clientId}/edit`} className="font-medium text-primary underline">
                    Edit details
                  </Link>
                </p>
              ) : null}

              {section.number === 2 ? (
                <>
                  <ReferralFundingQuickView
                    clientId={clientId}
                    lines={referralQuickViewLines}
                    returnTo={`/clients/${clientId}/background/interview`}
                    footer={
                      <button
                        type="button"
                        className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
                        onClick={() => setFundingAddOpen(true)}
                      >
                        + Add referral or funding approval
                      </button>
                    }
                  />
                  <InterviewFundingAddPanel
                    clientId={clientId}
                    practiceId={practiceId}
                    formOptions={referralFormOptions}
                    open={fundingAddOpen}
                    onOpenChange={setFundingAddOpen}
                  />
                </>
              ) : null}

              {section.number === 3 ? (
                <div className="space-y-6">
                  <AutosaveFields
                    saved={data.demographics.identity}
                    save={async (value) => {
                      identityRef.current = value
                      const result = await saveIdentityAction(clientId, value)
                      if ("error" in result && result.error) return { error: result.error }
                      if (!("identity" in result) || !result.identity) return { error: "Could not save." }
                      identityRef.current = result.identity
                      return { value: result.identity }
                    }}
                    onPhase={(phase, retry) => onPhase("identity", phase, retry)}
                    registerFlush={registerFlush}
                  >
                    {(value, onChange, commit) => {
                      identityRef.current = value
                      return (
                        <IdentityFieldsEditor
                          value={value}
                          onChange={onChange}
                          onCommit={commit}
                          client={suggestions?.identity}
                        />
                      )
                    }}
                  </AutosaveFields>
                  <AutosaveFields
                    saved={data.demographics.education}
                    save={async (value) => {
                      const result = await saveEducationAction(clientId, value)
                      if ("error" in result && result.error) return { error: result.error }
                      if (!("education" in result) || !result.education) return { error: "Could not save." }
                      return { value: result.education }
                    }}
                    onPhase={(phase, retry) => onPhase("education", phase, retry)}
                    registerFlush={registerFlush}
                  >
                    {(value, onChange, commit) => (
                      <EducationFieldsEditor
                        value={value}
                        onChange={onChange}
                        onCommit={commit}
                        client={suggestions?.education}
                      />
                    )}
                  </AutosaveFields>
                  <AutosaveFields
                    saved={data.demographics.occupation}
                    save={async (value) => {
                      occupationRef.current = value
                      const result = await saveOccupationAction(clientId, value)
                      if ("error" in result && result.error) return { error: result.error }
                      if (!("occupation" in result) || !result.occupation) return { error: "Could not save." }
                      occupationRef.current = result.occupation
                      return { value: result.occupation }
                    }}
                    onPhase={(phase, retry) => onPhase("occupation", phase, retry)}
                    registerFlush={registerFlush}
                  >
                    {(value, onChange, commit) => {
                      occupationRef.current = value
                      return (
                        <OccupationFieldsEditor
                          value={value}
                          onChange={onChange}
                          onCommit={commit}
                          client={suggestions?.occupation}
                        />
                      )
                    }}
                  </AutosaveFields>
                </div>
              ) : null}

              {section.number === 4 ? (
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="font-medium">Emergency contacts</p>
                    <p className="whitespace-pre-line text-muted-foreground">
                      {formatEmergencyContactSummary(emergencyContacts)}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Medical contacts</p>
                    {medicalContactLines.length === 0 ? (
                      <p className="text-muted-foreground">None recorded</p>
                    ) : (
                      <ul className="list-inside list-disc text-muted-foreground">
                        {medicalContactLines.map((line) => (
                          <li key={`${line.name}-${line.professionName}`}>
                            {line.name}
                            {line.professionName ? ` · ${line.professionName}` : ""}
                            {line.isMain ? " (main)" : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <Link
                    href={`/clients/${clientId}/edit?open=emergency`}
                    className="inline-flex min-h-11 items-center font-medium text-primary underline"
                  >
                    Edit contacts
                  </Link>
                </div>
              ) : null}

              {section.number === 5 ? (
                <RelationshipBlocksSection
                  clientId={clientId}
                  relationships={relationships}
                  blocks={data.relationshipBlocks}
                  blockAnswers={blockAnswers}
                  relationshipStatus={data.relationshipStatus}
                  onRelationships={onRelationships}
                  onBlocks={onBlocks}
                  onBlockAnswers={onBlockAnswers}
                  onRelationshipStatus={onRelationshipStatus}
                  onPhase={onPhase}
                  registerFlush={registerFlush}
                  relationshipClient={suggestions?.relationshipStatus}
                  childrenPrompt={suggestions?.numberOfChildren?.label ?? null}
                  visibleSections={["intimate"]}
                  embedWithoutChrome
                  hideTopLevelAnswers
                />
              ) : null}

              {section.number === 6 ? (
                <RelationshipBlocksSection
                  clientId={clientId}
                  relationships={relationships}
                  blocks={data.relationshipBlocks}
                  blockAnswers={blockAnswers}
                  relationshipStatus={data.relationshipStatus}
                  onRelationships={onRelationships}
                  onBlocks={onBlocks}
                  onBlockAnswers={onBlockAnswers}
                  onRelationshipStatus={onRelationshipStatus}
                  onPhase={onPhase}
                  registerFlush={registerFlush}
                  visibleSections={["caregivers"]}
                  embedWithoutChrome
                  hideTopLevelAnswers
                />
              ) : null}

              {section.number === 7 ? (
                <AutosaveFields
                  saved={data.demographics.livingSituation}
                  save={async (value) => {
                    livingRef.current = value
                    const result = await saveLivingSituationAction(clientId, value)
                    if ("error" in result && result.error) return { error: result.error }
                    if (!("livingSituation" in result) || !result.livingSituation) {
                      return { error: "Could not save." }
                    }
                    livingRef.current = result.livingSituation
                    return { value: result.livingSituation }
                  }}
                  onPhase={(phase, retry) => onPhase("living", phase, retry)}
                  registerFlush={registerFlush}
                >
                  {(value, onChange, commit) => {
                    livingRef.current = value
                    return (
                      <LivingFieldsEditor
                        value={value}
                        relationships={relationships}
                        onChange={onChange}
                        onCommit={commit}
                        client={suggestions?.living}
                      />
                    )
                  }}
                </AutosaveFields>
              ) : null}

              {section.number === 8 ? (
                <HistoryTreeSection
                  clientId={clientId}
                  clientName={clientName.split(/\s+/)[0] || clientName}
                  dateOfBirth={data.dateOfBirth}
                  events={events}
                  relationships={relationships}
                  screening={screening}
                  medicalContacts={medicalContacts}
                  professionals={professionals}
                  issues={data.issues}
                  presentation="interview"
                  groupFilter="client"
                  hideScreeningControls
                  onEventsChange={setEvents}
                  medicationClient={suggestions?.medication}
                  historyClient={suggestions?.history}
                />
              ) : null}

              {section.number === 9 ? (
                <HistoryTreeSection
                  clientId={clientId}
                  clientName={clientName.split(/\s+/)[0] || clientName}
                  dateOfBirth={data.dateOfBirth}
                  events={events}
                  relationships={relationships}
                  screening={screening}
                  medicalContacts={medicalContacts}
                  professionals={professionals}
                  issues={data.issues}
                  presentation="interview"
                  groupFilter="significant_other"
                  hideScreeningControls
                  onEventsChange={setEvents}
                  historyClient={suggestions?.history}
                />
              ) : null}
            </InterviewNumberedSection>
          )
        })}

        <InterviewSectionCard
          title="Stressors"
          open={Boolean(sectionOpen.Stressors)}
          onToggle={() => toggleSection("Stressors")}
        >
          <AutosaveFields
            saved={data.stressors}
            save={async (value) => {
              stressorsRef.current = value
              const result = await saveStressorsAction(clientId, value)
              if (result.error || !("stressors" in result) || !result.stressors) {
                return { error: result.error ?? "Could not save stressors." }
              }
              stressorsRef.current = result.stressors
              return { value: result.stressors }
            }}
            onPhase={(phase, retry) => onPhase("stressors", phase, retry)}
            registerFlush={registerFlush}
          >
            {(value, onChange, commit) => {
              stressorsRef.current = value
              return (
                <StressorsFields
                  idPrefix="interview_stressors"
                  value={value}
                  onChange={onChange}
                  onCommit={commit}
                  client={suggestions?.stressors}
                />
              )
            }}
          </AutosaveFields>
        </InterviewSectionCard>
      </div>

      <Dialog
        open={notFinishedOpen}
        onOpenChange={(next) => {
          if (!next) setNotFinishedOpen(false)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Not finished</DialogTitle>
            <DialogDescription>
              {formatSectionList(notFinishedSections)} still have items to answer. Answer them, or use Nothing to
              record, then press Complete again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              className="inline-flex min-h-10 items-center rounded-md border px-3 text-sm"
              onClick={() => {
                setNotFinishedOpen(false)
                openSections(notFinishedSections)
              }}
            >
              Go back
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmPrefilledDialog
        open={confirmPrefilledOpen}
        title="Confirm pre-filled answers?"
        body={`${formatSectionList(confirmPrefilledSections)} still have answers carried over from last time that haven't been confirmed. Confirm them and complete?`}
        confirmLabel="Confirm and complete"
        onGoBack={() => {
          setConfirmPrefilledOpen(false)
          openSections(confirmPrefilledSections)
        }}
        onConfirmAndSave={() => {
          setConfirmPrefilledOpen(false)
          openWorthChecking(true)
        }}
      />

      <Dialog open={worthCheckingOpen} onOpenChange={(next) => !completing && setWorthCheckingOpen(next)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Complete background interview</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Complete this background interview?</p>
          {worthChecks.length > 0 ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              <p className="font-medium">Worth checking ({worthChecks.length})</p>
              <div className="mt-2">
                <WorthCheckingLinks
                  checks={worthChecks}
                  onJump={(check) => {
                    setWorthCheckingOpen(false)
                    jumpToCheck(check)
                  }}
                />
              </div>
            </div>
          ) : null}
          {completeError ? <p className="text-sm text-destructive">{completeError}</p> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={completing}
              onClick={() => setWorthCheckingOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" className="min-h-11" disabled={completing} onClick={() => void finishComplete()}>
              {completing ? "Completing…" : "Complete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function formatReceived(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Australia/Sydney",
  })
}

function itemSummaries(input: {
  clientName: string
  dateOfBirth: string | null
  contactDetails: InterviewContactDetails
  data: ClientBackgroundData
  emergencyContacts: InterviewEmergencyContact[]
  medicalContactLines: InterviewMedicalContactLine[]
  blockAnswers: RelationshipBlockAnswers
  relationships: RelationshipRecord[]
}): Record<string, string> {
  const identity = input.data.demographics.identity
  const education = input.data.demographics.education
  const occupation = input.data.demographics.occupation
  const living = input.data.demographics.livingSituation
  const gps = input.medicalContactLines.filter(
    (line) => line.isMain || (line.professionName ?? "").toLowerCase().includes("general")
  )
  const others = input.medicalContactLines.filter((line) => !gps.includes(line))
  return {
    s1_name: input.clientName,
    s1_dob: input.dateOfBirth?.trim() || "Not recorded",
    s1_phone: input.contactDetails.phone?.trim() || "Not recorded",
    s1_email: input.contactDetails.email?.trim() || "Not recorded",
    s1_address: input.contactDetails.address?.trim() || "Not recorded",
    s1_comms: formatCommunicationSummary(input.contactDetails.comms),
    s3_identity:
      [identity.sex, identity.genderIdentity, identity.sexualOrientation].filter(Boolean).join(" · ") ||
      "Not recorded",
    s3_education: education.level?.trim() || "Not recorded",
    s3_occupation: occupation.role?.trim() || occupation.workStatus?.trim() || "Not recorded",
    s4_emergency: formatEmergencyContactSummary(input.emergencyContacts),
    s4_gp: gps.map((line) => line.name).join(", ") || "Not recorded",
    s4_other_professionals: others.map((line) => line.name).join(", ") || "Not recorded",
    s7_housing_type: living.housingType?.trim() || "Not recorded",
    s7_housing_security: living.housingStability?.trim() || "Not recorded",
  }
}
