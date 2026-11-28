"use client"

import Link from "next/link"
import { useActionState, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import {
  createUnplacedReferrerPerson,
  upsertFundingApproval,
  type FundingFormState,
} from "@/lib/actions/funding"
import { saveProfessionalAction } from "@/lib/actions/contacts"
import { ProfessionalForm } from "@/components/contacts/professional-form"
import {
  clearFundingApprovalDraft,
  loadFundingApprovalDraft,
  saveFundingApprovalDraft,
} from "@/lib/funding/funding-approval-draft"
import {
  defaultFundingFormKind,
  type FundingFormKind,
} from "@/lib/funding/funding-form-kind"
import {
  claimOptionsWithPrivateFirst,
  CREATE_PRIVATE_CLAIM,
  isPrivateClaimSelection,
  privateApprovalTypeId,
  REFERRAL_SOURCE_LABELS,
  REFERRAL_SOURCES,
  type ReferralSource,
} from "@/lib/funding/referral"
import { safeReturnTo } from "@/lib/navigation/safe-return-to"
import {
  ADDABLE_RELATIONSHIP_GROUPS,
  RELATIONSHIP_TO_CLIENT_LABELS,
  type RelationshipToClient,
} from "@/lib/client-background/types"
import { personRoleLabel } from "@/lib/client-background/tree"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  addMonthsToDateString,
  APPROVAL_STATUS_LABELS,
  APPROVAL_STATUSES,
  isMedicareClaim,
} from "@/lib/funding/format"
import { cn } from "@/lib/utils"

const selectClassName = cn(
  "flex h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
)

type ClientOption = {
  clientId: string
  firstName: string
  lastName: string
}

type ApprovalTypeOption = {
  fundingApprovalTypeId: string
  name: string
  claimTypeId: string | null
  durationMonths: number | null
  appointmentsApproved: number | null
  reports: Array<{ appointmentNumber: number; reportType: string }>
}

type ClaimOption = {
  claimId: string
  clientId?: string
  claimTypeId: string | null
  claimTypeName: string
  claimTypeCode?: string | null
  startDate?: string | null
}

type ReferrerOption = {
  professionalId: string
  title?: string | null
  firstName: string
  lastName: string
  professionName?: string | null
  organisationName: string | null
}

type RelationshipOption = {
  relationshipRecordId: string
  givenName: string
  relationshipToClient: string
  blockRole?: string | null
  blockRoleType?: string | null
}

type ProfessionOption = {
  professionId: string
  professionName: string
}

type OrganisationOption = {
  organisationId: string
  organisationName: string
}

type LinkedAppointment = {
  appointmentDate: string
  appointmentTime: string
  location: string | null
}

export type FundingApprovalFormInitialValues = {
  fundingApprovalId?: string
  clientId?: string
  fundingApprovalTypeId?: string | null
  claimId?: string | null
  referrerId?: string | null
  referralDate?: string | null
  referrerComments?: string | null
  referralSource?: string | null
  referrerRelationshipId?: string | null
  referrerOther?: string | null
  startDate?: string | null
  endDate?: string | null
  appointmentsApproved?: number | null
  appointmentsAttended?: number
  approvalStatus?: string
  linkedAppointments?: LinkedAppointment[]
}

