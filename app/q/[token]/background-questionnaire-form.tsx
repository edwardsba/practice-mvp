"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import {
  clearUntriggeredBackgroundAnswers,
  emptyBackgroundAnswers,
} from "@/lib/background-questionnaire/answers"
import {
  BACKGROUND_PARTS,
  BACKGROUND_QUESTIONNAIRE_INTRO,
  BACKGROUND_QUESTIONNAIRE_TITLE,
  readBackgroundField,
  writeBackgroundField,
  type BackgroundChoice,
  type BackgroundConditional,
  type BackgroundQuestion,
} from "@/lib/background-questionnaire/questions"
import type {
  BackgroundAnswers,
  BackgroundPartKey,
} from "@/lib/background-questionnaire/types"
import { cn } from "@/lib/utils"

const CONFIRMATION = "Thank you. Your answers have been sent."

const choiceRowClass =
  "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 transition-colors"

export function BackgroundQuestionnaireForm({ token }: { token: string }) {
  const [partIndex, setPartIndex] = useState(0)
  const [answers, setAnswers] = useState<BackgroundAnswers>(emptyBackgroundAnswers)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [partIndex])

  const part = BACKGROUND_PARTS[partIndex]
  const isFirst = partIndex === 0
  const isLast = partIndex === BACKGROUND_PARTS.length - 1

  function updateField(partKey: BackgroundPartKey, field: string, value: unknown) {
    setAnswers((current) =>
      clearUntriggeredBackgroundAnswers(
        writeBackgroundField(current, partKey, field, value)
      )
    )
  }

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch("/api/assessments/submit-background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, answers }),
      })
      const data = (await response.json()) as { success?: boolean; error?: string }
      if (!response.ok || !data.success) {
        setError(data.error ?? "Unable to submit your answers. Please try again.")
        return
      }
      setSubmitted(true)
    } catch {
      setError("Unable to submit your answers. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (!part) return null

  if (submitted) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
        <div className="max-w-md space-y-2 text-center">
          <p className="text-lg font-medium">{CONFIRMATION}</p>
          <p className="text-sm text-muted-foreground">
            You may now safely close this window.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8 pb-16">
      {isFirst ? (
        <header className="mb-8 space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {BACKGROUND_QUESTIONNAIRE_TITLE}
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            {BACKGROUND_QUESTIONNAIRE_INTRO}
          </p>
        </header>
      ) : null}

      <div className="mb-8 space-y-3">
        <p className="text-sm text-muted-foreground">
          Part {partIndex + 1} of {BACKGROUND_PARTS.length} · {part.name}
        </p>
        <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div
            className="h-full bg-primary"
            style={{ width: `${((partIndex + 1) / BACKGROUND_PARTS.length) * 100}%` }}
          />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">{part.name}</h2>
        {part.lead ? (
          <p className="text-base leading-relaxed text-muted-foreground">{part.lead}</p>
        ) : null}
      </div>

      <div className="space-y-8">
        {part.questions.map((question, index) => (
          <div key={question.field} className="space-y-3">
            {question.sectionHeading ? (
              <h3 className="text-sm font-semibold">{question.sectionHeading}</h3>
            ) : null}
            <QuestionCard
              partKey={part.key}
              index={index + 1}
              question={question}
              answers={answers}
              onChange={updateField}
            />
          </div>
        ))}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className={cn("flex gap-3", isFirst ? undefined : "justify-between")}>
          {isFirst ? null : (
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => setPartIndex((current) => Math.max(0, current - 1))}
              disabled={submitting}
            >
              ← Previous
            </Button>
          )}
          <Button
            type="button"
            size="lg"
            className={isFirst ? "w-full" : undefined}
            disabled={submitting}
            onClick={() => {
              if (isLast) {
                void submit()
                return
              }
              setPartIndex((current) => current + 1)
            }}
          >
            {isLast ? (submitting ? "Submitting…" : "Submit") : "Next"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function QuestionCard({
  partKey,
  index,
  question,
  answers,
  onChange,
}: {
  partKey: BackgroundPartKey
  index: number
  question: BackgroundQuestion
  answers: BackgroundAnswers
  onChange: (partKey: BackgroundPartKey, field: string, value: unknown) => void
}) {
  const value = readBackgroundField(answers, partKey, question.field)
  const labelId = `${partKey}-${question.field}-label`

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className="space-y-3 rounded-xl border bg-card p-4 shadow-sm"
    >
      <p id={labelId} className="text-base leading-snug font-medium">
        <span className="text-muted-foreground">{index}. </span>
        {question.text}
        {question.optional ? (
          <span className="font-normal text-muted-foreground italic"> (optional)</span>
        ) : null}
      </p>
      <QuestionControl
        partKey={partKey}
        field={question.field}
        kind={question.kind}
        value={value}
        options={question.options}
        hint={question.hint}
        min={question.min}
        max={question.max}
        onChange={onChange}
      />
      {question.conditionals?.map((conditional) =>
        conditional.visible(answers) ? (
          <ConditionalField
            key={conditional.field}
            partKey={partKey}
            conditional={conditional}
            value={readBackgroundField(answers, partKey, conditional.field)}
            onChange={onChange}
          />
        ) : null
      )}
    </div>
  )
}

function ConditionalField({
  partKey,
  conditional,
  value,
  onChange,
}: {
  partKey: BackgroundPartKey
  conditional: BackgroundConditional
  value: unknown
  onChange: (partKey: BackgroundPartKey, field: string, value: unknown) => void
}) {
  const labelId = `${partKey}-${conditional.field}-label`
  return (
    <div className="space-y-2 border-l-2 pl-3">
      <p id={labelId} className="text-sm leading-snug font-medium">
        {conditional.text}
        {conditional.optional ? (
          <span className="font-normal text-muted-foreground italic"> (optional)</span>
        ) : null}
      </p>
      <QuestionControl
        partKey={partKey}
        field={conditional.field}
        kind={conditional.kind}
        value={value}
        labelledBy={labelId}
        onChange={onChange}
      />
    </div>
  )
}

function QuestionControl({
  partKey,
  field,
  kind,
  value,
  options,
  hint,
  min,
  max,
  labelledBy,
  onChange,
}: {
  partKey: BackgroundPartKey
  field: string
  kind: BackgroundQuestion["kind"] | BackgroundConditional["kind"]
  value: unknown
  options?: BackgroundChoice[]
  hint?: string
  min?: number
  max?: number
  labelledBy?: string
  onChange: (partKey: BackgroundPartKey, field: string, value: unknown) => void
}) {
  const controlId = `${partKey}-${field}`

  if (kind === "radio" || kind === "yesno") {
    const choices =
      kind === "yesno"
        ? [
            { label: "Yes", value: "yes" },
            { label: "No", value: "no" },
          ]
        : (options ?? [])
    const selected =
      kind === "yesno"
        ? value === true
          ? "yes"
          : value === false
            ? "no"
            : ""
        : typeof value === "string"
          ? value
          : ""
    return (
      <RadioGroup
        value={selected}
        onValueChange={(next) => {
          if (kind === "yesno") {
            onChange(partKey, field, next === "yes")
            return
          }
          onChange(partKey, field, next)
        }}
        className="gap-2"
        aria-labelledby={labelledBy}
      >
        {choices.map((choice) => (
          <label
            key={choice.value}
            className={cn(
              choiceRowClass,
              selected === choice.value
                ? "border-primary bg-primary/5"
                : "border-transparent hover:bg-muted/60"
            )}
          >
            <RadioGroupItem value={choice.value} className="mt-0.5" />
            <span className="text-sm leading-snug">{choice.label}</span>
          </label>
        ))}
      </RadioGroup>
    )
  }

  if (kind === "checkboxes") {
    const selected = Array.isArray(value) ? value.filter((item) => typeof item === "string") : []
    return (
      <div className="space-y-2">
        <div className="flex flex-col gap-2">
          {(options ?? []).map((choice) => {
            const checked = selected.includes(choice.value)
            function setChecked(next: boolean) {
              const without = selected.filter((item) => item !== choice.value)
              const nextValues = next ? [...without, choice.value] : without
              const ordered = (options ?? [])
                .map((option) => option.value)
                .filter((option) => nextValues.includes(option))
              onChange(partKey, field, ordered)
            }
            return (
              <div
                key={choice.value}
                className={cn(
                  choiceRowClass,
                  checked
                    ? "border-primary bg-primary/5"
                    : "border-transparent hover:bg-muted/60"
                )}
                onClick={() => setChecked(!checked)}
              >
                <Checkbox
                  checked={checked}
                  onClick={(event) => event.stopPropagation()}
                  onCheckedChange={(next) => setChecked(next === true)}
                  className="mt-0.5"
                />
                <span className="text-sm leading-snug">{choice.label}</span>
              </div>
            )
          })}
        </div>
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      </div>
    )
  }

  if (kind === "textarea") {
    return (
      <Textarea
        id={controlId}
        aria-labelledby={labelledBy}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(partKey, field, event.target.value)}
        className="text-base"
      />
    )
  }

  if (kind === "number") {
    return (
      <div className="space-y-2">
        <Input
          id={controlId}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={1}
          value={typeof value === "number" ? String(value) : ""}
          onChange={(event) => {
            const raw = event.target.value
            if (raw.trim() === "") {
              onChange(partKey, field, null)
              return
            }
            const parsed = Number(raw)
            if (!Number.isInteger(parsed)) return
            const lower = min ?? 0
            const upper = max ?? 20
            onChange(partKey, field, Math.min(upper, Math.max(lower, parsed)))
          }}
          className="w-24 text-base"
          aria-labelledby={labelledBy}
        />
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      </div>
    )
  }

  return (
    <Input
      id={controlId}
      aria-labelledby={labelledBy}
      value={typeof value === "string" ? value : ""}
      onChange={(event) => onChange(partKey, field, event.target.value)}
      className="text-base"
    />
  )
}
