"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import {
  saveEducationAction,
  saveIdentityAction,
  saveLivingSituationAction,
  saveOccupationAction,
} from "@/app/clients/[client_id]/background/actions"
import {
  EducationFieldsEditor,
  IdentityFieldsEditor,
  LivingFieldsEditor,
  OccupationFieldsEditor,
} from "@/components/client-background/demographics-section"
import { AutosaveFields, type SavePhase } from "@/components/client-background/interview-autosave"
import { InterviewHistory } from "@/components/client-background/interview-history"
import {
  InterviewSectionCard,
  needsBadge,
  readSectionOpenState,
  writeSectionOpenState,
} from "@/components/client-background/interview-section-card"
import { RelationshipBlocksSection } from "@/components/client-background/relationship-blocks-section"
import { scrollToBackgroundCheck } from "@/components/client-background/worth-checking"
import { ReferralFundingCard } from "@/components/funding/referral-funding-card"
import { Button } from "@/components/ui/button"
import type { ReferralFundingCardProps } from "@/lib/funding/referral-funding-card-props"
import { backgroundAnswersToClientBackground } from "@/lib/background-questionnaire/to-client-background"
import type { BackgroundSelfReport } from "@/lib/background-questionnaire/types"
import { assessAge, displayedAge } from "@/lib/client-background/age"
import {
  backgroundChecks,
  interviewPageForCheck,
  type BackgroundCheck,
} from "@/lib/client-background/checks"
import type { ReasonSupport } from "@/lib/client-background/load"
import { parsePartialDate } from "@/lib/client-background/partial-date"
import type { ScreeningAnswers } from "@/lib/client-background/interview-history"
import type {
  ClientBackgroundData,
  EventRecord,
  RelationshipRecord,
  StressorsRecord,
} from "@/lib/client-background/types"
import { todayDateString } from "@/lib/dates/practice-time"
import { cn } from "@/lib/utils"

type InterviewPageId = "background" | "history"

function clientAge(dateOfBirth: string | null) {
  if (!dateOfBirth) return ""
  return displayedAge(assessAge(parsePartialDate(dateOfBirth), parsePartialDate(todayDateString()), "person"))
}

