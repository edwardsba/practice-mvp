"use client"

import { RadioOptionList } from "@/components/assessments/form/radio-option-list"
import { TextListInput } from "@/components/assessments/form/text-list-input"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { TICK_VALUE, type FormElement } from "@/lib/assessments/form-rules"
import { cn } from "@/lib/utils"

export function ElementControl({
  element,
  values,
  onChange,
  onActivate,
  error,
  disabled,
}: {
  element: FormElement
  values: string[]
  onChange: (next: string[]) => void
  /** Fires when the practitioner interacts with a choice (incl. re-tap). */
  onActivate?: () => void
  error?: boolean
  disabled?: boolean
}) {
  const id = `el-${element.elementKey}`

  switch (element.elementType) {
    case "yes_no":
    case "radio":
      return (
        <RadioOptionList
          options={element.options}
          value={values[0]}
          onValueChange={(next) => onChange([next])}
          onOptionActivate={() => onActivate?.()}
          name={id}
          aria-labelledby={`${id}-label`}
          required={element.isRequired}
          disabled={disabled}
        />
      )

    case "checkbox":
      return (
        <div className="space-y-2" role="group" aria-labelledby={`${id}-label`}>
          {element.options.map((option) => {
            const optionId = `${id}-${option.value}`
            const checked = values.includes(option.value)
            return (
              <label
                key={option.value}
                htmlFor={optionId}
                className={cn(
                  "flex min-h-11 cursor-pointer items-start gap-3 rounded-md border px-3 py-2",
                  checked ? "border-primary bg-primary/5" : "border-input",
                  error && "border-destructive"
                )}
              >
                <input
                  id={optionId}
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => {
                    if (checked) {
                      onChange(values.filter((v) => v !== option.value))
                    } else {
                      onChange([...values, option.value])
                    }
                  }}
                  className="mt-1"
                />
                <span className="text-sm leading-snug">{option.label}</span>
              </label>
            )
          })}
        </div>
      )

    case "tick": {
      const checked = values.includes(TICK_VALUE)
      return (
        <label
          htmlFor={id}
          className={cn(
            "flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2",
            checked ? "border-primary bg-primary/5" : "border-input",
            error && "border-destructive"
          )}
        >
          <input
            id={id}
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={() => onChange(checked ? [] : [TICK_VALUE])}
          />
          <span className="text-sm font-medium">{element.questionText}</span>
        </label>
      )
    }

    case "text_list":
      return (
        <TextListInput
          id={id}
          values={values}
          onChange={onChange}
          disabled={disabled}
          error={error}
        />
      )

    case "long_text":
      return (
        <Textarea
          id={id}
          value={values[0] ?? ""}
          disabled={disabled}
          onChange={(event) => onChange([event.target.value])}
          className={cn(
            "min-h-28",
            error && "border-destructive focus-visible:ring-destructive/40"
          )}
        />
      )

    case "short_text":
      return (
        <Input
          id={id}
          value={values[0] ?? ""}
          disabled={disabled}
          onChange={(event) => onChange([event.target.value])}
          className={cn(
            "min-h-11",
            error && "border-destructive focus-visible:ring-destructive/40"
          )}
        />
      )

    case "date":
      return (
        <Input
          id={id}
          type="date"
          value={values[0] ?? ""}
          disabled={disabled}
          onChange={(event) => onChange([event.target.value])}
          className={cn(
            "min-h-11 max-w-xs",
            error && "border-destructive focus-visible:ring-destructive/40"
          )}
        />
      )

    default:
      return null
  }
}
