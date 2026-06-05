export type CheckboxOption = {
  key: string
  label: string
}

export const ONGOING_ASSESSMENT_OPTIONS: CheckboxOption[] = [
  { key: "phq9", label: "PHQ-9" },
  { key: "gad7", label: "GAD-7" },
  { key: "assist", label: "ASSIST" },
]

export const RISK_MANAGEMENT_OPTIONS: CheckboxOption[] = [
  { key: "support_team", label: "Support team in place" },
  { key: "medication_supervision", label: "Medication supervision" },
  { key: "medication_adherence", label: "Medication adherence" },
  { key: "crisis_plan", label: "Crisis plan" },
]

export const SUPPORT_SERVICES_OPTIONS: CheckboxOption[] = [
  { key: "twelve_step_membership", label: "12 step group membership" },
  { key: "twelve_step_sponsor", label: "12 step sponsor and program" },
  { key: "smart_membership", label: "SMART recovery group membership" },
  { key: "smart_online_training", label: "SMART recovery online training" },
  { key: "private_rehab_instay", label: "Private Rehab instay" },
  { key: "private_psychiatric_instay", label: "Private Psychiatric instay" },
  {
    key: "private_outpatient_group",
    label: "Private outpatient group membership",
  },
  { key: "er_hospital_attendance", label: "ER hospital attendance" },
  { key: "public_hospital_instay", label: "Public hospital instay" },
  {
    key: "public_hospital_outpatient_group",
    label: "Public hospital outpatient group membership",
  },
  { key: "charity_instay", label: "Charity organisation instay" },
  {
    key: "charity_outpatient_group",
    label: "Charity organisation outpatient group membership",
  },
  {
    key: "charity_counselling_case_worker",
    label: "Charity organisation counselling and case worker",
  },
]

export const PSYCHOEDUCATION_OPTIONS: CheckboxOption[] = [
  {
    key: "cognitive_model_target",
    label: "Cognitive model of therapeutic target",
  },
  { key: "principles_cbt", label: "Principles of CBT" },
  { key: "principles_dbt", label: "Principles of DBT" },
  { key: "principles_schema", label: "Principles of Schema" },
  { key: "principles_mi", label: "Principles of MI" },
  {
    key: "principles_biopsychosocial",
    label: "Principles of Biopsychosocial",
  },
  { key: "principles_ta", label: "Principles of TA" },
]

export const CASE_FORMULATION_OPTIONS: CheckboxOption[] = [
  { key: "behavioural_chain_analysis", label: "Behavioural chain analysis" },
  {
    key: "transactional_analysis_game",
    label: "Transactional analysis and game formula",
  },
  {
    key: "primary_secondary_processes",
    label: "Primary and secondary processes",
  },
  {
    key: "classical_operant_conditioning",
    label: "Classical conditioning and operant conditioning",
  },
  { key: "biopsychosocial_analysis", label: "BiopsychoSocial analysis" },
  { key: "schemas", label: "Schemas" },
]

export const ALTERNATE_RESPONSES_OPTIONS: CheckboxOption[] = [
  { key: "behavioural_targets", label: "Behavioural targets" },
  { key: "cognitive_restructuring", label: "Cognitive restructuring" },
  {
    key: "behavioural_skills_training",
    label: "Behavioural skills training",
  },
  { key: "gradual_exposure", label: "Gradual exposure" },
  { key: "behavioural_activation", label: "Behavioural activation" },
  {
    key: "alternate_behavioural_strategies",
    label: "Alternate behavioural strategies",
  },
]

export const QUALITY_OF_LIFE_OPTIONS: CheckboxOption[] = [
  {
    key: "identify_values_domains",
    label: "Identify values in various life domains",
  },
  {
    key: "behavioural_goals_domains",
    label: "Behavioural goals for each domain",
  },
  { key: "repair_relationships", label: "Repair relationships" },
  {
    key: "prevent_relapse_vulnerability",
    label: "Prevent relapse by reducing vulnerability",
  },
]

export const MULTI_SELECT_SECTIONS = [
  { id: "risk_management", title: "Risk Management", options: RISK_MANAGEMENT_OPTIONS },
  {
    id: "support_services",
    title: "Support Services",
    options: SUPPORT_SERVICES_OPTIONS,
  },
  {
    id: "psychoeducation",
    title: "Psychoeducation",
    options: PSYCHOEDUCATION_OPTIONS,
  },
  {
    id: "case_formulation",
    title: "Case Formulation",
    options: CASE_FORMULATION_OPTIONS,
  },
  {
    id: "alternate_responses",
    title: "Alternate Responses",
    options: ALTERNATE_RESPONSES_OPTIONS,
  },
  {
    id: "quality_of_life",
    title: "Quality of Life",
    options: QUALITY_OF_LIFE_OPTIONS,
  },
] as const

export function optionLabel(
  options: CheckboxOption[],
  key: string
): string {
  return options.find((o) => o.key === key)?.label ?? key
}
