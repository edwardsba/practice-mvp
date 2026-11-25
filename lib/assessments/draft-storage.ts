import type { FormAnswers } from "@/lib/assessments/form-rules"

export type AssessmentDraft = {
  answers: FormAnswers
  assessmentDate: string
  savedAt: string
}

function draftKey(params: {
  clientId: string
  assessmentCode: string
  instanceId?: string | null
}): string {
  const instance = params.instanceId?.trim() || "new"
  return `assessment-draft:${params.clientId}:${params.assessmentCode}:${instance}`
}

export function readAssessmentDraft(params: {
  clientId: string
  assessmentCode: string
  instanceId?: string | null
}): AssessmentDraft | null {
  try {
    if (typeof window === "undefined") return null
    const raw = window.localStorage.getItem(draftKey(params))
    if (!raw) return null
    const parsed = JSON.parse(raw) as AssessmentDraft
    if (!parsed || typeof parsed !== "object") return null
    if (!parsed.answers || typeof parsed.answers !== "object") return null
    if (typeof parsed.assessmentDate !== "string") return null
    return parsed
  } catch {
    return null
  }
}

export function writeAssessmentDraft(params: {
  clientId: string
  assessmentCode: string
  instanceId?: string | null
  draft: AssessmentDraft
}): void {
  try {
    if (typeof window === "undefined") return
    window.localStorage.setItem(draftKey(params), JSON.stringify(params.draft))
  } catch {
    // ignore quota / private mode
  }
}

export function clearAssessmentDraft(params: {
  clientId: string
  assessmentCode: string
  instanceId?: string | null
}): void {
  try {
    if (typeof window === "undefined") return
    window.localStorage.removeItem(draftKey(params))
  } catch {
    // ignore
  }
}
