"use client"

import { useRouter } from "next/navigation"
import {
  Suspense,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ComponentProps,
} from "react"

import { AssessmentFormCore } from "@/components/assessments/form/assessment-form-core"
import { DiscardChangesDialog } from "@/components/client-background/discard-changes-dialog"
import { ConfirmPrefilledDialog } from "@/components/shared/confirm-prefilled-dialog"
import { SectionProgressChips } from "@/components/shared/section-progress-chips"
import { SectionNumberBadge, SectionStatusPill } from "@/components/shared/section-status-pill"
import { BackButton } from "@/components/ui/back-button"
import { Button } from "@/components/ui/button"
import type { PageRegistryKey } from "@/lib/navigation/page-registry"
import { useBackTarget } from "@/lib/navigation/use-back-target"
import { Input } from "@/components/ui/input"
import {
  clearAssessmentDraft,
  readAssessmentDraft,
  writeAssessmentDraft,
} from "@/lib/assessments/draft-storage"
import {
  prefilledConfirmDialogCopy,
  prefilledElementKeys,
  sectionStatuses,
  showSectionProgressBar,
  validateAnswers,
  type FormAnswers,
  type FormElement,
  type FormValidationError,
} from "@/lib/assessments/form-rules"
import type { SavePractitionerAssessmentState } from "@/lib/assessments/save-practitioner-assessment"
import { UNGROUPED_SECTION_KEY } from "@/lib/assessments/section-presentation"
import { attentionSaveBannerClass } from "@/lib/ui/status-colours"
import { cn } from "@/lib/utils"

export function PractitionerAssessmentForm(props: ComponentProps<typeof PractitionerAssessmentFormInner>) {
  return (
    <Suspense fallback={null}>
      <PractitionerAssessmentFormInner {...props} />
    </Suspense>
  )
}

