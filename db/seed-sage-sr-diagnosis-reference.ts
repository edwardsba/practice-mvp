import { config } from "dotenv"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { sageSrDiagnosisReference } from "./schema"

config({ path: ".env.local" })

// Source: every diagnosis label observed across TeleSage's own SAGE-SR Core Clinician
// Report ("Possible Diagnoses to Consider" + "Endorsed Symptoms for Further Evaluation" +
// "Areas with Absent or Minimal Symptoms" sections) plus the 10 DSM-5-TR personality
// disorders from the SAGE-SR Personality Report's severity dials.
//
// Where TeleSage's own report supplied a code directly (confirmed against the actual
// Test01 report), that exact code is used verbatim rather than re-derived from memory.
// Where TeleSage supplies no code (bare episodes, medium-tier "further evaluation" items,
// and all of Personality), a standard ICD-10-CM code is provided where one exists cleanly,
// with requiresClinicalSpecifier: true + codeNotes flagging that severity/subtype/episode
// history/insight-level judgment is needed to pick the exact code — these are NOT meant
// to be printed as a final billing code without clinician review.
const DIAGNOSIS_REFERENCE_DATA = [
  // --- Core: confirmed directly from TeleSage's own Clinician Report ---
  { label: "Generalized Anxiety Disorder", module: "core", code: "F41.1", requiresSpecifier: false, notes: null },
  { label: "Panic Disorder", module: "core", code: "F41.0", requiresSpecifier: false, notes: null },
  { label: "Agoraphobia with Panic Disorder", module: "core", code: "F40.01", requiresSpecifier: false, notes: null },
  { label: "Social Anxiety Disorder", module: "core", code: "F40.10", requiresSpecifier: false, notes: null },
  { label: "Obsessive-Compulsive Disorder", module: "core", code: "F42.9", requiresSpecifier: false, notes: null },
  { label: "Post-Traumatic Stress Disorder", module: "core", code: "F43.10", requiresSpecifier: false, notes: null },
  { label: "Schizoaffective Disorder, Mixed Type", module: "core", code: "F25.0", requiresSpecifier: false, notes: null },
  { label: "Alcohol Use Disorder (Severe)", module: "core", code: "F10.20", requiresSpecifier: false, notes: null },
  { label: "Cannabis Use Disorder (Severe)", module: "core", code: "F12.20", requiresSpecifier: false, notes: null },
  { label: "Bipolar I Disorder", module: "core", code: "F31.9", requiresSpecifier: true, notes: "TeleSage's own report lists this as 'F31.x' — a family, not a final code. Actual code depends on current/most recent episode type (manic/hypomanic/depressed/mixed) and severity. F31.9 (unspecified) shown as placeholder only." },

  // --- Core: bare episodes — genuinely not directly codable without clinical history ---
  { label: "Major Depressive Episode", module: "core", code: null, requiresSpecifier: true, notes: "An episode, not a standalone billable diagnosis — becomes MDD, Bipolar I, or Bipolar II depending on episode history a clinician must determine. No code assigned." },
  { label: "Past Major Depressive Episode", module: "core", code: null, requiresSpecifier: true, notes: "Same as Major Depressive Episode — episode history determines the eventual diagnosis and code." },
  { label: "Manic Episode", module: "core", code: null, requiresSpecifier: true, notes: "An episode, not a standalone diagnosis — contributes to a Bipolar I determination pending clinical review. No code assigned." },
  { label: "Past Manic Episode", module: "core", code: null, requiresSpecifier: true, notes: "Same as Manic Episode." },
  { label: "Past Hypomanic Episode", module: "core", code: null, requiresSpecifier: true, notes: "Contributes to a Bipolar II determination pending clinical review. No code assigned." },

  // --- Core: medium-tier "Endorsed Symptoms for Further Evaluation" — TeleSage supplies no code for this tier at all ---
  { label: "Persistent Depressive Disorder", module: "core", code: "F34.1", requiresSpecifier: false, notes: "TeleSage's report does not supply a code for medium-tier items — this is a standard reference code, not sourced from the report itself." },
  { label: "Attention-Deficit Hyperactivity Disorder", module: "core", code: "F90.9", requiresSpecifier: true, notes: "TeleSage's report does not supply a code for medium-tier items. F90.9 (unspecified presentation) shown as placeholder — actual code depends on inattentive/hyperactive-impulsive/combined presentation." },

  // --- Core: "Areas with Absent or Minimal Symptoms" — screened, not endorsed, but kept in the reference table for completeness since the module still asks about them ---
  { label: "Bipolar II Disorder", module: "core", code: "F31.81", requiresSpecifier: false, notes: null },
  { label: "Other Specified Bipolar Disorder", module: "core", code: "F31.89", requiresSpecifier: false, notes: null },
  { label: "Schizophrenia", module: "core", code: "F20.9", requiresSpecifier: false, notes: null },
  { label: "Schizophreniform Disorder", module: "core", code: "F20.81", requiresSpecifier: false, notes: null },
  { label: "Delusional Disorder", module: "core", code: "F22", requiresSpecifier: false, notes: null },
  { label: "Brief Psychotic Disorder", module: "core", code: "F23", requiresSpecifier: false, notes: null },
  { label: "Other Specified Psychotic Disorder", module: "core", code: "F28", requiresSpecifier: false, notes: null },
  { label: "Uncertain Psychotic Disorder", module: "core", code: "F29", requiresSpecifier: false, notes: "Mapped to F29 (Unspecified Schizophrenia Spectrum and Other Psychotic Disorder) as the closest standard equivalent." },
  { label: "Sedative, Hypnotic, or Anxiolytic Use Disorder", module: "core", code: "F13.20", requiresSpecifier: true, notes: "Severity (mild/moderate/severe) not determined by this label alone — F13.20 shown as severe/default placeholder." },
  { label: "Stimulant Use Disorder - Amphetamine", module: "core", code: "F15.20", requiresSpecifier: true, notes: "Severity not determined by this label alone." },
  { label: "Stimulant Use Disorder - Cocaine", module: "core", code: "F14.20", requiresSpecifier: true, notes: "Severity not determined by this label alone." },
  { label: "Opioid Use Disorder", module: "core", code: "F11.20", requiresSpecifier: true, notes: "Severity not determined by this label alone." },
  { label: "PCP Use Disorder", module: "core", code: "F16.20", requiresSpecifier: true, notes: "Severity not determined by this label alone." },
  { label: "Other Hallucinogen Use Disorder", module: "core", code: "F16.20", requiresSpecifier: true, notes: "Shares an ICD-10-CM code family with PCP Use Disorder; severity not determined by this label alone." },
  { label: "Inhalant Use Disorder", module: "core", code: "F18.20", requiresSpecifier: true, notes: "Severity not determined by this label alone." },
  { label: "Other Drug Use Disorder", module: "core", code: "F19.20", requiresSpecifier: true, notes: "Severity not determined by this label alone." },

  // --- Personality: TeleSage's Personality Report never supplies a code for any of these ---
  { label: "Paranoid Personality Disorder", module: "personality", code: "F60.0", requiresSpecifier: false, notes: null },
  { label: "Schizoid Personality Disorder", module: "personality", code: "F60.1", requiresSpecifier: false, notes: null },
  { label: "Schizotypal Personality Disorder", module: "personality", code: "F21", requiresSpecifier: false, notes: "Coded under the schizophrenia-spectrum block (F21), not the F60.x personality-disorder block — this is correct per ICD-10-CM, not an error." },
  { label: "Antisocial Personality Disorder", module: "personality", code: "F60.2", requiresSpecifier: false, notes: null },
  { label: "Borderline Personality Disorder", module: "personality", code: "F60.3", requiresSpecifier: false, notes: null },
  { label: "Histrionic Personality Disorder", module: "personality", code: "F60.4", requiresSpecifier: false, notes: null },
  { label: "Narcissistic Personality Disorder", module: "personality", code: "F60.81", requiresSpecifier: false, notes: null },
  { label: "Avoidant Personality Disorder", module: "personality", code: "F60.6", requiresSpecifier: false, notes: null },
  { label: "Dependent Personality Disorder", module: "personality", code: "F60.7", requiresSpecifier: false, notes: null },
  { label: "Obsessive-Compulsive Personality Disorder", module: "personality", code: "F60.5", requiresSpecifier: false, notes: null },
] as const

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local")
  }

  const pool = new Pool({ connectionString })
  const db = drizzle(pool)

  let inserted = 0
  let skipped = 0

  for (const row of DIAGNOSIS_REFERENCE_DATA) {
    const [existing] = await db
      .select({ id: sageSrDiagnosisReference.sageSrDiagnosisReferenceId })
      .from(sageSrDiagnosisReference)
      .where(eq(sageSrDiagnosisReference.diagnosisLabel, row.label))
      .limit(1)

    if (existing) {
      skipped++
      continue
    }

    await db.insert(sageSrDiagnosisReference).values({
      diagnosisLabel: row.label,
      sageSrModule: row.module,
      icd10Code: row.code,
      requiresClinicalSpecifier: row.requiresSpecifier,
      codeNotes: row.notes,
    })
    inserted++
  }

  console.log(`SAGE-SR diagnosis reference seeded: ${inserted} inserted, ${skipped} already present.`)
  await pool.end()
}

main().catch((error) => {
  console.error("Seed failed:", error)
  process.exit(1)
})
