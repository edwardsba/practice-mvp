"use client"

import Link from "next/link"
import { useActionState, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { upsertClaim, type FundingFormState } from "@/lib/actions/funding"
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
  isInsuranceClaimType,
  isMedicareClaimType,
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

type ClaimTypeOption = {
  claimTypeId: string
  claimTypeName: string
}

type OrganisationOption = {
  organisationId: string
  organisationName: string
}

type ClaimInitialValues = {
  claimId?: string
  clientId?: string
  claimTypeId?: string
  medicareCardNumber?: string | null
  medicareIrn?: string | null
  insuranceOrganisationId?: string | null
  insuranceReferenceNumber?: string | null
  startDate?: string | null
  endDate?: string | null
}

export function ClaimForm({
  clients,
  claimTypes,
  organisations,
  initialValues,
  cancelHref,
  returnTo,
}: {
  clients: ClientOption[]
  claimTypes: ClaimTypeOption[]
  organisations: OrganisationOption[]
  initialValues?: ClaimInitialValues
  cancelHref: string
  returnTo?: string
}) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(
    upsertClaim.bind(null, initialValues?.claimId) as (
      prevState: FundingFormState,
      formData: FormData
    ) => Promise<FundingFormState>,
    {} as FundingFormState
  )
  const [selectedClaimTypeId, setSelectedClaimTypeId] = useState(
    initialValues?.claimTypeId ?? claimTypes[0]?.claimTypeId ?? ""
  )

  const selectedClaimType = useMemo(
    () => claimTypes.find((type) => type.claimTypeId === selectedClaimTypeId),
    [claimTypes, selectedClaimTypeId]
  )

  const showMedicare = isMedicareClaimType(selectedClaimType?.claimTypeName)
  const showInsurance = isInsuranceClaimType(selectedClaimType?.claimTypeName)

  useEffect(() => {
    if (state.success && state.claimId) {
      if (returnTo) {
        const separator = returnTo.includes("?") ? "&" : "?"
        router.push(`${returnTo}${separator}created_claim_id=${state.claimId}`)
      } else {
        router.push(`/funding/claims/${state.claimId}`)
      }
      router.refresh()
    }
  }, [state.success, state.claimId, returnTo, router])

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>{initialValues?.claimId ? "Edit claim" : "Add claim"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {initialValues?.claimId && initialValues.clientId ? (
            <input
              type="hidden"
              name="client_id"
              value={initialValues.clientId}
            />
          ) : null}
          <input
            type="hidden"
            name="claim_type_id"
            value={selectedClaimTypeId}
          />

          <div className="space-y-2">
            <Label htmlFor="client_id">Client</Label>
            <select
              id="client_id"
              name={initialValues?.claimId ? undefined : "client_id"}
              required={!initialValues?.claimId}
              defaultValue={initialValues?.clientId ?? ""}
              disabled={Boolean(initialValues?.claimId)}
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

          <div className="space-y-2">
            <Label htmlFor="claim_type_id">Claim type</Label>
            <select
              id="claim_type_id"
              required
              value={selectedClaimTypeId}
              onChange={(event) => setSelectedClaimTypeId(event.target.value)}
              className={selectClassName}
            >
              {claimTypes.map((type) => (
                <option key={type.claimTypeId} value={type.claimTypeId}>
                  {type.claimTypeName}
                </option>
              ))}
            </select>
          </div>

          {showMedicare ? (
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <Label htmlFor="medicare_card_number">Medicare card no.</Label>
                <Input
                  id="medicare_card_number"
                  name="medicare_card_number"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="10 digits"
                  defaultValue={initialValues?.medicareCardNumber ?? ""}
                />
              </div>
              <div className="space-y-2 sm:w-24">
                <Label htmlFor="medicare_irn">IRN</Label>
                <Input
                  id="medicare_irn"
                  name="medicare_irn"
                  maxLength={2}
                  placeholder="1"
                  defaultValue={initialValues?.medicareIrn ?? ""}
                />
              </div>
            </div>
          ) : null}

          {showInsurance ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="insurance_organisation_id">
                  Insurance organisation
                </Label>
                <select
                  id="insurance_organisation_id"
                  name="insurance_organisation_id"
                  defaultValue={initialValues?.insuranceOrganisationId ?? ""}
                  className={selectClassName}
                >
                  <option value="">Select organisation</option>
                  {organisations.map((org) => (
                    <option
                      key={org.organisationId}
                      value={org.organisationId}
                    >
                      {org.organisationName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="insurance_reference_number">
                  Insurance reference no.
                </Label>
                <Input
                  id="insurance_reference_number"
                  name="insurance_reference_number"
                  defaultValue={initialValues?.insuranceReferenceNumber ?? ""}
                />
              </div>
            </>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start date</Label>
              <Input
                id="start_date"
                name="start_date"
                type="date"
                defaultValue={initialValues?.startDate ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">End date</Label>
              <Input
                id="end_date"
                name="end_date"
                type="date"
                defaultValue={initialValues?.endDate ?? ""}
              />
            </div>
          </div>

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
        </form>
      </CardContent>
    </Card>
  )
}
