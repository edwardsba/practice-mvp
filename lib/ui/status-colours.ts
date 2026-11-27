/**
 * Shared status colours — one meaning each.
 * See AGENTS.md "Colours: one meaning each."
 *
 * All Tailwind palette classes for these meanings live here so the rest of
 * the app imports these strings instead of writing amber-/emerald-/etc.
 *
 * Contrast (approx WCAG AA for small text, ≥4.5:1):
 * | Name      | Light text on bg                         | Dark text on bg                          |
 * |-----------|------------------------------------------|------------------------------------------|
 * | neutral   | neutral-800 on neutral-50 ≈ 14.5:1       | neutral-100 on neutral-900 ≈ 14.5:1      |
 * | attention | amber-950 on amber-50 ≈ 12.6:1           | amber-100 on amber-950 ≈ 11.8:1          |
 * | done      | emerald-900 on emerald-50 ≈ 8.6:1        | emerald-100 on emerald-950 ≈ 10.4:1      |
 * | problem   | red-900 on red-50 ≈ 8.3:1                | red-100 on red-950 ≈ 10.1:1              |
 * | client    | blue-900 on blue-50 ≈ 9.5:1              | blue-100 on blue-950 ≈ 10.8:1            |
 * Neutral vs attention also differ in lightness (neutral-800 vs amber-950 text;
 * cool grey vs warm amber backgrounds).
 */

export type StatusColourName = "neutral" | "attention" | "done" | "problem" | "client"

export type StatusColourStyles = {
  /** Soft notice / tag box: background, border, text. */
  soft: string
  /** Compact pill or inline badge. */
  pill: string
  /** Progress chip / number badge. */
  chip: string
  /** Badge component variant body. */
  badge: string
  /** Text-only tone (status pills, inline labels). */
  text: string
}

/**
 * Full static class strings (required for Tailwind 4 detection).
 * Do not build these with string concatenation of palette names.
 */
export const statusColours: Record<StatusColourName, StatusColourStyles> = {
  neutral: {
    soft: "rounded-md border border-neutral-300 bg-neutral-50 text-neutral-800 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100",
    pill: "rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100",
    chip: "border-neutral-300 bg-neutral-50 text-neutral-800 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100",
    badge:
      "border-neutral-300 bg-neutral-50 text-neutral-800 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100",
    text: "text-neutral-800 dark:text-neutral-200",
  },
  attention: {
    soft: "rounded-md border border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100",
    pill: "rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-950 dark:bg-amber-900 dark:text-amber-100",
    chip: "border-amber-400 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100",
    badge:
      "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100",
    text: "text-amber-950 dark:text-amber-100",
  },
  done: {
    soft: "rounded-md border border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100",
    pill: "inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100",
    chip: "border-emerald-600 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100",
    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100",
    text: "text-emerald-900 dark:text-emerald-100",
  },
  problem: {
    soft: "rounded-md border border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-100",
    pill: "rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-900 dark:bg-red-900 dark:text-red-100",
    chip: "border-red-500 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-100",
    badge:
      "border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100",
    text: "text-red-900 dark:text-red-100",
  },
  client: {
    soft: "rounded-md border border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-100",
    pill: "rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-900 dark:bg-blue-900 dark:text-blue-100",
    chip: "border-blue-400 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-100",
    badge:
      "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100",
    text: "text-blue-900 dark:text-blue-100",
  },
}

/** Client "Use" control on self-report suggestion rows. */
export const clientUseButtonClass =
  "min-h-11 shrink-0 rounded-md bg-blue-700 px-3 text-sm font-medium text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"

/** Self-report suggestion row shell (Client: … + Use). */
export const clientSuggestionRowClass =
  "flex items-center justify-between gap-2 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 dark:border-blue-700 dark:bg-blue-950"

/** Border-only problem emphasis (e.g. alerts card). */
export const problemBorderClass = "border-red-300 dark:border-red-700"

/** Compact funding / status badge shells. */
export const attentionStatusBadgeClass =
  "inline-flex rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"

export const doneStatusBadgeClass =
  "inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100"

/** Unsaved draft notice under assessment progress chips. */
export const attentionSaveBannerClass =
  "border-b-2 border-amber-400 pb-2 text-sm text-amber-950 dark:border-amber-600 dark:text-amber-100"

/** Inline success / saved confirmation line. */
export const doneSuccessMessageClass =
  "text-sm text-emerald-900 dark:text-emerald-100"

/** Pre-filled inline tag (assessment / interview). */
export const attentionPrefilledTagClass =
  "ml-2 align-middle text-xs font-normal text-amber-950 dark:text-amber-100"
