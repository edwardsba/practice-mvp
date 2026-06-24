"use client"

import Link from "next/link"
import { useActionState, useRef, useState } from "react"

import { DeleteConfirmationButton } from "@/components/delete-confirmation-button"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  deleteEmailTemplate,
  upsertEmailTemplate,
  type EmailTemplateFormState,
} from "@/lib/actions/email-templates"
import {
  APPOINTMENT_CONTEXT_EXCLUDED_TEMPLATE_KEYS,
  EMAIL_TEMPLATE_VARIABLE_CHIPS,
  NO_ACTION_BUTTON_TEMPLATE_KEYS,
  PROTECTED_TEMPLATE_KEYS,
  SYSTEM_LINK_TEMPLATE_KEYS,
  type EmailTemplateVariableChip,
} from "@/lib/email/templates"
import { cn } from "@/lib/utils"

type InitialValues = {
  emailTemplateId?: string
  templateKey?: string | null
  name?: string
  subject?: string
  message?: string
  defaultCc?: string | null
  defaultBcc?: string | null
  hasActionButton?: boolean
  actionButtonLabel?: string | null
}

function isChipAvailable(
  chip: EmailTemplateVariableChip,
  templateKey: string | null | undefined,
  hasActionButton: boolean
) {
  if (chip.availability === "always") return true
  if (chip.availability === "action_button") return hasActionButton
  if (chip.availability === "appointment_context") {
    return templateKey
      ? !APPOINTMENT_CONTEXT_EXCLUDED_TEMPLATE_KEYS.includes(templateKey)
      : true
  }
  return false
}

function chipUnavailableTitle(chip: EmailTemplateVariableChip) {
  if (chip.availability === "action_button") {
    return "Available when 'Has action button' is enabled"
  }
  if (chip.availability === "appointment_context") {
    return "Not available in ad-hoc templates"
  }
  return undefined
}

function getSystemTemplateNote(
  templateKey: string | null | undefined
): string | null {
  switch (templateKey) {
    case "send_assessment":
      return "This is the Send Assessment template — special behaviour (assessment link creation, assessment selection) is built into the system and cannot be changed here."
    case "pre_session_questionnaire":
      return "This is the Pre-Session Questionnaire template, sent automatically the day before each appointment. The questionnaire link is generated automatically by the system and inserted via {questionnaire_link}."
    case "post_session":
      return "This is the Post-Session template, sent automatically the day after each completed appointment. The feedback link is generated automatically by the system and inserted via {questionnaire_link}."
    case "appointment_reminder":
      return "This is the Appointment Reminder template, sent automatically two days before each appointment. It has no action button."
    default:
      return null
  }
}

