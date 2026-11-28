"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"

import {
  acceptInterviewClientChangesAction,
  completeBackgroundInterviewAction,
  confirmInterviewSectionAction,
  decideInterviewClientAnswerAction,
  saveEducationAction,
  saveIdentityAction,
  saveInterviewAnswersBulkAction,
  saveInterviewItemAnswerAction,
  saveLivingSituationAction,
  saveOccupationAction,
  updateBlockMemberAction,
} from "@/app/clients/[client_id]/background/actions"
import {
  EducationFieldsEditor,
  IdentityFieldsEditor,
  OccupationFieldsEditor,
} from "@/components/client-background/demographics-section"
import { HistoryTreeSection } from "@/components/client-background/history-tree-section"
import type { SavePhase } from "@/components/client-background/interview-autosave"
import { InterviewConfirmSection } from "@/components/client-background/interview-confirm-section"
import {
  headingAnswerHasContent,
  InterviewHeadingAnswer,
} from "@/components/client-background/interview-heading-answer"
import {
  InterviewContactEditor,
  InterviewEmergencyContactsEditor,
  InterviewFieldsEditor,
  InterviewFundingEditor,
  InterviewLivingEditor,
  InterviewMedicalContactsEditor,
  InterviewMedicareEditor,
} from "@/components/client-background/interview-item-editors"
import { InterviewLinedRow, NONE_RECORDED } from "@/components/client-background/interview-lined-row"
import { InterviewNumberedSection } from "@/components/client-background/interview-numbered-section"
import {
  readSectionOpenState,
  writeSectionOpenState,
} from "@/components/client-background/interview-section-card"
import { RelationshipBlocksSection } from "@/components/client-background/relationship-blocks-section"
import { scrollToBackgroundCheck, WorthCheckingLinks } from "@/components/client-background/worth-checking"
import type { ContactDetailsClient } from "@/components/clients/contact-details-form"
import type { MedicalContactListItem } from "@/components/medical-contacts/medical-contacts-section"
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
import { isInsurerClaim, isNdisClaim } from "@/lib/funding/format"
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
  dropMissingPerRecordAnswers,
  formatSectionList,
  INTERVIEW_SECTIONS,
  interviewItemDef,
  interviewSectionStatus,
  isQuestionKind,
  perRecordContactId,
  S4_EC_PREFIX,
  S4_MC_PREFIX,
  section4ExtraItems,
  section4ExtrasAfterParent,
  sectionsNotConfirmed,
  unansweredQuestionCount,
  type BlockAnswerMirrorKey,
  type InterviewAnswerValue,
  type InterviewAnswersJson,
  type InterviewItemDef,
  type InterviewSectionDef,
} from "@/lib/client-background/interview-answers"
import {
  clientFieldStates,
  clientFieldStatesForItem,
  waitingClientFieldsForSection,
  type ClientFieldKey,
} from "@/lib/client-background/interview-client-fields"
import {
  householdAloneContradiction,
  interviewContradictionNotes,
} from "@/lib/client-background/interview-contradictions"
import {
  detailPresenceForInterview,
  detailPresenceForSection,
  sectionByNumber,
} from "@/lib/client-background/interview-detail-presence"
import { personLivesWithClient } from "@/lib/client-background/household"
import {
  claimGroupFactLines,
  emergencyContactFactLines,
  isGpProfession,
  medicalContactFactLines,
  medicareFactLines,
  pickMedicareClaim,
  section1FactLines,
  type InterviewClaimFactInput,
} from "@/lib/client-background/interview-section-1-4-facts"
import {
  clientFieldFileText,
  formatBiologicalParentsFacts,
  formatCaregiverFacts,
  formatChildrenFacts,
  formatCurrentRelationshipFacts,
  formatHistoryCategoryFacts,
  formatLivingMemberLines,
  formatParentOtherFacts,
  formatPreviousRelationshipFacts,
  formatSiblingFacts,
  section3ValueLines,
  section7ValueLines,
  type InterviewValueLine,
} from "@/lib/client-background/interview-facts"
import {
  interviewRowModel,
  plainValueLines,
  type InterviewRowModel,
} from "@/lib/client-background/interview-row-model"
import {
  headingAddNeedsYes,
  interviewItemKeyForTreeHeading,
  interviewYesItemForTreeHeading,
  type RelationshipTreeHeading,
  type TreeHeadingRef,
} from "@/lib/client-background/interview-tree-headings"
import type {
  ClientBackgroundData,
  Demographics,
  EventRecord,
  HistoryIssue,
  RelationshipBlock,
  RelationshipBlockAnswers,
  RelationshipRecord,
} from "@/lib/client-background/types"
import { emptyBlockAnswers } from "@/lib/client-background/types"
import type { EmergencyContactRow } from "@/lib/crisis-plans/types"
import { todayDateString } from "@/lib/dates/practice-time"
import type { SectionStatus } from "@/lib/section-status"
import { statusColours } from "@/lib/ui/status-colours"
import { cn } from "@/lib/utils"

