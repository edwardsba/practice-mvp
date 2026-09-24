"use client"

import { TextAreaField } from "@/components/intake-interview/fields"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { NECESSITY_KEYS, NECESSITY_LABELS } from "@/lib/intake-interview/constants"
import type { FinancialFields, NecessityAccess } from "@/lib/intake-interview/types"

export function FinancialGroup({
  value,
  onChange,
}: {
  value: FinancialFields
  onChange: (value: FinancialFields) => void
}) {
  function updateNecessity(
    key: (typeof NECESSITY_KEYS)[number],
    next: NecessityAccess
  ) {
    onChange({ ...value, [key]: next })
  }

  return (
    <div className="space-y-6">
      <TextAreaField
        id="financial_concerns"
        label="Financial concerns"
        value={value.financialConcerns}
        onChange={(financialConcerns) => onChange({ ...value, financialConcerns })}
      />

      <div className="space-y-3">
        <p className="text-sm font-medium">Access to necessities</p>
        <p className="text-xs text-muted-foreground">
          Tick any area where access is a concern, then add detail.
        </p>
        {NECESSITY_KEYS.map((key) => {
          const item = value[key]
          return (
            <div key={key} className="space-y-2">
              <div className="flex items-start gap-3">
                <Checkbox
                  id={`necessity_${key}`}
                  checked={item.hasDifficulty}
                  onCheckedChange={(checked) =>
                    updateNecessity(key, {
                      ...item,
                      hasDifficulty: checked === true,
                    })
                  }
                />
                <Label
                  htmlFor={`necessity_${key}`}
                  className="cursor-pointer font-normal"
                >
                  Difficulty accessing {NECESSITY_LABELS[key].toLowerCase()}
                </Label>
              </div>
              {item.hasDifficulty ? (
                <div className="ml-7">
                  <TextAreaField
                    id={`necessity_${key}_detail`}
                    label="Detail"
                    value={item.detail}
                    onChange={(detail) => updateNecessity(key, { ...item, detail })}
                  />
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