export function EmailTemplateForm({
  practiceId,
  initialValues,
  cancelHref,
}: {
  practiceId: string
  initialValues?: InitialValues
  cancelHref: string
}) {
  const messageRef = useRef<HTMLTextAreaElement>(null)
  const templateKey = initialValues?.templateKey ?? null
  const hasSystemActionButton = templateKey
    ? SYSTEM_LINK_TEMPLATE_KEYS.includes(templateKey)
    : false
  const forcesNoActionButton = templateKey
    ? NO_ACTION_BUTTON_TEMPLATE_KEYS.includes(templateKey)
    : false
  const isProtectedTemplate = templateKey
    ? PROTECTED_TEMPLATE_KEYS.includes(templateKey)
    : false
  const [hasActionButton, setHasActionButton] = useState(
    hasSystemActionButton
      ? true
      : forcesNoActionButton
        ? false
        : (initialValues?.hasActionButton ?? false)
  )
  const systemTemplateNote = getSystemTemplateNote(templateKey)
  const [message, setMessage] = useState(initialValues?.message ?? "")
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [state, formAction, pending] = useActionState(
    upsertEmailTemplate.bind(
      null,
      practiceId,
      initialValues?.emailTemplateId
    ) as (
      prevState: EmailTemplateFormState,
      formData: FormData
    ) => Promise<EmailTemplateFormState>,
    {} as EmailTemplateFormState
  )

  function insertVariable(variable: string) {
    const el = messageRef.current
    if (!el) {
      setMessage((current) => current + variable)
      return
    }

    const start = el.selectionStart ?? message.length
    const end = el.selectionEnd ?? message.length
    const next = message.slice(0, start) + variable + message.slice(end)
    setMessage(next)

    requestAnimationFrame(() => {
      el.focus()
      const position = start + variable.length
      el.setSelectionRange(position, position)
    })
  }

  async function handleDelete() {
    if (!initialValues?.emailTemplateId || isProtectedTemplate) return

    setDeleteError(null)

    const result = await deleteEmailTemplate(
      practiceId,
      initialValues.emailTemplateId
    )

    if (result?.error) {
      setDeleteError(result.error)
      throw new Error(result.error)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {initialValues?.emailTemplateId ? "Edit template" : "New template"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {systemTemplateNote ? (
          <p className="mb-4 text-sm text-muted-foreground">
            {systemTemplateNote}
          </p>
        ) : null}

        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              required
              defaultValue={initialValues?.name ?? ""}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              name="subject"
              required={initialValues?.templateKey !== "ad_hoc"}
              defaultValue={initialValues?.subject ?? ""}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              name="message"
              ref={messageRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={10}
              required={initialValues?.templateKey !== "ad_hoc"}
              className="font-sans text-sm"
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Insert variable</p>
            <div className="flex flex-wrap gap-2">
              {EMAIL_TEMPLATE_VARIABLE_CHIPS.map((chip) => {
                const available = isChipAvailable(
                  chip,
                  templateKey,
                  hasActionButton
                )

                return (
                  <Button
                    key={chip.variable}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!available}
                    title={
                      !available ? chipUnavailableTitle(chip) : undefined
                    }
                    className={cn(
                      !available && "cursor-not-allowed opacity-40"
                    )}
                    onClick={() => {
                      if (!available) return
                      insertVariable(chip.variable)
                    }}
                  >
                    {chip.label}
                  </Button>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="defaultCc">CC preset</Label>
            <Input
              id="defaultCc"
              name="defaultCc"
              placeholder="Optional — comma-separated emails"
              defaultValue={initialValues?.defaultCc ?? ""}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="defaultBcc">BCC preset</Label>
            <Input
              id="defaultBcc"
              name="defaultBcc"
              placeholder="Optional — comma-separated emails"
              defaultValue={initialValues?.defaultBcc ?? ""}
            />
          </div>

          {!hasSystemActionButton && !forcesNoActionButton ? (
            <>
              <input
                type="hidden"
                name="hasActionButton"
                value={hasActionButton ? "true" : "false"}
              />
              <div className="flex items-center gap-2">
                <Checkbox
                  id="hasActionButton"
                  checked={hasActionButton}
                  onCheckedChange={(checked) =>
                    setHasActionButton(checked === true)
                  }
                />
                <Label htmlFor="hasActionButton">Has action button</Label>
              </div>
            </>
          ) : (
            <input
              type="hidden"
              name="hasActionButton"
              value={hasActionButton ? "true" : "false"}
            />
          )}

          {hasActionButton ? (
            <div className="space-y-2">
              <Label htmlFor="actionButtonLabel">Action button label</Label>
              <Input
                id="actionButtonLabel"
                name="actionButtonLabel"
                placeholder="e.g. Complete Questionnaire"
                defaultValue={initialValues?.actionButtonLabel ?? ""}
              />
              {!hasSystemActionButton ? (
                <p className="text-sm text-muted-foreground">
                  A button link source must be implemented in code for this
                  template to function (e.g. assessment link, appointment change
                  link).
                </p>
              ) : null}
            </div>
          ) : null}

          {state.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href={cancelHref}>Cancel</Link>
            </Button>
          </div>

          {deleteError ? (
            <p className="text-sm text-destructive" role="alert">
              {deleteError}
            </p>
          ) : null}
        </form>

        {initialValues?.emailTemplateId ? (
          <DeleteConfirmationButton
            entityName="Email Template"
            blockedReason={
              isProtectedTemplate
                ? "This system template cannot be deleted."
                : undefined
            }
            onDelete={handleDelete}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}
