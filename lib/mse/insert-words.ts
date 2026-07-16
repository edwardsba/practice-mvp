/**
 * Insert words for non-baseline MSE options (Session Note sentence engine).
 * Source: MSE_Reporting_Guidelines.xlsx → "Report Wording" tab.
 * Suicidality is deliberately omitted — it never participates in sentence generation.
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
  orientation: {
    Place: "disorientation to place",
    Object: "disorientation to object",
    Person: "disorientation to person",
    Time: "disorientation to time",
  },
  memory: {
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
