/**
 * Page registry (NV-8): every typed page's route, type, default parent and label.
 * Default parents match design guide 13B exactly.
 */

import {
  backLabel,
  datedRecordLabel,
  truncateNavName,
} from "@/lib/navigation/labels"
import type { FormMode, PageType } from "@/lib/navigation/page-types"

export type PageFamily =
  | { kind: "client"; clientId: string }
  | { kind: "area"; area: string }

export type NavTarget = {
  href: string
  label: string
}

/** Plain values the page already loads — never ready-made back labels. */
export type PageNavData = {
  clientId?: string
  clientName?: string
  appointmentId?: string
  appointmentDate?: string | Date | null
  sessionNoteId?: string
  sessionNoteDate?: string | Date | null
  resultId?: string
  resultDate?: string | Date | null
  reportId?: string
  reportDate?: string | Date | null
  claimId?: string
  approvalId?: string
  professionalId?: string
  professionalName?: string
  organisationId?: string
  organisationName?: string
  typeId?: string
  typeName?: string
  assessmentCode?: string
  assessmentName?: string
  planId?: string
  membershipId?: string
  contactId?: string
  templateId?: string
  templateName?: string
  /** Query / content ids that identify the page (e.g. clientId on /appointments/new). */
  queryClientId?: string
}

export type PageRegistryKey =
  | "/dashboard"
  | "/calendar"
  | "/clients"
  | "/appointments"
  | "/session-notes"
  | "/reports"
  | "/funding/claims"
  | "/funding/approvals"
  | "/contacts/professionals"
  | "/contacts/organisations"
  | "/settings/professions"
  | "/settings/appointment-types"
  | "/settings/email-templates"
  | "/settings/email-variables"
  | "/settings/report-types"
  | "/settings/assessments"
  | "/funding/claim-types"
  | "/funding/approval-types"
  | "/practice"
  | "/practitioner"
  | "/clients/[client_id]"
  | "/contacts/professionals/[professional_id]"
  | "/contacts/organisations/[organisation_id]"
  | "/clients/[client_id]/edit"
  | "/clients/[client_id]/emergency-contacts/[contact_id]/edit"
  | "/contacts/professionals/new"
  | "/contacts/professionals/[professional_id]/edit"
  | "/contacts/organisations/new"
  | "/contacts/organisations/[organisation_id]/edit"
  | "/practice/edit"
  | "/practitioner/edit"
  | "/practitioner/memberships/new"
  | "/practitioner/memberships/[membership_id]/edit"
  | "/clients/[client_id]/appointments"
  | "/clients/[client_id]/session-notes"
  | "/clients/[client_id]/assessments"
  | "/clients/[client_id]/reports"
  | "/clients/[client_id]/claims"
  | "/clients/[client_id]/communications"
  | "/clients/[client_id]/background"
  | "/clients/[client_id]/assessments/feedback"
  | "/clients/[client_id]/background/interview"
  | "/clients/[client_id]/assessments/start"
  | "/clients/[client_id]/assessments/new/[assessment_code]"
  | "/clients/[client_id]/assessments/edit/[instance_id]"
  | "/appointments/[appointment_id]"
  | "/session-notes/[session_note_id]"
  | "/clients/[client_id]/results/[result_id]"
  | "/clients/[client_id]/reports/[report_id]"
  | "/clients/[client_id]/reports/sage-sr/[report_id]"
  | "/clients/[client_id]/treatment-plan/[plan_id]"
  | "/clients/[client_id]/crisis-plan/[plan_id]"
  | "/funding/claims/[claim_id]"
  | "/funding/approvals/[approval_id]"
  | "/settings/appointment-types/[type_id]"
  | "/settings/report-types/[type_id]"
  | "/settings/assessments/[assessment_code]"
  | "/funding/approval-types/[type_id]"
  | "/appointments/new"
  | "/appointments/[appointment_id]/edit"
  | "/clients/[client_id]/reports/new"
  | "/clients/[client_id]/reports/[report_id]/edit"
  | "/clients/[client_id]/treatment-plan/new"
  | "/clients/[client_id]/treatment-plan/[plan_id]/edit"
  | "/clients/[client_id]/crisis-plan/new"
  | "/clients/[client_id]/crisis-plan/[plan_id]/edit"
  | "/funding/claims/new"
  | "/funding/claims/[claim_id]/edit"
  | "/funding/approvals/new"
  | "/funding/approvals/[approval_id]/edit"
  | "/settings/appointment-types/new"
  | "/settings/appointment-types/[type_id]/edit"
  | "/settings/report-types/new"
  | "/settings/report-types/[type_id]/edit"
  | "/funding/approval-types/new"
  | "/funding/approval-types/[type_id]/edit"
  | "/settings/email-templates/new"
  | "/settings/email-templates/[template_id]/edit"

