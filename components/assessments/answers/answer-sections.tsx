"use client"

import { useState } from "react"

import type {
  AnswerDisplay,
  AnswerSection,
} from "@/lib/assessments/answer-rows"
import { cn } from "@/lib/utils"

function AnswerCell({ answer }: { answer: AnswerDisplay }) {
  if (answer.kind === "list") {
    return (
      <ul className="list-disc space-y-1 pl-4 text-sm font-medium">
        {answer.values.map((value, index) => (
          <li key={`${index}-${value}`} className="whitespace-pre-wrap">
            {value}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <p className="text-sm font-medium whitespace-pre-wrap">{answer.value}</p>
  )
}

export function AnswerSections({ sections }: { sections: AnswerSection[] }) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(
        sections.filter((s) => !s.skipped).map((s) => [s.groupLabel, true])
      )
  )

  function toggle(groupLabel: string) {
    setOpenSections((prev) => ({
      ...prev,
      [groupLabel]: !prev[groupLabel],
    }))
  }

  return (
    <div className="space-y-3">
      {sections.map((section) => {
        const open = !section.skipped && Boolean(openSections[section.groupLabel])
        return (
          <section
            key={section.groupLabel}
            className="rounded-lg border"
          >
            <h2>
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
                aria-expanded={section.skipped ? false : open}
                disabled={section.skipped}
                onClick={() => {
                  if (!section.skipped) toggle(section.groupLabel)
                }}
              >
                <span className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border text-sm font-semibold">
                  {section.letter}
                </span>
                <span className="flex-1 text-sm font-semibold">
                  {section.title}
                </span>
                {section.skipped ? (
                  <span className="text-xs text-muted-foreground">Not asked</span>
                ) : (
                  <span className="text-muted-foreground" aria-hidden>
                    {open ? "▾" : "▸"}
                  </span>
                )}
              </button>
            </h2>
            {open ? (
              <div className="border-t">
                <table className="w-full table-fixed border-collapse text-sm">
                  <tbody>
                    {section.rows.map((row, index) => {
                      if (row.kind === "subheading") {
                        return (
                          <tr key={`sub-${section.letter}-${index}-${row.label}`}>
                            <td
                              colSpan={2}
                              className="px-4 pt-4 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
                            >
                              {row.label}
                            </td>
                          </tr>
                        )
                      }

                      return (
                        <tr
                          key={row.elementKey}
                          className="border-t border-border/60"
                        >
                          <td
                            className={cn(
                              "w-[58%] align-top px-4 py-2.5 text-muted-foreground",
                              row.depth > 0 && "border-l-2 border-border/70",
                              row.depth === 1 && "pl-7",
                              row.depth >= 2 && "pl-10"
                            )}
                          >
                            {row.question}
                          </td>
                          <td className="w-[42%] align-top px-4 py-2.5">
                            <AnswerCell answer={row.answer} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        )
      })}
    </div>
  )
}
