"use client"

import { useState, type ReactNode } from "react"

import {
  saveEducationAction,
  saveIdentityAction,
  saveLivingSituationAction,
  saveOccupationAction,
} from "@/app/clients/[client_id]/background/actions"
import { SaveRow, SelectField, TextAreaField, TextField, YesNoDetail } from "@/components/client-background/fields"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  EDUCATION_LEVEL_OPTIONS,
  HOUSING_STABILITY_OPTIONS,
  HOUSING_TYPE_OPTIONS,
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

export function DemographicsSection({
  clientId,
  demographics,
}: {
  clientId: string
  demographics: Demographics
}) {
  return (
    <div className="columns-1 gap-4 md:columns-2">
      <IdentityCard clientId={clientId} initial={demographics.identity} />
      <LivingCard clientId={clientId} initial={demographics.livingSituation} />
      <EducationCard clientId={clientId} initial={demographics.education} />
      <OccupationCard clientId={clientId} initial={demographics.occupation} />
    </div>
  )
}

function CardShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="mb-4 break-inside-avoid">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

function IdentityCard({ clientId, initial }: { clientId: string; initial: IdentityFields }) {
  const [value, setValue] = useState(initial)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setPending(true)
    setError(null)
    const result = await saveIdentityAction(clientId, value)
    setPending(false)
    if (result.error || !("identity" in result)) {
      setError(result.error ?? "Could not save identity.")
      return
    }
    setValue(result.identity)
  }

  return (
    <CardShell title="Identity">
      <SelectField id="sex" label="Sex" value={value.sex} onChange={(sex) => setValue({ ...value, sex })}>
        <option value="">Not recorded</option>
        {SEX_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </SelectField>
      <div className="flex items-start gap-3">
        <Checkbox
          id="gender_differs"
          checked={value.genderDiffersFromSex}
          onCheckedChange={(checked) =>
            setValue({
              ...value,
              genderDiffersFromSex: checked === true,
              genderIdentity: checked === true ? value.genderIdentity : "",
            })
          }
        />
        <Label htmlFor="gender_differs" className="cursor-pointer font-normal">
          Gender identity differs from sex
        </Label>
      </div>
      {value.genderDiffersFromSex ? (
        <TextField
          id="gender_identity"
          label="Gender identity"
          value={value.genderIdentity}
          onChange={(genderIdentity) => setValue({ ...value, genderIdentity })}
        />
      ) : null}
      <SelectField
        id="pronouns"
        label="Pronouns"
        value={value.pronouns}
        onChange={(pronouns) => setValue({ ...value, pronouns, pronounsOther: pronouns === "Other" ? value.pronounsOther : "" })}
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
          onChange={(pronounsOther) => setValue({ ...value, pronounsOther })}
        />
      ) : null}
      <TextField
        id="race_ethnicity"
        label="Race/Ethnicity"
        value={value.raceEthnicity}
        onChange={(raceEthnicity) => setValue({ ...value, raceEthnicity })}
      />
      <TextField id="religion" label="Religion" value={value.religion} onChange={(religion) => setValue({ ...value, religion })} />
      <TextField
        id="primary_language"
        label="Primary language"
        value={value.primaryLanguage}
        onChange={(primaryLanguage) => setValue({ ...value, primaryLanguage })}
      />
      <TextAreaField
        id="disability"
        label="Disability"
        value={value.disability}
        onChange={(disability) => setValue({ ...value, disability })}
      />
      <TextAreaField
        id="accessibility"
        label="Accessibility needs"
        value={value.accessibilityNeeds}
        onChange={(accessibilityNeeds) => setValue({ ...value, accessibilityNeeds })}
      />
      <SaveRow pending={pending} error={error} onSave={() => void save()} />
    </CardShell>
  )
}

