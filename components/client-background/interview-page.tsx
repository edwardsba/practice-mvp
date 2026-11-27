"use client"

import Link from "next/link"
import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import {
  completeBackgroundInterviewAction,
  saveEducationAction,
  saveIdentityAction,
  saveInterviewAnswersBulkAction,
  saveInterviewItemAnswerAction,
  saveLivingSituationAction,
  saveMedicareInterviewAction,
  saveOccupationAction,
  updateBlockMemberAction,
  type SaveMedicareInterviewState,
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
  readSectionOpenState,
  writeSectionOpenState,
} from "@/components/client-background/interview-section-card"
import { HistoryTreeSection } from "@/components/client-background/history-tree-section"
import { RelationshipBlocksSection } from "@/components/client-background/relationship-blocks-section"
import { scrollToBackgroundCheck, WorthCheckingLinks } from "@/components/client-background/worth-checking"
import {
  ContactDetailsForm,
  type ContactDetailsClient,
} from "@/components/clients/contact-details-form"
import { EmergencyContactsSection } from "@/components/emergency-contacts/emergency-contacts-section"
import { InterviewFundingAddPanel } from "@/components/funding/interview-funding-add-panel"
import { MedicareFields } from "@/components/funding/medicare-fields"
import {
  MedicalContactsSection,
  type MedicalContactListItem,
} from "@/components/medical-contacts/medical-contacts-section"
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
  confirmAllShownInSection,
  dropMissingPerRecordAnswers,
  formatSectionList,
  INTERVIEW_SECTIONS,
  interviewSectionStatus,
  perRecordContactId,
  S4_EC_PREFIX,
  S4_MC_PREFIX,
  section4ExtraItems,
  sectionHasConfirmAllTargets,
  type InterviewAnswerValue,
  type InterviewAnswersJson,
  type InterviewItemDef,
} from "@/lib/client-background/interview-answers"
import {
  householdAloneContradiction,
  interviewContradictionNotes,
} from "@/lib/client-background/interview-contradictions"
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
  factLinesOrFallback,
  formatBiologicalParentsFacts,
  formatCaregiverFacts,
  formatChildrenFacts,
  formatCurrentRelationshipFacts,
  formatHistoryCategoryFacts,
  formatLivingSecurityLine,
  formatLivingTypeLine,
  formatLivingWhoFactLines,
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
} from "@/lib/client-background/types"
import { emptyBlockAnswers } from "@/lib/client-background/types"
import type { EmergencyContactRow } from "@/lib/crisis-plans/types"
import { todayDateString } from "@/lib/dates/practice-time"
import type { SectionStatus } from "@/lib/section-status"
import { statusColours } from "@/lib/ui/status-colours"
import { cn } from "@/lib/utils"

