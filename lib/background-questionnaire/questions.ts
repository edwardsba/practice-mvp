import {
  EDUCATION_LEVEL_OPTIONS,
  EMPLOYED_WORK_STATUSES,
  SEX_OPTIONS,
  WORK_STATUSES,
  WORK_STATUS_LABELS,
  type ClientRelationshipStatus,
  type LivesWith,
  type NecessityKey,
} from "@/lib/client-background/types"

import {
  HOUSING_SECURITY_VALUES,
  HOUSING_TYPE_VALUES,
  type BackgroundAnswers,
  type BackgroundPartKey,
  type HousingSecurityValue,
  type HousingTypeValue,
} from "@/lib/background-questionnaire/types"

export const BACKGROUND_QUESTIONNAIRE_TITLE = "Background questionnaire"

export const BACKGROUND_QUESTIONNAIRE_INTRO =
  "These questions help your psychologist understand your background. Answer what you can. Any question can be skipped."

export const STRESSORS_LEAD =
  "Have you had any difficulties with any of the following?"

const EDUCATION_WITH_FIELD = [
  "Trade apprenticeship",
  "Certificate / diploma",
  "Bachelor degree",
  "Postgraduate",
] as const

export type BackgroundChoice = {
  label: string
  value: string
}

export type BackgroundQuestionKind =
  | "radio"
  | "yesno"
  | "text"
  | "textarea"
  | "number"
  | "checkboxes"

export type BackgroundConditional = {
  text: string
  optional?: boolean
  kind: "text" | "textarea" | "yesno"
  field: string
  visible: (answers: BackgroundAnswers) => boolean
}

export type BackgroundQuestion = {
  text: string
  optional?: boolean
  kind: BackgroundQuestionKind
  field: string
  hint?: string
  min?: number
  max?: number
  options?: BackgroundChoice[]
  sectionHeading?: string
  conditionals?: BackgroundConditional[]
}

export type BackgroundPart = {
  key: BackgroundPartKey
  name: string
  lead?: string
  questions: BackgroundQuestion[]
}

function educationChoice(label: string, value: string): BackgroundChoice {
  return { label, value }
}

const EDUCATION_CHOICES: BackgroundChoice[] = [
  educationChoice("Did not finish secondary school", "Did not complete secondary"),
  educationChoice("Secondary school", "Secondary"),
  educationChoice("Trade apprenticeship", "Trade apprenticeship"),
  educationChoice("Certificate or diploma", "Certificate / diploma"),
  educationChoice("Bachelor degree", "Bachelor degree"),
  educationChoice("Postgraduate degree", "Postgraduate"),
  educationChoice("Other", "Other"),
]

const RELATIONSHIP_CHOICES: { label: string; value: ClientRelationshipStatus }[] = [
  { label: "Single", value: "single" },
  { label: "In a relationship", value: "in_relationship_not_living_together" },
  { label: "Engaged", value: "engaged" },
  { label: "Married", value: "married" },
  { label: "De facto", value: "defacto" },
  { label: "Separated", value: "separated" },
  { label: "Divorced", value: "divorced" },
  { label: "Widowed", value: "widowed" },
  { label: "Other", value: "other" },
]

const LIVES_WITH_CHOICES: { label: string; value: LivesWith }[] = [
  { label: "Alone", value: "alone" },
  { label: "With partner", value: "with_partner" },
  { label: "With partner and children", value: "with_partner_and_children" },
  { label: "With children", value: "with_children_sole_parent" },
  { label: "With parents", value: "with_parents" },
  { label: "With other family", value: "with_other_family" },
  { label: "With flatmates or friends", value: "with_flatmates_or_friends" },
  { label: "Supported or residential accommodation", value: "supported_or_residential" },
  { label: "No fixed address", value: "no_fixed_address" },
  { label: "Other", value: "other" },
]