/** Side-panel editors for sections 1–4 and 7. */
type EditorKey =
  | "contact"
  | "medicare"
  | "funding"
  | "identity"
  | "education"
  | "occupation"
  | "emergency"
  | "medical"
  | "living"

/** Sections answered under the relationship and history tree headings. */
const TREE_SECTIONS = new Set([5, 6, 8, 9])

function clientAge(dateOfBirth: string | null) {
  if (!dateOfBirth) return ""
  return displayedAge(assessAge(parsePartialDate(dateOfBirth), parsePartialDate(todayDateString()), "person"))
}

function editorForItem(itemKey: string): EditorKey | null {
  if (itemKey.startsWith("s1_")) return "contact"
  if (itemKey === "s2_medicare") return "medicare"
  if (itemKey === "s2_ndis" || itemKey === "s2_insurance") return "funding"
  if (itemKey === "s4_emergency" || itemKey.startsWith(S4_EC_PREFIX)) return "emergency"
  if (
    itemKey === "s4_gp" ||
    itemKey === "s4_other_professionals" ||
    itemKey.startsWith(S4_MC_PREFIX)
  ) {
    return "medical"
  }
  if (itemKey === "s3_identity" || itemKey === "s3_disability") return "identity"
  if (itemKey === "s3_education") return "education"
  if (itemKey === "s3_occupation" || itemKey === "s3_financial") return "occupation"
  if (itemKey.startsWith("s7_")) return "living"
  return null
}

