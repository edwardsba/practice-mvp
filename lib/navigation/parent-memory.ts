/**
 * Per-tab parent memory (NV-3) via sessionStorage.
 * Pure helpers are exported for selftests; browser wrappers catch storage failures.
 */

import { backLabel } from "@/lib/navigation/labels"
import {
  familiesMatch,
  matchRegistryKey,
  type PageFamily,
  type PageNavData,
  type PageRegistryKey,
  type NavTarget,
  getPageEntry,
} from "@/lib/navigation/page-registry"
import {
  isAllowedParentType,
  NEVER_PARENT_TYPES,
  type PageType,
} from "@/lib/navigation/page-types"

export const CURRENT_PAGE_KEY = "nv:current-page"
export const PARENT_MEMORY_PREFIX = "nv:parent:"

export type RememberedPage = {
  href: string
  type: PageType
  family: PageFamily
  /** Own label text after "← Back to " (NV-5). */
  ownLabel: string
  registryKey: PageRegistryKey
  /** The parent's href this page currently remembers (if any). */
  rememberedParentHref?: string | null
}

export type ParentMemoryStore = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function parentMemoryKey(href: string): string {
  return `${PARENT_MEMORY_PREFIX}${href}`
}

export function normalizePageHref(href: string): string {
  if (!href) return "/"
  try {
    if (href.startsWith("http://") || href.startsWith("https://")) {
      const url = new URL(href)
      return `${url.pathname}${url.search}`
    }
  } catch {
    // fall through
  }
  return href.startsWith("/") ? href : `/${href}`
}

function readJson<T>(store: ParentMemoryStore, key: string): T | null {
  try {
    const raw = store.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeJson(store: ParentMemoryStore, key: string, value: unknown): void {
  try {
    store.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full / unavailable — ignore (NV-3: fall back to default).
  }
}

export function readCurrentPage(store: ParentMemoryStore): RememberedPage | null {
  return readJson<RememberedPage>(store, CURRENT_PAGE_KEY)
}

export function writeCurrentPage(
  store: ParentMemoryStore,
  page: RememberedPage
): void {
  writeJson(store, CURRENT_PAGE_KEY, page)
}

export function readRememberedParent(
  store: ParentMemoryStore,
  href: string
): NavTarget | null {
  return readJson<NavTarget>(store, parentMemoryKey(normalizePageHref(href)))
}

export function writeRememberedParent(
  store: ParentMemoryStore,
  href: string,
  parent: NavTarget | null
): void {
  const key = parentMemoryKey(normalizePageHref(href))
  if (!parent) {
    try {
      store.removeItem(key)
    } catch {
      // ignore
    }
    return
  }
  writeJson(store, key, parent)
}

/**
 * Clear memory for a missing page and any parents pointing at it (NV-3.5).
 */
export function clearMemoryForMissingHref(
  store: ParentMemoryStore,
  missingHref: string
): void {
  const normalized = normalizePageHref(missingHref)
  try {
    store.removeItem(parentMemoryKey(normalized))
  } catch {
    // ignore
  }
  // Scan known keys is not possible with sessionStorage API alone in pure store;
  // callers that know keys can clear. When used with real sessionStorage we walk.
  if (typeof (store as Storage).length === "number") {
    const storage = store as Storage
    const toRemove: string[] = []
    try {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i)
        if (!key?.startsWith(PARENT_MEMORY_PREFIX)) continue
        const value = readJson<NavTarget>(store, key)
        if (value && normalizePageHref(value.href) === normalized) {
          toRemove.push(key)
        }
      }
      for (const key of toRemove) storage.removeItem(key)
    } catch {
      // ignore
    }
  }
}

export type MountPageInput = {
  href: string
  registryKey: PageRegistryKey
  type: PageType
  family: PageFamily
  ownLabel: string
  formMode?: "new" | "edit"
  menuEntity?: boolean
}

/**
 * NV-3 steps 1–4: decide the remembered parent after mounting page B,
 * given the previous current page (opener A).
 */
