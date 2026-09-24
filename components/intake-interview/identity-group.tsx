"use client"

import { useState } from "react"

import {
  Field,
  NativeSelect,
  TextAreaField,
  TextField,
  YesNoField,
} from "@/components/intake-interview/fields"
import { PRONOUN_OPTIONS, SEX_OPTIONS } from "@/lib/intake-interview/constants"
import type { IdentityFields } from "@/lib/intake-interview/types"

export function IdentityGroup({
  value,
  onChange,
}: {
  value: IdentityFields
  onChange: (value: IdentityFields) => void
}) {
  const isCustomPronoun =
    value.pronouns !== "" && !PRONOUN_OPTIONS.includes(value.pronouns)
  const [showCustomPronouns, setShowCustomPronouns] = useState(isCustomPronoun)

  function patch(partial: Partial<IdentityFields>) {
    onChange({ ...value, ...partial })
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Sex" htmlFor="identity_sex">
        <NativeSelect
          id="identity_sex"
          value={value.sex}
          onChange={(sex) => patch({ sex })}
        >
          <option value="">Not recorded</option>
          {SEX_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Pronouns" htmlFor="identity_pronouns">
        <NativeSelect
          id="identity_pronouns"
          value={showCustomPronouns || isCustomPronoun ? "Another" : value.pronouns}
          onChange={(next) => {
            if (next === "Another") {
              setShowCustomPronouns(true)
              if (PRONOUN_OPTIONS.includes(value.pronouns)) {
                patch({ pronouns: "" })
              }
            } else {
              setShowCustomPronouns(false)
              patch({ pronouns: next })
            }
          }}
        >
          <option value="">Not recorded</option>
          {PRONOUN_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
          <option value="Another">Another</option>
        </NativeSelect>
      </Field>
      {showCustomPronouns || isCustomPronoun ? (
        <TextField
          id="identity_pronouns_other"
          label="Pronouns (specify)"
          value={PRONOUN_OPTIONS.includes(value.pronouns) ? "" : value.pronouns}
          onChange={(pronouns) => patch({ pronouns })}
        />
      ) : null}

      <div className="sm:col-span-2">
        <YesNoField
          name="gender_differs"
          label="Does gender identity differ from sex?"
          value={value.genderDiffersFromSex}
          onChange={(genderDiffersFromSex) => patch({ genderDiffersFromSex })}
        />
      </div>
      {value.genderDiffersFromSex ? (
        <TextField
          id="identity_gender"
          label="Gender identity"
          value={value.genderIdentity}
          onChange={(genderIdentity) => patch({ genderIdentity })}
        />
      ) : null}

      <TextField
        id="identity_race"
        label="Race"
        value={value.race}
        onChange={(race) => patch({ race })}
      />
      <TextField
        id="identity_ethnicity"
        label="Ethnicity"
        value={value.ethnicity}
        onChange={(ethnicity) => patch({ ethnicity })}
      />
      <TextField
        id="identity_culture"
        label="Cultural / religious background"
        value={value.culturalReligiousBackground}
        onChange={(culturalReligiousBackground) =>
          patch({ culturalReligiousBackground })
        }
      />
      <TextField
        id="identity_language"
        label="Primary language"
        value={value.primaryLanguage}
        onChange={(primaryLanguage) => patch({ primaryLanguage })}
      />
      <div className="sm:col-span-2">
        <YesNoField
          name="interpreter_needed"
          label="Interpreter needed?"
          value={value.interpreterNeeded}
          onChange={(interpreterNeeded) => patch({ interpreterNeeded })}
        />
      </div>
      {value.interpreterNeeded ? (
        <TextField
          id="identity_interpreter"
          label="Interpreter needs"
          value={value.interpreterNeeds}
          onChange={(interpreterNeeds) => patch({ interpreterNeeds })}
        />
      ) : null}
      <TextAreaField
        id="identity_disability"
        label="Disability"
        value={value.disability}
        onChange={(disability) => patch({ disability })}
      />
      <TextAreaField
        id="identity_access"
        label="Accessibility needs"
        value={value.accessibilityNeeds}
        onChange={(accessibilityNeeds) => patch({ accessibilityNeeds })}
      />
    </div>
  )
}
