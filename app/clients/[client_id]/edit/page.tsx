import { notFound } from "next/navigation"
import { and, eq } from "drizzle-orm"

import { ContactDetailsForm } from "@/components/clients/contact-details-form"
import { ScrollToOpenPanel } from "@/app/clients/[client_id]/edit/scroll-to-open-panel"
import { deleteClient, getClientDeleteStatus } from "@/app/clients/actions"
import { ClientPanel } from "@/components/clients/client-panel"
import { ClientStatusControl } from "@/components/clients/client-status-control"
import {
  DemographicsSection,
  LivingSituationSection,
} from "@/components/client-background/demographics-section"
import { HistoryTreeSection } from "@/components/client-background/history-tree-section"
import { RelationshipTreeSection } from "@/components/client-background/relationship-tree-section"
import { EmergencyContactsSection } from "@/components/emergency-contacts/emergency-contacts-section"
import { MedicalContactsSection } from "@/components/medical-contacts/medical-contacts-section"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { EntityPageHeader } from "@/components/ui/entity-page-header"
import { EntityDeleteSection } from "@/components/entity-delete-section"
import { clients } from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import {
  loadBackgroundInterviewCard,
  loadClientBackground,
  loadReasonSupport,
} from "@/lib/client-background/load"
import { ensureFamilyOfOrigin } from "@/lib/client-background/mutations"
import { emptyBlockAnswers } from "@/lib/client-background/types"
import { formatCommunicationSummary } from "@/lib/clients/communication-summary"
import { formatClientDisplayName } from "@/lib/clients/display-name"
import {
  editDetailsPanelElementId,
  parseEditDetailsOpenParam,
} from "@/lib/clients/edit-details-panels"
import { loadEmergencyContacts } from "@/lib/crisis-plans/load"
import { db } from "@/lib/db"
import { loadMedicalContactsWithSupervises } from "@/lib/medical-contacts/load"

