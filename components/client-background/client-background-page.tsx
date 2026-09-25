"use client"

import { useState } from "react"

import { DemographicsSection } from "@/components/client-background/demographics-section"
import { HistorySection } from "@/components/client-background/history-section"
import { RelationshipsSection } from "@/components/client-background/relationships-section"
import { RiskSection } from "@/components/client-background/risk-section"
import type { ClientBackgroundData } from "@/lib/client-background/types"
import { cn } from "@/lib/utils"

const SECTIONS = [
  { id: "demographics", label: "Demographics" },
  { id: "relationships", label: "Relationships" },
  { id: "history", label: "History" },
  { id: "risk", label: "Risk" },
] as const

type SectionId = (typeof SECTIONS)[number]["id"]

export function ClientBackgroundPage({
  clientId,
  data,
}: {
  clientId: string
  data: ClientBackgroundData
}) {
  const [section, setSection] = useState<SectionId>("demographics")

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              "rounded-md px-3 py-1.5 text-sm hover:bg-muted",
              section === item.id && "bg-muted font-medium"
            )}
            onClick={() => setSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {section === "demographics" ? (
        <DemographicsSection clientId={clientId} demographics={data.demographics} />
      ) : null}
      {section === "relationships" ? (
        <RelationshipsSection
          clientId={clientId}
          relationships={data.relationships}
          partnerships={data.partnerships}
        />
      ) : null}
      {section === "history" ? (
        <HistorySection
          clientId={clientId}
          dateOfBirth={data.dateOfBirth}
          events={data.events}
          relationships={data.relationships}
        />
      ) : null}
      {section === "risk" ? <RiskSection clientId={clientId} risk={data.risk} /> : null}
    </div>
  )
}