function LivingCard({ clientId, initial }: { clientId: string; initial: LivingSituationFields }) {
  const [value, setValue] = useState(initial)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setPending(true)
    setError(null)
    const result = await saveLivingSituationAction(clientId, value)
    setPending(false)
    if (result.error || !("livingSituation" in result)) {
      setError(result.error ?? "Could not save living situation.")
      return
    }
    setValue(result.livingSituation)
  }

  return (
    <CardShell title="Living Situation">
      <SelectField
        id="housing_type"
        label="Housing type"
        value={value.housingType}
        onChange={(housingType) => setValue({ ...value, housingType })}
      >
        <option value="">Not recorded</option>
        {HOUSING_TYPE_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </SelectField>
      <TextAreaField
        id="household"
        label="Household composition"
        value={value.householdComposition}
        onChange={(householdComposition) => setValue({ ...value, householdComposition })}
      />
      <SelectField
        id="housing_stability"
        label="Housing stability"
        value={value.housingStability}
        onChange={(housingStability) => setValue({ ...value, housingStability })}
      >
        <option value="">Not recorded</option>
        {HOUSING_STABILITY_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </SelectField>
      <SaveRow pending={pending} error={error} onSave={() => void save()} />
    </CardShell>
  )
}

function EducationCard({ clientId, initial }: { clientId: string; initial: EducationFields }) {
  const [value, setValue] = useState(initial)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setPending(true)
    setError(null)
    const result = await saveEducationAction(clientId, value)
    setPending(false)
    if (result.error || !("education" in result)) {
      setError(result.error ?? "Could not save education.")
      return
    }
    setValue(result.education)
  }

  return (
    <CardShell title="Education">
      <SelectField id="education_level" label="Level of education" value={value.level} onChange={(level) => setValue({ ...value, level })}>
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
        onChange={(fieldOfStudy) => setValue({ ...value, fieldOfStudy })}
      />
      <YesNoDetail
        id="currently_studying"
        label="Currently studying"
        value={value.currentlyStudying}
        detail={value.currentlyStudyingDetail}
        onChange={(currentlyStudying) => setValue({ ...value, currentlyStudying })}
        onDetail={(currentlyStudyingDetail) => setValue({ ...value, currentlyStudyingDetail })}
      />
      <YesNoDetail
        id="disruption"
        label="Disruption to education"
        value={value.disruption}
        detail={value.disruptionDetail}
        onChange={(disruption) => setValue({ ...value, disruption })}
        onDetail={(disruptionDetail) => setValue({ ...value, disruptionDetail })}
      />
      <SaveRow pending={pending} error={error} onSave={() => void save()} />
    </CardShell>
  )
}

function OccupationCard({ clientId, initial }: { clientId: string; initial: OccupationFields }) {
  const [value, setValue] = useState(initial)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateJob(id: string, patch: Partial<PreviousJob>) {
    setValue({
      ...value,
      previousJobs: value.previousJobs.map((job) => (job.id === id ? { ...job, ...patch } : job)),
    })
  }

  async function save() {
    setPending(true)
    setError(null)
    const result = await saveOccupationAction(clientId, value)
    setPending(false)
    if (result.error || !("occupation" in result)) {
      setError(result.error ?? "Could not save occupation and financial concerns.")
      return
    }
    setValue(result.occupation)
  }

  return (
    <CardShell title="Occupation & Financial Concerns">
      <YesNoDetail
        id="currently_employed"
        label="Currently employed"
        value={value.currentlyEmployed}
        detail={value.currentlyEmployedDetail}
        onChange={(currentlyEmployed) => setValue({ ...value, currentlyEmployed })}
        onDetail={(currentlyEmployedDetail) => setValue({ ...value, currentlyEmployedDetail })}
      />
      <div className="space-y-3">
        <p className="text-sm font-medium">Previous jobs</p>
        {value.previousJobs.map((job, index) => (
          <div key={job.id} className="space-y-2 rounded-md border p-3">
            <TextField id={`job_role_${job.id}`} label="Role" value={job.role} onChange={(role) => updateJob(job.id, { role })} />
            <TextField
              id={`job_employer_${job.id}`}
              label="Employer"
              value={job.employer}
              onChange={(employer) => updateJob(job.id, { employer })}
            />
            <TextField
              id={`job_dates_${job.id}`}
              label="Dates"
              value={job.dates}
              onChange={(dates) => updateJob(job.id, { dates })}
              placeholder="e.g. 2016–2019"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                setValue({ ...value, previousJobs: value.previousJobs.filter((item) => item.id !== job.id) })
              }
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
            setValue({
              ...value,
              previousJobs: [
                ...value.previousJobs,
                { id: crypto.randomUUID(), role: "", employer: "", dates: "" },
              ],
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
        onChange={(financialConcerns) => setValue({ ...value, financialConcerns })}
        onDetail={(financialConcernsDetail) => setValue({ ...value, financialConcernsDetail })}
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
                setValue({
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
      <SaveRow pending={pending} error={error} onSave={() => void save()} />
    </CardShell>
  )
}
