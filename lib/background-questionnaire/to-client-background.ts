import { BACKGROUND_PARTS } from "@/lib/background-questionnaire/questions"
import type { HistoryQuestionKey } from "@/lib/client-background/interview-history"
import type {
  BackgroundAnswers,
  BackgroundPartKey,
  HousingSecurityValue,
  HousingTypeValue,
} from "@/lib/background-questionnaire/types"
import {
  EMPLOYED_WORK_STATUSES,
  NECESSITY_KEYS,
  emptyNecessities,
  type ClientRelationshipStatus,
  type ClientRelationshipStatusValue,
  type LivesWith,
  type NecessityAccess,
  type NecessityKey,
  type StressorKey,
  type WorkStatus,
} from "@/lib/client-background/types"

/**
 * One client answer the interview can show.
 * `label` is the text after "Client: ".
 * `apply` is what Use writes. Prompt-only answers omit it.
 */
export type AppliedAnswer<T> = {
  label: string
  apply: T
}

export type YesNoDetailApply = {
  value: boolean
  detail: string
}

export type ClientBackgroundSuggestions = {
  identity: {
    sex?: AppliedAnswer<string>
    genderIdentity?: AppliedAnswer<string>
    pronouns?: AppliedAnswer<string>
    raceEthnicity?: AppliedAnswer<string>
    religion?: AppliedAnswer<string>
    primaryLanguage?: AppliedAnswer<string>
    disability?: AppliedAnswer<YesNoDetailApply>
  }
  education: {
    level?: AppliedAnswer<string>
    fieldOfStudy?: AppliedAnswer<string>
    currentlyStudying?: AppliedAnswer<YesNoDetailApply>
    disruption?: AppliedAnswer<YesNoDetailApply>
  }
  occupation: {
    workStatus?: AppliedAnswer<{ workStatus: WorkStatus; workStatusOther: string }>
    role?: AppliedAnswer<string>
    employer?: AppliedAnswer<string>
    previousJob?: AppliedAnswer<{ role: string; employer: string }>
    necessities?: AppliedAnswer<NecessityAccess>
  }
  relationshipStatus?: AppliedAnswer<ClientRelationshipStatusValue>
  numberOfChildren?: { label: string; count: number }
  living: {
    housingType?: AppliedAnswer<string>
    livesWith?: AppliedAnswer<{ livesWith: LivesWith; livesWithOther: string }>
    housingStability?: AppliedAnswer<string>
  }
  history: Partial<Record<HistoryQuestionKey, AppliedAnswer<"yes" | "no">>>
  medication: {
    currentlyTaking?: AppliedAnswer<"yes" | "no">
    previouslyTaken?: AppliedAnswer<"yes" | "no">
  }
  stressors: Partial<Record<StressorKey, AppliedAnswer<"yes" | "no">>> & {
    mainReason?: AppliedAnswer<string>
  }
}

const HOUSING_TYPE_APPLY: Record<HousingTypeValue, string> = {
  own_home: "Own home",
  private_rental: "Private rental",
  social_housing: "Social or community housing",
  parents_home: "Parent's home",
  shared_housing: "Shared housing",
  temporary_housing: "Temporary housing",
  other: "Other",
}

const HOUSING_SECURITY_APPLY: Record<HousingSecurityValue, string> = {
  secure: "Stable",
  some_concerns: "Some concern",
  at_risk: "Unstable",
}

const STRESSOR_TARGETS: { source: keyof BackgroundAnswers["stressors"]; target: StressorKey }[] = [
  { source: "family", target: "family" },
  { source: "socialLife", target: "socialLife" },
  { source: "intimateRelationships", target: "intimateRelationships" },
  { source: "workOrStudy", target: "workStudy" },
  { source: "financial", target: "financial" },
  { source: "yourHealth", target: "ownHealth" },
  { source: "healthOfSignificantOthers", target: "othersHealth" },
  { source: "lossOfLovedOne", target: "lossOfLovedOne" },
  { source: "legalMatters", target: "legalPoliceAccidents" },
]

