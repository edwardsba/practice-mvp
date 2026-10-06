"use client"

import { useState, type ReactNode } from "react"

import { saveDemographicsAction } from "@/app/clients/[client_id]/background/actions"
import { PartialDatePicker, ReadOnlyField, SaveRow, SelectField, TextAreaField, TextField, YesNoDetail } from "@/components/client-background/fields"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  EDUCATION_LEVEL_OPTIONS,
  HOUSING_STABILITY_OPTIONS,
  NECESSITY_KEYS,
  NECESSITY_LABELS,
  PRONOUN_OPTIONS,
  SEX_OPTIONS,
  type Demographics,
  type EducationFields,
  type IdentityFields,
  type LivingSituationFields,
  type OccupationFields,
  type PreviousJob,
} from "@/lib/client-background/types"
import { formatPartialDateLabel } from "@/lib/client-background/age"
import { cn } from "@/lib/utils"

export function DemographicsSection({
  clientId,
  demographics,
}: {
  clientId: string
  demographics: Demographics
}) {
  const [saved, setSaved] = useState(demographics)
  const [draft, setDraft] = useState(demographics)
  const [editing, setEditing] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateIdentity(identity: IdentityFields) {
    setDraft({ ...draft, identity })
  }
  function updateLiving(livingSituation: LivingSituationFields) {
    setDraft({ ...draft, livingSituation })
  }
  function updateEducation(education: EducationFields) {
    setDraft({ ...draft, education })
  }
  function updateOccupation(occupation: OccupationFields) {
    setDraft({ ...draft, occupation })
  }

  async function save() {
    setPending(true)
    setError(null)
    const result = await saveDemographicsAction(clientId, draft)
    setPending(false)
    if (result.error || !("demographics" in result) || !result.demographics) {
      setError(result.error ?? "Could not save demographics.")
      return
    }
    setSaved(result.demographics)
    setDraft(result.demographics)
    setEditing(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {editing ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => {
              setDraft(saved)
              setError(null)
              setEditing(false)
            }}
          >
            Cancel
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setDraft(saved)
              setError(null)
              setEditing(true)
            }}
          >
            Edit
          </Button>
        )}
      </div>
      {editing ? (
        <form
          className="max-w-xl min-w-0 space-y-6"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <Subsection title="Identity">
            <IdentityFieldsEditor value={draft.identity} onChange={updateIdentity} />
          </Subsection>
          <Subsection title="Living Situation" divided>
            <LivingFieldsEditor value={draft.livingSituation} onChange={updateLiving} />
          </Subsection>
          <Subsection title="Education" divided>
            <EducationFieldsEditor value={draft.education} onChange={updateEducation} />
          </Subsection>
          <Subsection title="Occupation & Financial Concerns" divided>
            <OccupationFieldsEditor value={draft.occupation} onChange={updateOccupation} />
          </Subsection>
          <SaveRow pending={pending} error={error} onSave={() => void save()} />
        </form>
      ) : (
        <DemographicsReadOnly value={saved} />
      )}
    </div>
  )
}

function Subsection({
  title,
  divided,
  children,
}: {
  title: string
  divided?: boolean
  children: ReactNode
}) {
  return (
    <section className={cn("space-y-4", divided && "border-t pt-6")}>
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  )
}

function DemographicsReadOnly({ value }: { value: Demographics }) {
  const pronouns =
    value.identity.pronouns === "Other"
      ? value.identity.pronounsOther || "Other"
      : value.identity.pronouns
  const limited = NECESSITY_KEYS.filter((key) => value.occupation.necessities[key])

  return (
    <div className="max-w-xl space-y-6">
      <Subsection title="Identity">
        <ReadOnlyField label="Sex" value={value.identity.sex} />
        <ReadOnlyField label="Gender identity" value={value.identity.genderIdentity} />
        <ReadOnlyField label="Pronouns" value={pronouns} />
        <ReadOnlyField label="Race/Ethnicity" value={value.identity.raceEthnicity} />
        <ReadOnlyField label="Religion" value={value.identity.religion} />
        <ReadOnlyField label="Primary language" value={value.identity.primaryLanguage} />
        <ReadOnlyField label="Disability" value={value.identity.disability} />
        <ReadOnlyField label="Accessibility needs" value={value.identity.accessibilityNeeds} />
      </Subsection>
      <Subsection title="Living Situation" divided>
        <ReadOnlyField label="Living arrangement" value={value.livingSituation.livingArrangement} />
        <ReadOnlyField
          label="Client depends on others in the household"
          value={yesNoText(value.livingSituation.clientDependsOnOthers, value.livingSituation.clientDependsOnOthersDetail)}
        />
        <ReadOnlyField
          label="Others in the household depend on the client"
          value={yesNoText(value.livingSituation.othersDependOnClient, value.livingSituation.othersDependOnClientDetail)}
        />
        <ReadOnlyField label="Household composition" value={value.livingSituation.householdComposition} />
        <ReadOnlyField label="Housing stability" value={value.livingSituation.housingStability} />
      </Subsection>
      <Subsection title="Education" divided>
        <ReadOnlyField label="Level of education" value={value.education.level} />
        <ReadOnlyField label="Field of study" value={value.education.fieldOfStudy} />
        <ReadOnlyField
          label="Currently studying"
          value={yesNoText(value.education.currentlyStudying, value.education.currentlyStudyingDetail)}
        />
        <ReadOnlyField
          label="Disruption to education"
          value={yesNoText(value.education.disruption, value.education.disruptionDetail)}
        />
      </Subsection>
      <Subsection title="Occupation & Financial Concerns" divided>
        <ReadOnlyField
          label="Currently employed"
          value={yesNoText(value.occupation.currentlyEmployed, value.occupation.currentlyEmployedDetail)}
        />
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Previous jobs</p>
          {value.occupation.previousJobs.length === 0 ? (
            <p className="text-sm">Not recorded</p>
          ) : (
            value.occupation.previousJobs.map((job) => (
              <p key={job.id} className="text-sm">
                {[job.role, job.employer, jobDateRange(job)].filter(Boolean).join(" · ") || "Not recorded"}
              </p>
            ))
          )}
        </div>
        <ReadOnlyField
          label="Financial concerns"
          value={yesNoText(value.occupation.financialConcerns, value.occupation.financialConcernsDetail)}
        />
        <ReadOnlyField
          label="Access to necessities"
          value={limited.length ? `Limited: ${limited.map((key) => NECESSITY_LABELS[key]).join(", ")}` : "No limits recorded"}
        />
      </Subsection>
    </div>
  )
}

