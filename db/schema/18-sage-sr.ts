import { boolean, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

// Static reference table — NOT client data. One row per possible diagnosis/trait label
// that can appear across any SAGE-SR module (Core or Personality), independent of any
// individual client's results. Built once, seeded once, looked up by every client's
// SAGE-SR import going forward.
//
// Exists because TeleSage's own reports don't reliably supply an ICD-10 code for every
// label: bare "episodes" (Major Depressive Episode, Manic Episode) are never coded —
// correctly, since coding requires clinical episode-history judgment TeleSage can't make —
// and the Personality Report never supplies codes at all. This table is the single source
// of truth the report-generation engine joins against, rather than trusting any one
// imported PDF to have included a code.
export const sageSrDiagnosisReference = pgTable('sage_sr_diagnosis_reference', {
  sageSrDiagnosisReferenceId: uuid('sage_sr_diagnosis_reference_id').primaryKey().defaultRandom(),
  diagnosisLabel: text('diagnosis_label').notNull().unique(), // exact label as it appears in TeleSage's reports, e.g. "Generalized Anxiety Disorder"
  sageSrModule: text('sage_sr_module').notNull(), // 'core' | 'personality' — which SAGE-SR assessment surfaces this label
  icd10Code: text('icd10_code'), // nullable — null where a code genuinely can't be assigned without clinical judgment (see requiresClinicalSpecifier)
  requiresClinicalSpecifier: boolean('requires_clinical_specifier').notNull().default(false), // true where icd10Code (if present) is a default/unspecified variant — actual code depends on a specifier (severity, subtype, episode type, insight level) only a clinician can determine
  codeNotes: text('code_notes'), // free text explaining the specifier situation, e.g. "Requires single/recurrent + severity specifier — code shown is unspecified default"
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// Static reference table — NOT client data. One row per SAGE-SR Personality item that maps
// to a specific DSM-5-TR personality disorder criterion. Built once from a manual audit of
// the real Test01 item bank against DSM-5-TR (criteria paraphrased in our own words, not
// quoted from the DSM-5-TR text itself), reviewed and corrected by Ben, and re-seeded
// whenever that review changes — see db/seed-sage-sr-personality-criteria-reference.ts for
// the actual source data and how to re-run it after a correction.
//
// A single DSM-5-TR criterion is often supported by more than one SAGE-SR item (multiple
// rows sharing the same disorder + criterionNumber) — a criterion counts as satisfied for a
// client if ANY of its mapped items are satisfied, not all of them.
//
// Deliberately excludes: (a) criteria for which no corresponding SAGE-SR item exists at all
// (the criterion is simply absent from this table for that disorder — not an oversight, a
// reflection of the instrument's actual coverage), and (b) two criteria (Obsessive-Compulsive
// criterion 4 "overconscientious about ethics" and criterion 7 "miserly spending style") where
// the real Test01 response didn't clearly fit either scoring direction — left out rather than
// guessed at, pending Ben's clinical read.
export const sageSrPersonalityCriteriaReference = pgTable('sage_sr_personality_criteria_reference', {
  sageSrPersonalityCriteriaReferenceId: uuid('sage_sr_personality_criteria_reference_id').primaryKey().defaultRandom(),
  disorder: text('disorder').notNull(), // e.g. "Paranoid Personality Disorder"
  criterionNumber: integer('criterion_number').notNull(), // 1-indexed, per DSM-5-TR's own numbering for that disorder
  criterionText: text('criterion_text').notNull(), // paraphrased in our own words, not quoted from the DSM-5-TR
  thresholdRequired: integer('threshold_required').notNull(), // e.g. 5 — number of distinct criteria (not items) that must be satisfied for this disorder
  totalCriteria: integer('total_criteria').notNull(), // e.g. 9 — total criteria DSM-5-TR defines for this disorder, for display as "X of Y"
  itemText: text('item_text').notNull(), // exact SAGE-SR item wording, as it appears in the Personality Response Report
  reverseScored: boolean('reverse_scored').notNull().default(false), // true if the pathological/criterion-satisfying direction is the LOW end of the response scale (e.g. "I forgave people who insulted me": Never/Rarely/Sometimes satisfies, Often/Always does not)
  notes: text('notes'), // free text — e.g. flags an item that's shared with another trait's TeleSage display box, or other mapping caveats worth keeping visible
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  disorderIdx: index('sage_sr_personality_criteria_reference_disorder_idx').on(table.disorder),
}))