function PractitionerAssessmentFormInner({
  mode,
  clientId,
  clientName,
  practitionerName,
  assessmentCode,
  displayName,
  elements,
  initialAnswers,
  initialAssessmentDate,
  sessionNoteId,
  instanceId,
  saveAction,
}: {
  mode: "new" | "edit"
  clientId: string
  clientName: string
  practitionerName: string
  assessmentCode: string
  /** assessment_name from the definition (heading only; Save is plain "Save"). */
  displayName: string
  elements: FormElement[]
  initialAnswers: FormAnswers
  initialAssessmentDate: string
  sessionNoteId: string | null
  instanceId?: string | null
  saveAction: (
    prev: SavePractitionerAssessmentState,
    formData: FormData
  ) => Promise<SavePractitionerAssessmentState>
}) {
  const page: PageRegistryKey =
    mode === "edit"
      ? "/clients/[client_id]/assessments/edit/[instance_id]"
      : "/clients/[client_id]/assessments/new/[assessment_code]"
  const navData = { clientId, clientName, assessmentCode }
  const backTarget = useBackTarget(page, navData)
  const cancelHref = backTarget?.href ?? `/clients/${clientId}/assessments`
  const router = useRouter()
  const [answers, setAnswers] = useState<FormAnswers>(initialAnswers)
  const [assessmentDate, setAssessmentDate] = useState(initialAssessmentDate)
  // Edit mode: everything starts confirmed. New mode: empty until tapped.
  const [confirmedKeys, setConfirmedKeys] = useState<Set<string>>(() => {
    if (mode === "edit") {
      return new Set(elements.map((el) => el.elementKey))
    }
    return new Set()
  })
  const [errors, setErrors] = useState<FormValidationError[]>([])
  const [banner, setBanner] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [prefillDialogOpen, setPrefillDialogOpen] = useState(false)
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [hydrated, setHydrated] = useState(false)

  const sections = useMemo(
    () => sectionStatuses(elements, answers, confirmedKeys),
    [elements, answers, confirmedKeys]
  )
  const showProgress = useMemo(
    () => showSectionProgressBar(elements),
    [elements]
  )
  const prefilledKeys = useMemo(
    () => new Set(prefilledElementKeys(elements, answers, confirmedKeys)),
    [elements, answers, confirmedKeys]
  )

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    () => {
      const initial: Record<string, boolean> = {}
      const statuses = sectionStatuses(elements, initialAnswers, confirmedKeys)
      statuses.forEach((section, index) => {
        if (mode === "new") {
          initial[section.groupLabel] = index === 0
        } else {
          initial[section.groupLabel] = false
        }
      })
      return initial
    }
  )

  useEffect(() => {
    const draft = readAssessmentDraft({
      clientId,
      assessmentCode,
      instanceId,
    })
    if (draft) {
      setAnswers(draft.answers)
      setAssessmentDate(draft.assessmentDate)
      if (Array.isArray(draft.confirmedKeys)) {
        setConfirmedKeys(new Set(draft.confirmedKeys))
      }
      setDirty(true)
    }
    setHydrated(true)
  }, [clientId, assessmentCode, instanceId])

  useEffect(() => {
    if (!hydrated || !dirty) return
    writeAssessmentDraft({
      clientId,
      assessmentCode,
      instanceId,
      draft: {
        answers,
        assessmentDate,
        savedAt: new Date().toISOString(),
        confirmedKeys: [...confirmedKeys],
      },
    })
  }, [
    answers,
    assessmentDate,
    confirmedKeys,
    hydrated,
    dirty,
    clientId,
    assessmentCode,
    instanceId,
  ])

  function confirmElement(elementKey: string) {
    setConfirmedKeys((prev) => {
      if (prev.has(elementKey)) return prev
      const next = new Set(prev)
      next.add(elementKey)
      return next
    })
  }

  function updateAnswers(next: FormAnswers) {
    setAnswers(next)
    setDirty(true)
    if (errors.length > 0) {
      setErrors(validateAnswers(elements, next))
    }
  }

  function toggleSection(groupLabel: string) {
    setOpenSections((prev) => ({
      ...prev,
      [groupLabel]: !prev[groupLabel],
    }))
  }

  function openSectionAndScroll(groupLabel: string, letter: string) {
    setOpenSections((prev) => ({ ...prev, [groupLabel]: true }))
    const el = document.getElementById(`section-${letter}`)
    el?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  function requestLeave(href: string) {
    if (!dirty) {
      router.push(href)
      return
    }
    setPendingHref(href)
    setDiscardOpen(true)
  }

  function confirmDiscard() {
    clearAssessmentDraft({ clientId, assessmentCode, instanceId })
    setDiscardOpen(false)
    const href = pendingHref ?? cancelHref
    setPendingHref(null)
    setDirty(false)
    router.push(href)
  }

  function submitSave(finalAnswers: FormAnswers) {
    setBanner(null)
    setErrors([])

    const formData = new FormData()
    formData.set("answers_json", JSON.stringify(finalAnswers))
    formData.set("assessment_date", assessmentDate)
        formData.set("assessment_code", assessmentCode)
    if (sessionNoteId) formData.set("session_note_id", sessionNoteId)

    clearAssessmentDraft({ clientId, assessmentCode, instanceId })
    setDirty(false)

    startTransition(async () => {
      const result = await saveAction({}, formData)
      if (result?.error) {
        setBanner(result.error)
        if (result.fieldErrors?.length) {
          setErrors(result.fieldErrors)
        }
        setDirty(true)
        return
      }
    })
  }

  function handleSave() {
    const fieldErrors = validateAnswers(elements, answers)
    if (fieldErrors.length > 0) {
      setErrors(fieldErrors)
      setBanner(
        `${fieldErrors.length} question${fieldErrors.length === 1 ? "" : "s"} still need an answer`
      )
      const errorKeys = new Set(fieldErrors.map((e) => e.elementKey))
      const nextOpen: Record<string, boolean> = {}
      for (const section of sections) {
        const sectionHasError = elements.some(
          (el) =>
            el.groupLabel === section.groupLabel &&
            errorKeys.has(el.elementKey)
        )
        nextOpen[section.groupLabel] = sectionHasError
      }
      setOpenSections(nextOpen)
      const firstKey = fieldErrors[0]?.elementKey
      if (firstKey) {
        requestAnimationFrame(() => {
          document
            .getElementById(`question-${firstKey}`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" })
        })
      }
      return
    }

    const stillPrefilled = prefilledElementKeys(elements, answers, confirmedKeys)
    if (stillPrefilled.length > 0) {
      setPrefillDialogOpen(true)
      return
    }

    submitSave(answers)
  }

  function handlePrefillGoBack() {
    setPrefillDialogOpen(false)
    const nextOpen: Record<string, boolean> = { ...openSections }
    for (const section of sections) {
      if (section.status === "to_confirm") {
        nextOpen[section.groupLabel] = true
      }
    }
    setOpenSections(nextOpen)
  }

  function handlePrefillConfirmAndSave() {
    setPrefillDialogOpen(false)
    const allKeys = new Set(confirmedKeys)
    for (const key of prefilledElementKeys(elements, answers, confirmedKeys)) {
      allKeys.add(key)
    }
    setConfirmedKeys(allKeys)
    submitSave(answers)
  }

  const prefillDialog = useMemo(() => {
    const keys = prefilledElementKeys(elements, answers, confirmedKeys)
    const badges = sections
      .filter((section) => section.status === "to_confirm")
      .map((section) => section.letter)
    return prefilledConfirmDialogCopy({
      count: keys.length,
      sectionBadges: badges,
    })
  }, [elements, answers, confirmedKeys, sections])

  return (
    <div className="pb-28">
      <div className="mb-4 space-y-2">
        <BackButton page={page} data={navData} isDirty={dirty} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {displayName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {clientName} · {practitionerName}
          </p>
        </div>
        <div className="max-w-xs space-y-1">
          <label htmlFor="assessment_date" className="text-sm font-medium">
            Date of assessment
          </label>
          <Input
            id="assessment_date"
            type="date"
            value={assessmentDate}
            onChange={(event) => {
              setAssessmentDate(event.target.value)
              setDirty(true)
            }}
            className="min-h-11"
          />
        </div>
      </div>

      <div className="sticky top-0 z-20 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur">
        {showProgress ? (
          <SectionProgressChips
            sections={sections}
            onSelect={(section) =>
              openSectionAndScroll(section.groupLabel, section.letter)
            }
          />
        ) : null}
        <p
          className={cn(
            attentionSaveBannerClass,
            showProgress ? "mt-2" : null
          )}
        >
          Not saved yet. Answers are kept on this device until you press Save.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {sections.map((section) => {
          const ungrouped = section.groupLabel === UNGROUPED_SECTION_KEY
          const open = ungrouped
            ? true
            : Boolean(openSections[section.groupLabel])
          return (
            <section
              key={section.groupLabel || "ungrouped"}
              id={`section-${section.letter}`}
              className="rounded-lg border"
            >
              {ungrouped ? null : (
                <h2>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                    aria-expanded={open}
                    onClick={() => toggleSection(section.groupLabel)}
                  >
                    <SectionNumberBadge section={section} />
                    <span className="flex-1 text-sm font-semibold">
                      {section.title}
                    </span>
                    <SectionStatusPill section={section} />
                    <span className="text-muted-foreground" aria-hidden>
                      {open ? "▾" : "▸"}
                    </span>
                  </button>
                </h2>
              )}
              {open ? (
                <div className={cn("px-4 py-4", ungrouped ? null : "border-t")}>
                  {section.status === "skipped" ? (
                    <p className="text-sm text-muted-foreground">
                      Not asked, because of an earlier answer.
                    </p>
                  ) : (
                    <AssessmentFormCore
                      elements={elements}
                      groupLabel={
                        ungrouped ? undefined : section.groupLabel
                      }
                      answers={answers}
                      onAnswersChange={updateAnswers}
                      onElementActivate={confirmElement}
                      prefilledKeys={prefilledKeys}
                      errors={errors}
                      disabled={pending}
                    />
                  )}
                </div>
              ) : null}
            </section>
          )
        })}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {banner ? (
            <p className="text-sm text-destructive" role="alert">
              {banner}
            </p>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={pending}
              onClick={() => requestLeave(cancelHref)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="min-h-11"
              disabled={pending}
              onClick={handleSave}
            >
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </div>

      <DiscardChangesDialog
        open={discardOpen}
        onDiscard={confirmDiscard}
        onKeepEditing={() => {
          setDiscardOpen(false)
          setPendingHref(null)
        }}
      />

      <ConfirmPrefilledDialog
        open={prefillDialogOpen}
        title={prefillDialog.title}
        body={prefillDialog.body}
        onGoBack={handlePrefillGoBack}
        onConfirmAndSave={handlePrefillConfirmAndSave}
      />

    </div>
  )
}
