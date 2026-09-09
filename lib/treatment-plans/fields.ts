import type { OngoingAssessmentsJson } from "@/lib/treatment-plans/types"

export type CheckboxOption = {
  key: string
  label: string
}

export type SupportServiceOption = CheckboxOption & {
  /** Indented descriptive sub-lines shown under this option, elaborating what
   * checking it covers. Not independently selectable — no separate stored keys;
   * checking the parent box is understood to cover everything listed here.
   * (2026-09-10 correction: these were briefly separate reveal-on-check child
   * checkboxes — Ben's feedback was that they should be one tick box with
   * descriptive sub-lines, not several tick boxes.) */
  sublines?: string[]
}

export const ONGOING_ASSESSMENT_OPTIONS: CheckboxOption[] = [
  { key: "phq9", label: "PHQ-9" },
  { key: "gad7", label: "GAD-7" },
  { key: "assist", label: "ASSIST" },
]

// New-plan defaults (2026-09-10 correction, confirmed with Ben): CBT pre-checked on
// Treatment Modalities, PHQ-9 + GAD-7 pre-checked on Ongoing Assessment Tools. Only
// applied on a brand-new plan (see isFreshPlan in treatment-plan-form.tsx) — never
// forced onto an existing saved plan's actual selections.
export const DEFAULT_NEW_PLAN_MODALITY_KEYS: string[] = ["cbt"]
export const DEFAULT_NEW_PLAN_ONGOING_ASSESSMENTS: OngoingAssessmentsJson = {
  phq9: true,
  gad7: true,
  assist: false,
}

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

// Support Services (2026-09 layout update, corrected 2026-09-10): six flat,
// independently-checkable items. 12-Step Program and SMART Recovery each carry
// descriptive sublines (shown indented under the one checkbox) rather than
// separate sub-checkboxes — ticking the parent is understood to cover everything
// listed under it, and no sub-item has its own stored value. No item is
// pre-checked by default on a new plan.
export const SUPPORT_SERVICES_OPTIONS: SupportServiceOption[] = [
  {
    key: "twelve_step_program",
    label: "12-Step Program",
    sublines: [
      "12-step meeting attendance and volunteering",
      "Work with a 12-step sponsor",
      "Complete the 12-step program",
    ],
  },
  {
    key: "smart_recovery",
    label: "SMART Recovery",
    sublines: [
      "SMART meeting attendance",
      "SMART online training participation",
    ],
  },
  { key: "rehab_psychiatric_instay", label: "Rehabilitation / Psychiatric Instay" },
  { key: "outpatient_group_membership", label: "Outpatient Group Membership" },
  { key: "case_worker_support_person", label: "Case Worker / Support Person" },
  { key: "couples_counselling", label: "Couples Counselling" },
]

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
    options: SUPPORT_SERVICES_OPTIONS,
  },
] as const

export function optionLabel(
  options: CheckboxOption[],
  key: string
): string {
  return options.find((o) => o.key === key)?.label ?? key
}
