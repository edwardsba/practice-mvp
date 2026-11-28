"use client"

import { startTransition, useEffect, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"

import {
  getDefaultParent,
  getOwnLabel,
  type PageNavData,
  type PageRegistryKey,
  type NavTarget,
} from "@/lib/navigation/page-registry"
import {
  browserMemoryStore,
  buildMountInput,
  mountPage,
  normalizePageHref,
  resolveBackTarget,
} from "@/lib/navigation/parent-memory"

/** Resolves back/cancel target (default parent, then remembered). NV-4. */
export function useBackTarget(
  page: PageRegistryKey,
  data: PageNavData = {},
  identifyingSearchKeys?: string[]
): NavTarget | null {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const defaultParent = getDefaultParent(page, data)
  const [target, setTarget] = useState<NavTarget | null>(defaultParent)
  const dataKey = JSON.stringify(data)
  const defaultKey = defaultParent
    ? `${defaultParent.href}|${defaultParent.label}`
    : ""

  useEffect(() => {
    if (!defaultParent) {
      startTransition(() => setTarget(null))
      return
    }
    const store = browserMemoryStore()
    if (!store) {
      startTransition(() => setTarget(defaultParent))
      return
    }

    let href = normalizePageHref(pathname)
    if (identifyingSearchKeys?.length) {
      const params = new URLSearchParams()
      for (const key of identifyingSearchKeys) {
        const value = searchParams.get(key)
        if (value) params.set(key, value)
      }
      const qs = params.toString()
      if (qs) href = normalizePageHref(`${pathname}?${qs}`)
    }

    const input = buildMountInput(page, href, data)
    input.ownLabel = getOwnLabel(page, data)
    mountPage(store, input)
    const resolved =
      resolveBackTarget(store, href, defaultParent) ?? defaultParent
    startTransition(() => setTarget(resolved))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable via dataKey
  }, [page, dataKey, defaultKey, pathname, searchParams, identifyingSearchKeys])

  return target
}
