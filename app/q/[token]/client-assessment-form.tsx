"use client"

import { useEffect, useMemo, useState } from "react"

import { AssessmentFormCore } from "@/components/assessments/form/assessment-form-core"
import { SectionProgressChips } from "@/components/shared/section-progress-chips"
import { SectionNumberBadge } from "@/components/shared/section-status-pill"
import { Button } from "@/components/ui/button"
import { applyClientVisitSectionStatuses } from "@/lib/assessments/client-section-status"
import {
  clearAssessmentDraft,
  readAssessmentDraft,
  writeAssessmentDraft,
} from "@/lib/assessments/draft-storage"
import {
  sectionStatuses,
  showSectionProgressBar,
  validateAnswers,
  type FormAnswers,
  type FormElement,
  type FormValidationError,
} from "@/lib/assessments/form-rules"
import { UNGROUPED_SECTION_KEY } from "@/lib/assessments/section-presentation"
import { problemBorderClass } from "@/lib/ui/status-colours"
import { cn } from "@/lib/utils"

const THANK_YOU =
  "Thank you. Your responses have been sent to your psychologist."

const SAVE_ON_DEVICE_NOTE =
  "Your answers are saved on this device until you send them."

type SubmitResponse = {
  success?: boolean
  error?: string
  fieldErrors?: FormValidationError[]
}

