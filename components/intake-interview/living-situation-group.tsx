"use client"

import {
  Field,
  NativeSelect,
  TextAreaField,
} from "@/components/intake-interview/fields"
import {
  HOUSING_STABILITY_OPTIONS,
  HOUSING_TYPE_OPTIONS,
} from "@/lib/intake-interview/constants"
import type { LivingSituationFields } from "@/lib/intake-interview/types"

export function LivingSituationGroup({
  value,
  onChange,
}: {
  value: LivingSituationFields
  onChange: (value: LivingSituationFields) => void
}) {
  function patch(partial: Partial<LivingSituationFields>) {
    onChange({ ...value, ...partial })
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextAreaField
        id="household_composition"
        label="Household composition"
        value={value.householdComposition}
        onChange={(householdComposition) => patch({ householdComposition })}
        placeholder="Who lives in the household"
      />
      <Field label="Housing type" htmlFor="housing_type">
        <NativeSelect
          id="housing_type"
          value={value.housingType}
          onChange={(housingType) => patch({ housingType })}
        >
          <option value="">Not recorded</option>
          {HOUSING_TYPE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Housing stability" htmlFor="housing_stability">
        <NativeSelect
          id="housing_stability"
          value={value.housingStability}
          onChange={(housingStability) => patch({ housingStability })}
        >
          <option value="">Not recorded</option>
          {HOUSING_STABILITY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </NativeSelect>
      </Field>
    </div>
  )
}