function jobDateRange(job: PreviousJob) {
  const start = formatPartialDateLabel(job.started)
  const end = formatPartialDateLabel(job.ended)
  if (start && end) return `${start} – ${end}`
  return start || end
}

function yesNoText(value: boolean | null, detail: string) {
  if (value == null) return ""
  if (!value) return "No"
  return detail.trim() ? `Yes — ${detail.trim()}` : "Yes"
}

function IdentityFieldsEditor({
  value,
  onChange,
}: {
  value: IdentityFields
  onChange: (value: IdentityFields) => void
}) {
  return (
    <>
      <SelectField id="sex" label="Sex" value={value.sex} onChange={(sex) => onChange({ ...value, sex })}>
        <option value="">Not recorded</option>
        {SEX_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </SelectField>
      <TextField
        id="gender_identity"
        label="Gender identity"
        value={value.genderIdentity}
        placeholder="if relevant"
        onChange={(genderIdentity) => onChange({ ...value, genderIdentity })}
      />
      <SelectField
        id="pronouns"
        label="Pronouns"
        value={value.pronouns}
        onChange={(pronouns) => onChange({ ...value, pronouns, pronounsOther: pronouns === "Other" ? value.pronounsOther : "" })}
      >
        <option value="">Not recorded</option>
        {PRONOUN_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </SelectField>
      {value.pronouns === "Other" ? (
        <TextField
          id="pronouns_other"
          label="Pronouns detail"
          value={value.pronounsOther}
          onChange={(pronounsOther) => onChange({ ...value, pronounsOther })}
        />
      ) : null}
      <TextField
        id="race_ethnicity"
        label="Race/Ethnicity"
        value={value.raceEthnicity}
        onChange={(raceEthnicity) => onChange({ ...value, raceEthnicity })}
      />
      <TextField id="religion" label="Religion" value={value.religion} onChange={(religion) => onChange({ ...value, religion })} />
      <TextField
        id="primary_language"
        label="Primary language"
        value={value.primaryLanguage}
        onChange={(primaryLanguage) => onChange({ ...value, primaryLanguage })}
      />
      <TextField
        id="disability"
        label="Disability"
        value={value.disability}
        onChange={(disability) => onChange({ ...value, disability })}
      />
      <TextField
        id="accessibility"
        label="Accessibility needs"
        value={value.accessibilityNeeds}
        onChange={(accessibilityNeeds) => onChange({ ...value, accessibilityNeeds })}
      />
    </>
  )
}

function LivingFieldsEditor({
  value,
  onChange,
}: {
  value: LivingSituationFields
  onChange: (value: LivingSituationFields) => void
}) {
  return (
    <>
      <TextField
        id="living_arrangement"
        label="Living arrangement"
        value={value.livingArrangement}
        hint="Where the client lives — for example own home, renting, a parent's home, supported accommodation, or residential care."
        onChange={(livingArrangement) => onChange({ ...value, livingArrangement })}
      />
      <YesNoDetail
        id="client_depends"
        label="Client depends on others in the household"
        value={value.clientDependsOnOthers}
        detail={value.clientDependsOnOthersDetail}
        onChange={(clientDependsOnOthers) => onChange({ ...value, clientDependsOnOthers })}
        onDetail={(clientDependsOnOthersDetail) => onChange({ ...value, clientDependsOnOthersDetail })}
      />
      <YesNoDetail
        id="others_depend"
        label="Others in the household depend on the client"
        value={value.othersDependOnClient}
        detail={value.othersDependOnClientDetail}
        onChange={(othersDependOnClient) => onChange({ ...value, othersDependOnClient })}
        onDetail={(othersDependOnClientDetail) => onChange({ ...value, othersDependOnClientDetail })}
      />
      <TextAreaField
        id="household"
        label="Household composition"
        value={value.householdComposition}
        onChange={(householdComposition) => onChange({ ...value, householdComposition })}
      />
      <SelectField
        id="housing_stability"
        label="Housing stability"
        value={value.housingStability}
        onChange={(housingStability) => onChange({ ...value, housingStability })}
      >
        <option value="">Not recorded</option>
        {HOUSING_STABILITY_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </SelectField>
    </>
  )
}

function EducationFieldsEditor({
  value,
  onChange,
}: {
  value: EducationFields
  onChange: (value: EducationFields) => void
}) {
  return (
    <>
      <SelectField
        id="education_level"
        label="Level of education"
        value={value.level}
        onChange={(level) => onChange({ ...value, level })}
      >
        <option value="">Not recorded</option>
        {EDUCATION_LEVEL_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </SelectField>
      <TextField
        id="field_of_study"
        label="Field of study"
        value={value.fieldOfStudy}
        onChange={(fieldOfStudy) => onChange({ ...value, fieldOfStudy })}
      />
      <YesNoDetail
        id="currently_studying"
        label="Currently studying"
        value={value.currentlyStudying}
        detail={value.currentlyStudyingDetail}
        onChange={(currentlyStudying) => onChange({ ...value, currentlyStudying })}
        onDetail={(currentlyStudyingDetail) => onChange({ ...value, currentlyStudyingDetail })}
      />
      <YesNoDetail
        id="disruption"
        label="Disruption to education"
        value={value.disruption}
        detail={value.disruptionDetail}
        onChange={(disruption) => onChange({ ...value, disruption })}
        onDetail={(disruptionDetail) => onChange({ ...value, disruptionDetail })}
      />
    </>
  )
}

function OccupationFieldsEditor({
  value,
  onChange,
}: {
  value: OccupationFields
  onChange: (value: OccupationFields) => void
}) {
  function updateJob(id: string, patch: Partial<PreviousJob>) {
    onChange({
      ...value,
      previousJobs: value.previousJobs.map((job) => (job.id === id ? { ...job, ...patch } : job)),
    })
  }

  return (
    <>
      <YesNoDetail
        id="currently_employed"
        label="Currently employed"
        value={value.currentlyEmployed}
        detail={value.currentlyEmployedDetail}
        onChange={(currentlyEmployed) => onChange({ ...value, currentlyEmployed })}
        onDetail={(currentlyEmployedDetail) => onChange({ ...value, currentlyEmployedDetail })}
      />
      <div className="space-y-3">
        <p className="text-sm font-medium">Previous jobs</p>
        {value.previousJobs.map((job, index) => (
          <div key={job.id} className="space-y-4 rounded-md border p-3">
            <TextField id={`job_role_${job.id}`} label="Role" value={job.role} onChange={(role) => updateJob(job.id, { role })} />
            <TextField
              id={`job_employer_${job.id}`}
              label="Employer"
              value={job.employer}
              onChange={(employer) => updateJob(job.id, { employer })}
            />
            <PartialDatePicker
              id={`job_start_${job.id}`}
              dateLabel="Start"
              mode="date-only"
              value={job.started}
              onChange={(started) => updateJob(job.id, { started })}
            />
            <PartialDatePicker
              id={`job_end_${job.id}`}
              dateLabel="End"
              mode="date-only"
              value={job.ended}
              onChange={(ended) => updateJob(job.id, { ended })}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange({ ...value, previousJobs: value.previousJobs.filter((item) => item.id !== job.id) })}
            >
              Remove job {index + 1}
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onChange({
              ...value,
              previousJobs: [...value.previousJobs, { id: crypto.randomUUID(), role: "", employer: "", started: "", ended: "" }],
            })
          }
        >
          + Add job
        </Button>
      </div>
      <YesNoDetail
        id="financial_concerns"
        label="Financial concerns"
        value={value.financialConcerns}
        detail={value.financialConcernsDetail}
        onChange={(financialConcerns) => onChange({ ...value, financialConcerns })}
        onDetail={(financialConcernsDetail) => onChange({ ...value, financialConcernsDetail })}
      />
      <div className="space-y-2">
        <p className="text-sm font-medium">Access to necessities</p>
        <p className="text-xs text-muted-foreground">Tick any area where access is limited.</p>
        {NECESSITY_KEYS.map((key) => (
          <div key={key} className="flex items-start gap-3">
            <Checkbox
              id={`necessity_${key}`}
              checked={value.necessities[key]}
              onCheckedChange={(checked) =>
                onChange({
                  ...value,
                  necessities: { ...value.necessities, [key]: checked === true },
                })
              }
            />
            <Label htmlFor={`necessity_${key}`} className="cursor-pointer font-normal">
              {NECESSITY_LABELS[key]}
            </Label>
          </div>
        ))}
      </div>
    </>
  )
}