export function ClientAssessmentForm({
  token,
  practiceName,
  assessmentName,
  introText,
  assessmentCode,
  clientId,
  instanceId,
  elements,
}: {
  token: string
  practiceName: string
  assessmentName: string
  introText: string
  assessmentCode: string
  clientId: string
  instanceId: string
  elements: FormElement[]
}) {
  const [answers, setAnswers] = useState<FormAnswers>({})
  const [errors, setErrors] = useState<FormValidationError[]>([])
  const [banner, setBanner] = useState<string | null>(null)
  const [finishLaterMessage, setFinishLaterMessage] = useState<string | null>(
    null
  )
  const [loading, setLoading] = useState(false)
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(
    null
  )
  const [hydrated, setHydrated] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [sectionIndex, setSectionIndex] = useState(0)
  const [visitedSectionKeys, setVisitedSectionKeys] = useState<string[]>([])

  const baseSections = useMemo(
    () => sectionStatuses(elements, answers, new Set()),
    [elements, answers]
  )
  const showProgress = useMemo(
    () => showSectionProgressBar(elements),
    [elements]
  )

  const safeIndex = Math.min(
    Math.max(sectionIndex, 0),
    Math.max(baseSections.length - 1, 0)
  )
  const currentBase = baseSections[safeIndex] ?? null
  const sections = useMemo(
    () =>
      applyClientVisitSectionStatuses(baseSections, {
        currentGroupLabel: currentBase?.groupLabel ?? null,
        visitedGroupLabels: new Set(visitedSectionKeys),
      }),
    [baseSections, currentBase?.groupLabel, visitedSectionKeys]
  )
  const currentSection = sections[safeIndex] ?? null
  const isFirst = safeIndex <= 0
  const isLast = safeIndex >= sections.length - 1

  function persistDraft(
    nextAnswers: FormAnswers,
    nextVisited: string[] = visitedSectionKeys
  ) {
    writeAssessmentDraft({
      clientId,
      assessmentCode,
      instanceId,
      draft: {
        answers: nextAnswers,
        assessmentDate: "",
        savedAt: new Date().toISOString(),
        visitedSectionKeys: nextVisited,
      },
    })
  }

  useEffect(() => {
    const draft = readAssessmentDraft({
      clientId,
      assessmentCode,
      instanceId,
    })
    if (draft?.answers) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional hydrate from localStorage
      setAnswers(draft.answers)
      setDirty(true)
    }
    if (Array.isArray(draft?.visitedSectionKeys)) {
      setVisitedSectionKeys(
        draft.visitedSectionKeys.filter((key) => typeof key === "string")
      )
    }
    setHydrated(true)
  }, [clientId, assessmentCode, instanceId])

  useEffect(() => {
    if (!hydrated || !dirty) return
    persistDraft(answers, visitedSectionKeys)
    // persistDraft closes over ids; answers/visited/dirty drive writes
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional draft sync
  }, [answers, visitedSectionKeys, hydrated, dirty, clientId, assessmentCode, instanceId])

  function updateAnswers(next: FormAnswers) {
    setAnswers(next)
    setDirty(true)
    setFinishLaterMessage(null)
    if (errors.length > 0) {
      setErrors(validateAnswers(elements, next))
    }
  }

  function markVisited(groupLabel: string | undefined) {
    if (!groupLabel) return visitedSectionKeys
    if (visitedSectionKeys.includes(groupLabel)) return visitedSectionKeys
    const next = [...visitedSectionKeys, groupLabel]
    setVisitedSectionKeys(next)
    return next
  }

  function goToSection(index: number) {
    const leaving = baseSections[safeIndex]
    const nextVisited = markVisited(leaving?.groupLabel)
    setBanner(null)
    setErrors([])
    setFinishLaterMessage(null)
    setSectionIndex(index)
    setDirty(true)
    persistDraft(answers, nextVisited)
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" })
    })
  }

  function handleSaveAndFinishLater() {
    persistDraft(answers, visitedSectionKeys)
    setDirty(true)
    setFinishLaterMessage(
      "Saved on this device. You can close this page and come back to the same link later."
    )
  }

  async function handleSend() {
    setBanner(null)
    setFinishLaterMessage(null)
    const fieldErrors = validateAnswers(elements, answers)
    if (fieldErrors.length > 0) {
      setErrors(fieldErrors)
      setBanner(
        `${fieldErrors.length} question${fieldErrors.length === 1 ? "" : "s"} still need an answer`
      )
      const firstKey = fieldErrors[0]?.elementKey
      const sectionWithError = sections.findIndex((section) =>
        elements.some(
          (el) =>
            el.groupLabel === section.groupLabel &&
            el.elementKey === firstKey
        )
      )
      if (sectionWithError >= 0) {
        setSectionIndex(sectionWithError)
      }
      requestAnimationFrame(() => {
        document
          .getElementById(`question-${firstKey}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" })
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/assessments/submit-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, answers }),
      })
      const data = (await response.json()) as SubmitResponse
      if (!response.ok || !data.success) {
        setBanner(data.error ?? "Couldn't send. Try again.")
        if (data.fieldErrors?.length) {
          setErrors(data.fieldErrors)
        }
        return
      }
      clearAssessmentDraft({ clientId, assessmentCode, instanceId })
      setDirty(false)
      setConfirmationMessage(THANK_YOU)
    } catch {
      setBanner("Couldn't send. Try again.")
    } finally {
      setLoading(false)
    }
  }

  if (confirmationMessage) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
        <div className="max-w-md space-y-2 text-center">
          <p className="text-lg font-medium">{confirmationMessage}</p>
          <p className="text-sm text-muted-foreground">
            You may now safely close this window.
          </p>
        </div>
      </div>
    )
  }

  const ungrouped = currentSection?.groupLabel === UNGROUPED_SECTION_KEY

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8">
      <header className="mb-6 space-y-2">
        <p className="text-sm text-muted-foreground">{practiceName}</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {assessmentName}
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          {introText}
        </p>
        <p className="text-sm text-muted-foreground">{SAVE_ON_DEVICE_NOTE}</p>
      </header>

      {showProgress && sections.length > 0 ? (
        <div className="sticky top-0 z-20 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur">
          <SectionProgressChips
            sections={sections}
            onSelect={(section) => {
              const index = sections.findIndex(
                (s) => s.groupLabel === section.groupLabel
              )
              if (index >= 0) goToSection(index)
            }}
          />
        </div>
      ) : null}

      {currentSection ? (
        <section
          className="mt-4 rounded-lg border"
          id={`section-${currentSection.letter}`}
        >
          {ungrouped ? null : (
            <div className="flex items-center gap-3 border-b px-4 py-3">
              <SectionNumberBadge section={currentSection} />
              <h2 className="flex-1 text-sm font-semibold">
                {currentSection.title}
              </h2>
            </div>
          )}
          <div className="px-4 py-4">
            {currentSection.status === "skipped" ? (
              <p className="text-sm text-muted-foreground">
                Not asked, because of an earlier answer.
              </p>
            ) : (
              <AssessmentFormCore
                elements={elements}
                groupLabel={ungrouped ? undefined : currentSection.groupLabel}
                answers={answers}
                onAnswersChange={updateAnswers}
                errors={errors}
                disabled={loading}
                listPresentation="sheet"
              />
            )}
          </div>
        </section>
      ) : null}

      {banner ? (
        <p
          className={cn(
            "mt-4 rounded-md border px-3 py-2 text-sm text-destructive",
            problemBorderClass
          )}
          role="alert"
        >
          {banner}
        </p>
      ) : null}

      {finishLaterMessage ? (
        <p className="mt-4 text-sm text-muted-foreground" role="status">
          {finishLaterMessage}
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 flex-1"
            disabled={loading || isFirst}
            onClick={() => goToSection(safeIndex - 1)}
          >
            Back
          </Button>
          {isLast ? (
            <Button
              type="button"
              className="min-h-11 flex-1"
              disabled={loading}
              onClick={() => void handleSend()}
            >
              {loading ? "Sending…" : "Send to my psychologist"}
            </Button>
          ) : (
            <Button
              type="button"
              className="min-h-11 flex-1"
              disabled={loading}
              onClick={() => goToSection(safeIndex + 1)}
            >
              Next
            </Button>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 w-full"
          disabled={loading}
          onClick={handleSaveAndFinishLater}
        >
          Save and finish later
        </Button>
      </div>
    </div>
  )
}