export type InterviewMedicalContactLine = {
  id: string
  name: string
  professionName: string | null
  organisationName: string | null
  phone: string | null
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
  medicalContactItems = [],
  emergencyContactRows = [],
  contactClient,
  interviewClaims = [],
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
  medicalContactItems?: MedicalContactListItem[]
  medicalContactLines?: InterviewMedicalContactLine[]
  emergencyContactRows?: EmergencyContactRow[]
  contactClient: ContactDetailsClient
  interviewClaims?: InterviewClaimFactInput[]
  referralFormOptions: ReferralFundingCardFormOptions
  referralRecorded?: boolean
  lrampStartHref?: string | null
}) {
  const router = useRouter()
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
  const livingContactIds = useMemo(
    () => ({
      emergencyContactIds: emergencyContactRows.map((row) => row.contactId),
      medicalContactIds: medicalContactItems.map((row) => row.medicalContactId),
    }),
    [emergencyContactRows, medicalContactItems]
  )
  const [interviewAnswersRaw, setInterviewAnswers] = useState(initialAnswers)
  const interviewAnswers = useMemo(
    () => dropMissingPerRecordAnswers(interviewAnswersRaw, livingContactIds),
    [interviewAnswersRaw, livingContactIds]
  )
  const [screening, setScreening] = useState(initialScreening)
  const [events, setEvents] = useState(data.events)
  const [issues, setIssues] = useState<HistoryIssue[]>(data.issues ?? [])
  const [confirmingSection, setConfirmingSection] = useState<number | null>(null)
  const [confirmErrors, setConfirmErrors] = useState<Record<number, string>>({})
  const [notFinishedOpen, setNotFinishedOpen] = useState(false)
  const [notFinishedSections, setNotFinishedSections] = useState<number[]>([])
  const [worthCheckingOpen, setWorthCheckingOpen] = useState(false)
  const [worthChecks, setWorthChecks] = useState<BackgroundCheck[]>([])
  const [completing, setCompleting] = useState(false)
  const [completeError, setCompleteError] = useState<string | null>(null)
  const [decidingClientAnswer, setDecidingClientAnswer] = useState(false)
  const [clientAnswerErrors, setClientAnswerErrors] = useState<Record<string, string>>({})
  const answerToken = useRef(0)

  const age = clientAge(data.dateOfBirth)
  const suggestions = useMemo(
    () => (selfReport ? backgroundAnswersToClientBackground(selfReport.answers) : null),
    [selfReport]
  )
  const clientStates = useMemo(
    () => clientFieldStates(suggestions, demographics, interviewAnswers.clientDecisions),
    [suggestions, demographics, interviewAnswers.clientDecisions]
  )
  const received = selfReport ? formatReceived(selfReport.assessmentDate) : ""
  const clientFirstName = clientName.split(/\s+/)[0] || clientName

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

  // Sections 5 and 6 each mount a relationship tree; keep their save states apart.
  const onIntimatePhase = useCallback(
    (id: string, phase: SavePhase, retry: (() => void) | null) => onPhase(`${id}:intimate`, phase, retry),
    [onPhase]
  )
  const onCaregiversPhase = useCallback(
    (id: string, phase: SavePhase, retry: (() => void) | null) => onPhase(`${id}:caregivers`, phase, retry),
    [onPhase]
  )

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

  const getChecks = useCallback(
    (current: {
      screening: ScreeningAnswers
      events: EventRecord[]
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

  function closeEditor() {
    setOpenEditor(null)
  }

  function scrollToSection(sectionNumber: number) {
    requestAnimationFrame(() => {
      document
        .getElementById(`interview-section-${sectionNumber}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }

  function openSections(numbers: number[]) {
    for (const number of numbers) {
      setSection(String(number), true)
    }
    const first = numbers[0]
    if (first) scrollToSection(first)
  }

  function jumpToCheck(check: BackgroundCheck) {
    if (check.id.startsWith("contradiction-")) {
      const itemKey = check.id.slice("contradiction-".length)
      const match = /^s(\d)_/.exec(itemKey)
      if (match) setSection(match[1], true)
      pendingCheck.current = check
      setScrollNonce((count) => count + 1)
      return
    }
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
    const current = answersRef.current
    const changed = (Object.keys(mirrors) as BlockAnswerMirrorKey[]).filter(
      (key) => mirrors[key] !== current[key]
    )
    if (changed.length === 0) return
    const merged: RelationshipBlockAnswers = { ...current }
    for (const key of changed) merged[key] = mirrors[key] ?? current[key]
    onBlockAnswers(merged)
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

  function applyDemographics(changed: Partial<Demographics> | undefined) {
    if (!changed) return
    if (changed.identity) identityRef.current = changed.identity
    if (changed.education) educationRef.current = changed.education
    if (changed.occupation) occupationRef.current = changed.occupation
    if (changed.livingSituation) livingRef.current = changed.livingSituation
    setDemographics((current) => ({ ...current, ...changed }))
  }

  /** Use client's / Keep on one row. The server reads the value from the stored self-report. */
  async function decideClientAnswer(itemKey: string, fieldKey: ClientFieldKey, choice: "used" | "kept") {
    if (!selfReport || decidingClientAnswer) return
    setDecidingClientAnswer(true)
    setClientAnswerErrors((current) => {
      const next = { ...current }
      delete next[itemKey]
      return next
    })
    onPhase("client-answers", "saving", null)
    const result = await decideInterviewClientAnswerAction(clientId, fieldKey, choice, selfReport.resultId)
    setDecidingClientAnswer(false)
    if (result.error || !result.answers) {
      onPhase("client-answers", "error", () => void decideClientAnswer(itemKey, fieldKey, choice))
      setClientAnswerErrors((current) => ({
        ...current,
        [itemKey]: result.error ?? "Could not save your choice.",
      }))
      return
    }
    applyDemographics(result.demographics)
    applyLocalMirrors(result.answers)
    onPhase("client-answers", "saved", null)
  }

  function waitingFieldsFor(sectionNumber: number) {
    return waitingClientFieldsForSection(clientStates, sectionNumber)
  }

  function sectionExtraItems(sectionNumber: number): InterviewItemDef[] {
    if (sectionNumber !== 4) return []
    return section4ExtraItems(section4ExtraInput)
  }

  /** Details on file right now, read from refs so tree saves just flushed are included. */
  function currentDetailPresence() {
    return detailPresenceForInterview({
      clientDisplayName: clientName,
      preferredName: contactClient.preferredName,
      dateOfBirth: contactClient.dateOfBirth,
      ageLabel: age,
      phone: contactClient.phone,
      email: contactClient.email,
      address: contactClient.address,
      comms: contactComms,
      demographics: {
        identity: identityRef.current,
        education: educationRef.current,
        occupation: occupationRef.current,
        livingSituation: livingRef.current,
      },
      relationships: relationshipsRef.current,
      blocks: blocksRef.current,
      emergencyContacts: emergencyContactRows.map((row) => ({
        id: row.contactId,
        name: row.name,
        role: row.role,
        phone: row.phone,
        email: row.email,
      })),
      medicalContacts: medicalContactLines.map((line) => ({
        id: line.id,
        name: line.name,
        organisationName: line.organisationName,
        phone: line.phone,
        isMain: line.isMain,
      })),
      medicareClaimExists: medicareClaim != null,
      ndisClaimCount: interviewClaims.filter((c) => isNdisClaim(c.claimTypeCode)).length,
      insurerClaimCount: interviewClaims.filter((c) => isInsurerClaim(c.claimTypeCode)).length,
      gpCount: medicalContactLines.filter((line) => isGpProfession(line.professionName)).length,
      otherProfessionalCount: medicalContactLines.filter(
        (line) => !isGpProfession(line.professionName)
      ).length,
    })
  }

  async function confirmSection(sectionNumber: number) {
    const section = sectionByNumber(sectionNumber)
    if (!section || confirmingSection != null) return
    setConfirmingSection(sectionNumber)
    setConfirmErrors((current) => {
      const next = { ...current }
      delete next[sectionNumber]
      return next
    })
    await flushAll()
    const extras = sectionExtraItems(sectionNumber)
    const detailHasValue = detailPresenceForSection(section, currentDetailPresence(), extras)
    // Waiting client answers are accepted with the confirm; the server takes their values from
    // the stored self-report and only checks these names against what is still waiting.
    const waiting = waitingFieldsFor(sectionNumber).map((state) => state.fieldKey)
    onPhase("answers", "saving", null)
    let changed: Partial<Demographics> | undefined
    let result: { error?: string; answers?: InterviewAnswersJson; screening?: ScreeningAnswers }
    if (waiting.length > 0 && selfReport) {
      const accepted = await acceptInterviewClientChangesAction(
        clientId,
        sectionNumber,
        detailHasValue,
        waiting,
        selfReport.resultId
      )
      changed = accepted.demographics
      result = accepted
    } else {
      result = await confirmInterviewSectionAction(clientId, sectionNumber, detailHasValue, extras)
    }
    setConfirmingSection(null)
    if (result.error || !result.answers) {
      onPhase("answers", "error", () => void confirmSection(sectionNumber))
      setConfirmErrors((current) => ({
        ...current,
        [sectionNumber]: result.error ?? "Could not confirm this section.",
      }))
      return
    }
    applyDemographics(changed)
    applyLocalMirrors(result.answers, result.screening)
    onPhase("answers", "saved", null)
    setSection(String(sectionNumber), false)
    scrollToSection(sectionNumber)
  }

  async function beginComplete() {
    await flushAll()
    const unconfirmed = sectionsNotConfirmed(interviewAnswers)
    if (unconfirmed.length > 0) {
      setNotFinishedSections(unconfirmed)
      setNotFinishedOpen(true)
      return
    }
    openWorthChecking()
  }

  function openWorthChecking() {
    const base = getChecks({
      screening,
      events,
    })
    const contradictionChecks = contradictionNotes.map((note) => {
      const target: BackgroundCheck["target"] =
        note.target === "history"
          ? "history"
          : note.target === "relationships"
            ? "relationships"
            : note.target === "funding"
              ? "reason"
              : "relationships"
      return {
        id: `contradiction-${note.itemKey}`,
        message: note.message,
        target,
      } satisfies BackgroundCheck
    })
    setWorthChecks([...base, ...contradictionChecks])
    setCompleteError(null)
    setWorthCheckingOpen(true)
  }

  async function finishComplete() {
    setCompleting(true)
    setCompleteError(null)
    const result = await completeBackgroundInterviewAction(clientId, selfReport?.resultId ?? null)
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

  const gpMedicalIds = useMemo(
    () =>
      new Set(
        medicalContactLines
          .filter((line) => isGpProfession(line.professionName))
          .map((line) => line.id)
      ),
    [medicalContactLines]
  )

  const section4ExtraInput = {
    answers: interviewAnswers,
    emergencyContacts: emergencyContactRows.map((row) => ({
      id: row.contactId,
      label: row.name.trim() || "Unnamed",
    })),
    gpContacts: medicalContactLines
      .filter((line) => isGpProfession(line.professionName))
      .map((line) => ({ id: line.id, label: line.name })),
    otherMedicalContacts: medicalContactLines
      .filter((line) => !isGpProfession(line.professionName))
      .map((line) => ({ id: line.id, label: line.name })),
  }
  const section4Extras = section4ExtraItems(section4ExtraInput)

  const sectionStatuses: SectionStatus[] = INTERVIEW_SECTIONS.map((section) => {
    const extras = section.number === 4 ? section4Extras : []
    return interviewSectionStatus(section, interviewAnswers, extras, {
      waitingClientChanges: waitingFieldsFor(section.number).length,
    })
  })

  const contactComms = {
    commsOptOut: contactClient.commsOptOut,
    reminderOptOut: contactClient.reminderOptOut,
    preSessionOptOut: contactClient.preSessionOptOut,
    postSessionOptOut: contactClient.postSessionOptOut,
    adminCommsOptOut: contactClient.adminCommsOptOut,
    onlineBookingPermitted: contactClient.onlineBookingPermitted,
  }

  const section1Facts = section1FactLines({
    preferredName: contactClient.preferredName,
    dateOfBirth: contactClient.dateOfBirth,
    ageLabel: age,
    phone: contactClient.phone,
    email: contactClient.email,
    address: contactClient.address,
    comms: contactComms,
    clientDisplayName: clientName,
  })

  const medicareClaim = pickMedicareClaim(interviewClaims)

  const section3Lines = useMemo(() => section3ValueLines(demographics), [demographics])
  const section7Lines = useMemo(
    () => section7ValueLines(demographics.livingSituation),
    [demographics.livingSituation]
  )

  function extraItemsAfterParent(parentKey: string): InterviewItemDef[] {
    return section4ExtrasAfterParent(parentKey, section4Extras, gpMedicalIds)
  }

  function factsIfAny(lines: string[]): string[] | null {
    return lines.length > 0 ? lines : null
  }

  /** Section 4 per-contact rows: the contact's details on file. */
  function contactFactLines(itemKey: string): string[] {
    if (itemKey.startsWith(S4_EC_PREFIX)) {
      const id = perRecordContactId(itemKey)
      const contact = emergencyContactRows.find((row) => row.contactId === id)
      return contact
        ? emergencyContactFactLines({
            name: contact.name,
            role: contact.role,
            phone: contact.phone,
            email: contact.email,
          })
        : []
    }
    if (itemKey.startsWith(S4_MC_PREFIX)) {
      const id = perRecordContactId(itemKey)
      const contact = medicalContactLines.find((line) => line.id === id)
      return contact
        ? medicalContactFactLines({
            name: contact.name,
            organisationName: contact.organisationName,
            phone: contact.phone,
            isMain: contact.isMain,
          })
        : []
    }
    return []
  }

  /** Facts under the tree headings (sections 5, 6, 8 and 9). */
  function treeFactLines(itemKey: string): string[] | null {
    if (itemKey === "s5_current") {
      return factsIfAny(formatCurrentRelationshipFacts(relationshipStatus, blocks, relationships))
    }
    if (itemKey === "s5_previous") {
      return factsIfAny(formatPreviousRelationshipFacts(blocks, relationships))
    }
    if (itemKey === "s5_children") {
      return factsIfAny(formatChildrenFacts(blocks, relationships, data.dateOfBirth))
    }
    if (itemKey === "s6_biological_parents") {
      return factsIfAny(formatBiologicalParentsFacts(blocks, relationships))
    }
    if (itemKey === "s6_mother_other") {
      return factsIfAny(formatParentOtherFacts("mother", blocks, relationships))
    }
    if (itemKey === "s6_father_other") {
      return factsIfAny(formatParentOtherFacts("father", blocks, relationships))
    }
    if (itemKey === "s6_caregiver") {
      return factsIfAny(formatCaregiverFacts(blocks, relationships))
    }
    if (itemKey === "s6_siblings") {
      return factsIfAny(formatSiblingFacts(blocks, relationships))
    }
    if (itemKey.startsWith("s8_")) {
      const key = itemKey.slice(3) as HistoryQuestionKey
      return factsIfAny(formatHistoryCategoryFacts(key, issues, events, "self"))
    }
    if (itemKey.startsWith("s9_")) {
      const key = itemKey.slice(3) as HistoryQuestionKey
      return factsIfAny(formatHistoryCategoryFacts(key, issues, events, "significant_other"))
    }
    return null
  }

  const gpCount = medicalContactLines.filter((line) => isGpProfession(line.professionName)).length
  const otherProfessionalCount = medicalContactLines.filter(
    (line) => !isGpProfession(line.professionName)
  ).length
  const relationshipHasEntries: Record<string, boolean> = {
    s5_current: Boolean(treeFactLines("s5_current")?.length),
    s5_previous: Boolean(treeFactLines("s5_previous")?.length),
    s5_children: Boolean(treeFactLines("s5_children")?.length),
    s6_mother_other: Boolean(treeFactLines("s6_mother_other")?.length),
    s6_father_other: Boolean(treeFactLines("s6_father_other")?.length),
    s6_caregiver: Boolean(treeFactLines("s6_caregiver")?.length),
    s6_siblings: Boolean(treeFactLines("s6_siblings")?.length),
  }
  const historyHasEntries: Record<string, boolean> = {}
  for (const section of INTERVIEW_SECTIONS) {
    if (section.number !== 8 && section.number !== 9) continue
    for (const item of section.items) {
      historyHasEntries[item.key] = Boolean(treeFactLines(item.key)?.length)
    }
  }
  const contradictionNotes = interviewContradictionNotes({
    answers: interviewAnswers.items,
    medicareClaimExists: medicareClaim != null,
    ndisClaimCount: interviewClaims.filter((c) => isNdisClaim(c.claimTypeCode)).length,
    insurerClaimCount: interviewClaims.filter((c) => isInsurerClaim(c.claimTypeCode)).length,
    emergencyContactCount: emergencyContactRows.length,
    gpCount,
    otherProfessionalCount,
    historyHasEntries,
    relationshipHasEntries,
    householdAloneWithSomeoneLiving: householdAloneContradiction({
      household: demographics.livingSituation.household,
      someoneLivesWithClient: relationships.some(personLivesWithClient),
      othersInHomeCount: (demographics.livingSituation.othersInHome ?? []).filter((row) =>
        row.who.trim()
      ).length,
    }),
  })
  const contradictionByKey: Record<string, string> = {}
  for (const note of contradictionNotes) contradictionByKey[note.itemKey] = note.message

  function detailLabel(item: InterviewItemDef): string {
    if (item.key.startsWith(S4_EC_PREFIX)) return "Emergency contact"
    if (item.key.startsWith(S4_MC_PREFIX)) {
      const id = perRecordContactId(item.key)
      return id && gpMedicalIds.has(id) ? "GP" : "Treating professional"
    }
    return item.label
  }

  function editFor(itemKey: string) {
    const editor = editorForItem(itemKey)
    return editor ? () => setOpenEditor(editor) : undefined
  }

  function isPrefilled(itemKey: string) {
    const answer = interviewAnswers.items[itemKey]
    return Boolean(answer && !answer.confirmed)
  }

  /** On-file lines merged with this item's self-report answers (sections 3 and 7). */
  function rowModel(itemKey: string, lines: readonly InterviewValueLine[]): InterviewRowModel {
    return interviewRowModel(lines, clientFieldStatesForItem(clientStates, itemKey), (fieldKey) =>
      clientFieldFileText(fieldKey, demographics)
    )
  }

  function fileModel(lines: readonly string[]): InterviewRowModel {
    return { choices: [], value: plainValueLines(lines).map((entry) => ({ kind: "file", text: entry.text })) }
  }

  /** One lined row; its value opens the item's editor. */
  function renderRow(
    item: InterviewItemDef,
    model?: InterviewRowModel,
    subRows?: ReactNode[] | null,
    emptyLabel?: string
  ) {
    return (
      <InterviewLinedRow
        key={item.key}
        id={`check-contradiction-${item.key}`}
        label={item.label}
        prefilled={isPrefilled(item.key)}
        question={
          isQuestionKind(item.kind)
            ? {
                kind: item.kind,
                value: interviewAnswers.items[item.key]?.value ?? null,
                onSelect: (value) => void selectAnswer(item.key, value),
              }
            : undefined
        }
        model={model}
        onEdit={editFor(item.key)}
        onUse={(fieldKey) => void decideClientAnswer(item.key, fieldKey, "used")}
        onKeep={(fieldKey) => void decideClientAnswer(item.key, fieldKey, "kept")}
        busy={decidingClientAnswer || confirmingSection != null}
        contradictionNote={contradictionByKey[item.key] ?? null}
        error={clientAnswerErrors[item.key] ?? null}
        emptyLabel={emptyLabel}
      >
        {subRows && subRows.length > 0 ? subRows : null}
      </InterviewLinedRow>
    )
  }

  /** Section 2: each claim on file is a row within its question. */
  function claimRows(item: InterviewItemDef): ReactNode[] {
    const onEdit = editFor(item.key)
    if (item.key === "s2_medicare") {
      return medicareClaim
        ? [
            <InterviewLinedRow
              key={medicareClaim.claimId}
              label="Claim"
              model={fileModel(medicareFactLines(medicareClaim))}
              onEdit={onEdit}
            />,
          ]
        : []
    }
    const kind = item.key === "s2_ndis" ? "ndis" : "insurer"
    return interviewClaims
      .filter((claim) => (kind === "ndis" ? isNdisClaim(claim.claimTypeCode) : isInsurerClaim(claim.claimTypeCode)))
      .map((claim) => (
        <InterviewLinedRow
          key={claim.claimId}
          label="Claim"
          model={fileModel(claimGroupFactLines([claim], kind))}
          onEdit={onEdit}
        />
      ))
  }

  /** Section 4: each contact on file is a row within its question. */
  function contactRows(item: InterviewItemDef): ReactNode[] {
    return extraItemsAfterParent(item.key).map((record) => (
      <InterviewLinedRow
        key={record.key}
        id={`check-contradiction-${record.key}`}
        label={detailLabel(record)}
        prefilled={isPrefilled(record.key)}
        model={fileModel(contactFactLines(record.key))}
        onEdit={editFor(record.key)}
        contradictionNote={contradictionByKey[record.key] ?? null}
      />
    ))
  }

  /** Section 7 household: one row per person in the home, after the household row. */
  function householdMemberRows(): ReactNode[] {
    const onEdit = editFor("s7_who")
    return formatLivingMemberLines(demographics.livingSituation, relationships).map((line, index) => (
      <InterviewLinedRow key={`s7-member-${index}-${line}`} label="Lives in the home" model={fileModel([line])} onEdit={onEdit} />
    ))
  }

  /** Sections 1–4 and 7: one lined row per item (presence items use "None recorded"). */
  function renderItemRows(section: InterviewSectionDef) {
    return (
      <div className="divide-y">
        {section.items.flatMap((item) => {
          if (section.number === 1) return [renderRow(item, fileModel(section1Facts[item.key] ?? []))]
          if (section.number === 2) {
            const claims = claimRows(item)
            return [
              renderRow(
                item,
                claims.length === 0 ? fileModel([]) : undefined,
                claims.length > 0 ? claims : null,
                NONE_RECORDED
              ),
            ]
          }
          if (section.number === 3) {
            const empty = item.kind === "presence" ? NONE_RECORDED : undefined
            return [renderRow(item, rowModel(item.key, section3Lines[item.key] ?? []), null, empty)]
          }
          if (section.number === 4) {
            const contacts = contactRows(item)
            return [
              renderRow(
                item,
                contacts.length === 0 ? fileModel([]) : undefined,
                contacts.length > 0 ? contacts : null,
                NONE_RECORDED
              ),
            ]
          }
          const row = renderRow(item, rowModel(item.key, section7Lines[item.key] ?? []))
          return item.key === "s7_who" ? [row, ...householdMemberRows()] : [row]
        })}
      </div>
    )
  }

  function headingAnswer(ref: TreeHeadingRef): ReactNode {
    const key = interviewItemKeyForTreeHeading(ref)
    const item = key ? interviewItemDef(key) : undefined
    if (!key || !item) return null
    const answer = interviewAnswers.items[key]
    const note = contradictionByKey[key] ?? null
    if (!headingAnswerHasContent(item, answer, note)) return null
    return (
      <InterviewHeadingAnswer
        item={item}
        answer={answer}
        contradictionNote={note}
        onSelect={(value) => void selectAnswer(key, value)}
      />
    )
  }

  /** ⊕ under a heading means the answer to its question is Yes. */
  function headingAddYes(ref: TreeHeadingRef) {
    const key = interviewYesItemForTreeHeading(ref)
    if (!key || !headingAddNeedsYes(interviewAnswers.items[key])) return
    void selectAnswer(key, "yes")
  }

  const relationshipTreeProps = {
    clientId,
    relationships,
    blocks,
    blockAnswers,
    relationshipStatus,
    onRelationships,
    onBlocks,
    onBlockAnswers,
    onRelationshipStatus,
    registerFlush,
    embedWithoutChrome: true,
    hideTopLevelAnswers: true,
    renderHeadingAnswer: (heading: RelationshipTreeHeading) => headingAnswer({ tree: "relationships", heading }),
    onHeadingAdd: (heading: RelationshipTreeHeading) => headingAddYes({ tree: "relationships", heading }),
  }

  const historyTreeProps = {
    clientId,
    clientName: clientFirstName,
    dateOfBirth: data.dateOfBirth,
    events,
    relationships,
    screening,
    medicalContacts,
    professionals,
    issues,
    presentation: "interview" as const,
    hideScreeningControls: true,
    onEventsChange: setEvents,
    onIssuesChange: setIssues,
    historyClient: suggestions?.history,
    renderHeadingAnswer: (screeningKey: HistoryQuestionKey) => headingAnswer({ tree: "history", screeningKey }),
    onHeadingAdd: (screeningKey: HistoryQuestionKey) => headingAddYes({ tree: "history", screeningKey }),
  }

  /** Sections 5, 6, 8, 9: the shared trees, with each question answered under its heading. */
  function renderTreeSection(sectionNumber: number) {
    if (sectionNumber === 5) {
      return (
        <RelationshipBlocksSection
          {...relationshipTreeProps}
          onPhase={onIntimatePhase}
          relationshipClient={suggestions?.relationshipStatus}
          childrenPrompt={suggestions?.numberOfChildren?.label ?? null}
          visibleSections={["intimate"]}
        />
      )
    }
    if (sectionNumber === 6) {
      return (
        <RelationshipBlocksSection
          {...relationshipTreeProps}
          onPhase={onCaregiversPhase}
          visibleSections={["caregivers"]}
        />
      )
    }
    if (sectionNumber === 8) {
      return (
        <HistoryTreeSection
          {...historyTreeProps}
          groupFilter="client"
          medicationClient={suggestions?.medication}
        />
      )
    }
    return <HistoryTreeSection {...historyTreeProps} groupFilter="significant_other" />
  }

  return (
    <div className="mx-auto min-w-0 max-w-2xl pb-28">
      <header className="sticky top-0 z-30 -mx-4 border-b bg-background px-4">
        <div className="flex items-start justify-between gap-3 py-2">
          <div className="min-w-0">
            <p className="text-sm font-medium">Background interview</p>
            <p className="truncate text-xs text-muted-foreground">
              {clientName}
              {age ? `, ${age}` : ""}
            </p>
          </div>
          {lrampStartHref ? (
            <Link
              href={lrampStartHref}
              className="inline-flex min-h-10 shrink-0 items-center text-sm font-medium text-primary underline"
            >
              Start LRAMP
            </Link>
          ) : null}
        </div>
        <div className="pb-2">
          <SectionProgressChips
            sections={sectionStatuses}
            onSelect={(section) => {
              setSection(section.letter, true)
              scrollToSection(Number(section.letter))
            }}
          />
        </div>
      </header>

      {selfReport ? (
        <p className={cn("mt-4 px-3 py-2 text-sm", statusColours.client.soft)}>
          Self-report received {received}. Purple &quot;Client:&quot; lines show the client&apos;s answers; items
          without one aren&apos;t in the self-report. Use client&apos;s (or Use) copies an answer onto the file and Keep
          leaves the file as it is; nothing is filled in automatically.
        </p>
      ) : null}

      <div className="space-y-4 py-4">
        {INTERVIEW_SECTIONS.map((section, index) => {
          const sectionExtras = section.number === 4 ? section4Extras : []
          const status = sectionStatuses[index]
          return (
            <InterviewNumberedSection
              key={section.id}
              section={status}
              open={Boolean(sectionOpen[String(section.number)] ?? section.number <= 2)}
              onToggle={() => toggleSection(String(section.number))}
            >
              {TREE_SECTIONS.has(section.number)
                ? renderTreeSection(section.number)
                : renderItemRows(section)}
              <InterviewConfirmSection
                unansweredQuestions={unansweredQuestionCount(section, interviewAnswers, sectionExtras)}
                waitingClientChanges={waitingFieldsFor(section.number).length}
                showNothingToRecord={section.nothingToRecord}
                confirming={confirmingSection === section.number}
                error={confirmErrors[section.number] ?? null}
                onNothingToRecord={() => void nothingToRecord(section.number)}
                onConfirm={() => void confirmSection(section.number)}
              />
            </InterviewNumberedSection>
          )
        })}
      </div>

      {openEditor === "contact" ? (
        <InterviewContactEditor clientId={clientId} client={contactClient} onClose={closeEditor} />
      ) : null}
      {openEditor === "medicare" ? (
        <InterviewMedicareEditor
          clientId={clientId}
          medicareCardNumber={medicareClaim?.medicareCardNumber}
          medicareIrn={medicareClaim?.medicareIrn}
          medicareExpiry={medicareClaim?.medicareExpiry}
          onClose={closeEditor}
        />
      ) : null}
      {openEditor === "funding" ? (
        <InterviewFundingEditor
          clientId={clientId}
          practiceId={practiceId}
          formOptions={referralFormOptions}
          onClose={closeEditor}
        />
      ) : null}
      {openEditor === "identity" ? (
        <InterviewFieldsEditor
          title="Identity"
          saved={demographics.identity}
          save={async (value) => {
            const result = await saveIdentityAction(clientId, value)
            if ("error" in result && result.error) return { error: result.error }
            if (!("identity" in result) || !result.identity) return { error: "Could not save." }
            const identity = result.identity
            identityRef.current = identity
            setDemographics((current) => ({ ...current, identity }))
            return {}
          }}
          onClose={closeEditor}
        >
          {(value, onChange) => <IdentityFieldsEditor value={value} onChange={onChange} />}
        </InterviewFieldsEditor>
      ) : null}
      {openEditor === "education" ? (
        <InterviewFieldsEditor
          title="Education"
          saved={demographics.education}
          save={async (value) => {
            const result = await saveEducationAction(clientId, value)
            if ("error" in result && result.error) return { error: result.error }
            if (!("education" in result) || !result.education) return { error: "Could not save." }
            const education = result.education
            educationRef.current = education
            setDemographics((current) => ({ ...current, education }))
            return {}
          }}
          onClose={closeEditor}
        >
          {(value, onChange) => <EducationFieldsEditor value={value} onChange={onChange} />}
        </InterviewFieldsEditor>
      ) : null}
      {openEditor === "occupation" ? (
        <InterviewFieldsEditor
          title="Occupation"
          saved={demographics.occupation}
          save={async (value) => {
            const result = await saveOccupationAction(clientId, value)
            if ("error" in result && result.error) return { error: result.error }
            if (!("occupation" in result) || !result.occupation) return { error: "Could not save." }
            const occupation = result.occupation
            occupationRef.current = occupation
            setDemographics((current) => ({ ...current, occupation }))
            return {}
          }}
          onClose={closeEditor}
        >
          {(value, onChange) => <OccupationFieldsEditor value={value} onChange={onChange} />}
        </InterviewFieldsEditor>
      ) : null}
      {openEditor === "living" ? (
        <InterviewLivingEditor
          saved={demographics.livingSituation}
          relationships={relationships}
          save={async (value, changedPeople) => {
            let nextPeople = relationshipsRef.current
            for (const person of changedPeople) {
              const result = await updateBlockMemberAction(clientId, person)
              if (!result || ("error" in result && result.error)) {
                return { error: (result && "error" in result && result.error) || "Could not save." }
              }
              nextPeople =
                "relationships" in result && result.relationships
                  ? result.relationships
                  : nextPeople.map((row) =>
                      row.relationshipRecordId === person.relationshipRecordId ? person : row
                    )
              onRelationships(nextPeople)
            }
            const result = await saveLivingSituationAction(clientId, value)
            if ("error" in result && result.error) return { error: result.error }
            if (!("livingSituation" in result) || !result.livingSituation) return { error: "Could not save." }
            const livingSituation = result.livingSituation
            livingRef.current = livingSituation
            setDemographics((current) => ({ ...current, livingSituation }))
            return {}
          }}
          onClose={closeEditor}
        />
      ) : null}
      {openEditor === "emergency" ? (
        <InterviewEmergencyContactsEditor
          clientId={clientId}
          contacts={emergencyContactRows}
          onClose={closeEditor}
        />
      ) : null}
      {openEditor === "medical" ? (
        <InterviewMedicalContactsEditor
          clientId={clientId}
          contacts={medicalContactItems}
          professionals={professionals}
          onClose={closeEditor}
        />
      ) : null}

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
              {formatSectionList(notFinishedSections)}{" "}
              {notFinishedSections.length === 1 ? "isn't" : "aren't"} confirmed yet. Answer any questions left,
              press Confirm section, then press Complete again.
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

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <button type="button" className="min-h-11 text-sm underline" onClick={() => void leave()}>
            Save and leave
          </button>
          <div className="flex min-w-0 flex-1 flex-col items-center">
            {failed.length > 0 && !saving ? (
              <button type="button" className="text-xs text-destructive underline" onClick={retryFailed}>
                {saveLabel}
              </button>
            ) : (
              <p className="text-xs text-muted-foreground">{saveLabel}</p>
            )}
          </div>
          <Button type="button" className="min-h-11" onClick={() => void beginComplete()}>
            Complete
          </Button>
        </div>
      </div>

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