export function resolveRememberedParentOnMount(
  store: ParentMemoryStore,
  page: MountPageInput
): NavTarget | null {
  const href = normalizePageHref(page.href)
  const existing = readRememberedParent(store, href)
  const opener = readCurrentPage(store)

  // Returning is not opening (NV-3.4): opener's remembered parent is this page.
  if (
    opener &&
    opener.rememberedParentHref &&
    normalizePageHref(opener.rememberedParentHref) === href
  ) {
    return existing
  }

  if (!opener || normalizePageHref(opener.href) === href) {
    return existing
  }

  const destEntry = getPageEntry(page.registryKey)
  const allowed = isAllowedParentType(page.type, opener.type, {
    formMode: page.formMode ?? destEntry.formMode,
    menuEntity: page.menuEntity ?? destEntry.menuEntity,
  })

  // Entity→entity skips the family rule (NV-2 / NV.1): a professional and a
  // client are different families, but linked entity details may still parent.
  const entityToEntity =
    page.type === "entity" && opener.type === "entity"

  const sameFamily =
    entityToEntity ||
    familiesMatch(page.family, opener.family) ||
    opener.type === "home" ||
    opener.type === "main-list"

  if (allowed && sameFamily && !NEVER_PARENT_TYPES.has(opener.type)) {
    // Newest allowed opener wins (NV-3.3).
    return {
      href: normalizePageHref(opener.href),
      label: backLabel(opener.ownLabel),
    }
  }

  // Form or disallowed opener ignored (NV-3.2).
  if (existing) return existing

  if (NEVER_PARENT_TYPES.has(opener.type)) {
    const formParent = readRememberedParent(store, opener.href)
    if (formParent) {
      const parentType = typeForHref(store, formParent.href)
      if (
        parentType &&
        isAllowedParentType(page.type, parentType, {
          formMode: page.formMode ?? destEntry.formMode,
          menuEntity: page.menuEntity ?? destEntry.menuEntity,
        })
      ) {
        return formParent
      }
    }
  }

  return null
}

function readVisitedPage(
  store: ParentMemoryStore,
  href: string
): RememberedPage | null {
  return readJson<RememberedPage>(
    store,
    `nv:page:${normalizePageHref(href)}`
  )
}

function typeForHref(store: ParentMemoryStore, href: string): PageType | null {
  const visited = readVisitedPage(store, href)
  if (visited?.type) return visited.type
  const key = matchRegistryKey(normalizePageHref(href).split("?")[0] ?? href)
  return key ? getPageEntry(key).type : null
}

/**
 * Mount a page: update remembered parent, record current page, cache page snapshot.
 */
export function mountPage(
  store: ParentMemoryStore,
  page: MountPageInput
): NavTarget | null {
  const href = normalizePageHref(page.href)
  const parent = resolveRememberedParentOnMount(store, page)
  writeRememberedParent(store, href, parent)

  const snapshot: RememberedPage = {
    href,
    type: page.type,
    family: page.family,
    ownLabel: page.ownLabel,
    registryKey: page.registryKey,
    rememberedParentHref: parent?.href ?? null,
  }
  writeJson(store, `nv:page:${href}`, snapshot)
  writeCurrentPage(store, snapshot)
  return parent
}

/** Resolve Back target: remembered parent, else default (NV-3.5). */
export function resolveBackTarget(
  store: ParentMemoryStore,
  href: string,
  defaultParent: NavTarget | null
): NavTarget | null {
  const remembered = readRememberedParent(store, href)
  if (remembered) return remembered
  return defaultParent
}

export function createMemoryStore(): ParentMemoryStore {
  const map = new Map<string, string>()
  return {
    getItem(key) {
      return map.has(key) ? map.get(key)! : null
    },
    setItem(key, value) {
      map.set(key, value)
    },
    removeItem(key) {
      map.delete(key)
    },
  }
}

export function browserMemoryStore(): ParentMemoryStore | null {
  try {
    if (typeof sessionStorage === "undefined") return null
    // Probe
    const probe = "__nv_probe__"
    sessionStorage.setItem(probe, "1")
    sessionStorage.removeItem(probe)
    return sessionStorage
  } catch {
    return null
  }
}

export function buildMountInput(
  registryKey: PageRegistryKey,
  href: string,
  data: PageNavData
): MountPageInput {
  const entry = getPageEntry(registryKey)
  return {
    href,
    registryKey,
    type: entry.type,
    family: entry.family(data),
    ownLabel: entry.ownLabel(data),
    formMode: entry.formMode,
    menuEntity: entry.menuEntity,
  }
}