export type PageRegistryEntry = {
  route: PageRegistryKey
  type: PageType
  /** Entity opened from the menu — no back arrow (NV-1). */
  menuEntity?: boolean
  formMode?: FormMode
  /**
   * Interim † default parents that break strict NV-2 (Known gaps).
   * Guard allows these with an explicit comment.
   */
  knownGapDefaultParent?: boolean
  family: (data: PageNavData) => PageFamily
  defaultParent: (data: PageNavData) => NavTarget | null
  /** Own label text after "← Back to " when this page is someone's parent (NV-5). */
  ownLabel: (data: PageNavData) => string
}

function requireClientId(data: PageNavData): string {
  const id = data.clientId ?? data.queryClientId
  if (!id) throw new Error("clientId required for this page")
  return id
}

function clientFamily(data: PageNavData): PageFamily {
  return { kind: "client", clientId: requireClientId(data) }
}

function areaFamily(area: string): (data: PageNavData) => PageFamily {
  return () => ({ kind: "area", area })
}

function clientNameLabel(data: PageNavData): string {
  return truncateNavName(data.clientName?.trim() || "client")
}

const PAGE_REGISTRY: Record<PageRegistryKey, PageRegistryEntry> = {
  "/dashboard": {
    route: "/dashboard",
    type: "home",
    family: areaFamily("home"),
    defaultParent: () => null,
    ownLabel: () => "home",
  },
  "/calendar": {
    route: "/calendar",
    type: "main-list",
    family: areaFamily("calendar"),
    defaultParent: () => null,
    ownLabel: () => "calendar",
  },
  "/clients": {
    route: "/clients",
    type: "main-list",
    family: areaFamily("clients"),
    defaultParent: () => null,
    ownLabel: () => "clients",
  },
  "/appointments": {
    route: "/appointments",
    type: "main-list",
    family: areaFamily("appointments"),
    defaultParent: () => null,
    ownLabel: () => "all appointments",
  },
  "/session-notes": {
    route: "/session-notes",
    type: "main-list",
    family: areaFamily("session-notes"),
    defaultParent: () => null,
    ownLabel: () => "all session notes",
  },
  "/reports": {
    route: "/reports",
    type: "main-list",
    family: areaFamily("reports"),
    defaultParent: () => null,
    ownLabel: () => "all reports",
  },
  "/funding/claims": {
    route: "/funding/claims",
    type: "main-list",
    family: areaFamily("funding"),
    defaultParent: () => null,
    ownLabel: () => "all claims",
  },
  "/funding/approvals": {
    route: "/funding/approvals",
    type: "main-list",
    family: areaFamily("funding"),
    defaultParent: () => null,
    ownLabel: () => "all funding approvals",
  },
  "/contacts/professionals": {
    route: "/contacts/professionals",
    type: "main-list",
    family: areaFamily("contacts"),
    defaultParent: () => null,
    ownLabel: () => "professionals",
  },
  "/contacts/organisations": {
    route: "/contacts/organisations",
    type: "main-list",
    family: areaFamily("contacts"),
    defaultParent: () => null,
    ownLabel: () => "organisations",
  },
  "/settings/professions": {
    route: "/settings/professions",
    type: "main-list",
    family: areaFamily("settings"),
    defaultParent: () => null,
    ownLabel: () => "professions",
  },
  "/settings/appointment-types": {
    route: "/settings/appointment-types",
    type: "main-list",
    family: areaFamily("settings"),
    defaultParent: () => null,
    ownLabel: () => "appointment types",
  },
  "/settings/email-templates": {
    route: "/settings/email-templates",
    type: "main-list",
    family: areaFamily("settings"),
    defaultParent: () => null,
    ownLabel: () => "email templates",
  },
  "/settings/email-variables": {
    route: "/settings/email-variables",
    type: "main-list",
    family: areaFamily("settings"),
    defaultParent: () => null,
    ownLabel: () => "email variables",
  },
  "/settings/report-types": {
    route: "/settings/report-types",
    type: "main-list",
    family: areaFamily("settings"),
    defaultParent: () => null,
    ownLabel: () => "report types",
  },
  "/settings/assessments": {
    route: "/settings/assessments",
    type: "main-list",
    family: areaFamily("settings"),
    defaultParent: () => null,
    ownLabel: () => "assessments",
  },
  "/funding/claim-types": {
    route: "/funding/claim-types",
    type: "main-list",
    family: areaFamily("funding-types"),
    defaultParent: () => null,
    ownLabel: () => "claim types",
  },
  "/funding/approval-types": {
    route: "/funding/approval-types",
    type: "main-list",
    family: areaFamily("funding-types"),
    defaultParent: () => null,
    ownLabel: () => "funding approval types",
  },
  "/practice": {
    route: "/practice",
    type: "entity",
    menuEntity: true,
    family: areaFamily("practice"),
    defaultParent: () => null,
    ownLabel: () => "practice details",
  },
  "/practitioner": {
    route: "/practitioner",
    type: "entity",
    menuEntity: true,
    family: areaFamily("practitioner"),
    defaultParent: () => null,
    ownLabel: () => "practitioner profile",
  },
  "/clients/[client_id]": {
    route: "/clients/[client_id]",
    type: "entity",
    family: clientFamily,
    defaultParent: () => ({
      href: "/clients",
      label: backLabel("clients"),
    }),
    ownLabel: (data) => clientNameLabel(data),
  },
  "/contacts/professionals/[professional_id]": {
    route: "/contacts/professionals/[professional_id]",
    type: "entity",
    family: areaFamily("contacts"),
    defaultParent: () => ({
      href: "/contacts/professionals",
      label: backLabel("professionals"),
    }),
    ownLabel: (data) =>
      truncateNavName(data.professionalName?.trim() || "professional"),
  },
  "/contacts/organisations/[organisation_id]": {
    route: "/contacts/organisations/[organisation_id]",
    type: "entity",
    family: areaFamily("contacts"),
    defaultParent: () => ({
      href: "/contacts/organisations",
      label: backLabel("organisations"),
    }),
    ownLabel: (data) =>
      truncateNavName(data.organisationName?.trim() || "organisation"),
  },
  "/clients/[client_id]/edit": {
    route: "/clients/[client_id]/edit",
    type: "record-form",
    formMode: "edit",
    family: clientFamily,
    defaultParent: (data) => {
      const clientId = requireClientId(data)
      return {
        href: `/clients/${clientId}`,
        label: backLabel(clientNameLabel(data)),
      }
    },
    ownLabel: () => "edit client",
  },
  "/clients/[client_id]/emergency-contacts/[contact_id]/edit": {
    route: "/clients/[client_id]/emergency-contacts/[contact_id]/edit",
    type: "record-form",
    formMode: "edit",
    family: clientFamily,
    defaultParent: (data) => {
      const clientId = requireClientId(data)
      return {
        href: `/clients/${clientId}`,
        label: backLabel(clientNameLabel(data)),
      }
    },
    ownLabel: () => "edit emergency contact",
  },
  "/contacts/professionals/new": {
    route: "/contacts/professionals/new",
    type: "record-form",
    formMode: "new",
    family: areaFamily("contacts"),
    defaultParent: () => ({
      href: "/contacts/professionals",
      label: backLabel("professionals"),
    }),
    ownLabel: () => "new professional",
  },
  "/contacts/professionals/[professional_id]/edit": {
    route: "/contacts/professionals/[professional_id]/edit",
    type: "record-form",
    formMode: "edit",
    family: areaFamily("contacts"),
    defaultParent: (data) => ({
      href: `/contacts/professionals/${data.professionalId}`,
      label: backLabel(
        truncateNavName(data.professionalName?.trim() || "professional")
      ),
    }),
    ownLabel: () => "edit professional",
  },
  "/contacts/organisations/new": {
    route: "/contacts/organisations/new",
    type: "record-form",
    formMode: "new",
    family: areaFamily("contacts"),
    defaultParent: () => ({
      href: "/contacts/organisations",
      label: backLabel("organisations"),
    }),
    ownLabel: () => "new organisation",
  },
  "/contacts/organisations/[organisation_id]/edit": {
    route: "/contacts/organisations/[organisation_id]/edit",
    type: "record-form",
    formMode: "edit",
    family: areaFamily("contacts"),
    defaultParent: (data) => ({
      href: `/contacts/organisations/${data.organisationId}`,
      label: backLabel(
        truncateNavName(data.organisationName?.trim() || "organisation")
      ),
    }),
    ownLabel: () => "edit organisation",
  },
  "/practice/edit": {
    route: "/practice/edit",
    type: "record-form",
    formMode: "edit",
    family: areaFamily("practice"),
    defaultParent: () => ({
      href: "/practice",
      label: backLabel("practice details"),
    }),
    ownLabel: () => "edit practice details",
  },
  "/practitioner/edit": {
    route: "/practitioner/edit",
    type: "record-form",
    formMode: "edit",
    family: areaFamily("practitioner"),
    defaultParent: () => ({
      href: "/practitioner",
      label: backLabel("practitioner profile"),
    }),
    ownLabel: () => "edit practitioner profile",
  },
  "/practitioner/memberships/new": {
    route: "/practitioner/memberships/new",
    type: "record-form",
    formMode: "new",
    family: areaFamily("practitioner"),
    defaultParent: () => ({
      href: "/practitioner",
      label: backLabel("practitioner profile"),
    }),
    ownLabel: () => "new membership",
  },
  "/practitioner/memberships/[membership_id]/edit": {
    route: "/practitioner/memberships/[membership_id]/edit",
    type: "record-form",
    formMode: "edit",
    family: areaFamily("practitioner"),
    defaultParent: () => ({
      href: "/practitioner",
      label: backLabel("practitioner profile"),
    }),
    ownLabel: () => "edit membership",
  },
  "/clients/[client_id]/appointments": {
    route: "/clients/[client_id]/appointments",
    type: "sub-list",
    family: clientFamily,
    defaultParent: (data) => {
      const clientId = requireClientId(data)
      return {
        href: `/clients/${clientId}`,
        label: backLabel(clientNameLabel(data)),
      }
    },
    ownLabel: () => "appointments",
  },
  "/clients/[client_id]/session-notes": {
    route: "/clients/[client_id]/session-notes",
    type: "sub-list",
    family: clientFamily,
    defaultParent: (data) => {
      const clientId = requireClientId(data)
      return {
        href: `/clients/${clientId}`,
        label: backLabel(clientNameLabel(data)),
      }
    },
    ownLabel: () => "session notes",
  },
  "/clients/[client_id]/assessments": {
    route: "/clients/[client_id]/assessments",
    type: "sub-list",
    family: clientFamily,
    defaultParent: (data) => {
      const clientId = requireClientId(data)
      return {
        href: `/clients/${clientId}`,
        label: backLabel(clientNameLabel(data)),
      }
    },
    ownLabel: () => "assessments",
  },
  "/clients/[client_id]/reports": {
    route: "/clients/[client_id]/reports",
    type: "sub-list",
    family: clientFamily,
    defaultParent: (data) => {
      const clientId = requireClientId(data)
      return {
        href: `/clients/${clientId}`,
        label: backLabel(clientNameLabel(data)),
      }
    },
    ownLabel: () => "reports",
  },
  "/clients/[client_id]/claims": {
    route: "/clients/[client_id]/claims",
    type: "sub-list",
    family: clientFamily,
    defaultParent: (data) => {
      const clientId = requireClientId(data)
      return {
        href: `/clients/${clientId}`,
        label: backLabel(clientNameLabel(data)),
      }
    },
    ownLabel: () => "claims",
  },
  "/clients/[client_id]/communications": {
    route: "/clients/[client_id]/communications",
    type: "sub-list",
    family: clientFamily,
    defaultParent: (data) => {
      const clientId = requireClientId(data)
      return {
        href: `/clients/${clientId}`,
        label: backLabel(clientNameLabel(data)),
      }
    },
    ownLabel: () => "communications",
  },
  "/clients/[client_id]/background": {
    route: "/clients/[client_id]/background",
    type: "section",
    family: clientFamily,
    defaultParent: (data) => {
      const clientId = requireClientId(data)
      return {
        href: `/clients/${clientId}`,
        label: backLabel(clientNameLabel(data)),
      }
    },
    ownLabel: () => "background",
  },
  "/clients/[client_id]/assessments/feedback": {
    route: "/clients/[client_id]/assessments/feedback",
    type: "section",
    family: clientFamily,
    defaultParent: (data) => {
      const clientId = requireClientId(data)
      return {
        href: `/clients/${clientId}/assessments`,
        label: backLabel("assessments"),
      }
    },
    ownLabel: () => "feedback over time",
  },
  "/clients/[client_id]/background/interview": {
    route: "/clients/[client_id]/background/interview",
    type: "guided-form",
    family: clientFamily,
    defaultParent: (data) => {
      const clientId = requireClientId(data)
      return {
        href: `/clients/${clientId}/background`,
        label: backLabel("background"),
      }
    },
    ownLabel: () => "background interview",
  },
  "/clients/[client_id]/assessments/start": {
    route: "/clients/[client_id]/assessments/start",
    type: "guided-form",
    family: clientFamily,
    defaultParent: (data) => {
      const clientId = requireClientId(data)
      return {
        href: `/clients/${clientId}/assessments`,
        label: backLabel("assessments"),
      }
    },
    ownLabel: () => "start assessment",
  },
  "/clients/[client_id]/assessments/new/[assessment_code]": {
    route: "/clients/[client_id]/assessments/new/[assessment_code]",
    type: "guided-form",
    family: clientFamily,
    defaultParent: (data) => {
      const clientId = requireClientId(data)
      return {
        href: `/clients/${clientId}/assessments`,
        label: backLabel("assessments"),
      }
    },
    ownLabel: () => "new assessment",
  },
  "/clients/[client_id]/assessments/edit/[instance_id]": {
    route: "/clients/[client_id]/assessments/edit/[instance_id]",
    type: "guided-form",
    family: clientFamily,
    defaultParent: (data) => {
      const clientId = requireClientId(data)
      return {
        href: `/clients/${clientId}/assessments`,
        label: backLabel("assessments"),
      }
    },
    ownLabel: () => "edit assessment",
  },
  "/appointments/[appointment_id]": {
    route: "/appointments/[appointment_id]",
    type: "record",
    family: clientFamily,
    defaultParent: (data) => {
      const clientId = requireClientId(data)
      return {
        href: `/clients/${clientId}/appointments`,
        label: backLabel("appointments"),
      }
    },
    ownLabel: (data) =>
      datedRecordLabel("appointment", data.appointmentDate),
  },
  "/session-notes/[session_note_id]": {
    route: "/session-notes/[session_note_id]",
    type: "record",
    family: clientFamily,
    defaultParent: (data) => {
      const clientId = requireClientId(data)
      return {
        href: `/clients/${clientId}/session-notes`,
        label: backLabel("session notes"),
      }
    },
    ownLabel: (data) =>
      datedRecordLabel("session note", data.sessionNoteDate),
  },
  "/clients/[client_id]/results/[result_id]": {
    route: "/clients/[client_id]/results/[result_id]",
    type: "record",
    family: clientFamily,
    defaultParent: (data) => {
      const clientId = requireClientId(data)
      return {
        href: `/clients/${clientId}/assessments`,
        label: backLabel("assessments"),
      }
    },
    ownLabel: (data) => datedRecordLabel("result", data.resultDate),
  },
  "/clients/[client_id]/reports/[report_id]": {
    route: "/clients/[client_id]/reports/[report_id]",
    type: "record",
    family: clientFamily,
    defaultParent: (data) => {
      const clientId = requireClientId(data)
      return {
        href: `/clients/${clientId}/reports`,
        label: backLabel("reports"),
      }
    },
    ownLabel: (data) => datedRecordLabel("report", data.reportDate),
  },
  "/clients/[client_id]/reports/sage-sr/[report_id]": {
    route: "/clients/[client_id]/reports/sage-sr/[report_id]",
    type: "record",
    family: clientFamily,
    defaultParent: (data) => {
      const clientId = requireClientId(data)
      return {
        href: `/clients/${clientId}/reports`,
        label: backLabel("reports"),
      }
    },
    ownLabel: (data) => datedRecordLabel("report", data.reportDate),
  },
  // † Known gap: Record details with no Sub-list; default parent is Client (NV-2 gap).
  "/clients/[client_id]/treatment-plan/[plan_id]": {
    route: "/clients/[client_id]/treatment-plan/[plan_id]",
    type: "record",
    knownGapDefaultParent: true,
    family: clientFamily,
    defaultParent: (data) => {
      const clientId = requireClientId(data)
      return {
        href: `/clients/${clientId}`,
        label: backLabel(clientNameLabel(data)),
      }
    },
    ownLabel: () => "treatment plan",
  },
  // † Known gap: Record details with no Sub-list; default parent is Client (NV-2 gap).
  "/clients/[client_id]/crisis-plan/[plan_id]": {
    route: "/clients/[client_id]/crisis-plan/[plan_id]",
    type: "record",
    knownGapDefaultParent: true,
    family: clientFamily,
    defaultParent: (data) => {
      const clientId = requireClientId(data)
      return {
        href: `/clients/${clientId}`,
        label: backLabel(clientNameLabel(data)),
      }
    },
    ownLabel: () => "crisis plan",
  },
  "/funding/claims/[claim_id]": {
    route: "/funding/claims/[claim_id]",
    type: "record",
    family: clientFamily,
    defaultParent: (data) => {
      const clientId = requireClientId(data)
      return {
        href: `/clients/${clientId}/claims`,
        label: backLabel("claims"),
      }
    },
    ownLabel: () => "claim",
  },
  // † Known gap: hangs off Claim (Record), not a Sub-list (NV-2 gap).
  "/funding/approvals/[approval_id]": {
    route: "/funding/approvals/[approval_id]",
    type: "record",
    knownGapDefaultParent: true,
    family: clientFamily,
    defaultParent: (data) => ({
      href: `/funding/claims/${data.claimId}`,
      label: backLabel("claim"),
    }),
    ownLabel: () => "funding approval",
  },
  "/settings/appointment-types/[type_id]": {
    route: "/settings/appointment-types/[type_id]",
    type: "record",
    family: areaFamily("settings"),
    defaultParent: () => ({
      href: "/settings/appointment-types",
      label: backLabel("appointment types"),
    }),
    ownLabel: (data) =>
      truncateNavName(data.typeName?.trim() || "appointment type"),
  },
  "/settings/report-types/[type_id]": {
    route: "/settings/report-types/[type_id]",
    type: "record",
    family: areaFamily("settings"),
    defaultParent: () => ({
      href: "/settings/report-types",
      label: backLabel("report types"),
    }),
    ownLabel: (data) =>
      truncateNavName(data.typeName?.trim() || "report type"),
  },
  "/settings/assessments/[assessment_code]": {
    route: "/settings/assessments/[assessment_code]",
    type: "record",
    family: areaFamily("settings"),
    defaultParent: () => ({
      href: "/settings/assessments",
      label: backLabel("assessments"),
    }),
    ownLabel: (data) =>
      truncateNavName(data.assessmentName?.trim() || "assessment"),
  },
  "/funding/approval-types/[type_id]": {
    route: "/funding/approval-types/[type_id]",
    type: "record",
    family: areaFamily("funding-types"),
    defaultParent: () => ({
      href: "/funding/approval-types",
      label: backLabel("funding approval types"),
    }),
    ownLabel: (data) =>
      truncateNavName(data.typeName?.trim() || "funding approval type"),
  },
  "/appointments/new": {
    route: "/appointments/new",
    type: "record-form",
    formMode: "new",
    // Main-list / calendar can open this without a client yet; fall back to all appointments.
    family: (data) => {
      const id = data.clientId ?? data.queryClientId
      if (!id) return { kind: "area", area: "appointments" }
      return { kind: "client", clientId: id }
    },
    defaultParent: (data) => {
      const clientId = data.clientId ?? data.queryClientId
      if (!clientId) {
        return {
          href: "/appointments",
          label: backLabel("all appointments"),
        }
      }
      return {
        href: `/clients/${clientId}/appointments`,
        label: backLabel("appointments"),
      }
    },
    ownLabel: () => "new appointment",
  },
  "/appointments/[appointment_id]/edit": {
    route: "/appointments/[appointment_id]/edit",
    type: "record-form",
    formMode: "edit",
    family: clientFamily,
    defaultParent: (data) => ({
      href: `/appointments/${data.appointmentId}`,
      label: backLabel(
        datedRecordLabel("appointment", data.appointmentDate)
      ),
    }),
    ownLabel: () => "edit appointment",
  },
  "/clients/[client_id]/reports/new": {
    route: "/clients/[client_id]/reports/new",
    type: "record-form",
    formMode: "new",
    family: clientFamily,
    defaultParent: (data) => {
      const clientId = requireClientId(data)
      return {
        href: `/clients/${clientId}/reports`,
        label: backLabel("reports"),
      }
    },
    ownLabel: () => "new report",
  },
  "/clients/[client_id]/reports/[report_id]/edit": {
    route: "/clients/[client_id]/reports/[report_id]/edit",
    type: "record-form",
    formMode: "edit",
    family: clientFamily,
    defaultParent: (data) => {
      const clientId = requireClientId(data)
      return {
        href: `/clients/${clientId}/reports/${data.reportId}`,
        label: backLabel(datedRecordLabel("report", data.reportDate)),
      }
    },
    ownLabel: () => "edit report",
  },
  // † Known gap: New treatment plan defaults to Client (NV-2 gap).
  "/clients/[client_id]/treatment-plan/new": {
    route: "/clients/[client_id]/treatment-plan/new",
    type: "record-form",
    formMode: "new",
    knownGapDefaultParent: true,
    family: clientFamily,
    defaultParent: (data) => {
      const clientId = requireClientId(data)
      return {
        href: `/clients/${clientId}`,
        label: backLabel(clientNameLabel(data)),
      }
    },
    ownLabel: () => "new treatment plan",
  },
  "/clients/[client_id]/treatment-plan/[plan_id]/edit": {
    route: "/clients/[client_id]/treatment-plan/[plan_id]/edit",
    type: "record-form",
    formMode: "edit",
    family: clientFamily,
    defaultParent: (data) => {
      const clientId = requireClientId(data)
      return {
        href: `/clients/${clientId}/treatment-plan/${data.planId}`,
        label: backLabel("treatment plan"),
      }
    },
    ownLabel: () => "edit treatment plan",
  },
  // † Known gap: New crisis plan defaults to Client (NV-2 gap).
  "/clients/[client_id]/crisis-plan/new": {
    route: "/clients/[client_id]/crisis-plan/new",
    type: "record-form",
    formMode: "new",
    knownGapDefaultParent: true,
    family: clientFamily,
    defaultParent: (data) => {
      const clientId = requireClientId(data)
      return {
        href: `/clients/${clientId}`,
        label: backLabel(clientNameLabel(data)),
      }
    },
    ownLabel: () => "new crisis plan",
  },
  "/clients/[client_id]/crisis-plan/[plan_id]/edit": {
    route: "/clients/[client_id]/crisis-plan/[plan_id]/edit",
    type: "record-form",
    formMode: "edit",
    family: clientFamily,
    defaultParent: (data) => {
      const clientId = requireClientId(data)
      return {
        href: `/clients/${clientId}/crisis-plan/${data.planId}`,
        label: backLabel("crisis plan"),
      }
    },
    ownLabel: () => "edit crisis plan",
  },
  "/funding/claims/new": {
    route: "/funding/claims/new",
    type: "record-form",
    formMode: "new",
    // Main list can open this without a client yet; fall back to all claims.
    family: (data) => {
      const id = data.clientId ?? data.queryClientId
      if (!id) return { kind: "area", area: "funding" }
      return { kind: "client", clientId: id }
    },
    defaultParent: (data) => {
      const clientId = data.clientId ?? data.queryClientId
      if (!clientId) {
        return {
          href: "/funding/claims",
          label: backLabel("all claims"),
        }
      }
      return {
        href: `/clients/${clientId}/claims`,
        label: backLabel("claims"),
      }
    },
    ownLabel: () => "new claim",
  },
  "/funding/claims/[claim_id]/edit": {
    route: "/funding/claims/[claim_id]/edit",
    type: "record-form",
    formMode: "edit",
    family: clientFamily,
    defaultParent: (data) => ({
      href: `/funding/claims/${data.claimId}`,
      label: backLabel("claim"),
    }),
    ownLabel: () => "edit claim",
  },
  // New funding approval defaults to Claim († related).
  "/funding/approvals/new": {
    route: "/funding/approvals/new",
    type: "record-form",
    formMode: "new",
    knownGapDefaultParent: true,
    family: (data) => {
      const id = data.clientId ?? data.queryClientId
      if (!id) return { kind: "area", area: "funding" }
      return { kind: "client", clientId: id }
    },
    defaultParent: (data) => {
      if (data.claimId) {
        return {
          href: `/funding/claims/${data.claimId}`,
          label: backLabel("claim"),
        }
      }
      return {
        href: "/funding/approvals",
        label: backLabel("all funding approvals"),
      }
    },
    ownLabel: () => "new funding approval",
  },
  "/funding/approvals/[approval_id]/edit": {
    route: "/funding/approvals/[approval_id]/edit",
    type: "record-form",
    formMode: "edit",
    family: clientFamily,
    defaultParent: (data) => ({
      href: `/funding/approvals/${data.approvalId}`,
      label: backLabel("funding approval"),
    }),
    ownLabel: () => "edit funding approval",
  },
  "/settings/appointment-types/new": {
    route: "/settings/appointment-types/new",
    type: "record-form",
    formMode: "new",
    family: areaFamily("settings"),
    defaultParent: () => ({
      href: "/settings/appointment-types",
      label: backLabel("appointment types"),
    }),
    ownLabel: () => "new appointment type",
  },
  "/settings/appointment-types/[type_id]/edit": {
    route: "/settings/appointment-types/[type_id]/edit",
    type: "record-form",
    formMode: "edit",
    family: areaFamily("settings"),
    defaultParent: (data) => ({
      href: `/settings/appointment-types/${data.typeId}`,
      label: backLabel(
        truncateNavName(data.typeName?.trim() || "appointment type")
      ),
    }),
    ownLabel: () => "edit appointment type",
  },
  "/settings/report-types/new": {
    route: "/settings/report-types/new",
    type: "record-form",
    formMode: "new",
    family: areaFamily("settings"),
    defaultParent: () => ({
      href: "/settings/report-types",
      label: backLabel("report types"),
    }),
    ownLabel: () => "new report type",
  },
  "/settings/report-types/[type_id]/edit": {
    route: "/settings/report-types/[type_id]/edit",
    type: "record-form",
    formMode: "edit",
    family: areaFamily("settings"),
    defaultParent: (data) => ({
      href: `/settings/report-types/${data.typeId}`,
      label: backLabel(
        truncateNavName(data.typeName?.trim() || "report type")
      ),
    }),
    ownLabel: () => "edit report type",
  },
  "/funding/approval-types/new": {
    route: "/funding/approval-types/new",
    type: "record-form",
    formMode: "new",
    family: areaFamily("funding-types"),
    defaultParent: () => ({
      href: "/funding/approval-types",
      label: backLabel("funding approval types"),
    }),
    ownLabel: () => "new funding approval type",
  },
  "/funding/approval-types/[type_id]/edit": {
    route: "/funding/approval-types/[type_id]/edit",
    type: "record-form",
    formMode: "edit",
    family: areaFamily("funding-types"),
    defaultParent: (data) => ({
      href: `/funding/approval-types/${data.typeId}`,
      label: backLabel(
        truncateNavName(data.typeName?.trim() || "funding approval type")
      ),
    }),
    ownLabel: () => "edit funding approval type",
  },
  "/settings/email-templates/new": {
    route: "/settings/email-templates/new",
    type: "record-form",
    formMode: "new",
    family: areaFamily("settings"),
    defaultParent: () => ({
      href: "/settings/email-templates",
      label: backLabel("email templates"),
    }),
    ownLabel: () => "new email template",
  },
  "/settings/email-templates/[template_id]/edit": {
    route: "/settings/email-templates/[template_id]/edit",
    type: "record-form",
    formMode: "edit",
    // 13B: no email-template record page; defaults to the main list (NV-2 edit would want the record).
    knownGapDefaultParent: true,
    family: areaFamily("settings"),
    defaultParent: () => ({
      href: "/settings/email-templates",
      label: backLabel("email templates"),
    }),
    ownLabel: () => "edit email template",
  },
}