function optionLabel(part: BackgroundPartKey, field: string, value: string): string {
  const question = BACKGROUND_PARTS.find((item) => item.key === part)?.questions.find(
    (item) => item.field === field
  )
  return question?.options?.find((option) => option.value === value)?.label ?? value
}

function textAnswer(value: string): AppliedAnswer<string> | undefined {
  const text = value.trim()
  if (!text) return undefined
  return { label: text, apply: text }
}

function yesNo(value: boolean | null): AppliedAnswer<"yes" | "no"> | undefined {
  if (value === true) return { label: "Yes", apply: "yes" }
  if (value === false) return { label: "No", apply: "no" }
  return undefined
}

function yesNoDetail(value: boolean | null, detail: string): AppliedAnswer<YesNoDetailApply> | undefined {
  if (value === true) {
    const text = detail.trim()
    return {
      label: text ? `Yes — ${text}` : "Yes",
      apply: { value: true, detail: text },
    }
  }
  if (value === false) return { label: "No", apply: { value: false, detail: "" } }
  return undefined
}

export function childrenSelfReportLabel(count: number): string {
  if (count === 0) return "no children"
  if (count === 1) return "1 child"
  return `${count} children (including step-children)`
}

function employed(status: WorkStatus | null): status is WorkStatus {
  return status !== null && (EMPLOYED_WORK_STATUSES as readonly string[]).includes(status)
}

