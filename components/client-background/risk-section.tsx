"use client"

import { useState } from "react"

import { saveRiskAction } from "@/app/clients/[client_id]/background/actions"
import { SaveRow, SelectField, TextAreaField } from "@/components/client-background/fields"
import {
  PROTECTIVE_FACTORS,
  RATED_VALUES,
  RATED_VALUE_LABELS,
  RISK_FACTORS,
  type RatedFactorKey,
  type RiskRatings,
} from "@/lib/client-background/types"

export function RiskSection({ clientId, risk }: { clientId: string; risk: RiskRatings }) {
  const [value, setValue] = useState(risk)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function patch(key: RatedFactorKey, partial: Partial<RiskRatings[RatedFactorKey]>) {
    setValue({ ...value, [key]: { ...value[key], ...partial } })
  }

  async function save() {
    setPending(true)
    setError(null)
    const result = await saveRiskAction(clientId, value)
    setPending(false)
    if (result.error || !("risk" in result)) {
      setError(result.error ?? "Could not save risk ratings.")
      return
    }
    setValue(result.risk)
  }

  return (
    <div className="space-y-4">
      <SaveRow pending={pending} error={error} onSave={() => void save()} />
      <div className="grid gap-6 lg:grid-cols-2">
        <FactorColumn title="Risk Factors" factors={RISK_FACTORS} value={value} onChange={patch} />
        <FactorColumn title="Protective Factors" factors={PROTECTIVE_FACTORS} value={value} onChange={patch} />
      </div>
    </div>
  )
}

function FactorColumn({
  title,
  factors,
  value,
  onChange,
}: {
  title: string
  factors: readonly { key: RatedFactorKey; label: string }[]
  value: RiskRatings
  onChange: (key: RatedFactorKey, partial: Partial<RiskRatings[RatedFactorKey]>) => void
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {factors.map((factor) => (
        <div key={factor.key} className="space-y-2 rounded-md border p-3">
          <SelectField
            id={`risk_${factor.key}`}
            label={factor.label}
            value={value[factor.key].value}
            onChange={(next) => onChange(factor.key, { value: next as RiskRatings[RatedFactorKey]["value"] })}
          >
            <option value="">Not recorded</option>
            {RATED_VALUES.map((option) => (
              <option key={option} value={option}>
                {RATED_VALUE_LABELS[option]}
              </option>
            ))}
          </SelectField>
          <TextAreaField
            id={`risk_${factor.key}_comment`}
            label="Comment"
            value={value[factor.key].comment}
            onChange={(comment) => onChange(factor.key, { comment })}
          />
        </div>
      ))}
    </section>
  )
}
