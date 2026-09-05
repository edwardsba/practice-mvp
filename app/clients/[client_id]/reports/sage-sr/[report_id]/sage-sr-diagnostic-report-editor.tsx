"use client"

import Link from "next/link"
import { useActionState, useState, type ReactNode } from "react"

import { EditableParagraph } from "@/components/report/editable-paragraph"
import { Button } from "@/components/ui/button"
import {
  finaliseSageDiagnosticReportAction,
  type FinaliseSageDiagnosticReportState,
} from "@/app/clients/[client_id]/reports/sage-sr-diagnostic-report-actions"
import type { SageSrDiagnosticReportContent } from "@/lib/assessment-summary/load-sage-sr-diagnostic-report"

const BACKGROUND_FIELD_LABELS = {
  opening: "Opening",
  background: "Background",
  adverseChildhoodEvents: "Adverse childhood events",
  currentFunctioning: "Current functioning",
  safetyAndStability: "Safety and stability",
  treatmentEngagement: "Treatment engagement",
} as const

function FieldCaption({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-medium tracking-wide text-muted-foreground/80 uppercase">
      {children}
    </p>
  )
}

/**
 * Editable draft view for a SAGE-SR Diagnostic Report. Every prose field the
 * read-only view renders is editable via EditableParagraph (not Tiptap) — the
 * content is already structured as discrete paragraphs, and Ben's instruction
 * was metadata-only / no letter style. Only fields present in the generated
 * content are offered; null sections stay omitted rather than becoming blank
 * authoring slots.
 *
 * There is no separate "save draft without finalising" step: edits live in
 * client state until "Save as PDF" submits the whole object as edited_content_json
 * to finaliseSageDiagnosticReportAction.
 */
