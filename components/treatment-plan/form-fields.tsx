"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { CheckboxOption } from "@/lib/treatment-plans/fields"
import type {
  MultiSelectSectionJson,
  OngoingAssessmentsJson,
  SuicideAttemptRecord,
} from "@/lib/treatment-plans/types"

export function FormCheckboxField({
  id,
  name,
  label,
  defaultChecked = false,
}: {
  id: string
  name: string
  label: string
  defaultChecked?: boolean
}) {
  const [checked, setChecked] = useState(defaultChecked)

  return (
    <div className="flex items-start gap-3">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => setChecked(value === true)}
      />
      <input type="hidden" name={name} value={checked ? "on" : ""} />
      <Label htmlFor={id} className="cursor-pointer font-normal leading-snug">
        {label}
      </Label>
    </div>
  )
}

export function OngoingAssessmentsFields({
  value,
}: {
  value: OngoingAssessmentsJson
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <FormCheckboxField
        id="ongoing_phq9"
        name="ongoing_phq9"
        label="PHQ-9"
        defaultChecked={value.phq9}
      />
      <FormCheckboxField
        id="ongoing_gad7"
        name="ongoing_gad7"
        label="GAD-7"
        defaultChecked={value.gad7}
      />
      <FormCheckboxField
        id="ongoing_assist"
        name="ongoing_assist"
        label="ASSIST"
        defaultChecked={value.assist}
      />
    </div>
  )
}

export function MultiSelectSectionFields({
  prefix,
  options,
  value,
}: {
  prefix: string
  options: CheckboxOption[]
  value: MultiSelectSectionJson
}) {
  const [otherItems, setOtherItems] = useState<string[]>(
    value.other.length > 0 ? value.other : []
  )

  function addOtherRow() {
    setOtherItems((items) => [...items, ""])
  }

  function updateOtherRow(index: number, text: string) {
    setOtherItems((items) => items.map((item, i) => (i === index ? text : item)))
  }

  function removeOtherRow(index: number) {
    setOtherItems((items) => items.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((option) => (
          <FormCheckboxField
            key={option.key}
            id={`${prefix}_${option.key}`}
            name={`${prefix}_${option.key}`}
            label={option.label}
            defaultChecked={value.selected.includes(option.key)}
          />
        ))}
      </div>

      <div className="space-y-3 border-t pt-4">
        <p className="text-sm font-medium">Other</p>
        {otherItems.map((item, index) => (
          <div key={index} className="flex gap-2">
            <Input
              name={`${prefix}_other`}
              value={item}
              onChange={(e) => updateOtherRow(index, e.target.value)}
              placeholder="Custom item"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => removeOtherRow(index)}
            >
              Remove
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addOtherRow}>
          Add other
        </Button>
      </div>
    </div>
  )
}

export function BehaviouralTargetsFields({
  initialItems,
}: {
  initialItems: string[]
}) {
  const [items, setItems] = useState<string[]>(
    initialItems.length > 0 ? initialItems : []
  )

  function addRow() {
    setItems((rows) => [...rows, ""])
  }

  function updateRow(index: number, text: string) {
    setItems((rows) => rows.map((row, i) => (i === index ? text : row)))
  }

  function removeRow(index: number) {
    setItems((rows) => rows.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={index} className="flex gap-2">
          <Input
            name="behavioural_targets"
            value={item}
            onChange={(e) => updateRow(index, e.target.value)}
            placeholder="Behavioural target"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => removeRow(index)}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        Add behavioural target
      </Button>
    </div>
  )
}

export function SuicideAttemptsFields({
  initialItems,
}: {
  initialItems: SuicideAttemptRecord[]
}) {
  const [items, setItems] = useState<SuicideAttemptRecord[]>(initialItems)

  function addRow() {
    setItems((rows) => [
      ...rows,
      {
        id: crypto.randomUUID(),
        year: new Date().getFullYear(),
        month: null,
        day: null,
        notes: null,
      },
    ])
  }

  function updateRow(index: number, patch: Partial<SuicideAttemptRecord>) {
    setItems((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function removeRow(index: number) {
    setItems((rows) => rows.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={item.id}
          className="flex flex-wrap items-end gap-2 rounded-md border p-3"
        >
          <input type="hidden" name="suicide_attempt_id" value={item.id} />
          <div>
            <Label className="text-xs">Year</Label>
            <Input
              name="suicide_attempt_year"
              type="number"
              value={item.year}
              onChange={(e) =>
                updateRow(index, { year: parseInt(e.target.value, 10) })
              }
              className="w-24"
            />
          </div>
          <div>
            <Label className="text-xs">Month</Label>
            <Input
              name="suicide_attempt_month"
              type="number"
              min={1}
              max={12}
              value={item.month ?? ""}
              onChange={(e) =>
                updateRow(index, {
                  month: e.target.value ? parseInt(e.target.value, 10) : null,
                })
              }
              className="w-20"
            />
          </div>
          <div>
            <Label className="text-xs">Day</Label>
            <Input
              name="suicide_attempt_day"
              type="number"
              min={1}
              max={31}
              value={item.day ?? ""}
              onChange={(e) =>
                updateRow(index, {
                  day: e.target.value ? parseInt(e.target.value, 10) : null,
                })
              }
              className="w-20"
            />
          </div>
          <div className="min-w-[200px] flex-1">
            <Label className="text-xs">Notes</Label>
            <Input
              name="suicide_attempt_notes"
              value={item.notes ?? ""}
              onChange={(e) => updateRow(index, { notes: e.target.value })}
              placeholder="Method, circumstances, etc. (clinician record only — not shown in reports)"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => removeRow(index)}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        Add suicide attempt
      </Button>
    </div>
  )
}
