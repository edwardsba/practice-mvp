"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import type {
  QuestionnaireData,
  QuestionnaireQuestion,
} from "@/lib/assessments/load-questionnaire"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"

const INSTRUCTION =
  "Over the last 2 weeks, how often have you been bothered by any of the following problems?"

const STANDALONE_CONFIRMATION =
  "Thank you. Your responses have been submitted."

const BATTERY_CONFIRMATION =
  "Thank you. Your Pre-Session Questionnaire is complete."

type SubmitResponse = {
  success?: boolean
  error?: string
  nextUrl?: string
  batteryComplete?: boolean
}

export function QuestionnaireForm({
  token,
  assessmentName,
  questions,
  batteryNextToken,
}: QuestionnaireData & {
  token: string
  batteryNextToken?: string
}) {
  const router = useRouter()
  const [responses, setResponses] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(
    null
  )

  function setAnswer(elementId: string, value: string) {
    setResponses((prev) => ({ ...prev, [elementId]: value }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const unanswered = questions.filter((q) => !responses[q.elementId])
    if (unanswered.length > 0) {
      setError("Please answer all questions before submitting.")
      return
    }

    setLoading(true)
    try {
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

      if (data.nextUrl) {
        router.push(data.nextUrl)
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

  if (confirmationMessage) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
        <p className="max-w-md text-center text-lg font-medium">
          {confirmationMessage}
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8 pb-16">
      <header className="mb-8 space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">{assessmentName}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">{INSTRUCTION}</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-8">
        {questions.map((question, index) => (
          <QuestionBlock
            key={question.elementId}
            index={index + 1}
            question={question}
            value={responses[question.elementId]}
            onValueChange={(value) => setAnswer(question.elementId, value)}
          />
        ))}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? "Submitting…" : "Submit responses"}
        </Button>
      </form>
    </div>
  )
}

function QuestionBlock({
  index,
  question,
  value,
  onValueChange,
}: {
  index: number
  question: QuestionnaireQuestion
  value?: string
  onValueChange: (value: string) => void
}) {
  return (
    <fieldset className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
      <legend className="text-base leading-snug font-medium">
        <span className="text-muted-foreground">{index}. </span>
        {question.questionText}
      </legend>
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
    </fieldset>
  )
}