const HOUSING_TYPE_CHOICES: { label: string; value: HousingTypeValue }[] = [
  { label: "Own home (owned or paying off)", value: "own_home" },
  { label: "Private rental", value: "private_rental" },
  { label: "Social or community housing", value: "social_housing" },
  { label: "Parent's home", value: "parents_home" },
  { label: "Shared housing", value: "shared_housing" },
  { label: "Temporary housing", value: "temporary_housing" },
  { label: "Other", value: "other" },
]

const HOUSING_SECURITY_CHOICES: { label: string; value: HousingSecurityValue }[] = [
  { label: "Secure", value: "secure" },
  { label: "Some concerns", value: "some_concerns" },
  { label: "At risk", value: "at_risk" },
]

const NECESSITY_CHOICES: { label: string; value: NecessityKey }[] = [
  { label: "Food", value: "food" },
  { label: "Prescriptions", value: "prescriptions" },
  { label: "Transport", value: "transport" },
  { label: "Leisure", value: "leisure" },
  { label: "Phone or internet", value: "phoneInternet" },
]

function employed(answers: BackgroundAnswers) {
  const status = answers.studyWork.workStatus
  return status !== null && (EMPLOYED_WORK_STATUSES as readonly string[]).includes(status)
}

function workStatusIs(answers: BackgroundAnswers, status: string) {
  return answers.studyWork.workStatus === status
}

function levelHasField(answers: BackgroundAnswers) {
  const level = answers.studyWork.level
  return level !== null && (EDUCATION_WITH_FIELD as readonly string[]).includes(level)
}

