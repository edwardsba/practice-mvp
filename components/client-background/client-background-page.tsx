"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"

import { DemographicsSection, LivingSituationSection } from "@/components/client-background/demographics-section"
import { HistoryTreeSection } from "@/components/client-background/history-tree-section"
import { BackgroundInterviewCard } from "@/components/client-background/interview-card"
import { BackgroundStressorsSection } from "@/components/client-background/medication-stressors"
import { RelationshipTreeSection } from "@/components/client-background/relationship-tree-section"
import { scrollToBackgroundCheck } from "@/components/client-background/worth-checking"
import { ReferralFundingCard } from "@/components/funding/referral-funding-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { backgroundChecks, backgroundSectionForCheck, type BackgroundCheck } from "@/lib/client-background/checks"
import type { BackgroundInterviewCardData, ReasonSupport } from "@/lib/client-background/load"
import { emptyBlockAnswers, type ClientBackgroundData } from "@/lib/client-background/types"
import type { ReferralFundingCardProps } from "@/lib/funding/referral-funding-card-props"
import { cn } from "@/lib/utils"

const SECTIONS = [
  { id: "reason", label: "Referral and funding" },
  { id: "demographics", label: "Demographics" },
  { id: "relationships", label: "Relationships" },
  { id: "living", label: "Living situation" },
  { id: "history", label: "History" },
  { id: "stressors", label: "Stressors" },
  { id: "risk", label: "Risk" },
] as const

type SectionId = (typeof SECTIONS)[number]["id"]

export function ClientBackgroundPage({
  clientId,
  clientName = "Client",
  practiceId: _practiceId,
  data,
  interview,
  numberOfChildren,
  reasonSupport,
  referralFunding,
  referralRecorded = false,
}: {
  clientId: string
  clientName?: string
  practiceId: string
  data: ClientBackgroundData
  interview: BackgroundInterviewCardData
  numberOfChildren: number | null
  reasonSupport: ReasonSupport
  referralFunding: ReferralFundingCardProps
  referralRecorded?: boolean
}) {
  const [open, setOpen] = useState<SectionId | null>(null)
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "")
    if (!hash.startsWith("check-")) return
    const target = hash.slice("check-".length)
    const section: SectionId =
      target === "reason" ||
      target === "stressors" ||
      target === "relationships" ||
      target === "living" ||
      target === "history" ||
      target === "risk"
        ? target
        : target.startsWith("history")
          ? "history"
          : target === "living"
            ? "living"
            : "demographics"
    setOpen(section)
    window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 50)
  }, [])

  const checks = useMemo(
    () =>
      backgroundChecks({
        data,
        numberOfChildren,
        screening: interview.latest?.screening ?? null,
        referralRecorded,
      }),
    [data, interview.latest, numberOfChildren, referralRecorded]
  )

  function toggle(id: SectionId) {
    setOpen((current) => (current === id ? null : id))
  }

  function jump(check: BackgroundCheck) {
    const section = backgroundSectionForCheck(check.target)
    setOpen(section)
    window.setTimeout(() => scrollToBackgroundCheck(check), 50)
  }

  return (
    <div className="min-w-0 max-w-full space-y-4 max-lg:[&_input]:text-base max-lg:[&_select]:text-base max-lg:[&_textarea]:text-base">
      <BackgroundInterviewCard clientId={clientId} summary={interview} checks={checks} onJump={jump} />
      {SECTIONS.map((item) => (
        <SectionCard
          key={item.id}
          id={`check-${item.id}`}
          title={item.label}
          open={open === item.id}
          onToggle={() => toggle(item.id)}
        >
          {item.id === "reason" ? <ReferralFundingCard {...referralFunding} hideTitle /> : null}
          {item.id === "demographics" ? (
            <DemographicsSection
              clientId={clientId}
              demographics={data.demographics}
              relationships={data.relationships}
            />
          ) : null}
          {item.id === "relationships" ? (
            <RelationshipTreeSection
              clientId={clientId}
              relationships={data.relationships}
              blocks={data.relationshipBlocks ?? []}
              blockAnswers={data.blockAnswers ?? emptyBlockAnswers()}
              relationshipStatus={data.relationshipStatus}
              dateOfBirth={data.dateOfBirth}
              events={data.events}
            />
          ) : null}
          {item.id === "living" ? (
            <LivingSituationSection
              clientId={clientId}
              livingSituation={data.demographics.livingSituation}
              relationships={data.relationships}
            />
          ) : null}
          {item.id === "history" ? (
            <HistoryTreeSection
              clientId={clientId}
              clientName={clientName.split(/\s+/)[0] || clientName}
              dateOfBirth={data.dateOfBirth}
              events={data.events}
              relationships={data.relationships}
              screening={interview.latest?.screening ?? {}}
              professionals={reasonSupport.professionals}
              issues={data.issues}
            />
          ) : null}
          {item.id === "stressors" ? (
            <BackgroundStressorsSection clientId={clientId} stressors={data.stressors} />
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
  id,
  title,
  open,
  onToggle,
  children,
}: {
  id?: string
  title: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <Card id={id} className="scroll-mt-24">
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
