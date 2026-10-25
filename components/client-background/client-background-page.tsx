"use client"

import { useState, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"

import { DemographicsSection } from "@/components/client-background/demographics-section"
import { HistorySection } from "@/components/client-background/history-section"
import { BackgroundInterviewCard } from "@/components/client-background/interview-card"
import { RelationshipsSection } from "@/components/client-background/relationships-section"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { BackgroundInterviewCardData } from "@/lib/client-background/load"
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
  interview,
}: {
  clientId: string
  data: ClientBackgroundData
  interview: BackgroundInterviewCardData
}) {
  const [open, setOpen] = useState<SectionId | null>(null)

  function toggle(id: SectionId) {
    setOpen((current) => (current === id ? null : id))
  }

  return (
    <div className="min-w-0 max-w-full space-y-4 max-lg:[&_input]:text-base max-lg:[&_select]:text-base max-lg:[&_textarea]:text-base">
      <BackgroundInterviewCard clientId={clientId} summary={interview} />
      {SECTIONS.map((item) => (
        <SectionCard
          key={item.id}
          title={item.label}
          open={open === item.id}
          onToggle={() => toggle(item.id)}
        >
          {item.id === "demographics" ? (
            <DemographicsSection
              clientId={clientId}
              demographics={data.demographics}
              relationships={data.relationships}
            />
          ) : null}
          {item.id === "relationships" ? (
            <RelationshipsSection
              clientId={clientId}
              relationships={data.relationships}
              partnerships={data.partnerships}
              relationshipStatus={data.relationshipStatus}
            />
          ) : null}
          {item.id === "history" ? (
            <HistorySection
              clientId={clientId}
              dateOfBirth={data.dateOfBirth}
              events={data.events}
              relationships={data.relationships}
              medication={data.medication}
              stressors={data.stressors}
            />
          ) : null}
          {item.id === "risk" ? (
            <p className="text-sm text-muted-foreground">
              The read-only Risk view is not part of this release yet.
            </p>
          ) : null}
        </SectionCard>
      ))}
    </div>
  )
}

function SectionCard({
  title,
  open,
  onToggle,
  children,
}: {
  title: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 text-left"
          aria-expanded={open}
          onClick={onToggle}
        >
          <CardTitle>{title}</CardTitle>
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
      </CardHeader>
      <CardContent className={cn("min-w-0", !open && "hidden")}>{children}</CardContent>
    </Card>
  )
}
