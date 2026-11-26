/**
 * Insert words for non-baseline MSE options (Session Note sentence engine).
 * Source: MSE_Reporting_Guidelines.xlsx → "Report Wording" tab.
 * Old Orientation/Memory labels kept until Round AI removes the legacy pages.
 */
export const MSE_INSERT_WORDS: Record<string, Record<string, string>> = {
  appearance: {
    Dishevelled: "dishevelled",
    Inappropriate: "inappropriate",
    Bizarre: "bizarre",
  },
  behaviour: {
    Guarded: "guarded",
    Hyperactive: "hyperactive",
    Agitated: "agitated",
    Paranoid: "paranoid",
    Stereotyped: "stereotyped",
    Aggressive: "aggressive",
    Bizarre: "bizarre",
    Withdrawn: "withdrawn",
  },
  eyeContact: {
    Intense: "intense",
    Avoidant: "avoidant",
  },
  motorActivity: {
    Restless: "restless",
    Tics: "exhibiting tics",
    Slowed: "slowed",
  },
  affect: {
    Constricted: "constricted",
    Flat: "flat",
    Labile: "labile",
  },
  hallucination: {
    Auditory: "auditory hallucinations",
    Visual: "visual hallucinations",
  },
  depersonalisationDerealisation: {
    Derealisation: "derealisation",
    Depersonalisation: "depersonalisation",
  },
  homicidality: {
    Aggressive: "homicidal aggression",
    Intent: "homicidal intent",
    Plan: "a homicidal plan",
  },
  delusions: {
    Grandiose: "grandiose delusions",
    Paranoid: "paranoid delusions",
    Religious: "religious delusions",
  },
  suicidality: {
    Ideation: "suicidal ideation",
    Plan: "a suicide plan",
    Intent: "suicidal intent",
    "Self-Harm": "self-harm",
  },
  orientation: {
    // New shared-form labels
    "Disoriented to time": "disorientation to time",
    "Disoriented to time and place": "disorientation to time and place",
    "Disoriented to time, place and person":
      "disorientation to time, place and person",
    // Legacy labels (kept until Round AI)
    Place: "disorientation to place",
    Object: "disorientation to object",
    Person: "disorientation to person",
    Time: "disorientation to time",
  },
  memory: {
    // New shared-form labels
    "Short-term impaired": "short-term memory impairment",
    "Long-term impaired": "long-term memory impairment",
    "Short- and long-term impaired": "short- and long-term memory impairment",
    // Legacy labels (kept until Round AI)
    "Short-Term": "short-term memory impairment",
    "Long-Term": "long-term memory impairment",
  },
  attention: {
    Distracted: "distracted attention",
  },
  insight: {
    Fair: "fair",
    Poor: "poor",
  },
  judgement: {
    Fair: "fair",
    Poor: "poor",
  },
}
