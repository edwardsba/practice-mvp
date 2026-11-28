"use client"

import {
  useActionState,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"

import {
  saveMedicareInterviewAction,
  type SaveMedicareInterviewState,
} from "@/app/clients/[client_id]/background/actions"
import { LivingFieldsEditor } from "@/components/client-background/demographics-section"
import { DiscardChangesDialog } from "@/components/client-background/discard-changes-dialog"
import { ContactDetailsForm, type ContactDetailsClient } from "@/components/clients/contact-details-form"
import { EmergencyContactsSection } from "@/components/emergency-contacts/emergency-contacts-section"
import { FundingApprovalForm } from "@/components/funding/funding-approval-form"
import { MedicareFields } from "@/components/funding/medicare-fields"
import { MedicalContactsSection } from "@/components/medical-contacts/medical-contacts-section"
import { SidePanel, SidePanelFooter } from "@/components/shared/side-panel"
import type { ClientBackgroundSuggestions } from "@/lib/background-questionnaire/to-client-background"
import type { LivingSituationFields, RelationshipRecord } from "@/lib/client-background/types"
import type { ReferralFundingCardFormOptions } from "@/lib/funding/referral-funding-card-props"

/**
 * Background interview editors for details and question items (sections 1–4 and 7).
 * Each opens the item's existing editor in the shared side panel: Cancel · Save, or Done
 * for contact lists that save as they go. Cancel or ✕ with unsaved edits asks Discard changes?
 */
export function InterviewEditorShell({
  title,
  summary,
  dirty = false,
  saving = false,
  onSave,
  onClose,
  children,
}: {
  title: string
  summary?: string
  dirty?: boolean
  saving?: boolean
  /** Omit for lists that save as they go — the footer then shows Done only. */
  onSave?: () => void
  onClose: () => void
  children: ReactNode
}) {
  const [discardOpen, setDiscardOpen] = useState(false)

  function requestClose() {
    if (saving) return
    if (onSave && dirty) {
      setDiscardOpen(true)
      return
    }
    onClose()
  }

  if (typeof document === "undefined") return null
  return (
    <>
      {createPortal(
        <SidePanel
          title={title}
          summary={summary}
          onDismiss={requestClose}
          footer={
            onSave ? (
              <SidePanelFooter
                saving={saving}
                saveLabel={saving ? "Saving…" : "Save"}
                onCancel={requestClose}
                onSave={onSave}
              />
            ) : (
              <SidePanelFooter saveLabel="Done" onSave={onClose} />
            )
          }
        >
          {children}
        </SidePanel>,
        document.body
      )}
      <DiscardChangesDialog
        open={discardOpen}
        onDiscard={() => {
          setDiscardOpen(false)
          onClose()
        }}
        onKeepEditing={() => setDiscardOpen(false)}
      />
    </>
  )
}

/** Marks an uncontrolled form dirty on typing, selects, and checkbox/radio taps. */
function useDirtyTracking() {
  const [dirty, setDirty] = useState(false)
  const markDirty = () => setDirty(true)
  return {
    dirty,
    handlers: {
      onInput: markDirty,
      onChange: markDirty,
      onClick: (event: MouseEvent) => {
        if (
          event.target instanceof Element &&
          event.target.closest('[role="checkbox"], [role="radio"], [role="switch"]')
        ) {
          markDirty()
        }
      },
    },
  }
}

function submitFormIn(container: HTMLElement | null) {
  container?.querySelector("form")?.requestSubmit()
}

export function InterviewContactEditor({
  clientId,
  client,
  onClose,
}: {
  clientId: string
  client: ContactDetailsClient
  onClose: () => void
}) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const { dirty, handlers } = useDirtyTracking()
  const [saving, setSaving] = useState(false)
  return (
    <InterviewEditorShell
      title="Contact details"
      dirty={dirty}
      saving={saving}
      onSave={() => submitFormIn(bodyRef.current)}
      onClose={onClose}
    >
      <div ref={bodyRef} {...handlers}>
        <ContactDetailsForm
          clientId={clientId}
          client={client}
          mode="embedded"
          hideSubmit
          onPendingChange={setSaving}
          onSaved={onClose}
        />
      </div>
    </InterviewEditorShell>
  )
}

const medicareFormInitial: SaveMedicareInterviewState = {}

export function InterviewMedicareEditor({
  clientId,
  medicareCardNumber,
  medicareIrn,
  medicareExpiry,
  onClose,
}: {
  clientId: string
  medicareCardNumber?: string | null
  medicareIrn?: string | null
  medicareExpiry?: string | null
  onClose: () => void
}) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const { dirty, handlers } = useDirtyTracking()
  const [state, formAction, pending] = useActionState(
    saveMedicareInterviewAction.bind(null, clientId),
    medicareFormInitial
  )
  const onCloseRef = useRef(onClose)
  useLayoutEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!state.success) return
    router.refresh()
    onCloseRef.current()
  }, [router, state])

  return (
    <InterviewEditorShell
      title="Medicare"
      dirty={dirty}
      saving={pending}
      onSave={() => formRef.current?.requestSubmit()}
      onClose={onClose}
    >
      <form ref={formRef} action={formAction} className="space-y-4" {...handlers}>
        <MedicareFields
          medicareCardNumber={medicareCardNumber}
          medicareIrn={medicareIrn}
          medicareExpiry={medicareExpiry}
        />
        {state.error ? (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}
      </form>
    </InterviewEditorShell>
  )
}