export function backgroundAnswersToClientBackground(
  answers: BackgroundAnswers
): ClientBackgroundSuggestions {
  const about = answers.aboutYou
  const study = answers.studyWork
  const home = answers.familyHome
  const treatment = answers.treatmentHistory
  const stressors = answers.stressors

  const identity: ClientBackgroundSuggestions["identity"] = {}
  const sex = textAnswer(about.sex ?? "")
  if (sex) identity.sex = sex
  const genderIdentity = textAnswer(about.genderIdentity)
  if (genderIdentity) identity.genderIdentity = genderIdentity
  const pronouns = textAnswer(about.pronouns)
  if (pronouns) identity.pronouns = pronouns
  const raceEthnicity = textAnswer(about.raceEthnicity)
  if (raceEthnicity) identity.raceEthnicity = raceEthnicity
  const religion = textAnswer(about.religion)
  if (religion) identity.religion = religion
  const primaryLanguage = textAnswer(about.primaryLanguage)
  if (primaryLanguage) identity.primaryLanguage = primaryLanguage
  const disability = yesNoDetail(about.disability, about.disabilityDetail)
  if (disability) identity.disability = disability

  const education: ClientBackgroundSuggestions["education"] = {}
  if (study.level) {
    education.level = { label: optionLabel("studyWork", "level", study.level), apply: study.level }
  }
  const fieldOfStudy = textAnswer(study.fieldOfStudy)
  if (fieldOfStudy) education.fieldOfStudy = fieldOfStudy
  const currentlyStudying = yesNoDetail(study.currentlyStudying, study.currentlyStudyingDetail)
  if (currentlyStudying) education.currentlyStudying = currentlyStudying
  const disruption = yesNoDetail(study.disruption, study.disruptionDetail)
  if (disruption) education.disruption = disruption

  const occupation: ClientBackgroundSuggestions["occupation"] = {}
  if (study.workStatus) {
    const other = study.workStatus === "other" ? study.workStatusOther.trim() : ""
    occupation.workStatus = {
      label:
        study.workStatus === "other"
          ? other || "Other"
          : optionLabel("studyWork", "workStatus", study.workStatus),
      apply: { workStatus: study.workStatus, workStatusOther: other },
    }
  }
  if (employed(study.workStatus)) {
    const role = textAnswer(study.role)
    if (role) occupation.role = role
    const employer = textAnswer(study.employer)
    if (employer) occupation.employer = employer
  }
  if (study.workStatus === "unemployed") {
    const role = study.recentJobRole.trim()
    const employer = study.recentJobEmployer.trim()
    if (role || employer) {
      occupation.previousJob = {
        label: [role, employer].filter(Boolean).join(" · "),
        apply: { role, employer },
      }
    }
  }
  if (study.necessities.length > 0) {
    const picked = new Set<NecessityKey>(study.necessities)
    const necessities = emptyNecessities()
    for (const key of NECESSITY_KEYS) necessities[key] = picked.has(key)
    occupation.necessities = {
      label: study.necessities.map((key) => optionLabel("studyWork", "necessities", key)).join(", "),
      apply: necessities,
    }
  }

  let relationshipStatus: ClientBackgroundSuggestions["relationshipStatus"]
  if (home.relationshipStatus) {
    const other = home.relationshipStatus === "other" ? home.relationshipStatusOther.trim() : ""
    relationshipStatus = {
      label:
        home.relationshipStatus === "other" && other
          ? other
          : optionLabel("familyHome", "relationshipStatus", home.relationshipStatus),
      apply: {
        relationshipStatus: home.relationshipStatus as ClientRelationshipStatus,
        relationshipStatusOther: other,
      },
    }
  }

  const numberOfChildren =
    home.numberOfChildren == null
      ? undefined
      : { label: childrenSelfReportLabel(home.numberOfChildren), count: home.numberOfChildren }

  const living: ClientBackgroundSuggestions["living"] = {}
  if (home.housingType) {
    const other = home.housingType === "other" ? home.housingTypeOther.trim() : ""
    living.housingType = {
      label: other || optionLabel("familyHome", "housingType", home.housingType),
      apply: HOUSING_TYPE_APPLY[home.housingType],
    }
  }
  if (home.livesWith) {
    const other = home.livesWith === "other" ? home.livesWithOther.trim() : ""
    living.livesWith = {
      label:
        home.livesWith === "other" && other
          ? other
          : optionLabel("familyHome", "livesWith", home.livesWith),
      apply: { livesWith: home.livesWith, livesWithOther: other },
    }
  }
  if (home.housingSecurity) {
    living.housingStability = {
      label: optionLabel("familyHome", "housingSecurity", home.housingSecurity),
      apply: HOUSING_SECURITY_APPLY[home.housingSecurity],
    }
  }

  const history: ClientBackgroundSuggestions["history"] = {}
  const hospital = yesNo(treatment.hospitalForEmotionalProblem)
  if (hospital) history.psychiatric_admission = hospital
  const therapy = yesNo(treatment.therapyForEmotionalIssues)
  if (therapy) history.previous_therapy = therapy
  const familyEmotional = yesNo(treatment.familyEmotionalProblem)
  if (familyEmotional) history.family_emotional_problems = familyEmotional
  const familySubstances = yesNo(treatment.familyAlcoholOrDrugs)
  if (familySubstances) history.family_substance_use = familySubstances
  const familyHospital = yesNo(treatment.familyHospitalForEmotionalOrSubstance)
  if (familyHospital) history.family_psychiatric_admission = familyHospital

  const medication: ClientBackgroundSuggestions["medication"] = {}
  const currentlyTaking = yesNo(treatment.currentMedication)
  if (currentlyTaking) medication.currentlyTaking = currentlyTaking
  const previouslyTaken = yesNo(treatment.everTakenMedication)
  if (previouslyTaken) medication.previouslyTaken = previouslyTaken

  const stressorSuggestions: ClientBackgroundSuggestions["stressors"] = {}
  for (const item of STRESSOR_TARGETS) {
    const value = stressors[item.source]
    if (typeof value === "string") continue
    const answer = yesNo(value)
    if (answer) stressorSuggestions[item.target] = answer
  }
  const mainReason = textAnswer(stressors.mainReason)
  if (mainReason) stressorSuggestions.mainReason = mainReason

  return {
    identity,
    education,
    occupation,
    relationshipStatus,
    numberOfChildren,
    living,
    history,
    medication,
    stressors: stressorSuggestions,
  }
}
