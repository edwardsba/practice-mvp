import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

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
