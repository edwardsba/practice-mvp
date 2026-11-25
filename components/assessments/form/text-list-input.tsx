"use client"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/**
 * Growing list of short text entries. One empty box always trails; typing in
 * the last box adds another. Blank boxes are ignored by the rules layer.
 */
export function TextListInput({
  id,
  values,
  onChange,
  disabled,
  error,
}: {
  id: string
  values: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
  error?: boolean
}) {
  const entries = values.length === 0 ? [""] : [...values]
  if (entries[entries.length - 1] !== "") {
    entries.push("")
  }

  const hasContent = values.some((v) => v.trim().length > 0)

  function updateAt(index: number, value: string) {
    const next = [...entries]
    next[index] = value
    // Drop trailing empties except one
    while (next.length > 1 && next[next.length - 1] === "" && next[next.length - 2] === "") {
      next.pop()
    }
    onChange(next)
  }

  function removeAt(index: number) {
    const next = entries.filter((_, i) => i !== index)
    if (next.length === 0) onChange([""])
    else onChange(next)
  }

  return (
    <div className="space-y-2">
      {entries.map((value, index) => {
        const isLast = index === entries.length - 1
        const placeholder =
          !hasContent && isLast
            ? "Add a note"
            : isLast
              ? "Add another"
              : "Add a note"
        return (
          <div key={`${id}-${index}`} className="flex items-center gap-2">
            <Input
              id={index === 0 ? id : undefined}
              value={value}
              disabled={disabled}
              placeholder={placeholder}
              onChange={(event) => updateAt(index, event.target.value)}
              className={cn(
                "min-h-11",
                error && "border-destructive focus-visible:ring-destructive/40"
              )}
            />
            {!isLast || value.trim() ? (
              <button
                type="button"
                className="min-h-11 shrink-0 px-2 text-sm text-muted-foreground hover:text-destructive"
                onClick={() => removeAt(index)}
                disabled={disabled}
                aria-label={`Remove entry ${index + 1}`}
              >
                Remove
              </button>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
