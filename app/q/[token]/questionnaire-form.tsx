"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import type { BatteryNavContext } from "@/lib/assessments/battery-nav"
import {
  currentQuestionnaireUrl,
  extractTokenFromQuestionnairePath,
  readBatteryForwardUrl,
  readBatteryPreviousUrl,
  writeBatteryForwardUrl,
  writeBatteryPreviousUrl,
} from "@/lib/assessments/battery-session"
import type {
  QuestionnaireData,
  QuestionnaireQuestion,
} from "@/lib/assessments/load-questionnaire"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"

const STANDALONE_CONFIRMATION =
  "Thank you. Your responses have been submitted."

const BATTERY_CONFIRMATION =
  "Thank you. Your Pre-Session Questionnaire is complete."

const BATTERY_RESPONSES_KEY_PREFIX = "battery-responses:"

type SubmitResponse = {
  success?: boolean
  error?: string
  nextUrl?: string
  batteryComplete?: boolean
}

function storageKey(token: string) {
  return `${BATTERY_RESPONSES_KEY_PREFIX}${token}`
}

function readStoredResponses(token: string): Record<string, string> {
  if (typeof window === "undefined") return {}
  try {
    const raw = sessionStorage.getItem(storageKey(token))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, string>
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function writeStoredResponses(token: string, responses: Record<string, string>) {
  if (typeof window === "undefined") return
  sessionStorage.setItem(storageKey(token), JSON.stringify(responses))
}

export function QuestionnaireForm({
  token,
  assessmentName,
  instructionText,
  questions,
  carriedResponses,
  contextNote,
  conditionalSkip,
  batteryNextToken,
  batteryNav,
}: QuestionnaireData & {
  token: string
  batteryNextToken?: string
  batteryNav: BatteryNavContext
}) {
  const router = useRouter()
  const [responses, setResponses] = useState<Record<string, string>>({})
  const [previousUrl, setPreviousUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(
    null
  )
  const [unansweredIds, setUnansweredIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    // Carried-forward defaults apply first, then session storage on top — if the client
    // already interacted with this exact page this session (e.g. navigated back to it), their
    // own in-progress edits take precedence over the original carried-forward default.
    setResponses({ ...carriedResponses, ...readStoredResponses(token) })
    setPreviousUrl(readBatteryPreviousUrl(token))
    setError(null)
    setConfirmationMessage(null)
  }, [token, carriedResponses])

  const gateValue = conditionalSkip ? responses[conditionalSkip.triggerElementId] : undefined

  useEffect(() => {
    if (!conditionalSkip) return
    const defaults = conditionalSkip.skippedDefaults

    if (gateValue === conditionalSkip.triggerValue) {
      // Force-default the skipped questions whenever the trigger answer is given, even if
      // they already had values from an earlier pass through the form — a "No" here means
      // those answers are no longer applicable, not that they should be preserved.
      setResponses((prev) => {
        const next = { ...prev, ...defaults }
        writeStoredResponses(token, next)
        return next
      })
    } else if (gateValue !== undefined) {
      // Trigger answer changed away from the skip condition — clear any previously-set
      // skip defaults so those questions are asked fresh, not left stale from a prior answer.
      setResponses((prev) => {
        const hasAnyDefaults = Object.keys(defaults).some((id) => prev[id] !== undefined)
        if (!hasAnyDefaults) return prev
        const next = { ...prev }
        for (const id of Object.keys(defaults)) delete next[id]
        writeStoredResponses(token, next)
        return next
      })
    }
    // Only re-run when the trigger question's own answer changes, not on every keystroke
    // elsewhere in the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateValue])

  function setAnswer(elementId: string, value: string) {
    setResponses((prev) => {
      const next = { ...prev, [elementId]: value }
      writeStoredResponses(token, next)
      return next
    })
    setUnansweredIds((prev) => {
      if (!prev.has(elementId)) return prev
      const next = new Set(prev)
      next.delete(elementId)
      return next
    })
  }

  function validateResponses() {
    const unanswered = questions.filter(
      (q) => q.isRequired && !responses[q.elementId]
    )
    if (unanswered.length > 0) {
      setUnansweredIds(new Set(unanswered.map((q) => q.elementId)))
      setError("Please answer the highlighted question(s) below.")
      const firstElement = document.getElementById(
        `question-${unanswered[0].elementId}`
      )
      firstElement?.scrollIntoView({ behavior: "smooth", block: "center" })
      return false
    }
    setUnansweredIds(new Set())
    return true
  }

  function rememberBatteryNavigation(nextUrl: string) {
    const nextToken = extractTokenFromQuestionnairePath(nextUrl)
    if (!nextToken) return

    const currentUrl = currentQuestionnaireUrl()
    writeBatteryPreviousUrl(nextToken, currentUrl)
    writeBatteryForwardUrl(token, nextUrl)
  }

  async function submitCurrentStep() {
    setError(null)
    if (!validateResponses()) return

    setLoading(true)
    try {
      writeStoredResponses(token, responses)

      const payload: {
        token: string
        responses: Record<string, string>
        batteryNextToken?: string
      } = { token, responses }

      if (batteryNextToken) {
        payload.batteryNextToken = batteryNextToken
      }

      const response = await fetch("/api/assessments/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = (await response.json()) as SubmitResponse

      if (!response.ok || !data.success) {
        setError(data.error ?? "Unable to submit your responses. Please try again.")
        return
      }

      // Always check the actual response for a next step, rather than deciding in advance
      // from client-side batteryNav state computed at page load. That state can be stale —
      // e.g. a diagnostic battery trigger (like ASRS Part A -> Part B) may create the next
      // link reactively, during this very submission, which the client couldn't have known
      // about when the page first loaded.
      const forwardUrl = readBatteryForwardUrl(token)
      const navigateUrl = forwardUrl ?? data.nextUrl

      if (navigateUrl) {
        if (!forwardUrl && data.nextUrl) {
          rememberBatteryNavigation(data.nextUrl)
        }

        router.push(navigateUrl)
        return
      }

      setConfirmationMessage(
        data.batteryComplete ? BATTERY_CONFIRMATION : STANDALONE_CONFIRMATION
      )
    } catch {
      setError("Unable to submit your responses. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  function handlePrevious() {
    const targetUrl = previousUrl ?? readBatteryPreviousUrl(token)
    if (!targetUrl) return

    writeStoredResponses(token, responses)
    setError(null)
    router.push(targetUrl)
  }

  async function handleFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await submitCurrentStep()
  }

  const showPrevious = batteryNav.isBatteryStep && Boolean(previousUrl)
  const showNext =
    batteryNav.isBatteryStep && !batteryNav.isLastInBattery
  const submitLabel = showNext ? "Next Page →" : "Submit"

  const visibleQuestions =
    conditionalSkip && gateValue === conditionalSkip.triggerValue
      ? questions.filter((q) => !(q.elementId in conditionalSkip.skippedDefaults))
      : questions

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

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8 pb-16">
      <header className="mb-8 space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">{assessmentName}</h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          {instructionText}
        </p>
        {contextNote ? (
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm leading-snug">
            <span className="font-medium">Based on your earlier answers, </span>
            this section is about: {contextNote}
          </div>
        ) : null}
      </header>

      <form onSubmit={handleFormSubmit} className="space-y-8">
        {visibleQuestions.map((question, index) => (
          <QuestionBlock
            key={question.elementId}
            index={index + 1}
            question={question}
            value={responses[question.elementId]}
            onValueChange={(value) => setAnswer(question.elementId, value)}
            hasError={unansweredIds.has(question.elementId)}
            isCarriedForward={Boolean(carriedResponses[question.elementId])}
          />
        ))}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div
          className={cn(
            "flex gap-3",
            showPrevious ? "justify-between" : "justify-end"
          )}
        >
          {showPrevious ? (
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handlePrevious}
              disabled={loading}
            >
              ← Previous
            </Button>
          ) : null}
          <Button
            type="submit"
            size="lg"
            disabled={loading}
            className={showPrevious ? undefined : "w-full"}
          >
            {loading ? "Submitting…" : submitLabel}
          </Button>
        </div>
      </form>
    </div>
  )
}

function QuestionBlock({
  index,
  question,
  value,
  onValueChange,
  hasError,
  isCarriedForward,
}: {
  index: number
  question: QuestionnaireQuestion
  value?: string
  onValueChange: (value: string) => void
  hasError: boolean
  isCarriedForward: boolean
}) {
  const labelId = `question-label-${question.elementId}`

  return (
    <div
      id={`question-${question.elementId}`}
      role="group"
      aria-labelledby={labelId}
      className={cn(
        "space-y-3 rounded-xl border bg-card p-4 shadow-sm",
        hasError ? "border-destructive" : ""
      )}
    >
      <p id={labelId} className="text-base leading-snug font-medium">
        <span className="text-muted-foreground">{index}. </span>
        {question.questionText}
        {question.isRequired ? (
          <span className="text-destructive"> *</span>
        ) : null}
      </p>
      {isCarriedForward ? (
        <p className="text-sm text-muted-foreground italic">
          You already told us this — feel free to update it if anything&apos;s changed.
        </p>
      ) : null}
      <RadioGroup
        value={value}
        onValueChange={onValueChange}
        className="gap-2"
        required
      >
        {question.options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 transition-colors",
              value === option.value
                ? "border-primary bg-primary/5"
                : "border-transparent hover:bg-muted/60"
            )}
          >
            <RadioGroupItem value={option.value} className="mt-0.5" />
            <span className="text-sm leading-snug">{option.label}</span>
          </label>
        ))}
      </RadioGroup>
      {hasError ? (
        <p className="text-sm text-destructive">This question is required</p>
      ) : null}
    </div>
  )
}