export default async function EditClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ client_id: string }>
  searchParams: Promise<{ open?: string | string[]; saved?: string | string[] }>
}) {
  const { client_id: clientId } = await params
  const query = await searchParams
  const openPanel = parseEditDetailsOpenParam(query.open)
  const showSaved =
    (Array.isArray(query.saved) ? query.saved[0] : query.saved) === "1"
  const context = await requirePractitionerContext()

  const [client] = await db
    .select({
      firstName: clients.firstName,
      preferredName: clients.preferredName,
      lastName: clients.lastName,
      dateOfBirth: clients.dateOfBirth,
      email: clients.email,
      phone: clients.phone,
      address: clients.address,
      notes: clients.notes,
      clientStatus: clients.clientStatus,
      commsOptOut: clients.commsOptOut,
      reminderOptOut: clients.reminderOptOut,
      preSessionOptOut: clients.preSessionOptOut,
      postSessionOptOut: clients.postSessionOptOut,
      adminCommsOptOut: clients.adminCommsOptOut,
      onlineBookingPermitted: clients.onlineBookingPermitted,
    })
    .from(clients)
    .where(
      and(
        eq(clients.clientId, clientId),
        eq(clients.practiceId, context.practiceId),
        eq(clients.isActive, true)
      )
    )
    .limit(1)

  if (!client) {
    notFound()
  }

  await ensureFamilyOfOrigin({
    clientId,
    practiceId: context.practiceId,
    userId: context.userId,
  })

  const [deleteStatus, background, interview, reasonSupport, medicalBundle] =
    await Promise.all([
      getClientDeleteStatus(clientId),
      loadClientBackground(clientId, context.practiceId),
      loadBackgroundInterviewCard(clientId, context.practiceId),
      loadReasonSupport(clientId, context.practiceId, null),
      loadMedicalContactsWithSupervises(clientId, context.practiceId),
    ])

  if (!background) {
    notFound()
  }

  let emergencyContacts: Awaited<ReturnType<typeof loadEmergencyContacts>> = []
  try {
    emergencyContacts = await loadEmergencyContacts(
      clientId,
      context.practiceId
    )
  } catch {
    emergencyContacts = []
  }

  const clientName = formatClientDisplayName(
    client.firstName,
    client.preferredName,
    client.lastName
  )
  const communicationSummary = formatCommunicationSummary({
    commsOptOut: client.commsOptOut,
    reminderOptOut: client.reminderOptOut,
    preSessionOptOut: client.preSessionOptOut,
    postSessionOptOut: client.postSessionOptOut,
    adminCommsOptOut: client.adminCommsOptOut,
    onlineBookingPermitted: client.onlineBookingPermitted,
  })

  const medicalContactItems = medicalBundle.contacts.map((contact) => ({
    medicalContactId: contact.medicalContactId,
    professionalId: contact.professionalId,
    isMain: contact.isMain,
    isResolvedMain: contact.isResolvedMain,
    notes: contact.notes,
    supervisesLine: contact.supervisesLine,
    professional: contact.professional,
  }))

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref={`/clients/${clientId}`}
          label="← Back to client"
        />
      </div>
      <EntityPageHeader kicker="Edit details" name={clientName} />

      <ScrollToOpenPanel panelId={openPanel} />

      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <ClientPanel
          id={editDetailsPanelElementId("details")}
          title="Details"
          control="expand"
          defaultExpanded={openPanel === "details"}
          expandedContent={
            <div className="space-y-8">
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Account status</h3>
                <ClientStatusControl
                  clientId={clientId}
                  currentStatus={client.clientStatus}
                />
              </section>

              <section className="space-y-3 border-t pt-6">
                <h3 className="text-sm font-semibold">Contact information</h3>
                <ContactDetailsForm
                  clientId={clientId}
                  client={{ ...client, notes: client.notes }}
                  mode="page"
                  showNotes
                  redirectPanel="details"
                  showSaved={showSaved && openPanel === "details"}
                />
              </section>
            </div>
          }
        >
          <p className="text-sm text-muted-foreground">
            Account status · Contact information
          </p>
        </ClientPanel>

        <ClientPanel
          id={editDetailsPanelElementId("demographics")}
          title="Demographics"
          control="expand"
          defaultExpanded={openPanel === "demographics"}
          expandedContent={
            <div className="space-y-6">
              <DemographicsSection
                clientId={clientId}
                demographics={background.demographics}
              />
              <LivingSituationSection
                clientId={clientId}
                livingSituation={background.demographics.livingSituation}
                relationships={background.relationships}
              />
            </div>
          }
        >
          <p className="text-sm text-muted-foreground">
            Demographics · Living situation
          </p>
        </ClientPanel>

        <ClientPanel
          id={editDetailsPanelElementId("relationships")}
          title="Relationships"
          control="expand"
          defaultExpanded={openPanel === "relationships"}
          expandedContent={
            <RelationshipTreeSection
              clientId={clientId}
              clientName={client.firstName || clientName}
              relationships={background.relationships}
              blocks={background.relationshipBlocks ?? []}
              blockAnswers={background.blockAnswers ?? emptyBlockAnswers()}
              relationshipStatus={background.relationshipStatus}
              dateOfBirth={background.dateOfBirth}
              events={background.events}
            />
          }
        >
          <p className="text-sm text-muted-foreground">
            Intimate relationships and children · Primary caregivers and
            siblings
          </p>
        </ClientPanel>

        <ClientPanel
          id={editDetailsPanelElementId("history")}
          title="History"
          control="expand"
          defaultExpanded={openPanel === "history"}
          expandedContent={
            <HistoryTreeSection
              clientId={clientId}
              clientName={client.firstName || clientName}
              dateOfBirth={background.dateOfBirth}
              events={background.events}
              relationships={background.relationships}
              screening={interview?.latest?.screening ?? {}}
              professionals={reasonSupport.professionals}
              medicalContacts={medicalBundle.contacts.map(
                (row) => row.professional
              )}
              issues={background.issues}
            />
          }
        >
          <p className="text-sm text-muted-foreground">
            Client history · Significant other history
          </p>
        </ClientPanel>

        <ClientPanel
          id={editDetailsPanelElementId("emergency")}
          title="Emergency"
          control="expand"
          defaultExpanded={openPanel === "emergency"}
          expandedContent={
            <div className="space-y-6">
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Emergency contacts</h3>
                <div className="-mx-4">
                  <EmergencyContactsSection
                    clientId={clientId}
                    contacts={emergencyContacts}
                  />
                </div>
              </section>
              <section className="space-y-3 border-t pt-6">
                <h3 className="text-sm font-semibold">Medical contacts</h3>
                <MedicalContactsSection
                  clientId={clientId}
                  contacts={medicalContactItems}
                  professionals={reasonSupport.professionals}
                />
              </section>
            </div>
          }
        >
          <p className="text-sm text-muted-foreground">
            Emergency contacts · Medical contacts
          </p>
        </ClientPanel>

        <ClientPanel
          id={editDetailsPanelElementId("communication")}
          title="Communication preferences"
          control="expand"
          defaultExpanded={openPanel === "communication"}
          expandedContent={
            <ContactDetailsForm
              clientId={clientId}
              client={client}
              mode="page"
              showNotes={false}
              redirectPanel="communication"
              showSaved={showSaved && openPanel === "communication"}
            />
          }
        >
          <p className="text-sm text-muted-foreground">{communicationSummary}</p>
        </ClientPanel>

        <EntityDeleteSection
          entityName="Client"
          blockedReason={deleteStatus.blockedReason}
          requiresReportConfirmation={deleteStatus.requiresReportConfirmation}
          deleteAction={deleteClient.bind(null, clientId)}
        />
      </div>
    </AppShell>
  )
}
