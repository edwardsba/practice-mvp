export type CheckboxOption = {
  key: string
  label: string
}

export const EMERGENCY_NUMBERS_OPTIONS: CheckboxOption[] = [
  {
    key: "nsw_mental_health_line",
    label: "NSW Mental Health Line (Acute care, Crisis Teams) - 1800 011 511",
  },
  {
    key: "hornsby_acute_care",
    label: "Hornsby Acute Care Team - 02 9485 6500",
  },
  { key: "lifeline", label: "Lifeline - 13 11 14" },
  {
    key: "lifeline_text",
    label: "Lifeline Text Service - 0477 13 11 14",
  },
  {
    key: "suicide_callback",
    label: "Suicide Call Back Service - 1300 659 467",
  },
  { key: "beyond_blue", label: "Beyond Blue - 1300 224 636" },
  { key: "sane_australia", label: "SANE Australia - 1800 187 263" },
  {
    key: "medicare_mental_health",
    label: "Medicare Mental Health - 1800 595 212",
  },
  { key: "this_way_up", label: "This Way Up – www.thiswayup.org.au" },
  { key: "mindspot", label: "Mindspot – www.mindspot.org.au" },
  {
    key: "bpd_foundation",
    label: "Australian BPD Foundation – www.bpdfoundation.org.au",
  },
]

export const DOING_WELL_OPTIONS: CheckboxOption[] = [
  { key: "feel_well", label: "I feel well, I feel like doing things" },
  { key: "going_outside", label: "Going outside" },
  { key: "regular_exercise", label: "Getting regular exercise" },
  { key: "coping_work_study", label: "Coping with work and study" },
  {
    key: "social_interactions",
    label: "Getting regular social interactions",
  },
  { key: "attending_appointments", label: "Attending appointments" },
  {
    key: "meditation_breathwork",
    label: "Attending meditation/breathwork events",
  },
  { key: "taking_medication", label: "Taking medication" },
  { key: "healthy_meals", label: "Making healthy meals" },
  {
    key: "calming_activities",
    label:
      "Naturally choose calming activities in spare time (walking, reading, colouring)",
  },
]

export const STAY_WELL_OPTIONS: CheckboxOption[] = [
  { key: "daily_routine", label: "Have a daily plan/routine" },
  { key: "practice_skills", label: "Practice skills when triggered" },
  {
    key: "talk_about_worries",
    label: "Talk to others about things that worry me",
  },
  {
    key: "relaxation_mindfulness",
    label: "Practice relaxation and mindfulness",
  },
  { key: "calming_music", label: "Listen to calming ambient music" },
  {
    key: "cope_ahead",
    label: "Cope ahead for challenging situations",
  },
  {
    key: "weekend_planning",
    label: "Planning work or study to keep the weekend free",
  },
  {
    key: "medication_prescribed",
    label: "Take medication as prescribed",
  },
  {
    key: "keep_appointments",
    label: "Keep my appointments with GP etc.",
  },
]

export const BECOMING_UNWELL_OPTIONS: CheckboxOption[] = [
  { key: "negative_thoughts", label: "Negative thoughts" },
  { key: "low_energy", label: "Low energy" },
  { key: "low_mood", label: "Low mood" },
  {
    key: "low_motivation",
    label: "Low motivation and discipline",
  },
  { key: "feeling_agitated", label: "Feeling agitated" },
  { key: "easily_angered", label: "Easily angered" },
  { key: "low_confidence", label: "Low confidence" },
  { key: "not_using_skills", label: "Not using skills" },
  { key: "only_tipp", label: "Only using crisis TIPP skills" },
  {
    key: "not_meditating",
    label: "Not meditating or journaling",
  },
  { key: "avoiding_activity", label: "Avoiding activity" },
  { key: "avoiding_commitments", label: "Avoiding commitments" },
  {
    key: "avoiding_appointments",
    label: "Avoiding appointments with GP, therapy, etc.",
  },
  {
    key: "weekend_work",
    label: "Leaving work or assessments for the weekend",
  },
  {
    key: "excessive_social_media",
    label: "Excessive social media use",
  },
  {
    key: "forgetting_medication",
    label: "Forgetting to take medication",
  },
  {
    key: "poor_sleep",
    label: "Staying up late and sleeping in",
  },
  { key: "junk_food", label: "Eating junk food" },
  {
    key: "struggling_decisions",
    label: "Struggling to make decisions",
  },
  { key: "excessive_daydreaming", label: "Excessive daydreaming" },
  { key: "excess_hygiene", label: "Excess self hygiene" },
  { key: "skin_picking", label: "Skin picking" },
]

