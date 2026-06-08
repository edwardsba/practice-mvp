"use client"

import Link from "next/link"
import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { XIcon } from "lucide-react"

import { createPracticeInline } from "@/app/practice/actions"
import {
  upsertMembership,
  type AvailabilityBlockInput,
  type MembershipFormState,
} from "@/lib/actions/practitioner-practice"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  DAY_OF_WEEK_NAMES,
  AVAILABILITY_MODES,
  AVAILABILITY_MODE_LABELS,
} from "@/lib/practitioner/format"
import { cn } from "@/lib/utils"

const selectClassName = cn(
  "flex h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
)

const timeInputClassName = cn(
  "block h-9 w-full max-w-full min-w-0 appearance-none py-1",
  "[&::-webkit-date-and-time-value]:min-w-0 [&::-webkit-date-and-time-value]:text-left"
)

type PracticeOption = {
  practiceId: string
  practiceName: string
}

type MembershipInitialValues = {
  membershipId?: string
  practiceId?: string
  practiceName?: string
  role?: string | null
  medicareProviderNumber?: string | null
  availabilityBlocks?: AvailabilityBlockInput[]
}

function emptyBlock(): AvailabilityBlockInput {
  return {
    dayOfWeek: 0,
    startTime: "09:00",
    endTime: "17:00",
    mode: "both",
  }
}

function formatTimeInput(time: string): string {
  return time.slice(0, 5)
}

export function MembershipForm({
  practices,
  initialValues,
}: {
  practices: PracticeOption[]
  initialValues?: MembershipInitialValues
}) {
  const router = useRouter()
  const isEditing = Boolean(initialValues?.membershipId)
  const boundAction = upsertMembership.bind(
    null,
    initialValues?.membershipId
  )
  const [state, formAction, pending] = useActionState(
    boundAction,
    {} as MembershipFormState
  )

  const [practiceOptions, setPracticeOptions] = useState(practices)
  const [selectedPracticeId, setSelectedPracticeId] = useState(
    initialValues?.practiceId ?? practices[0]?.practiceId ?? ""
  )
  const [showCreatePractice, setShowCreatePractice] = useState(false)
  const [blocks, setBlocks] = useState<AvailabilityBlockInput[]>(
    initialValues?.availabilityBlocks?.map((block) => ({
      ...block,
      startTime: formatTimeInput(block.startTime),
      endTime: formatTimeInput(block.endTime),
    })) ?? []
  )

  const [createState, createAction, createPending] = useActionState(
    createPracticeInline,
    {}
  )

  useEffect(() => {
    if (state.success) {
      router.push("/practitioner")
      router.refresh()
    }
  }, [state.success, router])

  useEffect(() => {
    if (createState.practiceId && createState.practiceName) {
      setPracticeOptions((current) => [
        ...current,
        {
          practiceId: createState.practiceId!,
          practiceName: createState.practiceName!,
        },
      ])
      setSelectedPracticeId(createState.practiceId)
      setShowCreatePractice(false)
    }
  }, [createState.practiceId, createState.practiceName])

  function updateBlock(
    index: number,
    field: keyof AvailabilityBlockInput,
    value: string | number
  ) {
    setBlocks((current) =>
      current.map((block, blockIndex) =>
        blockIndex === index ? { ...block, [field]: value } : block
      )
    )
  }

  function removeBlock(index: number) {
    setBlocks((current) => current.filter((_, blockIndex) => blockIndex !== index))
  }

  return (
    <div className="space-y-6">
      {showCreatePractice && !isEditing ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">Create new practice</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="inline_practice_name">Practice name</Label>
                <Input
                  id="inline_practice_name"
                  name="practice_name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inline_timezone">Timezone</Label>
                <Input
                  id="inline_timezone"
                  name="timezone"
                  defaultValue="Australia/Sydney"
                />
              </div>
              {createState.error ? (
                <p className="text-sm text-destructive" role="alert">
                  {createState.error}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={createPending}>
                  {createPending ? "Creating…" : "Create practice"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreatePractice(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            {isEditing ? "Edit practice membership" : "Add practice membership"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-6">
            <input
              type="hidden"
              name="availability_blocks"
              value={JSON.stringify(blocks)}
            />

            <div className="space-y-2">
              <Label htmlFor="practice_id">Practice</Label>
              {isEditing ? (
                <p className="text-sm font-medium">
                  {initialValues?.practiceName ?? "—"}
                </p>
              ) : (
                <div className="space-y-3">
                  <select
                    id="practice_id"
                    name="practice_id"
                    required={!showCreatePractice}
                    value={selectedPracticeId}
                    onChange={(event) => setSelectedPracticeId(event.target.value)}
                    className={selectClassName}
                    disabled={showCreatePractice || practiceOptions.length === 0}
                  >
                    {practiceOptions.length === 0 ? (
                      <option value="">No practices available</option>
                    ) : (
                      practiceOptions.map((practice) => (
                        <option
                          key={practice.practiceId}
                          value={practice.practiceId}
                        >
                          {practice.practiceName}
                        </option>
                      ))
                    )}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCreatePractice((current) => !current)}
                  >
                    {showCreatePractice
                      ? "Cancel new practice"
                      : "Create new practice"}
                  </Button>
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Input
                  id="role"
                  name="role"
                  placeholder="Principal Psychologist"
                  defaultValue={initialValues?.role ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="medicare_provider_number">
                  Medicare provider number
                </Label>
                <Input
                  id="medicare_provider_number"
                  name="medicare_provider_number"
                  defaultValue={initialValues?.medicareProviderNumber ?? ""}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Availability blocks</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setBlocks((current) => [...current, emptyBlock()])}
                >
                  Add availability block
                </Button>
              </div>

              {blocks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No availability blocks added yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {blocks.map((block, index) => (
                    <div
                      key={index}
                      className="grid min-w-0 gap-3 rounded-lg border p-3 sm:grid-cols-[1.2fr_1fr_1fr_1fr_auto]"
                    >
                      <div className="min-w-0 space-y-1">
                        <Label className="text-xs">Day</Label>
                        <select
                          value={block.dayOfWeek}
                          onChange={(event) =>
                            updateBlock(index, "dayOfWeek", Number(event.target.value))
                          }
                          className={selectClassName}
                        >
                          {DAY_OF_WEEK_NAMES.map((day, dayIndex) => (
                            <option key={day} value={dayIndex}>
                              {day}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="min-w-0 space-y-1">
                        <Label className="text-xs">Start time</Label>
                        <Input
                          type="time"
                          value={block.startTime}
                          onChange={(event) =>
                            updateBlock(index, "startTime", event.target.value)
                          }
                          className={timeInputClassName}
                        />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <Label className="text-xs">End time</Label>
                        <Input
                          type="time"
                          value={block.endTime}
                          onChange={(event) =>
                            updateBlock(index, "endTime", event.target.value)
                          }
                          className={timeInputClassName}
                        />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <Label className="text-xs">Mode</Label>
                        <select
                          value={block.mode}
                          onChange={(event) =>
                            updateBlock(
                              index,
                              "mode",
                              event.target.value as AvailabilityBlockInput["mode"]
                            )
                          }
                          className={selectClassName}
                        >
                          {AVAILABILITY_MODES.map((mode) => (
                            <option key={mode} value={mode}>
                              {AVAILABILITY_MODE_LABELS[mode]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex min-w-0 items-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Remove availability block"
                          onClick={() => removeBlock(index)}
                        >
                          <XIcon />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {state.error ? (
              <p className="text-sm text-destructive" role="alert">
                {state.error}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save membership"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/practitioner">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
