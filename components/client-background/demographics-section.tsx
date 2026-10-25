"use client"

import { useState, type ReactNode } from "react"

import { saveDemographicsAction, saveMedicationAction } from "@/app/clients/[client_id]/background/actions"
import { AddButton, ClientAnswer, PartialDatePicker, ReadOnlyField, SaveRow, SelectField, TextField, YesNoDetail } from "@/components/client-background/fields"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { MedicationFields, MedicationReadOnly } from "@/components/client-background/medication-stressors"
import { livingWithClientLines } from "@/lib/client-background/tree"
import {
  EDUCATION_LEVEL_OPTIONS,
  EMPLOYED_WORK_STATUSES,
  HOUSING_STABILITY_OPTIONS,
  HOUSING_TYPE_OPTIONS,
  LIVES_WITH_LABELS,
  LIVES_WITH_OPTIONS,
  NECESSITY_KEYS,
  NECESSITY_LABELS,
  SEX_OPTIONS,
  WORK_STATUS_LABELS,
  WORK_STATUSES,
  type Demographics,
  type EducationFields,
  type IdentityFields,
  type LivesWith,
  type LivingSituationFields,
  type MedicationRecord,
  type OccupationFields,
  type PreviousJob,
  type RelationshipRecord,
  type WorkStatus,
} from "@/lib/client-background/types"
import { formatPartialDateLabel } from "@/lib/client-background/age"
import type { ClientBackgroundSuggestions } from "@/lib/background-questionnaire/to-client-background"
import { cn } from "@/lib/utils"

