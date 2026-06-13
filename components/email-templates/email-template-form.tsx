"use client"

import Link from "next/link"
import { useActionState, useRef, useState } from "react"

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
import { EMAIL_TEMPLATE_VARIABLE_CHIPS } from "@/lib/email/templates"

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
  const isSendAssessment = initialValues?.templateKey === "send_assessment"
  const isProtectedTemplate =
    initialValues?.templateKey === "send_assessment" ||
    initialValues?.templateKey === "ad_hoc"
  const [hasActionButton, setHasActionButton] = useState(
    isSendAssessment ? true : (initialValues?.hasActionButton ?? false)
  )
  const [message, setMessage] = useState(initialValues?.message ?? "")
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

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

    setDeleting(true)
    setDeleteError(null)

    const result = await deleteEmailTemplate(
      practiceId,
      initialValues.emailTemplateId
    )

    if (result?.error) {
      setDeleteError(result.error)
      setDeleting(false)
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
        {isSendAssessment ? (
          <p className="mb-4 text-sm text-muted-foreground">
            This is the Send Assessment template — special behaviour (assessment
            link creation, assessment selection) is built into the system and
            cannot be changed here.
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
              {EMAIL_TEMPLATE_VARIABLE_CHIPS.map((chip) => (
                <Button
                  key={chip.variable}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insertVariable(chip.variable)}
                >
                  {chip.label}
                </Button>
              ))}
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

          {!isSendAssessment ? (
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
            <input type="hidden" name="hasActionButton" value="true" />
          )}

          {hasActionButton || isSendAssessment ? (
            <div className="space-y-2">
              <Label htmlFor="actionButtonLabel">Action button label</Label>
              <Input
                id="actionButtonLabel"
                name="actionButtonLabel"
                placeholder="e.g. Complete Questionnaire"
                defaultValue={initialValues?.actionButtonLabel ?? ""}
              />
              {!isSendAssessment ? (
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
            {initialValues?.emailTemplateId ? (
              <Button
                type="button"
                variant="destructive"
                disabled={isProtectedTemplate || deleting}
                title={
                  isProtectedTemplate
                    ? "This system template cannot be deleted."
                    : undefined
                }
                onClick={handleDelete}
              >
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            ) : null}
          </div>

          {deleteError ? (
            <p className="text-sm text-destructive" role="alert">
              {deleteError}
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  )
}