export const BACKGROUND_PARTS: BackgroundPart[] = [
  {
    key: "aboutYou",
    name: "About you",
    questions: [
      {
        text: "What is your sex?",
        kind: "radio",
        field: "sex",
        options: SEX_OPTIONS.map((value) => ({ label: value, value })),
      },
      {
        text: "Gender, if different from your sex",
        optional: true,
        kind: "text",
        field: "genderIdentity",
        conditionals: [
          {
            text: "Pronouns",
            optional: true,
            kind: "text",
            field: "pronouns",
            visible: (answers) => answers.aboutYou.genderIdentity.trim().length > 0,
          },
        ],
      },
      {
        text: "What is your cultural or ethnic background?",
        kind: "text",
        field: "raceEthnicity",
      },
      {
        text: "What is your religion or spiritual practice, if any?",
        kind: "text",
        field: "religion",
      },
      {
        text: "What language do you mainly speak at home?",
        kind: "text",
        field: "primaryLanguage",
      },
      {
        text: "Do you have a disability?",
        kind: "yesno",
        field: "disability",
        conditionals: [
          {
            text: "Please describe",
            kind: "textarea",
            field: "disabilityDetail",
            visible: (answers) => answers.aboutYou.disability === true,
          },
        ],
      },
    ],
  },
  {
    key: "studyWork",
    name: "Study and work",
    questions: [
      {
        text: "What is the highest level of education you have completed?",
        kind: "radio",
        field: "level",
        options: EDUCATION_CHOICES,
        conditionals: [
          {
            text: "In what field or trade?",
            kind: "text",
            field: "fieldOfStudy",
            visible: levelHasField,
          },
        ],
      },
      {
        text: "Are you currently studying?",
        kind: "yesno",
        field: "currentlyStudying",
        conditionals: [
          {
            text: "What are you studying?",
            kind: "text",
            field: "currentlyStudyingDetail",
            visible: (answers) => answers.studyWork.currentlyStudying === true,
          },
        ],
      },
      {
        text: "Was your schooling or study ever interrupted?",
        kind: "yesno",
        field: "disruption",
        conditionals: [
          {
            text: "What happened?",
            kind: "textarea",
            field: "disruptionDetail",
            visible: (answers) => answers.studyWork.disruption === true,
          },
        ],
      },
      {
        text: "Which best describes your current work situation?",
        kind: "radio",
        field: "workStatus",
        options: WORK_STATUSES.map((value) => ({
          label: WORK_STATUS_LABELS[value],
          value,
        })),
        conditionals: [
          {
            text: "What is your job or role?",
            kind: "text",
            field: "role",
            visible: employed,
          },
          {
            text: "Who do you work for?",
            kind: "text",
            field: "employer",
            visible: employed,
          },
          {
            text: "What was your most recent job?",
            kind: "text",
            field: "recentJobRole",
            visible: (answers) => workStatusIs(answers, "unemployed"),
          },
          {
            text: "Who did you work for?",
            kind: "text",
            field: "recentJobEmployer",
            visible: (answers) => workStatusIs(answers, "unemployed"),
          },
          {
            text: "Please describe",
            kind: "text",
            field: "workStatusOther",
            visible: (answers) => workStatusIs(answers, "other"),
          },
        ],
      },
      {
        text: "Do you find it difficult to afford any of the following?",
        kind: "checkboxes",
        field: "necessities",
        hint: "Tick any that apply.",
        options: NECESSITY_CHOICES,
      },
    ],
  },
  {
    key: "familyHome",
    name: "Family and home",
    questions: [
      {
        text: "What is your relationship status?",
        kind: "radio",
        field: "relationshipStatus",
        options: RELATIONSHIP_CHOICES,
        conditionals: [
          {
            text: "Please describe",
            kind: "text",
            field: "relationshipStatusOther",
            visible: (answers) => answers.familyHome.relationshipStatus === "other",
          },
        ],
      },
      {
        text: "How many children do you have?",
        kind: "number",
        field: "numberOfChildren",
        hint: "Include step-children. Enter 0 if none.",
        min: 0,
        max: 20,
      },
      {
        text: "What type of home do you live in?",
        kind: "radio",
        field: "housingType",
        options: HOUSING_TYPE_CHOICES,
        conditionals: [
          {
            text: "Please describe",
            kind: "text",
            field: "housingTypeOther",
            visible: (answers) => answers.familyHome.housingType === "other",
          },
        ],
      },
      {
        text: "Who do you live with?",
        kind: "radio",
        field: "livesWith",
        options: LIVES_WITH_CHOICES,
        conditionals: [
          {
            text: "Please describe",
            kind: "text",
            field: "livesWithOther",
            visible: (answers) => answers.familyHome.livesWith === "other",
          },
        ],
      },
      {
        text: "How secure is your housing?",
        kind: "radio",
        field: "housingSecurity",
        options: HOUSING_SECURITY_CHOICES,
      },
    ],
  },
  {
    key: "treatmentHistory",
    name: "Medical treatment history",
    questions: [
      {
        text: "Have you ever attended hospital for anxiety, depression, substance use, or any other emotional problem?",
        kind: "yesno",
        field: "hospitalForEmotionalProblem",
      },
      {
        text: "Have you ever attended individual or group therapy for any emotional or personal issues?",
        kind: "yesno",
        field: "therapyForEmotionalIssues",
      },
      {
        text: "Are you currently taking any medications for anxiety, depression, or any other emotional problems?",
        kind: "yesno",
        field: "currentMedication",
        conditionals: [
          {
            text: "Have you ever taken any medications for anxiety, depression, or any other emotional problems?",
            kind: "yesno",
            field: "everTakenMedication",
            visible: (answers) => answers.treatmentHistory.currentMedication === false,
          },
        ],
      },
      {
        text: "Has anyone in your family ever had anxiety, depression, or any other emotional problem?",
        kind: "yesno",
        field: "familyEmotionalProblem",
        sectionHeading: "Family history",
      },
      {
        text: "Has anyone in your family ever had problems with alcohol or drugs?",
        kind: "yesno",
        field: "familyAlcoholOrDrugs",
      },
      {
        text: "Has anyone in your family ever attended hospital for emotional or substance use problems?",
        kind: "yesno",
        field: "familyHospitalForEmotionalOrSubstance",
      },
    ],
  },
  {
    key: "stressors",
    name: "Stressors",
    lead: STRESSORS_LEAD,
    questions: [
      { text: "Family", kind: "yesno", field: "family" },
      { text: "Social life", kind: "yesno", field: "socialLife" },
      { text: "Intimate relationships", kind: "yesno", field: "intimateRelationships" },
      { text: "Work or study", kind: "yesno", field: "workOrStudy" },
      { text: "Financial", kind: "yesno", field: "financial" },
      { text: "Your health", kind: "yesno", field: "yourHealth" },
      { text: "Health of significant others", kind: "yesno", field: "healthOfSignificantOthers" },
      { text: "Loss of a loved one", kind: "yesno", field: "lossOfLovedOne" },
      { text: "Legal matters, police or accidents", kind: "yesno", field: "legalMatters" },
      {
        text: "If you had to identify one issue, what would you say is the main reason you are here?",
        kind: "textarea",
        field: "mainReason",
      },
    ],
  },
]

