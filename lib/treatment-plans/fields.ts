export type CheckboxOption = {
  key: string
  label: string
}

export type SupportServiceOption = CheckboxOption & {
  /** Sub-items shown only once this parent option is checked. */
  children?: CheckboxOption[]
  defaultChecked?: boolean
}

export const ONGOING_ASSESSMENT_OPTIONS: CheckboxOption[] = [
  { key: "phq9", label: "PHQ-9" },
  { key: "gad7", label: "GAD-7" },
  { key: "assist", label: "ASSIST" },
]

export const TREATMENT_MODALITY_OPTIONS: CheckboxOption[] = [
  { key: "cbt", label: "Cognitive Behaviour Therapy (CBT)" },
  { key: "dbt", label: "Dialectical Behaviour Therapy (DBT)" },
]

// Treatment Model: single-select (radio), replacing the old multi-select "Case
// Formulation Model" list (2026-09 layout update). Deliberately no "Other"
// free-text — entries need to be exact citations. Expected to grow; Ben supplies
// new models as they're added.
export const TREATMENT_MODEL_OPTIONS: CheckboxOption[] = [
  {
    key: "unified_depression_beck_bredemeier_2016",
    label: "Unified Model of Depression (Beck and Bredemeier 2016)",
  },
  {
    key: "cognitive_anxiety_clark_beck_2010",
    label: "Cognitive Model of Anxiety (Clark and Beck 2010)",
  },
]

// Support Services (2026-09 layout update): simplified to six top-level items.
// 12-Step Program and SMART Recovery each reveal their own sub-checklist only once
// selected — the parent key and any checked children all live together as flat
// entries in the same MultiSelectSectionJson.selected array; flattenSupportServiceOptions()
// below is what parsing/rendering-as-a-flat-list use.
export const SUPPORT_SERVICES_OPTIONS: SupportServiceOption[] = [
  {
    key: "twelve_step_program",
    label: "12-Step Program",
    children: [
      {
        key: "twelve_step_meeting_attendance",
        label: "12-step meeting attendance and volunteering",
      },
      { key: "twelve_step_sponsor", label: "Work with a 12-step sponsor" },
      {
        key: "twelve_step_complete_program",
        label: "Complete the 12-step program",
      },
    ],
  },
  {
    key: "smart_recovery",
    label: "SMART Recovery",
    children: [
      { key: "smart_meeting_attendance", label: "SMART meeting attendance" },
      {
        key: "smart_online_training",
        label: "SMART online training participation",
      },
    ],
  },
  {
    key: "rehab_psychiatric_instay",
    label: "Rehabilitation / Psychiatric Instay",
    defaultChecked: true,
  },
  {
    key: "outpatient_group_membership",
    label: "Outpatient Group Membership",
    defaultChecked: true,
  },
  { key: "case_worker_support_person", label: "Case Worker / Support Person" },
  { key: "couples_counselling", label: "Couples Counselling" },
]

/** Flat list of every Support Services option (parents and children together), for
 * parsing form data and rendering labels — anything that doesn't need the parent/
 * child grouping itself. */
export function flattenSupportServiceOptions(): CheckboxOption[] {
  return SUPPORT_SERVICES_OPTIONS.flatMap((option) => [
    { key: option.key, label: option.label },
    ...(option.children ?? []),
  ])
}

export function defaultSupportServiceKeys(): string[] {
  return SUPPORT_SERVICES_OPTIONS.filter((o) => o.defaultChecked).map(
    (o) => o.key
  )
}

// Treatment Summary (2026-09 layout update): replaces the old Psychoeducation,
// Alternate Responses, and Quality of Life sections. This is a fixed, static recap
// of what every treatment plan covers — not per-client selectable state, so there's
// no JSON column backing it. Keep this list in sync with the source template if it
// changes; it's rendered identically on every plan.
export const TREATMENT_SUMMARY_ITEMS: string[] = [
  "Manage risk",
  "Utilise other support services",
  "Understand the treatment model",
  "Complete the case formulation per the treatment model",
  "Practice SMART goals",
  "Develop effective strategies — cognitive, emotional, behavioural",
  "Build quality of life — work/study, relationships, activities, spiritual",
]

// Reference list of every generic { selected, other } multi-select checklist section
// on the treatment plan (Ongoing Assessment Tools isn't here — it's a fixed set of
// boolean flags; Treatment Model isn't here — it's single-select; Risk isn't here —
// every item in it has bespoke handling now), for anything that wants to iterate
// rather than hardcode each section (nothing does yet — the form/view/PDF each
// render their own sections directly). Keep this in sync with treatment-plan-form.tsx
// when sections are added, renamed, or reordered.
export const MULTI_SELECT_SECTIONS = [
  {
    id: "treatment_modalities",
    title: "Treatment Modalities",
    options: TREATMENT_MODALITY_OPTIONS,
  },
  {
    id: "support_services",
    title: "Support Services",
    options: flattenSupportServiceOptions(),
  },
] as const

export function optionLabel(
  options: CheckboxOption[],
  key: string
): string {
  return options.find((o) => o.key === key)?.label ?? key
}