/** "+ Add referral or funding approval" — nothing is saved until Save. */
export function InterviewFundingEditor({
  clientId,
  practiceId,
  formOptions,
  onClose,
}: {
  clientId: string
  practiceId: string
  formOptions: ReferralFundingCardFormOptions
  onClose: () => void
}) {
  const router = useRouter()
  const bodyRef = useRef<HTMLDivElement>(null)
  const { dirty, handlers } = useDirtyTracking()
  const [saving, setSaving] = useState(false)
  const [relationships, setRelationships] = useState(formOptions.relationships)
  return (
    <InterviewEditorShell
      title="Add referral or funding approval"
      summary={`${formOptions.client.firstName} ${formOptions.client.lastName}`}
      dirty={dirty}
      saving={saving}
      onSave={() => submitFormIn(bodyRef.current)}
      onClose={onClose}
    >
      <div ref={bodyRef} {...handlers}>
        <FundingApprovalForm
          practiceId={practiceId}
          clients={[formOptions.client]}
          approvalTypes={formOptions.approvalTypes}
          claims={formOptions.claims.map((claim) => ({ ...claim, clientId }))}
          referrers={formOptions.referrers}
          relationships={relationships}
          professions={formOptions.professions}
          organisations={formOptions.organisations}
          privateClaimTypeId={formOptions.privateClaimTypeId}
          lockClient
          embedded
          hideActions
          initialValues={{ clientId }}
          onPendingChange={setSaving}
          onPersonCreated={(person) => {
            setRelationships((current) =>
              current.some((row) => row.relationshipRecordId === person.relationshipRecordId)
                ? current
                : [
                    ...current,
                    {
                      relationshipRecordId: person.relationshipRecordId,
                      givenName: person.givenName,
                      relationshipToClient: person.relationshipToClient,
                      blockRole: person.blockRole ?? null,
                      blockRoleType: person.blockRoleType ?? null,
                    },
                  ]
            )
          }}
          onSaved={() => {
            onClose()
            router.refresh()
          }}
          onCancel={onClose}
        />
      </div>
    </InterviewEditorShell>
  )
}

/** Identity, education, occupation: edit a copy; Save writes it. */
export function InterviewFieldsEditor<T>({
  title,
  saved,
  save,
  onClose,
  children,
}: {
  title: string
  saved: T
  save: (value: T) => Promise<{ error?: string }>
  onClose: () => void
  children: (value: T, onChange: (next: T) => void) => ReactNode
}) {
  const [value, setValue] = useState(saved)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dirty = JSON.stringify(value) !== JSON.stringify(saved)

  async function submit() {
    if (saving) return
    setSaving(true)
    setError(null)
    const result = await save(value)
    setSaving(false)
    if (result.error) {
      setError(result.error)
      return
    }
    onClose()
  }

  return (
    <InterviewEditorShell title={title} dirty={dirty} saving={saving} onSave={() => void submit()} onClose={onClose}>
      <div className="space-y-4">
        {children(value, setValue)}
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </InterviewEditorShell>
  )
}

function householdFieldsChanged(before: RelationshipRecord, after: RelationshipRecord): boolean {
  return (
    JSON.stringify([before.livingSituation, before.dependency]) !==
    JSON.stringify([after.livingSituation, after.dependency])
  )
}

/** Living situation: household fields and who-lives-here ticks on people are saved together. */
export function InterviewLivingEditor({
  saved,
  relationships,
  client,
  save,
  onClose,
}: {
  saved: LivingSituationFields
  relationships: RelationshipRecord[]
  client?: ClientBackgroundSuggestions["living"]
  save: (value: LivingSituationFields, changedPeople: RelationshipRecord[]) => Promise<{ error?: string }>
  onClose: () => void
}) {
  const [value, setValue] = useState(saved)
  const [people, setPeople] = useState(relationships)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const changedPeople = people.filter((person) => {
    const before = relationships.find((row) => row.relationshipRecordId === person.relationshipRecordId)
    return Boolean(before && householdFieldsChanged(before, person))
  })
  const dirty = JSON.stringify(value) !== JSON.stringify(saved) || changedPeople.length > 0

  async function submit() {
    if (saving) return
    setSaving(true)
    setError(null)
    const result = await save(value, changedPeople)
    setSaving(false)
    if (result.error) {
      setError(result.error)
      return
    }
    onClose()
  }

  return (
    <InterviewEditorShell
      title="Living situation"
      dirty={dirty}
      saving={saving}
      onSave={() => void submit()}
      onClose={onClose}
    >
      <div className="space-y-4">
        <LivingFieldsEditor
          value={value}
          relationships={people}
          onChange={setValue}
          onPersonChange={(person) =>
            setPeople((current) =>
              current.map((row) => (row.relationshipRecordId === person.relationshipRecordId ? person : row))
            )
          }
          client={client}
        />
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </InterviewEditorShell>
  )
}

export function InterviewEmergencyContactsEditor({
  clientId,
  contacts,
  onClose,
}: {
  clientId: string
  contacts: ComponentProps<typeof EmergencyContactsSection>["contacts"]
  onClose: () => void
}) {
  return (
    <InterviewEditorShell title="Emergency contacts" onClose={onClose}>
      {/* EmergencyContactsSection carries its own page gutter. */}
      <div className="-mx-4">
        <EmergencyContactsSection clientId={clientId} contacts={contacts} />
      </div>
    </InterviewEditorShell>
  )
}

export function InterviewMedicalContactsEditor({
  clientId,
  contacts,
  professionals,
  onClose,
}: {
  clientId: string
  contacts: ComponentProps<typeof MedicalContactsSection>["contacts"]
  professionals: ComponentProps<typeof MedicalContactsSection>["professionals"]
  onClose: () => void
}) {
  return (
    <InterviewEditorShell title="GP and treating professionals" onClose={onClose}>
      <MedicalContactsSection clientId={clientId} contacts={contacts} professionals={professionals} />
    </InterviewEditorShell>
  )
}
