import {
  BACKGROUND_PARTS,
  writeBackgroundField,
  type BackgroundQuestionKind,
} from "@/lib/background-questionnaire/questions"
import type {
  BackgroundAnswers,
  BackgroundPartKey,
} from "@/lib/background-questionnaire/types"

export function emptyBackgroundAnswers(): BackgroundAnswers {
  return {
    version: 1,
    aboutYou: {
      sex: null,
      genderIdentity: "",
      pronouns: "",
      raceEthnicity: "",
      religion: "",
      primaryLanguage: "",
      disability: null,
      disabilityDetail: "",
    },
    studyWork: {
      level: null,
      fieldOfStudy: "",
      currentlyStudying: null,
      currentlyStudyingDetail: "",
      disruption: null,
      disruptionDetail: "",
      workStatus: null,
      workStatusOther: "",
      role: "",
      employer: "",
      recentJobRole: "",
      recentJobEmployer: "",
      necessities: [],
    },
    familyHome: {
      relationshipStatus: null,
      relationshipStatusOther: "",
      numberOfChildren: null,
      housingType: null,
      housingTypeOther: "",
      livesWith: null,
      livesWithOther: "",
      housingSecurity: null,
    },
    treatmentHistory: {
      hospitalForEmotionalProblem: null,
      therapyForEmotionalIssues: null,
      currentMedication: null,
      everTakenMedication: null,
      familyEmotionalProblem: null,
      familyAlcoholOrDrugs: null,
      familyHospitalForEmotionalOrSubstance: null,
    },
    stressors: {
      family: null,
      socialLife: null,
      intimateRelationships: null,
      workOrStudy: null,
      financial: null,
      yourHealth: null,
      healthOfSignificantOthers: null,
      lossOfLovedOne: null,
      legalMatters: null,
      mainReason: "",
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readRaw(input: unknown, part: BackgroundPartKey, field: string): unknown {
  if (!isRecord(input)) return undefined
  const section = input[part]
  if (!isRecord(section)) return undefined
  return section[field]
}

function clampWholeNumber(value: unknown, min: number, max: number): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value.trim())
        : Number.NaN
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return null
  return Math.min(max, Math.max(min, parsed))
}

function normalizeField(
  kind: BackgroundQuestionKind,
  value: unknown,
  options: { value: string }[] | undefined,
  min?: number,
  max?: number
): unknown {
  if (kind === "yesno") {
    return value === true || value === false ? value : null
  }
  if (kind === "text" || kind === "textarea") {
    return typeof value === "string" ? value.trim() : ""
  }
  if (kind === "number") {
    return clampWholeNumber(value, min ?? 0, max ?? 20)
  }
  if (kind === "radio") {
    if (typeof value !== "string") return null
    return options?.some((option) => option.value === value) ? value : null
  }
  if (!Array.isArray(value)) return []
  const allowed = new Set(options?.map((option) => option.value) ?? [])
  const picked = new Set<string>()
  for (const item of value) {
    if (typeof item === "string" && allowed.has(item)) picked.add(item)
  }
  return (options ?? [])
    .map((option) => option.value)
    .filter((option) => picked.has(option))
}

export function clearUntriggeredBackgroundAnswers(
  answers: BackgroundAnswers
): BackgroundAnswers {
  let next = answers
  for (const part of BACKGROUND_PARTS) {
    for (const question of part.questions) {
      for (const conditional of question.conditionals ?? []) {
        if (conditional.visible(next)) continue
        const cleared = conditional.kind === "yesno" ? null : ""
        next = writeBackgroundField(next, part.key, conditional.field, cleared)
      }
    }
  }
  return next
}

export function sanitizeBackgroundAnswers(input: unknown): BackgroundAnswers {
  let next = emptyBackgroundAnswers()
  for (const part of BACKGROUND_PARTS) {
    for (const question of part.questions) {
      next = writeBackgroundField(
        next,
        part.key,
        question.field,
        normalizeField(
          question.kind,
          readRaw(input, part.key, question.field),
          question.options,
          question.min,
          question.max
        )
      )
      for (const conditional of question.conditionals ?? []) {
        next = writeBackgroundField(
          next,
          part.key,
          conditional.field,
          normalizeField(conditional.kind, readRaw(input, part.key, conditional.field), undefined)
        )
      }
    }
  }
  return clearUntriggeredBackgroundAnswers(next)
}