export function InterviewPage({
  clientId,
  practiceId: _practiceId,
  clientName,
  initialPage,
  data,
  screening,
  selfReport,
  reasonSupport,
  referralFunding,
  referralRecorded = false,
}: {
  clientId: string
  practiceId: string
  clientName: string
  initialPage: InterviewPageId
  data: ClientBackgroundData
  screening: ScreeningAnswers
  selfReport: BackgroundSelfReport | null
  reasonSupport: ReasonSupport
  referralFunding: ReferralFundingCardProps
  referralRecorded?: boolean
}) {
  const router = useRouter()
  const identityRef = useRef(data.demographics.identity)
  const occupationRef = useRef(data.demographics.occupation)
  const livingRef = useRef(data.demographics.livingSituation)
  const relationshipsRef = useRef(data.relationships)
  const statusRef = useRef(data.relationshipStatus)
  const pendingCheck = useRef<BackgroundCheck | null>(null)
  const [page, setPage] = useState<InterviewPageId>(initialPage)
  const [relationships, setRelationships] = useState(data.relationships)
  const [professionals, setProfessionals] = useState(reasonSupport.professionals)
  const blocksRef = useRef(data.relationshipBlocks ?? [])
  const answersRef = useRef(data.blockAnswers)
  const [scrollNonce, setScrollNonce] = useState(0)
  const [phases, setPhases] = useState<Record<string, { phase: SavePhase; retry: (() => void) | null }>>({})
  const flushers = useRef(new Set<() => Promise<void>>())
  const completeRef = useRef<() => void>(() => {})
  const [sectionOpen, setSectionOpen] = useState<Record<string, boolean>>({})
  const age = clientAge(data.dateOfBirth)
  const suggestions = selfReport ? backgroundAnswersToClientBackground(selfReport.answers) : null
  const received = selfReport ? formatReceived(selfReport.assessmentDate) : ""
  const backgroundSectionIds = [
    "reason",
    "identity",
    "education",
    "occupation",
    "relationships-intimate",
    "relationships-caregivers",
    "living",
  ] as const

  useEffect(() => {
    setSectionOpen(readSectionOpenState(clientId, "background"))
  }, [clientId])

  function setSection(id: string, open: boolean) {
    setSectionOpen((current) => {
      const next = { ...current, [id]: open }
      writeSectionOpenState(clientId, "background", next)
      return next
    })
  }

  function toggleSection(id: string) {
    setSection(id, !sectionOpen[id])
  }

  function openAllSections() {
    if (page === "history") {
      const next = {
        "Client history": true,
        "Significant others": true,
        Stressors: true,
      }
      writeSectionOpenState(clientId, "history", next)
      setScrollNonce((count) => count + 1)
      return
    }
    const next = Object.fromEntries(backgroundSectionIds.map((id) => [id, true]))
    setSectionOpen(next)
    writeSectionOpenState(clientId, "background", next)
  }

  function closeAllSections() {
    if (page === "history") {
      const next = {
        "Client history": false,
        "Significant others": false,
        Stressors: false,
      }
      writeSectionOpenState(clientId, "history", next)
      setScrollNonce((count) => count + 1)
      return
    }
    const next = Object.fromEntries(backgroundSectionIds.map((id) => [id, false]))
    setSectionOpen(next)
    writeSectionOpenState(clientId, "background", next)
  }

  const historyOpenState = page === "history" ? readSectionOpenState(clientId, "history") : {}
  const allHistoryOpen =
    Boolean(historyOpenState["Client history"]) &&
    Boolean(historyOpenState["Significant others"]) &&
    Boolean(historyOpenState.Stressors)
  const allSectionsOpen = page === "history" ? allHistoryOpen : backgroundSectionIds.every((id) => sectionOpen[id])
  const openAllLabel = allSectionsOpen ? "Close all" : "Open all"

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

  const onBlockAnswers = useCallback((next: NonNullable<ClientBackgroundData["blockAnswers"]>) => {
    answersRef.current = next
  }, [])

  const registerComplete = useCallback((open: () => void) => {
    completeRef.current = open
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

  const liveChecks = getChecks({
    screening,
    events: data.events,
    stressors: data.stressors,
  })
  function sectionNeeds(target: BackgroundCheck["target"] | BackgroundCheck["target"][]) {
    const targets = Array.isArray(target) ? target : [target]
    return liveChecks.filter((check) => targets.includes(check.target)).length
  }

  useEffect(() => {
    const check = pendingCheck.current
    if (!check) return
    pendingCheck.current = null
    scrollToBackgroundCheck(check)
  }, [page, scrollNonce])

  const values = Object.values(phases)
  const saving = values.some((item) => item.phase === "saving")
  const failed = values.filter((item) => item.phase === "error")
  const saveLabel = saving ? "Saving…" : failed.length > 0 ? "Couldn't save — retry" : "Saved"

  async function flushAll() {
    await Promise.all([...flushers.current].map((flush) => flush()))
  }

  function show(next: InterviewPageId) {
    setPage(next)
    const href =
      next === "history"
        ? `/clients/${clientId}/background/interview?page=history`
        : `/clients/${clientId}/background/interview`
    router.replace(href, { scroll: false })
    window.scrollTo(0, 0)
  }

  function jumpToCheck(check: BackgroundCheck) {
    const next = interviewPageForCheck(check.target)
    if (next === "background") {
      const sectionId =
        check.target === "reason"
          ? "reason"
          : check.target === "identity"
            ? "identity"
            : check.target === "occupation"
              ? "occupation"
              : check.target === "living"
                ? "living"
                : check.target === "relationships-caregivers"
                  ? "relationships-caregivers"
                  : check.target === "relationships-intimate" || check.target === "relationships"
                    ? "relationships-intimate"
                    : null
      if (sectionId) setSection(sectionId, true)
    } else {
      // Open every history group so the target check is reachable; History page owns finer state.
      const historyOpen = readSectionOpenState(clientId, "history")
      writeSectionOpenState(clientId, "history", {
        ...historyOpen,
        "Client history": true,
        "Significant others": true,
        Stressors: true,
      })
    }
    pendingCheck.current = check
    setScrollNonce((count) => count + 1)
    if (next !== page) {
      setPage(next)
      const href =
        next === "history"
          ? `/clients/${clientId}/background/interview?page=history`
          : `/clients/${clientId}/background/interview`
      router.replace(href, { scroll: false })
    }
  }

  async function leave() {
    await flushAll()
    router.push(`/clients/${clientId}/background`)
  }

  async function beginComplete() {
    await flushAll()
    completeRef.current()
  }

  function retryFailed() {
    for (const item of failed) item.retry?.()
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
          <button type="button" className="min-h-11 shrink-0 text-sm underline" onClick={() => void leave()}>
            Save and leave
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3 pb-3">
          <div role="group" aria-label="Interview page" className="inline-flex rounded-md border p-0.5">
            <PageButton pressed={page === "background"} onClick={() => show("background")}>
              Background
            </PageButton>
            <PageButton pressed={page === "history"} onClick={() => show("history")}>
              History
            </PageButton>
          </div>
          <button
            type="button"
            className="min-h-11 text-sm underline"
            onClick={() => (allSectionsOpen ? closeAllSections() : openAllSections())}
          >
            {openAllLabel}
          </button>
          {failed.length > 0 && !saving ? (
            <button type="button" className="min-h-11 text-sm text-destructive underline" onClick={retryFailed}>
              {saveLabel}
            </button>
          ) : (
            <p className="text-sm text-muted-foreground">{saveLabel}</p>
          )}
          {page === "history" ? (
            <Button type="button" className="min-h-11" onClick={() => void beginComplete()}>
              Complete
            </Button>
          ) : null}
        </div>
      </header>

      {selfReport ? (
        <p className="mt-4 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
          Self-report received {received}. Blue lines show the client&apos;s answers; items without one aren&apos;t in
          the self-report. &quot;Use&quot; copies an answer into the field; nothing is filled in automatically.
        </p>
      ) : null}

      <div className={cn("space-y-4 py-4", page !== "background" && "hidden")}>
        <InterviewSectionCard
          id="check-reason"
          title="Referral and funding"
          open={Boolean(sectionOpen.reason)}
          onToggle={() => toggleSection("reason")}
          badge={needsBadge(sectionNeeds("reason"))}
        >
          <ReferralFundingCard {...referralFunding} hideTitle />
        </InterviewSectionCard>
        <InterviewSectionCard
          id="check-identity"
          title="Identity"
          open={Boolean(sectionOpen.identity)}
          onToggle={() => toggleSection("identity")}
          badge={needsBadge(sectionNeeds("identity"))}
        >
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
        </InterviewSectionCard>
        <InterviewSectionCard
          title="Education"
          open={Boolean(sectionOpen.education)}
          onToggle={() => toggleSection("education")}
          badge={needsBadge(0)}
        >
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
        </InterviewSectionCard>
        <InterviewSectionCard
          id="check-occupation"
          title="Occupation and financial"
          open={Boolean(sectionOpen.occupation)}
          onToggle={() => toggleSection("occupation")}
          badge={needsBadge(sectionNeeds("occupation"))}
        >
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
        </InterviewSectionCard>
        <RelationshipBlocksSection
          clientId={clientId}
          relationships={relationships}
          blocks={data.relationshipBlocks}
          blockAnswers={data.blockAnswers}
          relationshipStatus={data.relationshipStatus}
          onRelationships={onRelationships}
          onBlocks={onBlocks}
          onBlockAnswers={onBlockAnswers}
          onRelationshipStatus={onRelationshipStatus}
          onPhase={onPhase}
          registerFlush={registerFlush}
          relationshipClient={suggestions?.relationshipStatus}
          childrenPrompt={suggestions?.numberOfChildren?.label ?? null}
          sectionOpen={{
            intimate: Boolean(sectionOpen["relationships-intimate"]),
            caregivers: Boolean(sectionOpen["relationships-caregivers"]),
          }}
          onToggleSection={(id) => toggleSection(id === "intimate" ? "relationships-intimate" : "relationships-caregivers")}
          sectionBadge={{
            intimate: needsBadge(sectionNeeds(["relationships-intimate", "relationships"])),
            caregivers: needsBadge(sectionNeeds("relationships-caregivers")),
          }}
        />
        <InterviewSectionCard
          id="check-living"
          title="Living situation"
          open={Boolean(sectionOpen.living)}
          onToggle={() => toggleSection("living")}
          badge={needsBadge(sectionNeeds("living"))}
        >
          <AutosaveFields
            saved={data.demographics.livingSituation}
            save={async (value) => {
              livingRef.current = value
              const result = await saveLivingSituationAction(clientId, value)
              if ("error" in result && result.error) return { error: result.error }
              if (!("livingSituation" in result) || !result.livingSituation) return { error: "Could not save." }
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
        </InterviewSectionCard>
        <Button type="button" className="min-h-11" onClick={() => show("history")}>
          Continue to History
        </Button>
      </div>

      <div id="check-history" className={cn("scroll-mt-28 py-4", page !== "history" && "hidden")}>
        <InterviewHistory
          clientId={clientId}
          dateOfBirth={data.dateOfBirth}
          events={data.events}
          relationships={relationships}
          screening={screening}
          stressors={data.stressors}
          selfReportId={selfReport?.resultId ?? null}
          historyClient={suggestions?.history}
          medicationClient={suggestions?.medication}
          professionals={professionals}
          stressorsClient={suggestions?.stressors}
          issues={data.issues}
          onEvents={() => {}}
          onPhase={onPhase}
          registerFlush={registerFlush}
          registerComplete={registerComplete}
          getChecks={getChecks}
          onJumpToCheck={jumpToCheck}
          sectionSyncKey={scrollNonce}
        />
      </div>
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

function PageButton({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn("min-h-11 rounded px-3 text-sm", pressed && "bg-muted font-medium")}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
