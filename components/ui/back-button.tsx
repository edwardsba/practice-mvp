"use client"

import Link from "next/link"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import {
  Suspense,
  startTransition,
  useEffect,
  useState,
  type MouseEvent,
} from "react"

import { DiscardChangesDialog } from "@/components/client-background/discard-changes-dialog"
import { Button } from "@/components/ui/button"
import {
  getDefaultParent,
  getOwnLabel,
  getPageEntry,
  type PageNavData,
  type PageRegistryKey,
  type NavTarget,
} from "@/lib/navigation/page-registry"
import { hasBackArrow } from "@/lib/navigation/page-types"
import {
  browserMemoryStore,
  buildMountInput,
  mountPage,
  normalizePageHref,
  resolveBackTarget,
} from "@/lib/navigation/parent-memory"

export type BackButtonProps = {
  page: PageRegistryKey
  data?: PageNavData
  /** When set, Back asks "Discard changes?" first if true (NV-4, PN-4). */
  isDirty?: boolean
  /** Identifying query keys to keep on the page href (e.g. clientId). */
  identifyingSearchKeys?: string[]
}

function pageHrefFromLocation(
  pathname: string,
  searchParams: URLSearchParams | null,
  identifyingSearchKeys: string[] | undefined
): string {
  if (!identifyingSearchKeys?.length || !searchParams) {
    return normalizePageHref(pathname)
  }
  const params = new URLSearchParams()
  for (const key of identifyingSearchKeys) {
    const value = searchParams.get(key)
    if (value) params.set(key, value)
  }
  const qs = params.toString()
  return normalizePageHref(qs ? `${pathname}?${qs}` : pathname)
}

export function BackButton({
  page,
  data = {},
  isDirty = false,
  identifyingSearchKeys,
}: BackButtonProps) {
  const entry = getPageEntry(page)
  if (!hasBackArrow(entry.type, { menuEntity: entry.menuEntity })) {
    return null
  }

  const defaultParent = getDefaultParent(page, data)
  if (!defaultParent) return null

  return (
    <Suspense
      fallback={
        <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
          <Link href={defaultParent.href}>{defaultParent.label}</Link>
        </Button>
      }
    >
      <BackButtonInner
        page={page}
        data={data}
        defaultParent={defaultParent}
        isDirty={isDirty}
        identifyingSearchKeys={identifyingSearchKeys}
      />
    </Suspense>
  )
}

function BackButtonInner({
  page,
  data,
  defaultParent,
  isDirty,
  identifyingSearchKeys,
}: {
  page: PageRegistryKey
  data: PageNavData
  defaultParent: NavTarget
  isDirty: boolean
  identifyingSearchKeys?: string[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [target, setTarget] = useState<NavTarget>(defaultParent)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [pendingHref, setPendingHref] = useState<string | null>(null)

  const dataKey = JSON.stringify(data)
  const defaultKey = `${defaultParent.href}|${defaultParent.label}`

  useEffect(() => {
    const store = browserMemoryStore()
    if (!store) return
    const href = pageHrefFromLocation(
      pathname,
      searchParams,
      identifyingSearchKeys
    )
    const input = buildMountInput(page, href, data)
    input.ownLabel = getOwnLabel(page, data)
    mountPage(store, input)
    const resolved = resolveBackTarget(store, href, defaultParent) ?? defaultParent
    startTransition(() => {
      setTarget(resolved)
    })
    // dataKey / defaultKey stand in for data and defaultParent identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional stable deps
  }, [page, dataKey, defaultKey, pathname, searchParams, identifyingSearchKeys])

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!isDirty) return
    event.preventDefault()
    setPendingHref(target.href)
    setDiscardOpen(true)
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
        <Link href={target.href} onClick={onClick}>
          {target.label}
        </Link>
      </Button>
      <DiscardChangesDialog
        open={discardOpen}
        onKeepEditing={() => {
          setDiscardOpen(false)
          setPendingHref(null)
        }}
        onDiscard={() => {
          const href = pendingHref ?? target.href
          setDiscardOpen(false)
          setPendingHref(null)
          router.push(href)
        }}
      />
    </>
  )
}

/** Record this page in tab memory without rendering a back button (Home / Main lists). */
export function RecordPageVisit({
  page,
  data = {},
  identifyingSearchKeys,
}: {
  page: PageRegistryKey
  data?: PageNavData
  identifyingSearchKeys?: string[]
}) {
  return (
    <Suspense fallback={null}>
      <RecordPageVisitInner
        page={page}
        data={data}
        identifyingSearchKeys={identifyingSearchKeys}
      />
    </Suspense>
  )
}

function RecordPageVisitInner({
  page,
  data,
  identifyingSearchKeys,
}: {
  page: PageRegistryKey
  data: PageNavData
  identifyingSearchKeys?: string[]
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const dataKey = JSON.stringify(data)

  useEffect(() => {
    const store = browserMemoryStore()
    if (!store) return
    const href = pageHrefFromLocation(
      pathname,
      searchParams,
      identifyingSearchKeys
    )
    mountPage(store, buildMountInput(page, href, data))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional stable deps
  }, [page, dataKey, pathname, searchParams, identifyingSearchKeys])

  return null
}
