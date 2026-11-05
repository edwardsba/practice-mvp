"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"

import { DemographicsSection } from "@/components/client-background/demographics-section"
import { HistorySection } from "@/components/client-background/history-section"
import { BackgroundInterviewCard } from "@/components/client-background/interview-card"
import { BackgroundStressorsSection } from "@/components/client-background/medication-stressors"
import { ReasonSection } from "@/components/client-background/reason-section"
import { RelationshipBlocksSection } from "@/components/client-background/relationship-blocks-section"
import { scrollToBackgroundCheck } from "@/components/client-background/worth-checking"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { backgroundChecks, backgroundSectionForCheck, type BackgroundCheck } from "@/lib/client-background/checks"
import type { BackgroundInterviewCardData, ReasonSupport } from "@/lib/client-background/load"
import type { ClientBackgroundData } from "@/lib/client-background/types"
import { cn } from "@/lib/utils"

const SECTIONS = [
  { id: "reason", label: "Referral" },
  { id: "demographics", label: "Demographics" },
  { id: "relationships", label: "Relationships" },
  { id: "history", label: "History" },
  { id: "stressors", label: "Stressors" },
  { id: "risk", label: "Risk" },
] as const

type SectionId = (typeof SECTIONS)[number]["id"]

export function ClientBackgroundPage({
  clientId,
  practiceId,
  data,
  interview,
  numberOfChildren,
  reasonSupport,
}: {
  clientId: string
  practiceId: string
  data: ClientBackgroundData
  interview: BackgroundInterviewCardData
  numberOfChildren: number | null
  reasonSupport: ReasonSupport
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
      target === "history" ||
      target === "risk"
        ? target
        : target.startsWith("history")
          ? "history"
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
      }),
    [data, interview.latest, numberOfChildren]
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
          {item.id === "reason" ? (
            <ReasonSection
              clientId={clientId}
              practiceId={practiceId}
              reason={data.reason}
              professionals={reasonSupport.professionals}
              professions={reasonSupport.professions}
              organisations={reasonSupport.organisations}
              relationships={data.relationships}
              suggestedProfessionalId={reasonSupport.suggestedProfessionalId}
            />
          ) : null}
          {item.id === "demographics" ? (
            <DemographicsSection
              clientId={clientId}
              demographics={data.demographics}
              relationships={data.relationships}
            />
          ) : null}
          {item.id === "relationships" ? (
            <RelationshipBlocksSection
              clientId={clientId}
              relationships={data.relationships}
              blocks={data.relationshipBlocks}
              blockAnswers={data.blockAnswers}
              relationshipStatus={data.relationshipStatus}
              childrenPrompt={
                numberOfChildren == null
                  ? null
                  : numberOfChildren === 0
                    ? "no children"
                    : numberOfChildren === 1
                      ? "1 child"
                      : `${numberOfChildren} children (including step-children)`
              }
            />
          ) : null}
          {item.id === "history" ? (
            <HistorySection
              clientId={clientId}
              dateOfBirth={data.dateOfBirth}
              events={data.events}
              relationships={data.relationships}
              interviewSource={interview.latest}
              professionals={reasonSupport.professionals}
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