export const GET_BETTER_OPTIONS: CheckboxOption[] = [
  {
    key: "behavioural_activation",
    label: "Keep involved (use behavioural activation)",
  },
  {
    key: "tipp_skills",
    label: "Manage distress with TIPP skills",
  },
  { key: "distraction", label: "Distraction skills" },
  {
    key: "self_soothing",
    label: "Self-soothing skills (5 senses)",
  },
  {
    key: "supportive_people",
    label: "Interact with supportive people",
  },
  {
    key: "avoid_risky",
    label: "Avoid unsafe/risky situations",
  },
  {
    key: "medication_prn",
    label: "Take medication / PRN medication",
  },
  {
    key: "gp_appointment",
    label: "Make an appointment with a GP, psychiatrist, etc.",
  },
  {
    key: "attend_hospital",
    label: "Attend rehab / psychiatric hospital",
  },
  {
    key: "please_skill",
    label: "Basic self care with PLEASE skill",
  },
  {
    key: "public_transport",
    label:
      "Use public transport instead of driving when fatigued or angry",
  },
  { key: "spending_limits", label: "Have spending limits" },
  {
    key: "extensions",
    label: "Apply for extensions for work or assessments",
  },
  {
    key: "public_study",
    label:
      "Schedule some study sessions in public places (e.g., library, coffee shop)",
  },
  {
    key: "written_notes",
    label:
      "Use written notes in therapy if too anxious or distressed to talk",
  },
]

export const UNWELL_OPTIONS: CheckboxOption[] = [
  { key: "very_low_mood", label: "Very low mood" },
  { key: "crying", label: "Crying all the time" },
  { key: "angry", label: "Angry all the time" },
  {
    key: "conflict_agitated",
    label: "Conflict and easily agitated",
  },
  { key: "feeling_numb", label: "Feeling numb" },
  {
    key: "too_nice",
    label: "Being too nice and 'okay with everything'",
  },
  { key: "avoidance", label: "Avoidance and isolation" },
  {
    key: "cancelling",
    label: "Cancelling things last minute",
  },
  {
    key: "not_attending",
    label: "Not attending appointments",
  },
  {
    key: "not_reaching_out",
    label: "Not reaching out for support",
  },
  { key: "not_taking_meds", label: "Not taking medication" },
  { key: "not_sleeping", label: "Not sleeping" },
  { key: "eating_issues", label: "Over or under eating" },
  {
    key: "pseudo_productivity",
    label:
      "Pseudo-productivity (being in study environment but not doing work)",
  },
  { key: "addictive_behaviours", label: "Addictive behaviours" },
  {
    key: "self_harm_thoughts",
    label: "Thoughts of or plans for self-harm",
  },
  { key: "sabotaging", label: "Thoughts of sabotaging" },
]

export const CRISIS_RESPONSE_OPTIONS: CheckboxOption[] = [
  { key: "call_000", label: "Call emergency 000" },
  { key: "contact_support", label: "Contact support services" },
  { key: "talk_contacts", label: "Talk to emergency contacts" },
  { key: "stay_close", label: "Stay close to others" },
  { key: "take_nap", label: "Take a nap" },
  {
    key: "medication_prn",
    label: "Take medication / PRN medication",
  },
  {
    key: "book_appointment",
    label:
      "Make an appointment with a GP, Psychiatrist, Psychologist, etc.",
  },
  { key: "present_er", label: "Present to hospital ER" },
  {
    key: "book_rehab",
    label: "Book into rehab / psychiatric hospital",
  },
]

export function optionLabel(options: CheckboxOption[], key: string): string {
  return options.find((o) => o.key === key)?.label ?? key
}
