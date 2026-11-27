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
import { InterviewEditorPanel } from "@/components/client-background/interview-editor-panel"
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
import type { HistoryQuestionKey, ScreeningAnswers } from "@/lib/client-background/interview-history"
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
import {
  factLinesOrFallback,
  formatBiologicalParentsFacts,
  formatCaregiverFacts,
  formatChildrenFacts,
  formatCurrentRelationshipFacts,
  formatHistoryCategoryFacts,
  formatLivingSecurityLine,
  formatLivingTypeLine,
  formatLivingWhoLine,
  formatParentOtherFacts,
  formatPreviousRelationshipFacts,
  formatSection3FactLines,
  formatSiblingFacts,
} from "@/lib/client-background/interview-facts"
import type {
  ClientBackgroundData,
  Demographics,
  EventRecord,
  HistoryIssue,
  RelationshipBlock,
  RelationshipBlockAnswers,
  RelationshipRecord,
  StressorsRecord,
} from "@/lib/client-background/types"
import { emptyBlockAnswers } from "@/lib/client-background/types"
import { formatCommunicationSummary } from "@/lib/clients/communication-summary"
import { formatEmergencyContactSummary } from "@/lib/clients/emergency-details-summary"
import { todayDateString } from "@/lib/dates/practice-time"
import type { SectionStatus } from "@/lib/section-status"
import { statusColours } from "@/lib/ui/status-colours"
import { cn } from "@/lib/utils"

type EditorKey =
  | "funding"
  | "identity"
  | "education"
  | "occupation"
  | "intimate"
  | "caregivers"
  | "living"
  | "history-client"
  | "history-family"

function clientAge(dateOfBirth: string | null) {
  if (!dateOfBirth) return ""
  return displayedAge(assessAge(parsePartialDate(dateOfBirth), parsePartialDate(todayDateString()), "person"))
}