export function getPageEntry(key: PageRegistryKey): PageRegistryEntry {
  return PAGE_REGISTRY[key]
}

export function getDefaultParent(
  key: PageRegistryKey,
  data: PageNavData
): NavTarget | null {
  return PAGE_REGISTRY[key].defaultParent(data)
}

export function getOwnLabel(key: PageRegistryKey, data: PageNavData): string {
  return PAGE_REGISTRY[key].ownLabel(data)
}

export function getBackLabel(key: PageRegistryKey, data: PageNavData): string {
  return backLabel(getOwnLabel(key, data))
}

export function listRegistryKeys(): PageRegistryKey[] {
  return Object.keys(PAGE_REGISTRY) as PageRegistryKey[]
}

export function listRegistryEntries(): PageRegistryEntry[] {
  return Object.values(PAGE_REGISTRY)
}

export { PAGE_REGISTRY }

/** Resolve a concrete href's registry key by matching dynamic segments. */
export function matchRegistryKey(pathname: string): PageRegistryKey | null {
  const path = pathname.split("?")[0] ?? pathname
  if ((PAGE_REGISTRY as Record<string, PageRegistryEntry>)[path]) {
    return path as PageRegistryKey
  }
  let best: PageRegistryKey | null = null
  let bestScore = -1
  for (const key of listRegistryKeys()) {
    const score = matchScore(key, path)
    if (score > bestScore) {
      bestScore = score
      best = key
    }
  }
  return bestScore >= 0 ? best : null
}

function matchScore(pattern: string, path: string): number {
  const patternParts = pattern.split("/").filter(Boolean)
  const pathParts = path.split("/").filter(Boolean)
  if (patternParts.length !== pathParts.length) return -1
  let score = 0
  for (let i = 0; i < patternParts.length; i++) {
    const pp = patternParts[i]!
    const vp = pathParts[i]!
    if (pp.startsWith("[") && pp.endsWith("]")) {
      score += 1
      continue
    }
    if (pp !== vp) return -1
    score += 10
  }
  return score
}

export function familiesMatch(a: PageFamily, b: PageFamily): boolean {
  if (a.kind === "client" && b.kind === "client") {
    return a.clientId === b.clientId
  }
  if (a.kind === "area" && b.kind === "area") {
    return a.area === b.area
  }
  return false
}
