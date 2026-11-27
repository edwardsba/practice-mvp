"use client"

import type { ReactNode } from "react"
import { ChevronRight } from "lucide-react"

import { PanelGroup } from "@/components/client-background/relationship-panel-shared"
import { NOT_RECORDED, type InfoGroup } from "@/lib/client-background/panel-info"
import { cn } from "@/lib/utils"

/** Shared info-page field rows: label ~40% grey, value right; empties italic Not recorded. */
export function PanelInfoFields({ groups }: { groups: InfoGroup[] }) {
  return (
    <div>
      {groups.map((group, index) => (
        <PanelGroup key={group.id} title={group.title} index={index}>
          <dl className="space-y-2 text-sm">
            {group.fields.map((row) => (
              <div key={row.label} className="grid grid-cols-[minmax(0,40%)_1fr] gap-2">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className={cn(row.empty && "italic text-muted-foreground")}>
                  {row.empty ? NOT_RECORDED : row.value}
                </dd>
              </div>
            ))}
          </dl>
        </PanelGroup>
      ))}
    </div>
  )
}

export type ConnectedLink = {
  id: string
  label: string
  onOpen: () => void
}

/** Last Connected group — tappable links to related items. */
export function PanelConnectedGroup({
  index,
  links,
  empty,
}: {
  index: number
  links: ConnectedLink[]
  empty?: string
}) {
  return (
    <PanelGroup title="Connected" index={index} empty={links.length === 0 ? empty : undefined}>
      {links.length > 0 ? (
        <ul className="space-y-2">
          {links.map((link) => (
            <li key={link.id}>
              <button
                type="button"
                className="flex min-h-11 w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted/50"
                onClick={link.onOpen}
              >
                <span className="min-w-0 flex-1">{link.label}</span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </PanelGroup>
  )
}

/** Info-page footer: Edit only (primary). */
export function SidePanelInfoFooter({
  onEdit,
  extra,
}: {
  onEdit: () => void
  extra?: ReactNode
}) {
  return (
    <footer className="flex flex-wrap items-center justify-end gap-2 p-4">
      {extra}
      <button
        type="button"
        className="inline-flex min-h-10 items-center rounded-md bg-primary px-3 text-sm text-primary-foreground"
        onClick={onEdit}
      >
        Edit
      </button>
    </footer>
  )
}