export function readBackgroundField(
  answers: BackgroundAnswers,
  part: BackgroundPartKey,
  field: string
): unknown {
  const section = answers[part] as unknown as Record<string, unknown>
  return section[field]
}

export function writeBackgroundField(
  answers: BackgroundAnswers,
  part: BackgroundPartKey,
  field: string,
  value: unknown
): BackgroundAnswers {
  const section = {
    ...(answers[part] as unknown as Record<string, unknown>),
    [field]: value,
  }
  return { ...answers, [part]: section } as BackgroundAnswers
}

export function backgroundQuestionLabel(text: string, optional?: boolean) {
  return optional ? `${text} (optional)` : text
}

export type BackgroundResultSection = {
  title: string
  rows: { question: string; answer: string }[]
}

function formatStoredAnswer(
  kind: BackgroundQuestionKind | BackgroundConditional["kind"],
  value: unknown,
  options?: BackgroundChoice[]
) {
  if (kind === "yesno") {
    if (value === true) return "Yes"
    if (value === false) return "No"
    return "—"
  }
  if (kind === "number") {
    return typeof value === "number" ? String(value) : "—"
  }
  if (kind === "checkboxes") {
    if (!Array.isArray(value) || value.length === 0) return "—"
    const labels = value.map((item) => {
      const match = options?.find((option) => option.value === item)
      return match?.label ?? String(item)
    })
    return labels.join(", ")
  }
  if (kind === "radio") {
    if (typeof value !== "string" || value.length === 0) return "—"
    return options?.find((option) => option.value === value)?.label ?? "—"
  }
  if (typeof value !== "string" || value.trim().length === 0) return "—"
  return value
}

function conditionalAnswerPresent(
  kind: BackgroundConditional["kind"],
  value: unknown
) {
  if (kind === "yesno") return value === true || value === false
  return typeof value === "string" && value.trim().length > 0
}

export function backgroundResultSections(
  answers: BackgroundAnswers
): BackgroundResultSection[] {
  return BACKGROUND_PARTS.map((part) => {
    const rows: BackgroundResultSection["rows"] = []
    for (const question of part.questions) {
      rows.push({
        question: backgroundQuestionLabel(question.text, question.optional),
        answer: formatStoredAnswer(
          question.kind,
          readBackgroundField(answers, part.key, question.field),
          question.options
        ),
      })
      for (const conditional of question.conditionals ?? []) {
        const value = readBackgroundField(answers, part.key, conditional.field)
        if (!conditionalAnswerPresent(conditional.kind, value)) continue
        rows.push({
          question: backgroundQuestionLabel(conditional.text, conditional.optional),
          answer: formatStoredAnswer(conditional.kind, value),
        })
      }
    }
    return { title: part.name, rows }
  })
}

export function educationChoicesUseKnownLevels() {
  return EDUCATION_CHOICES.every((choice) =>
    (EDUCATION_LEVEL_OPTIONS as readonly string[]).includes(choice.value)
  )
}

export function housingChoicesCoverKnownValues() {
  return (
    HOUSING_TYPE_CHOICES.map((choice) => choice.value).join() ===
      [...HOUSING_TYPE_VALUES].join() &&
    HOUSING_SECURITY_CHOICES.map((choice) => choice.value).join() ===
      [...HOUSING_SECURITY_VALUES].join()
  )
}
