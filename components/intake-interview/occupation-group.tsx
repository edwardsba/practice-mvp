"use client"

import { DynamicList } from "@/components/intake-interview/dynamic-list"
import { TextAreaField, TextField } from "@/components/intake-interview/fields"
import { emptyOccupationJob } from "@/lib/intake-interview/defaults"
import type { OccupationFields, OccupationJob } from "@/lib/intake-interview/types"

function JobEntryFields({
  job,
  onChange,
  showEndYear,
}: {
  job: OccupationJob
  onChange: (job: OccupationJob) => void
  showEndYear: boolean
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TextField
        id={`${job.id}_title`}
        label="Role"
        value={job.title}
        onChange={(title) => onChange({ ...job, title })}
      />
      <TextField
        id={`${job.id}_employer`}
        label="Employer"
        value={job.employer}
        onChange={(employer) => onChange({ ...job, employer })}
      />
      <TextField
        id={`${job.id}_start`}
        label="Start year"
        value={job.startYear}
        onChange={(startYear) => onChange({ ...job, startYear })}
      />
      {showEndYear ? (
        <TextField
          id={`${job.id}_end`}
          label="End year"
          value={job.endYear}
          onChange={(endYear) => onChange({ ...job, endYear })}
        />
      ) : null}
    </div>
  )
}

export function OccupationGroup({
  value,
  onChange,
}: {
  value: OccupationFields
  onChange: (value: OccupationFields) => void
}) {
  const filledJobs = [
    value.currentJob.title.trim() ? { ...value.currentJob, label: "Current role" } : null,
    ...value.previousJobs
      .filter((job) => job.title.trim())
      .map((job, index) => ({ ...job, label: `Previous role ${index + 1}` })),
  ].filter((job): job is OccupationJob & { label: string } => job != null)

  function updatePrevious(previousJobs: OccupationJob[]) {
    onChange({ ...value, previousJobs })
  }

  function updateIssues(jobId: string, issues: string) {
    if (jobId === value.currentJob.id) {
      onChange({ ...value, currentJob: { ...value.currentJob, issues } })
      return
    }
    onChange({
      ...value,
      previousJobs: value.previousJobs.map((job) =>
        job.id === jobId ? { ...job, issues } : job
      ),
    })
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-medium">Current role</p>
        <JobEntryFields
          job={value.currentJob}
          showEndYear={false}
          onChange={(currentJob) => onChange({ ...value, currentJob })}
        />
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">Previous jobs</p>
          <p className="text-xs text-muted-foreground">
            List roles first. Issues with each role are asked in a separate pass
            below.
          </p>
        </div>
        <DynamicList
          items={value.previousJobs}
          onChange={updatePrevious}
          createEmpty={() => emptyOccupationJob()}
          isEmpty={(job) => !job.title.trim()}
          renderRow={(job, _index, update) => (
            <div className="rounded-md border p-3">
              <JobEntryFields job={job} showEndYear onChange={update} />
            </div>
          )}
        />
      </div>

      {filledJobs.length > 0 ? (
        <div className="space-y-4 border-t pt-4">
          <div>
            <p className="text-sm font-medium">Issues with these roles</p>
            <p className="text-xs text-muted-foreground">
              Asked after the job list, not while entering each role.
            </p>
          </div>
          {filledJobs.map((job) => (
            <TextAreaField
              key={job.id}
              id={`${job.id}_issues`}
              label={`Any issues with this role — ${job.label}${job.title ? `: ${job.title}` : ""}`}
              value={job.issues}
              onChange={(issues) => updateIssues(job.id, issues)}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
