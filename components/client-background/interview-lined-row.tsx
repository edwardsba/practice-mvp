"use client"

import type { ReactNode } from "react"

import { InterviewAnswerButtons } from "@/components/client-background/interview-answer-buttons"
import { PrefilledTag } from "@/components/shared/prefilled-tag"
import { Button } from "@/components/ui/button"
import type { InterviewAnswerKind, InterviewAnswerValue } from "@/lib/client-background/interview-answers"
import type { ClientFieldKey } from "@/lib/client-background/interview-client-fields"
import {
  editValueAriaLabel,
  valuePartsText,
  type InterviewClientChoice,
  type InterviewRowModel,
  type InterviewValuePart,
} from "@/lib/client-background/interview-row-model"
import { clientSuggestionRowClass, clientUseButtonClass, statusColours } from "@/lib/ui/status-colours"
import { cn } from "@/lib/utils"

const NOT_RECORDED = "Not recorded"
/** Empty value for presence items (claims / contacts / yes-concerns) — Round AR.1. */
export const NONE_RECORDED = "None recorded"
const EMPTY_MODEL: InterviewRowModel = { choices: [], value: [] }

const valueLineClass = "underline decoration-muted-foreground/50 decoration-1 underline-offset-4"

export type InterviewRowQuestion = {
  kind: InterviewAnswerKind
  value: InterviewAnswerValue | null
  onSelect: (value: InterviewAnswerValue) => void
}

/**
 * One row of a Background interview list (sections 1–4 and 7): small grey label, then the
 * question's answer buttons, then the client's self-report lines, then what's on file. The value
 * is the edit link — tapping it opens the item's editor. Rows sit in a `divide-y` list, no cards.
 */
export function InterviewLinedRow({
  id,
  label,
  prefilled = false,
  question,
  model = EMPTY_MODEL,
  onEdit,
  onUse,
  onKeep,
  busy = false,
  contradictionNote,
  error,
  emptyLabel = NOT_RECORDED,
  children,
}: {
  /** Anchor for Worth checking jumps. */
  id?: string
  label: string
  prefilled?: boolean
  question?: InterviewRowQuestion
  model?: InterviewRowModel
  onEdit?: () => void
  onUse?: (fieldKey: ClientFieldKey) => void
  onKeep?: (fieldKey: ClientFieldKey) => void
  /** A Use client's / Keep or confirm is saving; their buttons wait. */
  busy?: boolean
  contradictionNote?: string | null
  /** A Use client's / Keep that didn't save. */
  error?: string | null
  /** Empty file value text (default "Not recorded"; presence items use "None recorded"). */
  emptyLabel?: string
  /** Rows within this question (contacts, claims), shown instead of this row's own value. */
  children?: ReactNode
}) {
  const pairsShowFile = model.choices.length > 0
  return (
    <div id={id} className={cn("space-y-1.5 py-2.5", id && "scroll-mt-36")}>
      <p className="text-xs text-muted-foreground">
        {label}
        {prefilled ? <PrefilledTag /> : null}
      </p>
      {question ? (
        <InterviewAnswerButtons
          kind={question.kind}
          name={label}
          value={question.value}
          onSelect={question.onSelect}
        />
      ) : null}
      {model.choices.map((choice) => (
        <InterviewClientChoiceLines
          key={choice.fieldKey}
          rowLabel={label}
          choice={choice}
          busy={busy}
          onEdit={onEdit}
          onUse={onUse}
          onKeep={onKeep}
        />
      ))}
      {children ? (
        <div className="divide-y border-t pl-3">{children}</div>
      ) : model.value.length > 0 || !pairsShowFile ? (
        <InterviewValueLink
          rowLabel={label}
          parts={model.value}
          emptyText={emptyLabel}
          onEdit={onEdit}
        />
      ) : null}
      {contradictionNote ? (
        <p className={cn("px-2 py-1.5 text-sm", statusColours.attention.soft)}>{contradictionNote}</p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** Purple "Client: …" with Use client's, then what's on file (still the edit link) with Keep. */
function InterviewClientChoiceLines({
  rowLabel,
  choice,
  busy,
  onEdit,
  onUse,
  onKeep,
}: {
  rowLabel: string
  choice: InterviewClientChoice
  busy: boolean
  onEdit?: () => void
  onUse?: (fieldKey: ClientFieldKey) => void
  onKeep?: (fieldKey: ClientFieldKey) => void
}) {
  const onFile = choice.fileText || choice.emptyText
  return (
    <div className="space-y-1">
      <div className={clientSuggestionRowClass}>
        <p className={cn("min-w-0 break-words text-sm", statusColours.client.text)}>Client: {choice.clientLabel}</p>
        {onUse ? (
          <button
            type="button"
            className={clientUseButtonClass}
            disabled={busy}
            aria-label={`Use client's answer for ${rowLabel}: ${choice.clientLabel}`}
            onClick={() => onUse(choice.fieldKey)}
          >
            Use client&apos;s
          </button>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <InterviewValueLink
          className="min-w-0 flex-1"
          rowLabel={rowLabel}
          parts={choice.fileText ? [{ kind: "file", text: choice.fileText }] : []}
          emptyText={choice.emptyText}
          onEdit={onEdit}
        />
        {onKeep ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 shrink-0 px-3"
            disabled={busy}
            aria-label={`Keep what's on file for ${rowLabel}, ${onFile}`}
            onClick={() => onKeep(choice.fieldKey)}
          >
            Keep
          </Button>
        ) : null}
      </div>
    </div>
  )
}

/** What's on file, as one tap target: black text with a thin grey underline; empty reads Not recorded. */
function InterviewValueLink({
  rowLabel,
  parts,
  emptyText = NOT_RECORDED,
  onEdit,
  className,
}: {
  rowLabel: string
  parts: readonly InterviewValuePart[]
  emptyText?: string
  onEdit?: () => void
  className?: string
}) {
  const content =
    parts.length === 0 ? (
      <span className={cn("italic text-muted-foreground", onEdit && valueLineClass)}>{emptyText}</span>
    ) : (
      parts.map((part, index) =>
        part.kind === "client" ? (
          <span key={`${index}-${part.fieldKey}`} className={cn("px-2 py-1", statusColours.client.soft)}>
            <span className={cn(onEdit && valueLineClass)}>Client: {part.text}</span>
          </span>
        ) : (
          <span key={`${index}-${part.text}`} className={cn("whitespace-pre-line break-words", onEdit && valueLineClass)}>
            <FactText text={part.text} />
          </span>
        )
      )
    )
  const classes = cn("flex min-h-11 flex-col justify-center gap-0.5 text-left text-sm text-foreground", className)
  if (!onEdit) return <div className={classes}>{content}</div>
  const valueText = parts.length > 0 ? valuePartsText(parts) : emptyText === NOT_RECORDED ? "" : emptyText
  return (
    <button
      type="button"
      className={cn(classes, "w-full rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
      aria-label={editValueAriaLabel(rowLabel, valueText)}
      onClick={onEdit}
    >
      {content}
    </button>
  )
}

/** "Label: Not recorded" reads as missing, not as a fact. */
function FactText({ text }: { text: string }) {
  const trimmed = text.trim()
  if (trimmed.endsWith(`: ${NOT_RECORDED}`)) {
    return (
      <>
        {trimmed.slice(0, -NOT_RECORDED.length)}
        <span className="italic text-muted-foreground">{NOT_RECORDED}</span>
      </>
    )
  }
  return <>{text}</>
}