function editorForItem(itemKey: string): EditorKey | null {
  if (itemKey.startsWith("s2_")) return "funding"
  if (itemKey === "s3_identity" || itemKey === "s3_disability") return "identity"
  if (itemKey === "s3_education") return "education"
  if (itemKey === "s3_occupation" || itemKey === "s3_financial") return "occupation"
  if (itemKey.startsWith("s5_")) return "intimate"
  if (itemKey.startsWith("s6_")) return "caregivers"
  if (itemKey.startsWith("s7_")) return "living"
  if (itemKey.startsWith("s8_")) return "history-client"
  if (itemKey.startsWith("s9_")) return "history-family"
  return null
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
  const educationRef = useRef(data.demographics.education)
  const occupationRef = useRef(data.demographics.occupation)
  const livingRef = useRef(data.demographics.livingSituation)
  const relationshipsRef = useRef(data.relationships)
  const statusRef = useRef(data.relationshipStatus)
  const pendingCheck = useRef<BackgroundCheck | null>(null)
  const [relationships, setRelationships] = useState(data.relationships)
  const professionals = reasonSupport.professionals
  const blocksRef = useRef(data.relationshipBlocks ?? [])
  const [blocks, setBlocks] = useState<RelationshipBlock[]>(data.relationshipBlocks ?? [])
  const answersRef = useRef(data.blockAnswers ?? emptyBlockAnswers())
  const [blockAnswers, setBlockAnswers] = useState<RelationshipBlockAnswers>(
    data.blockAnswers ?? emptyBlockAnswers()
  )
  const [relationshipStatus, setRelationshipStatus] = useState(data.relationshipStatus)
  const [demographics, setDemographics] = useState<Demographics>(data.demographics)
  const [scrollNonce, setScrollNonce] = useState(0)
  const [phases, setPhases] = useState<Record<string, { phase: SavePhase; retry: (() => void) | null }>>({})
  const flushers = useRef(new Set<() => Promise<void>>())
  const [sectionOpen, setSectionOpen] = useState<Record<string, boolean>>({})
  const [openEditor, setOpenEditor] = useState<EditorKey | null>(null)
  const [interviewAnswers, setInterviewAnswers] = useState(initialAnswers)
  const [screening, setScreening] = useState(initialScreening)
  const [events, setEvents] = useState(data.events)
  const [issues, setIssues] = useState<HistoryIssue[]>(data.issues ?? [])
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
    setRelationshipStatus(next)
  }, [])

  const onBlocks = useCallback((next: RelationshipBlock[]) => {
    blocksRef.current = next
    setBlocks(next)
  }, [])

  const onBlockAnswers = useCallback((next: RelationshipBlockAnswers) => {
    answersRef.current = next
    setBlockAnswers(next)
  }, [])

  const syncDemographicsFromRefs = useCallback(() => {
    setDemographics({
      identity: identityRef.current,
      education: educationRef.current,
      occupation: occupationRef.current,
      livingSituation: livingRef.current,
    })
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
            identity: identityRef.current,
            education: educationRef.current,
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
    syncDemographicsFromRefs()
  }

  async function closeEditor() {
    await flushAll()
    setOpenEditor(null)
    setFundingAddOpen(false)
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

  const section3Facts = useMemo(() => formatSection3FactLines(demographics), [demographics])
  const contactSummaries = useMemo(
    () => contactItemSummaries({ clientName, dateOfBirth: data.dateOfBirth, contactDetails, emergencyContacts, medicalContactLines }),
    [clientName, contactDetails, data.dateOfBirth, emergencyContacts, medicalContactLines]
  )

  function factLinesForItem(itemKey: string): string[] | null {
    if (itemKey.startsWith("s1_") || itemKey.startsWith("s2_") || itemKey.startsWith("s4_")) {
      return null
    }
    if (itemKey.startsWith("s3_")) {
      return factLinesOrFallback(section3Facts[itemKey] ?? [], "Not recorded")
    }
    if (itemKey === "s7_who") return [formatLivingWhoLine(demographics.livingSituation)]
    if (itemKey === "s7_housing_type") return [formatLivingTypeLine(demographics.livingSituation)]
    if (itemKey === "s7_housing_security") return [formatLivingSecurityLine(demographics.livingSituation)]

    const yesAnswer = interviewAnswers.items[itemKey]?.value === "yes"
    if (!yesAnswer && !itemKey.startsWith("s6_biological")) {
      // Still show recorded facts for CNA biological parents; for YNA only when Yes.
      if (itemKey !== "s6_biological_parents") return null
    }

    if (itemKey === "s5_current") {
      return factLinesOrFallback(
        formatCurrentRelationshipFacts(relationshipStatus, blocks, relationships),
        "Nothing recorded yet"
      )
    }
    if (itemKey === "s5_previous") {
      return yesAnswer
        ? factLinesOrFallback(formatPreviousRelationshipFacts(blocks, relationships), "Nothing recorded yet")
        : null
    }
    if (itemKey === "s5_children") {
      return yesAnswer
        ? factLinesOrFallback(
            formatChildrenFacts(blocks, relationships, data.dateOfBirth),
            "Nothing recorded yet"
          )
        : null
    }
    if (itemKey === "s6_biological_parents") {
      return factLinesOrFallback(formatBiologicalParentsFacts(blocks, relationships), "Not recorded")
    }
    if (itemKey === "s6_mother_other") {
      return yesAnswer
        ? factLinesOrFallback(formatParentOtherFacts("mother", blocks, relationships), "Nothing recorded yet")
        : null
    }
    if (itemKey === "s6_father_other") {
      return yesAnswer
        ? factLinesOrFallback(formatParentOtherFacts("father", blocks, relationships), "Nothing recorded yet")
        : null
    }
    if (itemKey === "s6_caregiver") {
      return yesAnswer
        ? factLinesOrFallback(formatCaregiverFacts(blocks, relationships), "Nothing recorded yet")
        : null
    }
    if (itemKey === "s6_siblings") {
      return yesAnswer
        ? factLinesOrFallback(formatSiblingFacts(blocks, relationships), "Nothing recorded yet")
        : null
    }
    if (itemKey.startsWith("s8_")) {
      const key = itemKey.slice(3) as HistoryQuestionKey
      return yesAnswer
        ? factLinesOrFallback(formatHistoryCategoryFacts(key, issues, events, "self"), "Nothing recorded yet")
        : null
    }
    if (itemKey.startsWith("s9_")) {
      const key = itemKey.slice(3) as HistoryQuestionKey
      return yesAnswer
        ? factLinesOrFallback(
            formatHistoryCategoryFacts(key, issues, events, "significant_other"),
            "Nothing recorded yet"
          )
        : null
    }
    return null
  }

  function renderEditor(sectionNumber: number) {
    if (sectionNumber === 2 && openEditor === "funding") {
      return (
        <InterviewEditorPanel onDone={() => void closeEditor()}>
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
        </InterviewEditorPanel>
      )
    }
    if (sectionNumber === 3 && openEditor === "identity") {
      return (
        <InterviewEditorPanel onDone={() => void closeEditor()}>
          <AutosaveFields
            saved={demographics.identity}
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
        </InterviewEditorPanel>
      )
    }
    if (sectionNumber === 3 && openEditor === "education") {
      return (
        <InterviewEditorPanel onDone={() => void closeEditor()}>
          <AutosaveFields
            saved={demographics.education}
            save={async (value) => {
              educationRef.current = value
              const result = await saveEducationAction(clientId, value)
              if ("error" in result && result.error) return { error: result.error }
              if (!("education" in result) || !result.education) return { error: "Could not save." }
              educationRef.current = result.education
              return { value: result.education }
            }}
            onPhase={(phase, retry) => onPhase("education", phase, retry)}
            registerFlush={registerFlush}
          >
            {(value, onChange, commit) => {
              educationRef.current = value
              return (
                <EducationFieldsEditor
                  value={value}
                  onChange={onChange}
                  onCommit={commit}
                  client={suggestions?.education}
                />
              )
            }}
          </AutosaveFields>
        </InterviewEditorPanel>
      )
    }
    if (sectionNumber === 3 && openEditor === "occupation") {
      return (
        <InterviewEditorPanel onDone={() => void closeEditor()}>
          <AutosaveFields
            saved={demographics.occupation}
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
        </InterviewEditorPanel>
      )
    }
    if (sectionNumber === 5 && openEditor === "intimate") {
      return (
        <InterviewEditorPanel onDone={() => void closeEditor()}>
          <RelationshipBlocksSection
            clientId={clientId}
            relationships={relationships}
            blocks={blocks}
            blockAnswers={blockAnswers}
            relationshipStatus={relationshipStatus}
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
        </InterviewEditorPanel>
      )
    }
    if (sectionNumber === 6 && openEditor === "caregivers") {
      return (
        <InterviewEditorPanel onDone={() => void closeEditor()}>
          <RelationshipBlocksSection
            clientId={clientId}
            relationships={relationships}
            blocks={blocks}
            blockAnswers={blockAnswers}
            relationshipStatus={relationshipStatus}
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
        </InterviewEditorPanel>
      )
    }
    if (sectionNumber === 7 && openEditor === "living") {
      return (
        <InterviewEditorPanel onDone={() => void closeEditor()}>
          <AutosaveFields
            saved={demographics.livingSituation}
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
        </InterviewEditorPanel>
      )
    }
    if (sectionNumber === 8 && openEditor === "history-client") {
      return (
        <InterviewEditorPanel onDone={() => void closeEditor()}>
          <HistoryTreeSection
            clientId={clientId}
            clientName={clientName.split(/\s+/)[0] || clientName}
            dateOfBirth={data.dateOfBirth}
            events={events}
            relationships={relationships}
            screening={screening}
            medicalContacts={medicalContacts}
            professionals={professionals}
            issues={issues}
            presentation="interview"
            groupFilter="client"
            hideScreeningControls
            onEventsChange={setEvents}
            onIssuesChange={setIssues}
            medicationClient={suggestions?.medication}
            historyClient={suggestions?.history}
          />
        </InterviewEditorPanel>
      )
    }
    if (sectionNumber === 9 && openEditor === "history-family") {
      return (
        <InterviewEditorPanel onDone={() => void closeEditor()}>
          <HistoryTreeSection
            clientId={clientId}
            clientName={clientName.split(/\s+/)[0] || clientName}
            dateOfBirth={data.dateOfBirth}
            events={events}
            relationships={relationships}
            screening={screening}
            medicalContacts={medicalContacts}
            professionals={professionals}
            issues={issues}
            presentation="interview"
            groupFilter="significant_other"
            hideScreeningControls
            onEventsChange={setEvents}
            onIssuesChange={setIssues}
            historyClient={suggestions?.history}
          />
        </InterviewEditorPanel>
      )
    }
    return null
  }

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
        <p className={cn("mt-4 px-3 py-2 text-sm", statusColours.client.soft)}>
          Self-report received {received}. Blue lines show the client&apos;s answers; items without one aren&apos;t in
          the self-report. &quot;Use&quot; copies an answer into the field; nothing is filled in automatically.
        </p>
      ) : null}

      <div className="space-y-4 py-4">
        {INTERVIEW_SECTIONS.map((section) => {
          const status = interviewSectionStatus(section, interviewAnswers)
          const unanswered = section.items.some((item) => !interviewAnswers.items[item.key])
          const sectionEditor = renderEditor(section.number)
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
                {section.items.map((item) => {
                  const editor = editorForItem(item.key)
                  const showEdit = Boolean(editor) || section.number === 1 || section.number === 4
                  return (
                    <InterviewItemRow
                      key={item.key}
                      label={item.label}
                      kind={item.kind}
                      answer={interviewAnswers.items[item.key]}
                      summary={
                        item.key.startsWith("s1_") || item.key.startsWith("s2_") || item.key.startsWith("s4_")
                          ? contactSummaries[item.key] ?? null
                          : null
                      }
                      factLines={factLinesForItem(item.key)}
                      showEdit={showEdit}
                      editing={editor != null && openEditor === editor}
                      onEdit={() => {
                        if (section.number === 1) {
                          router.push(`/clients/${clientId}/edit`)
                          return
                        }
                        if (section.number === 4) {
                          router.push(`/clients/${clientId}/edit?open=emergency`)
                          return
                        }
                        if (editor) setOpenEditor(editor)
                      }}
                      onSelect={(value) => void selectAnswer(item.key, value)}
                    />
                  )
                })}
              </div>

              {section.number === 2 && openEditor !== "funding" ? (
                <ReferralFundingQuickView
                  clientId={clientId}
                  lines={referralQuickViewLines}
                  returnTo={`/clients/${clientId}/background/interview`}
                />
              ) : null}

              {sectionEditor}
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
            <div className={cn("px-3 py-2 text-sm", statusColours.attention.soft)}>
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

function contactItemSummaries(input: {
  clientName: string
  dateOfBirth: string | null
  contactDetails: InterviewContactDetails
  emergencyContacts: InterviewEmergencyContact[]
  medicalContactLines: InterviewMedicalContactLine[]
}): Record<string, string> {
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
    s2_medicare: "See funding details",
    s2_ndis: "See funding details",
    s2_insurance: "See funding details",
    s4_emergency: formatEmergencyContactSummary(input.emergencyContacts),
    s4_gp: gps.map((line) => line.name).join(", ") || "Not recorded",
    s4_other_professionals: others.map((line) => line.name).join(", ") || "Not recorded",
  }
}