type EditorKey =
  | "contact"
  | "medicare"
  | "emergency"
  | "medical"
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
  if (itemKey.startsWith("s5_")) return "intimate"
  if (itemKey.startsWith("s6_")) return "caregivers"
  if (itemKey.startsWith("s7_")) return "living"
  if (itemKey.startsWith("s8_")) return "history-client"
  if (itemKey.startsWith("s9_")) return "history-family"
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

  async function confirmAllShown(sectionNumber: number) {
    const extras = sectionExtraItems(sectionNumber)
    const next = confirmAllShownInSection(interviewAnswers, sectionNumber, extras)
    onPhase("answers", "saving", null)
    const result = await saveInterviewAnswersBulkAction(clientId, next)
    if (result.error || !result.answers) {
      onPhase("answers", "error", () => void confirmAllShown(sectionNumber))
      return
    }
    applyLocalMirrors(result.answers, result.screening)
    onPhase("answers", "saved", null)
  }

  function sectionExtraItems(sectionNumber: number): InterviewItemDef[] {
    if (sectionNumber !== 4) return []
    return section4ExtraItems(section4ExtraInput)
  }

  function unfinishedSectionNumbers(
    answers: InterviewAnswersJson,
    status: "left" | "to_confirm"
  ): number[] {
    return INTERVIEW_SECTIONS.filter((section) => {
      const extras = sectionExtraItems(section.number)
      return interviewSectionStatus(section, answers, extras).status === status
    }).map((section) => section.number)
  }

  async function beginComplete() {
    await flushAll()
    const left = [
      ...unfinishedSectionNumbers(interviewAnswers, "left"),
      ...INTERVIEW_SECTIONS.filter((section) => {
        const extras = sectionExtraItems(section.number)
        return interviewSectionStatus(section, interviewAnswers, extras).status === "not_started"
      }).map((section) => section.number),
    ]
    const leftUnique = [...new Set(left)].sort((a, b) => a - b)
    if (leftUnique.length > 0) {
      setNotFinishedSections(leftUnique)
      setNotFinishedOpen(true)
      return
    }
    const toConfirm = unfinishedSectionNumbers(interviewAnswers, "to_confirm")
    if (toConfirm.length > 0) {
      setConfirmPrefilledSections(toConfirm)
      setConfirmPrefilledOpen(true)
      return
    }
    openWorthChecking(false)
  }

  function openWorthChecking(confirmAll: boolean) {
    setConfirmAllOnComplete(confirmAll)
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
    return interviewSectionStatus(section, interviewAnswers, extras)
  })

  const section1Facts = useMemo(
    () =>
      section1FactLines({
        preferredName: contactClient.preferredName,
        dateOfBirth: contactClient.dateOfBirth,
        ageLabel: age,
        phone: contactClient.phone,
        email: contactClient.email,
        address: contactClient.address,
        comms: {
          commsOptOut: contactClient.commsOptOut,
          reminderOptOut: contactClient.reminderOptOut,
          preSessionOptOut: contactClient.preSessionOptOut,
          postSessionOptOut: contactClient.postSessionOptOut,
          adminCommsOptOut: contactClient.adminCommsOptOut,
          onlineBookingPermitted: contactClient.onlineBookingPermitted,
        },
        clientDisplayName: clientName,
      }),
    [age, clientName, contactClient]
  )

  const medicareClaim = useMemo(() => pickMedicareClaim(interviewClaims), [interviewClaims])

  const section3Facts = useMemo(() => formatSection3FactLines(demographics), [demographics])

  function extraItemsAfterParent(parentKey: string): InterviewItemDef[] {
    if (parentKey === "s4_emergency") {
      return section4Extras.filter((item) => item.key.startsWith(S4_EC_PREFIX))
    }
    if (parentKey === "s4_gp") {
      return section4Extras.filter((item) => {
        const id = perRecordContactId(item.key)
        return id != null && gpMedicalIds.has(id)
      })
    }
    if (parentKey === "s4_other_professionals") {
      return section4Extras.filter((item) => {
        const id = perRecordContactId(item.key)
        return id != null && !gpMedicalIds.has(id)
      })
    }
    return []
  }

  function factsIfAny(lines: string[]): string[] | null {
    return lines.length > 0 ? lines : null
  }

  function factLinesForItem(itemKey: string): string[] | null {
    if (itemKey.startsWith("s1_")) {
      return factLinesOrFallback(section1Facts[itemKey] ?? [], "Not recorded")
    }
    if (itemKey === "s2_medicare") {
      return factsIfAny(medicareFactLines(medicareClaim))
    }
    if (itemKey === "s2_ndis") {
      return factsIfAny(claimGroupFactLines(interviewClaims, "ndis"))
    }
    if (itemKey === "s2_insurance") {
      return factsIfAny(claimGroupFactLines(interviewClaims, "insurer"))
    }
    if (itemKey === "s4_emergency") {
      const count = emergencyContactRows.length
      return count > 0 ? [`${count} emergency contact${count === 1 ? "" : "s"} recorded`] : null
    }
    if (itemKey === "s4_gp") {
      const count = medicalContactLines.filter((line) => isGpProfession(line.professionName)).length
      return count > 0 ? [`${count} GP${count === 1 ? "" : "s"} recorded`] : null
    }
    if (itemKey === "s4_other_professionals") {
      const count = medicalContactLines.filter((line) => !isGpProfession(line.professionName)).length
      return count > 0
        ? [`${count} treating professional${count === 1 ? "" : "s"} recorded`]
        : null
    }
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
        : null
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
        : null
    }
    if (itemKey.startsWith("s3_")) {
      return factLinesOrFallback(section3Facts[itemKey] ?? [], "Not recorded")
    }
    if (itemKey === "s7_who") {
      return factsIfAny(formatLivingWhoFactLines(demographics.livingSituation, relationships))
    }
    if (itemKey === "s7_housing_type") return [formatLivingTypeLine(demographics.livingSituation)]
    if (itemKey === "s7_housing_security") return [formatLivingSecurityLine(demographics.livingSituation)]

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
    s5_current: Boolean(factLinesForItem("s5_current")?.length),
    s5_previous: Boolean(factLinesForItem("s5_previous")?.length),
    s5_children: Boolean(factLinesForItem("s5_children")?.length),
    s6_mother_other: Boolean(factLinesForItem("s6_mother_other")?.length),
    s6_father_other: Boolean(factLinesForItem("s6_father_other")?.length),
    s6_caregiver: Boolean(factLinesForItem("s6_caregiver")?.length),
    s6_siblings: Boolean(factLinesForItem("s6_siblings")?.length),
  }
  const historyHasEntries: Record<string, boolean> = {}
  for (const section of INTERVIEW_SECTIONS) {
    if (section.number !== 8 && section.number !== 9) continue
    for (const item of section.items) {
      historyHasEntries[item.key] = Boolean(factLinesForItem(item.key)?.length)
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

  function renderEditor(sectionNumber: number) {
    if (sectionNumber === 1 && openEditor === "contact") {
      return (
        <InterviewEditorPanel onDone={() => void closeEditor()}>
          <ContactDetailsForm clientId={clientId} client={contactClient} mode="embedded" />
        </InterviewEditorPanel>
      )
    }
    if (sectionNumber === 2 && openEditor === "medicare") {
      return (
        <InterviewEditorPanel onDone={() => void closeEditor()}>
          <InterviewMedicareForm
            clientId={clientId}
            medicareCardNumber={medicareClaim?.medicareCardNumber}
            medicareIrn={medicareClaim?.medicareIrn}
            medicareExpiry={medicareClaim?.medicareExpiry}
          />
        </InterviewEditorPanel>
      )
    }
    if (sectionNumber === 4 && openEditor === "emergency") {
      return (
        <InterviewEditorPanel onDone={() => void closeEditor()}>
          <div className="-mx-4">
            <EmergencyContactsSection clientId={clientId} contacts={emergencyContactRows} />
          </div>
        </InterviewEditorPanel>
      )
    }
    if (sectionNumber === 4 && openEditor === "medical") {
      return (
        <InterviewEditorPanel onDone={() => void closeEditor()}>
          <MedicalContactsSection
            clientId={clientId}
            contacts={medicalContactItems}
            professionals={professionals}
          />
        </InterviewEditorPanel>
      )
    }
    if (sectionNumber === 2 && openEditor === "funding") {
      return (
        <InterviewEditorPanel onDone={() => void closeEditor()}>
          <button
            type="button"
            className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
            onClick={() => setFundingAddOpen(true)}
          >
            + Add referral or funding approval
          </button>
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
                  onPersonChange={async (person) => {
                    onRelationships(
                      relationships.map((row) =>
                        row.relationshipRecordId === person.relationshipRecordId ? person : row
                      )
                    )
                    await updateBlockMemberAction(clientId, person)
                  }}
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
          const sectionExtras = section.number === 4 ? section4Extras : []
          const status = interviewSectionStatus(section, interviewAnswers, sectionExtras)
          const allSectionItems =
            section.number === 4
              ? section.items.flatMap((item) => {
                  const rows: InterviewItemDef[] = [item]
                  rows.push(...extraItemsAfterParent(item.key))
                  return rows
                })
              : section.items
          const unanswered = allSectionItems.some((item) => !interviewAnswers.items[item.key])
          const showConfirmAll = sectionHasConfirmAllTargets(
            interviewAnswers,
            section.number,
            sectionExtras
          )
          const sectionEditor = renderEditor(section.number)
          return (
            <InterviewNumberedSection
              key={section.id}
              section={status}
              open={Boolean(sectionOpen[String(section.number)] ?? section.number <= 2)}
              onToggle={() => toggleSection(String(section.number))}
            >
              {(section.nothingToRecord && unanswered) || showConfirmAll ? (
                <div className="flex flex-wrap gap-2">
                  {section.nothingToRecord && unanswered ? (
                    <button
                      type="button"
                      className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-dashed px-3 text-sm"
                      onClick={() => void nothingToRecord(section.number)}
                    >
                      Nothing to record
                    </button>
                  ) : null}
                  {showConfirmAll ? (
                    <button
                      type="button"
                      className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md border px-3 text-sm font-medium"
                      onClick={() => void confirmAllShown(section.number)}
                    >
                      Confirm all shown
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-3">
                {allSectionItems.map((item) => {
                  const editor = editorForItem(item.key)
                  const showEdit = Boolean(editor)
                  return (
                    <InterviewItemRow
                      key={item.key}
                      label={item.label}
                      kind={item.kind}
                      answer={interviewAnswers.items[item.key]}
                      factLines={factLinesForItem(item.key)}
                      contradictionNote={contradictionByKey[item.key] ?? null}
                      showEdit={showEdit}
                      editing={editor != null && openEditor === editor}
                      onEdit={() => {
                        if (editor) setOpenEditor(editor)
                      }}
                      onSelect={(value) => void selectAnswer(item.key, value)}
                    />
                  )
                })}
              </div>

              {sectionEditor}
            </InterviewNumberedSection>
          )
        })}

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

const medicareFormInitial: SaveMedicareInterviewState = {}

function InterviewMedicareForm({
  clientId,
  medicareCardNumber,
  medicareIrn,
  medicareExpiry,
}: {
  clientId: string
  medicareCardNumber?: string | null
  medicareIrn?: string | null
  medicareExpiry?: string | null
}) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(
    saveMedicareInterviewAction.bind(null, clientId),
    medicareFormInitial
  )

  useEffect(() => {
    if (state.success) router.refresh()
  }, [router, state.success])

  return (
    <form action={formAction} className="space-y-4">
      <MedicareFields
        medicareCardNumber={medicareCardNumber}
        medicareIrn={medicareIrn}
        medicareExpiry={medicareExpiry}
      />
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" className="min-h-11" disabled={pending}>
        {pending ? "Saving…" : "Save Medicare details"}
      </Button>
    </form>
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