export function FundingApprovalForm({
  practiceId,
  clients,
  approvalTypes,
  claims,
  referrers,
  relationships: initialRelationships = [],
  professions = [],
  organisations = [],
  privateClaimTypeId = null,
  initialValues,
  initialKind,
  cancelHref,
  returnTo,
  lockClient = false,
  embedded = false,
  hideActions = false,
  onSaved,
  onCancel,
  onPendingChange,
  onPersonCreated,
}: {
  practiceId: string
  clients: ClientOption[]
  approvalTypes: ApprovalTypeOption[]
  claims: ClaimOption[]
  referrers: ReferrerOption[]
  relationships?: RelationshipOption[]
  professions?: ProfessionOption[]
  organisations?: OrganisationOption[]
  privateClaimTypeId?: string | null
  initialValues?: FundingApprovalFormInitialValues
  /** Query/default kind for new forms (`referral` | `approval`). */
  initialKind?: string | null
  cancelHref?: string
  returnTo?: string
  lockClient?: boolean
  embedded?: boolean
  /** Embedded in a panel whose own footer submits and cancels. */
  hideActions?: boolean
  onSaved?: (fundingApprovalId: string) => void
  onCancel?: () => void
  onPendingChange?: (pending: boolean) => void
  onPersonCreated?: (person: RelationshipOption) => void
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`
  const draftId = initialValues?.fundingApprovalId ?? "new"
  const skipNextTypeAutoFill = useRef(false)
  const [state, formAction, pending] = useActionState(
    upsertFundingApproval.bind(null, initialValues?.fundingApprovalId) as (
      prevState: FundingFormState,
      formData: FormData
    ) => Promise<FundingFormState>,
    {} as FundingFormState
  )

  const [formKind, setFormKind] = useState<FundingFormKind>(() =>
    defaultFundingFormKind({
      kindQuery: initialKind,
      fundingApprovalTypeId: initialValues?.fundingApprovalTypeId,
      isExisting: Boolean(initialValues?.fundingApprovalId),
    })
  )
  const [clientId, setClientId] = useState(initialValues?.clientId ?? "")
  const [claimId, setClaimId] = useState(initialValues?.claimId ?? "")
  const [referrerId, setReferrerId] = useState(initialValues?.referrerId ?? "")
  const [referralDate, setReferralDate] = useState(
    initialValues?.referralDate ?? ""
  )
  const [referrerComments, setReferrerComments] = useState(
    initialValues?.referrerComments ?? ""
  )
  const [referralSource, setReferralSource] = useState(
    (initialValues?.referralSource as ReferralSource | "") ?? ""
  )
  const [referrerRelationshipId, setReferrerRelationshipId] = useState(
    initialValues?.referrerRelationshipId
      ? initialValues.referrerRelationshipId
      : initialValues?.referrerOther
        ? "other"
        : ""
  )
  const [referrerOther, setReferrerOther] = useState(
    initialValues?.referrerOther ?? ""
  )
  const [approvalTypeId, setApprovalTypeId] = useState(
    initialValues?.fundingApprovalTypeId ?? ""
  )
  const [startDate, setStartDate] = useState(initialValues?.startDate ?? "")
  const [endDate, setEndDate] = useState(initialValues?.endDate ?? "")
  const [appointmentsApproved, setAppointmentsApproved] = useState(
    initialValues?.appointmentsApproved?.toString() ?? ""
  )
  const [approvalStatus, setApprovalStatus] = useState(
    initialValues?.approvalStatus ?? "active"
  )
  const [relationshipOptions, setRelationshipOptions] = useState(
    initialRelationships
  )
  const [referrerOptions, setReferrerOptions] = useState(referrers)
  const [addingProfessional, setAddingProfessional] = useState(false)
  const [addingPerson, setAddingPerson] = useState(false)
  const [newPersonName, setNewPersonName] = useState("")
  const [newPersonRole, setNewPersonRole] = useState<RelationshipToClient | "">(
    ""
  )
  const [personError, setPersonError] = useState<string | null>(null)
  const [personPending, setPersonPending] = useState(false)

  useEffect(() => {
    setRelationshipOptions(initialRelationships)
  }, [initialRelationships])

  useEffect(() => {
    setReferrerOptions(referrers)
  }, [referrers])

  const selectedType = useMemo(
    () =>
      approvalTypes.find(
        (type) => type.fundingApprovalTypeId === approvalTypeId
      ),
    [approvalTypes, approvalTypeId]
  )

  const clientClaims = useMemo(
    () =>
      claims.filter(
        (claim) => !clientId || !claim.clientId || claim.clientId === clientId
      ),
    [claims, clientId]
  )

  const claimSelectOptions = useMemo(
    () => claimOptionsWithPrivateFirst(clientClaims, privateClaimTypeId),
    [clientClaims, privateClaimTypeId]
  )

  const selectedClaimMeta = useMemo(() => {
    if (!claimId) return null
    if (claimId === CREATE_PRIVATE_CLAIM) {
      return {
        claimId: CREATE_PRIVATE_CLAIM,
        claimTypeId: privateClaimTypeId,
        claimTypeName: "Private",
        claimTypeCode: null,
      }
    }
    return clientClaims.find((claim) => claim.claimId === claimId) ?? null
  }, [claimId, clientClaims, privateClaimTypeId])

  const isMedicare = isMedicareClaim(selectedClaimMeta?.claimTypeCode)
  const isPrivate = isPrivateClaimSelection(claimId, clientClaims)

  const filteredApprovalTypes = useMemo(() => {
    if (isPrivate) {
      return approvalTypes.filter(
        (type) =>
          privateClaimTypeId == null || type.claimTypeId === privateClaimTypeId
      )
    }
    return selectedClaimMeta?.claimTypeId
      ? approvalTypes.filter(
          (type) => type.claimTypeId === selectedClaimMeta.claimTypeId
        )
      : approvalTypes
  }, [approvalTypes, isPrivate, privateClaimTypeId, selectedClaimMeta])

  useEffect(() => {
    const draft = loadFundingApprovalDraft(draftId)
    if (draft) {
      skipNextTypeAutoFill.current = true
      setClientId(draft.clientId || clientId)
      setApprovalTypeId(draft.approvalTypeId || approvalTypeId)
      setClaimId(draft.claimId || claimId)
      setReferrerId(draft.referrerId || referrerId)
      setReferralDate(draft.referralDate || referralDate)
      setReferrerComments(draft.referrerComments || referrerComments)
      setReferralSource((draft.referralSource as ReferralSource | "") || referralSource)
      setReferrerRelationshipId(
        draft.referrerRelationshipId || referrerRelationshipId
      )
      setReferrerOther(draft.referrerOther || referrerOther)
      setStartDate(draft.startDate || startDate)
      setEndDate(draft.endDate || endDate)
      setAppointmentsApproved(
        draft.appointmentsApproved || appointmentsApproved
      )
      clearFundingApprovalDraft(draftId)
    }

    const params = new URLSearchParams(window.location.search)
    const createdClaimId = params.get("created_claim_id")
    if (createdClaimId) {
      setClaimId(createdClaimId)
    }

    const createdReferrerId = params.get("created_referrer_id")
    if (createdReferrerId) {
      setReferrerId(createdReferrerId)
    }

    if (createdClaimId || createdReferrerId) {
      const cleanParams = new URLSearchParams(window.location.search)
      cleanParams.delete("created_claim_id")
      cleanParams.delete("created_referrer_id")
      const cleanUrl = `${window.location.pathname}${cleanParams.toString() ? `?${cleanParams.toString()}` : ""}`
      window.history.replaceState({}, "", cleanUrl)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedType) return
    if (skipNextTypeAutoFill.current) {
      skipNextTypeAutoFill.current = false
      return
    }
    if (!initialValues?.fundingApprovalId) {
      setAppointmentsApproved(
        selectedType.appointmentsApproved?.toString() ?? ""
      )
      if (startDate && selectedType.durationMonths) {
        setEndDate(
          addMonthsToDateString(startDate, selectedType.durationMonths) ?? ""
        )
      }
    }
  }, [approvalTypeId, selectedType, startDate, initialValues?.fundingApprovalId])

  useEffect(() => {
    if (!initialValues?.fundingApprovalId && !startDate && referralDate) {
      setStartDate(referralDate)
      if (selectedType?.durationMonths) {
        setEndDate(
          addMonthsToDateString(referralDate, selectedType.durationMonths) ?? ""
        )
      }
    }
  }, [
    referralDate,
    startDate,
    initialValues?.fundingApprovalId,
    selectedType?.durationMonths,
  ])

  useEffect(() => {
    if (state.success && state.fundingApprovalId) {
      if (embedded) {
        onSaved?.(state.fundingApprovalId)
        router.refresh()
        return
      }
      const safe = safeReturnTo(returnTo)
      if (safe) {
        router.push(safe)
      } else {
        router.push(`/funding/approvals/${state.fundingApprovalId}`)
      }
      router.refresh()
    }
  }, [state.success, state.fundingApprovalId, returnTo, router, embedded, onSaved])

  useEffect(() => {
    onPendingChange?.(pending)
  }, [pending, onPendingChange])

  const isReferral = formKind === "referral"
  const hasFundingValues = Boolean(
    approvalTypeId ||
      startDate ||
      endDate ||
      appointmentsApproved ||
      (approvalStatus && approvalStatus !== "active")
  )

  function clearFundingFields() {
    setApprovalTypeId("")
    setStartDate("")
    setEndDate("")
    setAppointmentsApproved("")
    setApprovalStatus("active")
  }

  function onFormKindChange(next: FundingFormKind) {
    if (next === formKind) return
    if (
      next === "referral" &&
      formKind === "approval" &&
      (initialValues?.fundingApprovalId || hasFundingValues)
    ) {
      const ok = window.confirm(
        "This will clear the funding details. Continue?"
      )
      if (!ok) return
      clearFundingFields()
    }
    setFormKind(next)
  }

  function saveCurrentDraft() {
    saveFundingApprovalDraft(draftId, {
      clientId,
      approvalTypeId,
      claimId,
      referrerId,
      referralDate,
      referrerComments,
      referralSource,
      referrerRelationshipId,
      referrerOther,
      startDate,
      endDate,
      appointmentsApproved,
    })
  }

  function onClaimChange(newClaimId: string) {
    setClaimId(newClaimId)

    if (isPrivateClaimSelection(newClaimId, clientClaims)) {
      const privateTypeId = privateApprovalTypeId(
        approvalTypes,
        privateClaimTypeId
      )
      if (privateTypeId) setApprovalTypeId(privateTypeId)
      return
    }

    const newClaim = clientClaims.find((c) => c.claimId === newClaimId)
    if (newClaim?.claimTypeId && approvalTypeId) {
      const stillValid = approvalTypes.some(
        (type) =>
          type.fundingApprovalTypeId === approvalTypeId &&
          type.claimTypeId === newClaim.claimTypeId
      )
      if (!stillValid) setApprovalTypeId("")
    }
    if (!newClaimId) setApprovalTypeId("")
  }

  async function handleAddPerson() {
    setPersonError(null)
    if (!clientId) {
      setPersonError("Client is required.")
      return
    }
    if (!newPersonName.trim() || !newPersonRole) {
      setPersonError("Given name and relationship are required.")
      return
    }
    setPersonPending(true)
    const result = await createUnplacedReferrerPerson(clientId, {
      givenName: newPersonName,
      relationshipToClient: newPersonRole,
    })
    setPersonPending(false)
    if ("error" in result) {
      setPersonError(result.error ?? "Unable to add person.")
      return
    }
    const person: RelationshipOption = {
      relationshipRecordId: result.relationshipRecordId,
      givenName: newPersonName.trim(),
      relationshipToClient: newPersonRole,
      blockRole: null,
      blockRoleType: null,
    }
    setRelationshipOptions((current) => [...current, person])
    onPersonCreated?.(person)
    setReferrerRelationshipId(result.relationshipRecordId)
    setReferrerOther("")
    setAddingPerson(false)
    setNewPersonName("")
    setNewPersonRole("")
  }

  const hideClientField = lockClient || Boolean(initialValues?.fundingApprovalId)
  const showReferralSource = !referrerId
  const whoValue =
    referrerRelationshipId ||
    (referralSource === "family_or_friend" && referrerOther ? "other" : "")

  const formBody = (
    <form action={formAction} className="space-y-6">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Type</legend>
        <div className="flex flex-wrap gap-4">
          <label className="inline-flex min-h-11 items-center gap-2 text-sm">
            <input
              type="radio"
              name="form_kind"
              value="referral"
              checked={isReferral}
              onChange={() => onFormKindChange("referral")}
            />
            Referral
          </label>
          <label className="inline-flex min-h-11 items-center gap-2 text-sm">
            <input
              type="radio"
              name="form_kind"
              value="approval"
              checked={!isReferral}
              onChange={() => onFormKindChange("approval")}
            />
            Funding approval
          </label>
        </div>
      </fieldset>

      {hideClientField ? (
        <input type="hidden" name="client_id" value={clientId} />
      ) : (
        <div className="space-y-2">
          <Label htmlFor="client_id">Client</Label>
          <select
            id="client_id"
            name="client_id"
            required
            value={clientId}
            onChange={(event) => {
              setClientId(event.target.value)
              setClaimId("")
            }}
            className={selectClassName}
          >
            <option value="" disabled>
              Select a client
            </option>
            {clients.map((client) => (
              <option key={client.clientId} value={client.clientId}>
                {client.lastName}, {client.firstName}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className={cn("grid gap-4", !isReferral && "sm:grid-cols-2")}>
        <div className="space-y-2">
          <Label htmlFor="claim_id">Claim</Label>
          <div className="flex flex-wrap items-center gap-2">
            <select
              id="claim_id"
              name="claim_id"
              required={!isReferral}
              value={claimId}
              onChange={(event) => onClaimChange(event.target.value)}
              className={selectClassName}
            >
              <option value="" disabled={!isReferral}>
                {isReferral ? "No claim (optional)" : "Select claim"}
              </option>
              {claimSelectOptions.map((claim) => (
                <option key={claim.claimId} value={claim.claimId}>
                  {claim.claimTypeName}
                  {"startDate" in claim && claim.startDate
                    ? ` (${claim.startDate})`
                    : ""}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                saveCurrentDraft()
                const returnToUrl = currentUrl
                const claimUrl = `/funding/claims/new?${clientId ? `client_id=${clientId}&` : ""}returnTo=${encodeURIComponent(returnToUrl)}`
                window.location.href = claimUrl
              }}
            >
              + Add claim
            </Button>
          </div>
        </div>

        {isReferral ? (
          <input type="hidden" name="funding_approval_type_id" value="" />
        ) : (
          <div className="space-y-2">
            <Label htmlFor="funding_approval_type_id">Funding approval type</Label>
            <select
              id="funding_approval_type_id"
              name="funding_approval_type_id"
              required
              value={approvalTypeId}
              onChange={(event) => setApprovalTypeId(event.target.value)}
              className={selectClassName}
            >
              <option value="" disabled>
                Select approval type
              </option>
              {filteredApprovalTypes.map((type) => (
                <option
                  key={type.fundingApprovalTypeId}
                  value={type.fundingApprovalTypeId}
                >
                  {type.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <fieldset className="space-y-4 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">Referral</legend>

        <div className="space-y-2">
          <Label htmlFor="referrer_id">
            Referrer
            {isMedicare ? (
              <span className="ml-1 text-destructive">*</span>
            ) : null}
          </Label>
          <div className="flex flex-wrap items-center gap-2">
            <select
              id="referrer_id"
              name="referrer_id"
              required={isMedicare}
              value={referrerId}
              onChange={(event) => {
                const value = event.target.value
                setReferrerId(value)
                if (value) {
                  setReferralSource("")
                  setReferrerRelationshipId("")
                  setReferrerOther("")
                }
              }}
              className={selectClassName}
            >
              <option value="">Select referrer</option>
              {referrerOptions.map((referrer) => {
                const name = [
                  referrer.title?.trim(),
                  referrer.firstName.trim(),
                  referrer.lastName.trim(),
                ]
                  .filter(Boolean)
                  .join(" ")
                const detail =
                  referrer.professionName?.trim() ||
                  referrer.organisationName?.trim() ||
                  ""
                return (
                  <option
                    key={referrer.professionalId}
                    value={referrer.professionalId}
                  >
                    {name}
                    {detail ? ` — ${detail}` : ""}
                  </option>
                )
              })}
            </select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAddingProfessional(true)}
            >
              + Add professional
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {isMedicare
              ? "Required for Medicare claims."
              : "Leave blank for self, family or friend referrals."}
          </p>
        </div>

        {showReferralSource ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="referral_source">Referral source</Label>
              <select
                id="referral_source"
                name="referral_source"
                value={referralSource}
                onChange={(event) => {
                  const value = event.target.value as ReferralSource | ""
                  setReferralSource(value)
                  if (value === "self") {
                    setReferrerRelationshipId("")
                    setReferrerOther("")
                  } else if (value !== "family_or_friend" && value !== "other") {
                    setReferrerRelationshipId("")
                    setReferrerOther("")
                  }
                }}
                className={selectClassName}
              >
                <option value="">Select…</option>
                {REFERRAL_SOURCES.map((source) => (
                  <option key={source} value={source}>
                    {REFERRAL_SOURCE_LABELS[source]}
                  </option>
                ))}
              </select>
            </div>

            {referralSource === "family_or_friend" ? (
              <div className="space-y-2">
                <Label htmlFor="referrer_relationship_id">Who</Label>
                <select
                  id="referrer_relationship_id"
                  name="referrer_relationship_id"
                  value={whoValue}
                  onChange={(event) => {
                    const value = event.target.value
                    if (value === "other") {
                      setReferrerRelationshipId("other")
                    } else {
                      setReferrerRelationshipId(value)
                      setReferrerOther("")
                    }
                  }}
                  className={selectClassName}
                >
                  <option value="">Select…</option>
                  {relationshipOptions.map((person) => {
                    const name = person.givenName.trim() || "Unnamed"
                    const role = personRoleLabel({
                      relationshipToClient:
                        person.relationshipToClient as RelationshipToClient,
                    })
                    return (
                      <option
                        key={person.relationshipRecordId}
                        value={person.relationshipRecordId}
                      >
                        {name} ({role})
                      </option>
                    )
                  })}
                  <option value="other">Other: describe</option>
                </select>
                {whoValue === "other" ? (
                  <Input
                    name="referrer_other"
                    value={referrerOther}
                    onChange={(event) => setReferrerOther(event.target.value)}
                    placeholder="Describe who referred them"
                  />
                ) : (
                  <input type="hidden" name="referrer_other" value="" />
                )}
                {!addingPerson ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAddingPerson(true)}
                  >
                    + Add person
                  </Button>
                ) : (
                  <div className="space-y-2 rounded-md border p-3">
                    <div className="space-y-2">
                      <Label htmlFor="new_person_given_name">Given name</Label>
                      <Input
                        id="new_person_given_name"
                        value={newPersonName}
                        onChange={(event) =>
                          setNewPersonName(event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new_person_role">Relationship</Label>
                      <select
                        id="new_person_role"
                        value={newPersonRole}
                        onChange={(event) =>
                          setNewPersonRole(
                            event.target.value as RelationshipToClient | ""
                          )
                        }
                        className={selectClassName}
                      >
                        <option value="">Select…</option>
                        {ADDABLE_RELATIONSHIP_GROUPS.map((group) => (
                          <optgroup key={group.label} label={group.label}>
                            {group.roles.map((role) => (
                              <option key={role} value={role}>
                                {RELATIONSHIP_TO_CLIENT_LABELS[role]}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    {personError ? (
                      <p className="text-sm text-destructive">{personError}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={personPending}
                        onClick={() => void handleAddPerson()}
                      >
                        {personPending ? "Saving…" : "Save person"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setAddingPerson(false)
                          setPersonError(null)
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {referralSource === "other" ? (
              <div className="space-y-2">
                <Label htmlFor="referrer_other">Describe</Label>
                <Input
                  id="referrer_other"
                  name="referrer_other"
                  value={referrerOther}
                  onChange={(event) => setReferrerOther(event.target.value)}
                  placeholder="Describe the referral source"
                />
                <input type="hidden" name="referrer_relationship_id" value="" />
              </div>
            ) : null}

            {referralSource !== "family_or_friend" &&
            referralSource !== "other" ? (
              <>
                <input type="hidden" name="referrer_relationship_id" value="" />
                <input type="hidden" name="referrer_other" value="" />
              </>
            ) : null}
          </>
        ) : (
          <>
            <input type="hidden" name="referral_source" value="" />
            <input type="hidden" name="referrer_relationship_id" value="" />
            <input type="hidden" name="referrer_other" value="" />
          </>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="referral_date">Referral date</Label>
            <Input
              id="referral_date"
              name="referral_date"
              type="date"
              value={referralDate}
              onChange={(event) => setReferralDate(event.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="referrer_comments">Referrer comments</Label>
            <Textarea
              id="referrer_comments"
              name="referrer_comments"
              value={referrerComments}
              onChange={(event) => setReferrerComments(event.target.value)}
              rows={3}
            />
          </div>
        </div>
      </fieldset>

      {isReferral ? (
        <>
          <input type="hidden" name="start_date" value="" />
          <input type="hidden" name="end_date" value="" />
          <input type="hidden" name="appointments_approved" value="" />
          <input type="hidden" name="approval_status" value="active" />
        </>
      ) : (
        <fieldset className="space-y-4 rounded-lg border p-4">
          <legend className="px-1 text-sm font-medium">Approval</legend>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start date</Label>
              <Input
                id="start_date"
                name="start_date"
                type="date"
                value={startDate}
                onChange={(event) => {
                  const value = event.target.value
                  setStartDate(value)
                  if (selectedType?.durationMonths) {
                    setEndDate(
                      addMonthsToDateString(
                        value,
                        selectedType.durationMonths
                      ) ?? ""
                    )
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">End date</Label>
              <Input
                id="end_date"
                name="end_date"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="appointments_approved">Appointments approved</Label>
              <Input
                id="appointments_approved"
                name="appointments_approved"
                type="number"
                min={0}
                value={appointmentsApproved}
                onChange={(event) =>
                  setAppointmentsApproved(event.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Appointments attended</Label>
              <Input
                readOnly
                value={initialValues?.appointmentsAttended ?? 0}
                className="bg-muted"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="approval_status">Status</Label>
            <select
              id="approval_status"
              name="approval_status"
              value={approvalStatus}
              onChange={(event) => setApprovalStatus(event.target.value)}
              className={selectClassName}
            >
              {APPROVAL_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {APPROVAL_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
        </fieldset>
      )}

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      {hideActions ? null : (
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
          {embedded ? (
            <Button type="button" variant="outline" onClick={() => onCancel?.()}>
              Cancel
            </Button>
          ) : (
            <Button type="button" variant="outline" asChild>
              <Link href={cancelHref ?? "/funding/approvals"}>Cancel</Link>
            </Button>
          )}
        </div>
      )}

      <Sheet open={addingProfessional} onOpenChange={setAddingProfessional}>
        <SheetContent className="h-full w-full overflow-y-auto sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle>Add professional</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">
            {addingProfessional ? (
              <ProfessionalForm
                action={saveProfessionalAction.bind(
                  null,
                  practiceId,
                  undefined,
                  null
                )}
                professions={professions}
                organisations={organisations}
                submitLabel="Save professional"
                onSaved={(professional) => {
                  setReferrerOptions((current) => {
                    if (
                      current.some(
                        (item) =>
                          item.professionalId === professional.professionalId
                      )
                    ) {
                      return current
                    }
                    return [
                      ...current,
                      {
                        professionalId: professional.professionalId,
                        title: professional.title,
                        firstName: professional.firstName,
                        lastName: professional.lastName,
                        professionName: professional.professionName,
                        organisationName: null,
                      },
                    ]
                  })
                  setReferrerId(professional.professionalId)
                  setReferralSource("")
                  setReferrerRelationshipId("")
                  setReferrerOther("")
                  setAddingProfessional(false)
                }}
                onCancel={() => setAddingProfessional(false)}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </form>
  )

  if (embedded) {
    return formBody
  }

  const cardTitle = initialValues?.fundingApprovalId
    ? isReferral
      ? "Edit referral"
      : "Edit funding approval"
    : isReferral
      ? "Add referral"
      : "Add funding approval"

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>{cardTitle}</CardTitle>
      </CardHeader>
      <CardContent>{formBody}</CardContent>
    </Card>
  )
}