export function DemographicsSection({
  clientId,
  demographics,
  relationships,
  medication,
}: {
  clientId: string
  demographics: Demographics
  relationships: RelationshipRecord[]
  medication: MedicationRecord
}) {
  const [saved, setSaved] = useState(demographics)
  const [draft, setDraft] = useState(demographics)
  const [savedMedication, setSavedMedication] = useState(medication)
  const [medicationDraft, setMedicationDraft] = useState(medication)
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
    const demographicsResult = await saveDemographicsAction(clientId, draft)
    if (demographicsResult.error || !("demographics" in demographicsResult) || !demographicsResult.demographics) {
      setPending(false)
      setError(demographicsResult.error ?? "Could not save demographics.")
      return
    }
    setSaved(demographicsResult.demographics)
    setDraft(demographicsResult.demographics)
    const medicationResult = await saveMedicationAction(clientId, medicationDraft)
    setPending(false)
    if (medicationResult.error || !("medication" in medicationResult) || !medicationResult.medication) {
      setError(medicationResult.error ?? "Could not save medication.")
      return
    }
    setSavedMedication(medicationResult.medication)
    setMedicationDraft(medicationResult.medication)
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
              setMedicationDraft(savedMedication)
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
              setMedicationDraft(savedMedication)
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
          <Subsection title="Education" divided>
            <EducationFieldsEditor value={draft.education} onChange={updateEducation} />
          </Subsection>
          <Subsection title="Occupation and financial" divided>
            <OccupationFieldsEditor value={draft.occupation} onChange={updateOccupation} />
          </Subsection>
          <Subsection title="Living situation" divided>
            <LivingFieldsEditor value={draft.livingSituation} relationships={relationships} onChange={updateLiving} />
          </Subsection>
          <Subsection title="Medication" divided>
            <MedicationFields idPrefix="demographics_medication" value={medicationDraft} onChange={setMedicationDraft} />
          </Subsection>
          <SaveRow pending={pending} error={error} onSave={() => void save()} />
        </form>
      ) : (
        <DemographicsReadOnly value={saved} relationships={relationships} medication={savedMedication} />
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

function DemographicsReadOnly({
  value,
  relationships,
  medication,
}: {
  value: Demographics
  relationships: RelationshipRecord[]
  medication: MedicationRecord
}) {
  const pronouns = value.identity.pronouns
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
        <ReadOnlyField
          label="Disability"
          value={yesNoText(value.identity.disability, value.identity.disabilityDetail)}
        />
        <ReadOnlyField label="Accessibility needs" value={value.identity.accessibilityNeeds} />
      </Subsection>
      <Subsection title="Education" divided>
        <ReadOnlyField label="Level of education" value={value.education.level} />
        <ReadOnlyField
          label="Currently studying"
          value={yesNoText(value.education.currentlyStudying, value.education.currentlyStudyingDetail)}
        />
        <ReadOnlyField label="Field of study" value={value.education.fieldOfStudy} />
        <ReadOnlyField
          label="Disruption to education"
          value={yesNoText(value.education.disruption, value.education.disruptionDetail)}
        />
      </Subsection>
      <Subsection title="Occupation and financial" divided>
        <ReadOnlyField label="Work status" value={workStatusText(value.occupation)} />
        {value.occupation.role.trim() ? <ReadOnlyField label="Role" value={value.occupation.role} /> : null}
        {value.occupation.employer.trim() ? <ReadOnlyField label="Employer" value={value.occupation.employer} /> : null}
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
      <Subsection title="Living situation" divided>
        <ReadOnlyField label="Housing type" value={value.livingSituation.housingType} />
        <ReadOnlyField label="Who the client lives with" value={livesWithText(value.livingSituation)} />
        <PeopleLivingWithClient relationships={relationships} />
        <ReadOnlyField label="Housing stability" value={value.livingSituation.housingStability} />
      </Subsection>
      <Subsection title="Medication" divided>
        <MedicationReadOnly value={medication} />
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

function workStatusText(occupation: OccupationFields) {
  if (!occupation.workStatus) return ""
  if (occupation.workStatus === "other") {
    const other = occupation.workStatusOther.trim()
    return other ? `Other — ${other}` : "Other"
  }
  return WORK_STATUS_LABELS[occupation.workStatus]
}

function livesWithText(living: LivingSituationFields) {
  if (!living.livesWith) return ""
  if (living.livesWith === "other") {
    const other = living.livesWithOther.trim()
    return other ? `Other — ${other}` : "Other"
  }
  return LIVES_WITH_LABELS[living.livesWith]
}

function employedWorkStatus(status: WorkStatus | "") {
  return status !== "" && (EMPLOYED_WORK_STATUSES as readonly string[]).includes(status)
}

function withWorkStatus(value: OccupationFields, workStatus: WorkStatus | ""): OccupationFields {
  const employed = employedWorkStatus(workStatus)
  return {
    ...value,
    workStatus,
    role: employed ? value.role : "",
    employer: employed ? value.employer : "",
    workStatusOther: workStatus === "other" ? value.workStatusOther : "",
  }
}

function PeopleLivingWithClient({ relationships }: { relationships: RelationshipRecord[] }) {
  const lines = livingWithClientLines(relationships)
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">People living with the client</p>
      {lines.length === 0 ? (
        <p className="text-sm">No family members recorded as living with the client</p>
      ) : (
        lines.map((line, index) => (
          <p key={`${line}-${index}`} className="text-sm">
            {line}
          </p>
        ))
      )}
    </div>
  )
}

export function IdentityFieldsEditor({
  value,
  onChange,
  onCommit,
  client,
}: {
  value: IdentityFields
  onChange: (value: IdentityFields) => void
  onCommit?: () => void
  client?: ClientBackgroundSuggestions["identity"]
}) {
  function apply(next: IdentityFields) {
    onChange(next)
    onCommit?.()
  }
  const disability = client?.disability
  return (
    <>
      <SelectField
        id="sex"
        label="Sex"
        value={value.sex}
        client={
          client?.sex ? (
            <ClientAnswer
              label={client.sex.label}
              matches={value.sex === client.sex.apply}
              onUse={() => apply({ ...value, sex: client.sex!.apply })}
            />
          ) : undefined
        }
        onChange={(sex) => onChange({ ...value, sex })}
      >
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
        client={
          client?.genderIdentity ? (
            <ClientAnswer
              label={client.genderIdentity.label}
              matches={value.genderIdentity === client.genderIdentity.apply}
              onUse={() => apply({ ...value, genderIdentity: client.genderIdentity!.apply })}
            />
          ) : undefined
        }
        onChange={(genderIdentity) => onChange({ ...value, genderIdentity })}
      />
      <TextField
        id="pronouns"
        label="Pronouns"
        value={value.pronouns}
        client={
          client?.pronouns ? (
            <ClientAnswer
              label={client.pronouns.label}
              matches={value.pronouns === client.pronouns.apply}
              onUse={() => apply({ ...value, pronouns: client.pronouns!.apply })}
            />
          ) : undefined
        }
        onChange={(pronouns) => onChange({ ...value, pronouns })}
      />
      <TextField
        id="race_ethnicity"
        label="Race/Ethnicity"
        value={value.raceEthnicity}
        client={
          client?.raceEthnicity ? (
            <ClientAnswer
              label={client.raceEthnicity.label}
              matches={value.raceEthnicity === client.raceEthnicity.apply}
              onUse={() => apply({ ...value, raceEthnicity: client.raceEthnicity!.apply })}
            />
          ) : undefined
        }
        onChange={(raceEthnicity) => onChange({ ...value, raceEthnicity })}
      />
      <TextField
        id="religion"
        label="Religion"
        value={value.religion}
        client={
          client?.religion ? (
            <ClientAnswer
              label={client.religion.label}
              matches={value.religion === client.religion.apply}
              onUse={() => apply({ ...value, religion: client.religion!.apply })}
            />
          ) : undefined
        }
        onChange={(religion) => onChange({ ...value, religion })}
      />
      <TextField
        id="primary_language"
        label="Primary language"
        value={value.primaryLanguage}
        client={
          client?.primaryLanguage ? (
            <ClientAnswer
              label={client.primaryLanguage.label}
              matches={value.primaryLanguage === client.primaryLanguage.apply}
              onUse={() => apply({ ...value, primaryLanguage: client.primaryLanguage!.apply })}
            />
          ) : undefined
        }
        onChange={(primaryLanguage) => onChange({ ...value, primaryLanguage })}
      />
      <YesNoDetail
        id="disability"
        label="Disability"
        value={value.disability}
        detail={value.disabilityDetail}
        client={
          disability ? (
            <ClientAnswer
              label={disability.label}
              matches={
                value.disability === disability.apply.value &&
                (disability.apply.value === false || value.disabilityDetail === disability.apply.detail)
              }
              onUse={() =>
                apply({
                  ...value,
                  disability: disability.apply.value,
                  disabilityDetail: disability.apply.detail,
                })
              }
            />
          ) : undefined
        }
        onChange={(disabilityValue) => onChange({ ...value, disability: disabilityValue })}
        onDetail={(disabilityDetail) => onChange({ ...value, disabilityDetail })}
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

export function LivingFieldsEditor({
  value,
  relationships,
  onChange,
  onCommit,
  client,
}: {
  value: LivingSituationFields
  relationships: RelationshipRecord[]
  onChange: (value: LivingSituationFields) => void
  onCommit?: () => void
  client?: ClientBackgroundSuggestions["living"]
}) {
  function apply(next: LivingSituationFields) {
    onChange(next)
    onCommit?.()
  }
  const housingType = client?.housingType
  const livesWith = client?.livesWith
  const housingStability = client?.housingStability
  return (
    <>
      <SelectField
        id="housing_type"
        label="Housing type"
        value={value.housingType}
        client={
          housingType ? (
            <ClientAnswer
              label={housingType.label}
              matches={value.housingType === housingType.apply}
              onUse={() => apply({ ...value, housingType: housingType.apply })}
            />
          ) : undefined
        }
        onChange={(next) => onChange({ ...value, housingType: next })}
      >
        <option value="">Not recorded</option>
        {HOUSING_TYPE_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </SelectField>
      <SelectField
        id="lives_with"
        label="Who the client lives with"
        value={value.livesWith}
        client={
          livesWith ? (
            <ClientAnswer
              label={livesWith.label}
              matches={
                value.livesWith === livesWith.apply.livesWith &&
                (livesWith.apply.livesWith !== "other" || value.livesWithOther === livesWith.apply.livesWithOther)
              }
              onUse={() =>
                apply({
                  ...value,
                  livesWith: livesWith.apply.livesWith,
                  livesWithOther: livesWith.apply.livesWithOther,
                })
              }
            />
          ) : undefined
        }
        onChange={(next) =>
          onChange({
            ...value,
            livesWith: next as LivesWith | "",
            livesWithOther: next === "other" ? value.livesWithOther : "",
          })
        }
      >
        <option value="">Not recorded</option>
        {LIVES_WITH_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {LIVES_WITH_LABELS[option]}
          </option>
        ))}
      </SelectField>
      {value.livesWith === "other" ? (
        <TextField
          id="lives_with_other"
          label="Other living arrangement"
          value={value.livesWithOther}
          onChange={(livesWithOther) => onChange({ ...value, livesWithOther })}
        />
      ) : null}
      <PeopleLivingWithClient relationships={relationships} />
      <SelectField
        id="housing_stability"
        label="Housing stability"
        value={value.housingStability}
        client={
          housingStability ? (
            <ClientAnswer
              label={housingStability.label}
              matches={value.housingStability === housingStability.apply}
              onUse={() => apply({ ...value, housingStability: housingStability.apply })}
            />
          ) : undefined
        }
        onChange={(next) => onChange({ ...value, housingStability: next })}
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

export function EducationFieldsEditor({
  value,
  onChange,
  onCommit,
  client,
}: {
  value: EducationFields
  onChange: (value: EducationFields) => void
  onCommit?: () => void
  client?: ClientBackgroundSuggestions["education"]
}) {
  function apply(next: EducationFields) {
    onChange(next)
    onCommit?.()
  }
  const level = client?.level
  const fieldOfStudy = client?.fieldOfStudy
  const currentlyStudying = client?.currentlyStudying
  const disruption = client?.disruption
  return (
    <>
      <SelectField
        id="education_level"
        label="Level of education"
        value={value.level}
        client={
          level ? (
            <ClientAnswer
              label={level.label}
              matches={value.level === level.apply}
              onUse={() => apply({ ...value, level: level.apply })}
            />
          ) : undefined
        }
        onChange={(next) => onChange({ ...value, level: next })}
      >
        <option value="">Not recorded</option>
        {EDUCATION_LEVEL_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </SelectField>
      <YesNoDetail
        id="currently_studying"
        label="Currently studying"
        value={value.currentlyStudying}
        detail={value.currentlyStudyingDetail}
        client={
          currentlyStudying ? (
            <ClientAnswer
              label={currentlyStudying.label}
              matches={
                value.currentlyStudying === currentlyStudying.apply.value &&
                (currentlyStudying.apply.value === false ||
                  value.currentlyStudyingDetail === currentlyStudying.apply.detail)
              }
              onUse={() =>
                apply({
                  ...value,
                  currentlyStudying: currentlyStudying.apply.value,
                  currentlyStudyingDetail: currentlyStudying.apply.detail,
                })
              }
            />
          ) : undefined
        }
        onChange={(next) => onChange({ ...value, currentlyStudying: next })}
        onDetail={(currentlyStudyingDetail) => onChange({ ...value, currentlyStudyingDetail })}
      />
      <TextField
        id="field_of_study"
        label="Field of study"
        value={value.fieldOfStudy}
        client={
          fieldOfStudy ? (
            <ClientAnswer
              label={fieldOfStudy.label}
              matches={value.fieldOfStudy === fieldOfStudy.apply}
              onUse={() => apply({ ...value, fieldOfStudy: fieldOfStudy.apply })}
            />
          ) : undefined
        }
        onChange={(next) => onChange({ ...value, fieldOfStudy: next })}
      />
      <YesNoDetail
        id="disruption"
        label="Disruption to education"
        value={value.disruption}
        detail={value.disruptionDetail}
        client={
          disruption ? (
            <ClientAnswer
              label={disruption.label}
              matches={
                value.disruption === disruption.apply.value &&
                (disruption.apply.value === false || value.disruptionDetail === disruption.apply.detail)
              }
              onUse={() =>
                apply({
                  ...value,
                  disruption: disruption.apply.value,
                  disruptionDetail: disruption.apply.detail,
                })
              }
            />
          ) : undefined
        }
        onChange={(next) => onChange({ ...value, disruption: next })}
        onDetail={(disruptionDetail) => onChange({ ...value, disruptionDetail })}
      />
    </>
  )
}

export function OccupationFieldsEditor({
  value,
  onChange,
  onCommit,
  client,
}: {
  value: OccupationFields
  onChange: (value: OccupationFields) => void
  onCommit?: () => void
  client?: ClientBackgroundSuggestions["occupation"]
}) {
  function updateJob(id: string, patch: Partial<PreviousJob>) {
    onChange({
      ...value,
      previousJobs: value.previousJobs.map((job) => (job.id === id ? { ...job, ...patch } : job)),
    })
  }

  function apply(next: OccupationFields) {
    onChange(next)
    onCommit?.()
  }

  const workStatus = client?.workStatus
  const role = client?.role
  const employer = client?.employer
  const previousJob = client?.previousJob
  const necessities = client?.necessities
  const previousJobMatches =
    previousJob != null &&
    value.previousJobs.some(
      (job) => job.role === previousJob.apply.role && job.employer === previousJob.apply.employer
    )

  return (
    <>
      <SelectField
        id="work_status"
        label="Work status"
        value={value.workStatus}
        client={
          workStatus ? (
            <ClientAnswer
              label={workStatus.label}
              matches={
                value.workStatus === workStatus.apply.workStatus &&
                value.workStatusOther === workStatus.apply.workStatusOther
              }
              onUse={() =>
                apply({
                  ...withWorkStatus(value, workStatus.apply.workStatus),
                  workStatusOther: workStatus.apply.workStatusOther,
                })
              }
            />
          ) : undefined
        }
        onChange={(next) => onChange(withWorkStatus(value, next as WorkStatus | ""))}
      >
        <option value="">Not recorded</option>
        {WORK_STATUSES.map((option) => (
          <option key={option} value={option}>
            {WORK_STATUS_LABELS[option]}
          </option>
        ))}
      </SelectField>
      {employedWorkStatus(value.workStatus) ? (
        <>
          <TextField
            id="work_role"
            label="Role"
            value={value.role}
            client={
              role ? (
                <ClientAnswer
                  label={role.label}
                  matches={value.role === role.apply}
                  onUse={() => apply({ ...value, role: role.apply })}
                />
              ) : undefined
            }
            onChange={(next) => onChange({ ...value, role: next })}
          />
          <TextField
            id="work_employer"
            label="Employer"
            value={value.employer}
            client={
              employer ? (
                <ClientAnswer
                  label={employer.label}
                  matches={value.employer === employer.apply}
                  onUse={() => apply({ ...value, employer: employer.apply })}
                />
              ) : undefined
            }
            onChange={(next) => onChange({ ...value, employer: next })}
          />
        </>
      ) : null}
      {value.workStatus === "other" ? (
        <TextField
          id="work_status_other"
          label="Other work status"
          value={value.workStatusOther}
          onChange={(workStatusOther) => onChange({ ...value, workStatusOther })}
        />
      ) : null}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Previous jobs</p>
          {previousJob ? (
            <ClientAnswer
              label={previousJob.label}
              matches={previousJobMatches}
              onUse={
                previousJobMatches
                  ? undefined
                  : () =>
                      apply({
                        ...value,
                        previousJobs: [
                          ...value.previousJobs,
                          {
                            id: crypto.randomUUID(),
                            role: previousJob.apply.role,
                            employer: previousJob.apply.employer,
                            started: "",
                            ended: "",
                          },
                        ],
                      })
              }
            />
          ) : null}
        </div>
        {value.previousJobs.map((job, index) => (
          <div key={job.id} className="space-y-4 rounded-md border p-4">
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
              onClick={() => {
                onChange({ ...value, previousJobs: value.previousJobs.filter((item) => item.id !== job.id) })
                onCommit?.()
              }}
            >
              Remove job {index + 1}
            </Button>
          </div>
        ))}
        <AddButton
          label="+ Add job"
          onClick={() => {
            onChange({
              ...value,
              previousJobs: [...value.previousJobs, { id: crypto.randomUUID(), role: "", employer: "", started: "", ended: "" }],
            })
            onCommit?.()
          }}
        />
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
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Access to necessities</p>
          {necessities ? (
            <ClientAnswer
              label={necessities.label}
              matches={NECESSITY_KEYS.every((key) => value.necessities[key] === necessities.apply[key])}
              onUse={() => apply({ ...value, necessities: necessities.apply })}
            />
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">Tick any area where access is limited.</p>
        {NECESSITY_KEYS.map((key) => (
          <div key={key} className="flex items-start gap-3">
            <Checkbox
              id={`necessity_${key}`}
              checked={value.necessities[key]}
              onCheckedChange={(checked) => {
                onChange({
                  ...value,
                  necessities: { ...value.necessities, [key]: checked === true },
                })
                onCommit?.()
              }}
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
