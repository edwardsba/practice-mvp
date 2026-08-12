CREATE TABLE IF NOT EXISTS sage_sr_diagnosis_reference (
  sage_sr_diagnosis_reference_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnosis_label text NOT NULL UNIQUE,
  sage_sr_module text NOT NULL,
  icd10_code text,
  requires_clinical_specifier boolean NOT NULL DEFAULT false,
  code_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
