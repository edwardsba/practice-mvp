"use server"

import { and, asc, eq, isNull, notInArray, or } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { emailTemplates } from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  EXCLUDED_FROM_MANUAL_SEND_TEMPLATE_KEYS,
  NO_ACTION_BUTTON_TEMPLATE_KEYS,
  PROTECTED_TEMPLATE_KEYS,
  SYSTEM_LINK_TEMPLATE_KEYS,
} from "@/lib/email/templates"

export type EmailTemplateFormState = {
  error?: string
  success?: boolean
  emailTemplateId?: string
}

async function verifyPracticeId(practiceId: string) {
  const context = await requirePractitionerContext()
  if (context.practiceId !== practiceId) {
    throw new Error("Unauthorized practice access.")
  }
  return context
}

export async function getEmailTemplates(practiceId: string) {
  await verifyPracticeId(practiceId)

  return db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.practiceId, practiceId))
    .orderBy(asc(emailTemplates.createdAt))
}

export async function getEmailTemplateById(
  practiceId: string,
  templateId: string
) {
  await verifyPracticeId(practiceId)

  const [template] = await db
    .select()
    .from(emailTemplates)
    .where(
      and(
        eq(emailTemplates.emailTemplateId, templateId),
        eq(emailTemplates.practiceId, practiceId)
      )
    )
    .limit(1)

  return template ?? null
}

export async function getEmailTemplatesForDropdown(practiceId: string) {
  await verifyPracticeId(practiceId)

  return db
    .select({
      emailTemplateId: emailTemplates.emailTemplateId,
      name: emailTemplates.name,
      templateKey: emailTemplates.templateKey,
    })
    .from(emailTemplates)
    .where(
      and(
        eq(emailTemplates.practiceId, practiceId),
        eq(emailTemplates.isActive, true),
        or(
          isNull(emailTemplates.templateKey),
          notInArray(
            emailTemplates.templateKey,
            EXCLUDED_FROM_MANUAL_SEND_TEMPLATE_KEYS
          )
        )
      )
    )
    .orderBy(asc(emailTemplates.createdAt))
}

function parseBoolean(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true" || value === "1"
}

export async function upsertEmailTemplate(
  practiceId: string,
  emailTemplateId: string | undefined,
  _prevState: EmailTemplateFormState,
  formData: FormData
): Promise<EmailTemplateFormState> {
  await verifyPracticeId(practiceId)

  const name = String(formData.get("name") ?? "").trim()
  const subject = String(formData.get("subject") ?? "").trim()
  const message = String(formData.get("message") ?? "").trim()
  const defaultCc = String(formData.get("defaultCc") ?? "").trim() || null
  const defaultBcc = String(formData.get("defaultBcc") ?? "").trim() || null
  const actionButtonLabel =
    String(formData.get("actionButtonLabel") ?? "").trim() || null
  const hasActionButton = parseBoolean(formData.get("hasActionButton"))

  if (!name) {
    return { error: "Name is required." }
  }

  type EmailTemplateRecord = NonNullable<
    Awaited<ReturnType<typeof getEmailTemplateById>>
  >
  let existingTemplate: EmailTemplateRecord | null = null
  if (emailTemplateId) {
    existingTemplate = await getEmailTemplateById(practiceId, emailTemplateId)
    if (!existingTemplate) {
      return { error: "Email template not found." }
    }
  }

  const allowEmptyContent = existingTemplate?.templateKey === "ad_hoc"

  if (!allowEmptyContent && !subject) {
    return { error: "Subject is required." }
  }
  if (!allowEmptyContent && !message) {
    return { error: "Message is required." }
  }
  const now = new Date()

  if (emailTemplateId && existingTemplate) {
    const templateKey = existingTemplate.templateKey
    const hasSystemActionButton = templateKey
      ? SYSTEM_LINK_TEMPLATE_KEYS.includes(templateKey)
      : false
    const forcesNoActionButton = templateKey
      ? NO_ACTION_BUTTON_TEMPLATE_KEYS.includes(templateKey)
      : false

    const resolvedHasActionButton = hasSystemActionButton
      ? true
      : forcesNoActionButton
        ? false
        : hasActionButton

    await db
      .update(emailTemplates)
      .set({
        name,
        subject,
        message,
        defaultCc,
        defaultBcc,
        hasActionButton: resolvedHasActionButton,
        actionButtonLabel: hasSystemActionButton
          ? actionButtonLabel ?? existingTemplate.actionButtonLabel
          : resolvedHasActionButton
            ? actionButtonLabel
            : null,
        updatedAt: now,
      })
      .where(
        and(
          eq(emailTemplates.emailTemplateId, emailTemplateId),
          eq(emailTemplates.practiceId, practiceId)
        )
      )

    revalidatePath("/settings/email-templates")
    revalidatePath(`/settings/email-templates/${emailTemplateId}/edit`)
    redirect("/settings/email-templates")
  }

  const [created] = await db
    .insert(emailTemplates)
    .values({
      practiceId,
      templateKey: null,
      name,
      subject,
      message,
      defaultCc,
      defaultBcc,
      hasActionButton,
      actionButtonLabel: hasActionButton ? actionButtonLabel : null,
      updatedAt: now,
    })
    .returning({ emailTemplateId: emailTemplates.emailTemplateId })

  if (!created) {
    return { error: "Unable to create email template." }
  }

  revalidatePath("/settings/email-templates")
  redirect("/settings/email-templates")
}

export async function deleteEmailTemplate(
  practiceId: string,
  templateId: string
): Promise<{ error?: string }> {
  await verifyPracticeId(practiceId)

  const existing = await getEmailTemplateById(practiceId, templateId)
  if (!existing) {
    return { error: "Email template not found." }
  }

  if (
    existing.templateKey &&
    PROTECTED_TEMPLATE_KEYS.includes(existing.templateKey)
  ) {
    return { error: "This system template cannot be deleted." }
  }

  await db
    .update(emailTemplates)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(
        eq(emailTemplates.emailTemplateId, templateId),
        eq(emailTemplates.practiceId, practiceId)
      )
    )

  revalidatePath("/settings/email-templates")
  redirect("/settings/email-templates")
}
