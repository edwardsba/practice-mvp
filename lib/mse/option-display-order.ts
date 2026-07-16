import type { MseSentenceFieldKey } from "@/lib/mse/session-note-sentence"

/**
 * Canonical option displayOrder per field (matches db/seed-mse.ts).
 * Used to order distinct abnormal values deterministically in Progress Reports.
 */
export const MSE_OPTION_DISPLAY_ORDER: Record<
  MseSentenceFieldKey,
  Record<string, number>
> = {
  appearance: {
    Neat: 1,
    Dishevelled: 2,
    Inappropriate: 3,
    Bizarre: 4,
  },
  behaviour: {
    Cooperative: 1,
    Guarded: 2,
    Hyperactive: 3,
    Agitated: 4,
    Paranoid: 5,
    Stereotyped: 6,
    Aggressive: 7,
    Bizarre: 8,
    Withdrawn: 9,
  },
  eyeContact: {
    Normal: 1,
    Intense: 2,
    Avoidant: 3,
  },
  motorActivity: {
    Normal: 1,
    Restless: 2,
    Tics: 3,
    Slowed: 4,
  },
  affect: {
    Full: 1,
    Constricted: 2,
    Flat: 3,
    Labile: 4,
  },
  hallucination: {
    None: 1,
    Auditory: 2,
    Visual: 3,
  },
  depersonalisationDerealisation: {
    None: 1,
    Derealisation: 2,
    Depersonalisation: 3,
  },
  homicidality: {
    None: 1,
    Aggressive: 2,
    Intent: 3,
    Plan: 4,
  },
  delusions: {
    None: 1,
    Grandiose: 2,
    Paranoid: 3,
    Religious: 4,
  },
  orientation: {
    None: 1,
    Place: 2,
    Object: 3,
    Person: 4,
    Time: 5,
  },
  memory: {
    None: 1,
    "Short-Term": 2,
    "Long-Term": 3,
  },
  attention: {
    Normal: 1,
    Distracted: 2,
  },
  insight: {
    Good: 1,
    Fair: 2,
    Poor: 3,
  },
  judgement: {
    Good: 1,
    Fair: 2,
    Poor: 3,
  },
}
