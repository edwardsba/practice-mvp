import type { IntakeInterviewPayload } from "@/lib/intake-interview/types"
import { emptyPayload } from "@/lib/intake-interview/defaults"
import { sanitizePayload } from "@/lib/intake-interview/sanitize"

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Accept a JSON payload from the form. Unknown/missing keys fall back to
 * empty defaults so a future self-report source can populate the same
 * shape without a parser rewrite.
 */
export function parseIntakeInterviewFormData(
  formData: FormData
): IntakeInterviewPayload {
  const interviewDate = String(formData.get("interview_date") ?? "").trim()
  const raw = String(formData.get("payload_json") ?? "")
  let parsed: unknown = {}
  try {
    parsed = raw ? JSON.parse(raw) : {}
  } catch {
    parsed = {}
  }

  const base = emptyPayload(interviewDate)
  if (!isObject(parsed)) {
    return sanitizePayload(base)
  }

  const merged: IntakeInterviewPayload = {
    ...base,
    ...(parsed as Partial<IntakeInterviewPayload>),
    interviewDate:
      interviewDate ||
      (typeof parsed.interviewDate === "string" ? parsed.interviewDate : ""),
    identity: { ...base.identity, ...(isObject(parsed.identity) ? parsed.identity : {}) },
    familyOfOriginRoster: {
      ...base.familyOfOriginRoster,
      ...(isObject(parsed.familyOfOriginRoster) ? parsed.familyOfOriginRoster : {}),
    },
    partnersChildrenRoster: {
      ...base.partnersChildrenRoster,
      childrenByPartnerId: {
        ...base.partnersChildrenRoster.childrenByPartnerId,
        ...(isObject(parsed.partnersChildrenRoster) &&
        isObject(parsed.partnersChildrenRoster.childrenByPartnerId)
          ? (parsed.partnersChildrenRoster.childrenByPartnerId as IntakeInterviewPayload["partnersChildrenRoster"]["childrenByPartnerId"])
          : {}),
      },
      ...(isObject(parsed.partnersChildrenRoster)
        ? {
            currentPartnerCount:
              (parsed.partnersChildrenRoster.currentPartnerCount as number | null) ??
              null,
            priorPartnerCount:
              (parsed.partnersChildrenRoster.priorPartnerCount as number | null) ??
              null,
            unlinkedChildCount:
              (parsed.partnersChildrenRoster.unlinkedChildCount as number | null) ??
              null,
          }
        : {}),
    },
    familyHistory: {
      ...base.familyHistory,
      ...(isObject(parsed.familyHistory) ? parsed.familyHistory : {}),
    },
    relationships: Array.isArray(parsed.relationships)
      ? (parsed.relationships as IntakeInterviewPayload["relationships"])
      : [],
    events: Array.isArray(parsed.events)
      ? (parsed.events as IntakeInterviewPayload["events"])
      : [],
    livingSituation: {
      ...base.livingSituation,
      ...(isObject(parsed.livingSituation) ? parsed.livingSituation : {}),
    },
    education: {
      ...base.education,
      educationalEvents: [],
      ...(isObject(parsed.education) ? parsed.education : {}),
    },
    occupation: {
      ...base.occupation,
      ...(isObject(parsed.occupation) ? parsed.occupation : {}),
      currentJob: {
        ...base.occupation.currentJob,
        ...(isObject(parsed.occupation) && isObject(parsed.occupation.currentJob)
          ? parsed.occupation.currentJob
          : {}),
      },
      previousJobs:
        isObject(parsed.occupation) && Array.isArray(parsed.occupation.previousJobs)
          ? (parsed.occupation.previousJobs as IntakeInterviewPayload["occupation"]["previousJobs"])
          : [],
    },
    financial: {
      ...base.financial,
      ...(isObject(parsed.financial) ? parsed.financial : {}),
    },
    socialSupport: {
      ...base.socialSupport,
      ...(isObject(parsed.socialSupport) ? parsed.socialSupport : {}),
    },
  }

  return sanitizePayload(merged)
}