export function SageSrDiagnosticReportEditor({
  clientId,
  reportId,
  title,
  initialContent,
  cancelHref,
}: {
  clientId: string
  reportId: string
  title: string
  initialContent: SageSrDiagnosticReportContent
  cancelHref: string
}) {
  const [content, setContent] = useState<SageSrDiagnosticReportContent>(initialContent)
  const [state, formAction, pending] = useActionState(
    finaliseSageDiagnosticReportAction.bind(null, clientId, reportId),
    {} as FinaliseSageDiagnosticReportState
  )

  return (
    <form action={formAction} className="space-y-6">
      <input
        type="hidden"
        name="edited_content_json"
        value={JSON.stringify(content)}
      />

      <div className="rounded-xl border bg-white p-8 shadow-sm">
        <article className="report-document mx-auto max-w-3xl space-y-6 bg-white text-foreground">
          <h2 className="text-lg font-semibold">{title}</h2>
          {initialContent.introduction !== null ? (
            <div>
              <FieldCaption>Introduction</FieldCaption>
              <EditableParagraph
                value={content.introduction ?? ""}
                onChange={(introduction) =>
                  setContent((current) => ({ ...current, introduction }))
                }
              />
            </div>
          ) : null}
          <div>
            <FieldCaption>Exclusion clause</FieldCaption>
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
              <EditableParagraph
                value={content.exclusionClause}
                onChange={(exclusionClause) =>
                  setContent((current) => ({ ...current, exclusionClause }))
                }
                className="text-amber-950"
              />
            </div>
          </div>
          {content.background ? (
            <div className="space-y-2">
              <h3 className="font-medium">Background</h3>
              {(
                Object.keys(BACKGROUND_FIELD_LABELS) as Array<
                  keyof typeof BACKGROUND_FIELD_LABELS
                >
              ).map((field) => {
                if (initialContent.background?.[field] == null) return null
                return (
                  <div key={field}>
                    <FieldCaption>{BACKGROUND_FIELD_LABELS[field]}</FieldCaption>
                    <EditableParagraph
                      value={content.background?.[field] ?? ""}
                      onChange={(next) =>
                        setContent((current) => ({
                          ...current,
                          background: current.background
                            ? { ...current.background, [field]: next }
                            : current.background,
                        }))
                      }
                      className="text-muted-foreground"
                    />
                  </div>
                )
              })}
            </div>
          ) : null}
          <div className="space-y-2">
            <h3 className="font-medium">Core</h3>
            {initialContent.core.alertsSentence ? (
              <div>
                <FieldCaption>Alerts</FieldCaption>
                <EditableParagraph
                  value={content.core.alertsSentence ?? ""}
                  onChange={(alertsSentence) =>
                    setContent((current) => ({
                      ...current,
                      core: { ...current.core, alertsSentence },
                    }))
                  }
                  className="font-medium text-destructive"
                />
              </div>
            ) : null}
            {content.core.paragraphs.map((paragraph, index) => (
              <div key={paragraph.diagnosis}>
                <FieldCaption>{paragraph.diagnosis}</FieldCaption>
                <EditableParagraph
                  value={paragraph.paragraph}
                  onChange={(next) =>
                    setContent((current) => ({
                      ...current,
                      core: {
                        ...current.core,
                        paragraphs: current.core.paragraphs.map((item, i) =>
                          i === index ? { ...item, paragraph: next } : item
                        ),
                      },
                    }))
                  }
                  className="text-muted-foreground"
                />
              </div>
            ))}
            {initialContent.core.furtherEvaluationSentence ? (
              <div>
                <FieldCaption>Further evaluation</FieldCaption>
                <EditableParagraph
                  value={content.core.furtherEvaluationSentence ?? ""}
                  onChange={(furtherEvaluationSentence) =>
                    setContent((current) => ({
                      ...current,
                      core: { ...current.core, furtherEvaluationSentence },
                    }))
                  }
                  className="text-muted-foreground"
                />
              </div>
            ) : null}
            {initialContent.core.absentOrMinimalSentence ? (
              <div>
                <FieldCaption>Absent or minimal</FieldCaption>
                <EditableParagraph
                  value={content.core.absentOrMinimalSentence ?? ""}
                  onChange={(absentOrMinimalSentence) =>
                    setContent((current) => ({
                      ...current,
                      core: { ...current.core, absentOrMinimalSentence },
                    }))
                  }
                  className="text-muted-foreground"
                />
              </div>
            ) : null}
          </div>
          {content.personality ? (
            <div className="space-y-2">
              <h3 className="font-medium">Personality</h3>
              {content.personality.paragraphs.map((paragraph, index) => (
                <div key={paragraph.disorder}>
                  <FieldCaption>{paragraph.disorder}</FieldCaption>
                  <EditableParagraph
                    value={paragraph.paragraph}
                    onChange={(next) =>
                      setContent((current) => ({
                        ...current,
                        personality: current.personality
                          ? {
                              ...current.personality,
                              paragraphs: current.personality.paragraphs.map(
                                (item, i) =>
                                  i === index
                                    ? { ...item, paragraph: next }
                                    : item
                              ),
                            }
                          : current.personality,
                      }))
                    }
                    className="text-muted-foreground"
                  />
                </div>
              ))}
              {initialContent.personality?.belowThresholdSentence ? (
                <div>
                  <FieldCaption>Below threshold</FieldCaption>
                  <EditableParagraph
                    value={content.personality.belowThresholdSentence ?? ""}
                    onChange={(belowThresholdSentence) =>
                      setContent((current) => ({
                        ...current,
                        personality: current.personality
                          ? { ...current.personality, belowThresholdSentence }
                          : current.personality,
                      }))
                    }
                    className="text-muted-foreground"
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </article>
      </div>

      {state.error ? (
        <p className="no-print text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="no-print flex flex-wrap gap-3">
        <Button type="button" variant="outline" asChild>
          <Link href={cancelHref}>Cancel</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save as PDF"}
        </Button>
      </div>
    </form>
  )
}
