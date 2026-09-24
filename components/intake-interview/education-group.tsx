"use client"

import { DynamicList } from "@/components/intake-interview/dynamic-list"
import {
  Field,
  NativeSelect,
  TextAreaField,
  TextField,
  YesNoField,
} from "@/components/intake-interview/fields"
import { Button } from "@/components/ui/button"
import { EDUCATION_LEVEL_OPTIONS } from "@/lib/intake-interview/constants"
import type {
  EducationFields,
  EducationalEvent,
} from "@/lib/intake-interview/types"

function emptyEducationalEvent(): EducationalEvent {
  return {
    id: "",
    description: "",
    ageDateStart: "",
    completed: null,
    detail: "",
  }
}

export function EducationGroup({
  value,
  onChange,
}: {
  value: EducationFields
  onChange: (value: EducationFields) => void
}) {
  function patch(partial: Partial<EducationFields>) {
    onChange({ ...value, ...partial })
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Education level" htmlFor="education_level">
          <NativeSelect
            id="education_level"
            value={value.level}
            onChange={(level) => patch({ level })}
          >
            <option value="">Not recorded</option>
            {EDUCATION_LEVEL_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <TextField
          id="field_of_study"
          label="Field of study"
          value={value.fieldOfStudy}
          onChange={(fieldOfStudy) => patch({ fieldOfStudy })}
        />
      </div>

      <YesNoField
        name="currently_studying"
        label="Currently studying?"
        value={value.currentlyStudying}
        onChange={(currentlyStudying) => patch({ currentlyStudying })}
      />
      {value.currentlyStudying ? (
        <TextField
          id="currently_studying_detail"
          label="Current study detail"
          value={value.currentlyStudyingDetail}
          onChange={(currentlyStudyingDetail) =>
            patch({ currentlyStudyingDetail })
          }
        />
      ) : null}

      <YesNoField
        name="education_disruption"
        label="Any disruption to education?"
        value={value.disruption}
        onChange={(disruption) => patch({ disruption })}
      />
      {value.disruption ? (
        <TextAreaField
          id="education_disruption_detail"
          label="Disruption detail"
          value={value.disruptionDetail}
          onChange={(disruptionDetail) => patch({ disruptionDetail })}
        />
      ) : null}

      <div className="space-y-3 border-t pt-4">
        {!value.showEducationalEventHistory ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => patch({ showEducationalEventHistory: true })}
          >
            Add educational event history (optional)
          </Button>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Educational event history</p>
                <p className="text-xs text-muted-foreground">
                  Clinically significant patterns of starting or not completing
                  courses. Interview-only; optional.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  patch({
                    showEducationalEventHistory: false,
                    educationalEvents: [],
                  })
                }
              >
                Hide
              </Button>
            </div>
            <DynamicList
              items={value.educationalEvents}
              onChange={(educationalEvents) => patch({ educationalEvents })}
              createEmpty={emptyEducationalEvent}
              isEmpty={(item) => !item.description.trim()}
              renderRow={(item, _index, update) => (
                <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
                  <TextField
                    id={`${item.id}_desc`}
                    label="Course / pattern"
                    value={item.description}
                    onChange={(description) => update({ ...item, description })}
                  />
                  <TextField
                    id={`${item.id}_when`}
                    label="When"
                    value={item.ageDateStart}
                    onChange={(ageDateStart) => update({ ...item, ageDateStart })}
                  />
                  <div className="sm:col-span-2">
                    <YesNoField
                      name={`${item.id}_completed`}
                      label="Completed?"
                      value={item.completed}
                      onChange={(completed) => update({ ...item, completed })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <TextAreaField
                      id={`${item.id}_detail`}
                      label="Detail"
                      value={item.detail}
                      onChange={(detail) => update({ ...item, detail })}
                    />
                  </div>
                </div>
              )}
            />
          </>
        )}
      </div>
    </div>
  )
}
