/**
 * Parent-memory cases from the design discussion (NV-3).
 */
import assert from "node:assert/strict"

import {
  createMemoryStore,
  mountPage,
  resolveBackTarget,
  type MountPageInput,
} from "@/lib/navigation/parent-memory"
import { getPageEntry } from "@/lib/navigation/page-registry"

const CLIENT_A = "client-a"
const CLIENT_B = "client-b"

function mount(
  store: ReturnType<typeof createMemoryStore>,
  input: MountPageInput
) {
  return mountPage(store, input)
}

function entryMount(
  store: ReturnType<typeof createMemoryStore>,
  key: Parameters<typeof getPageEntry>[0],
  href: string,
  data: Parameters<ReturnType<typeof getPageEntry>["family"]>[0]
): MountPageInput {
  const entry = getPageEntry(key)
  return {
    href,
    registryKey: key,
    type: entry.type,
    family: entry.family(data),
    ownLabel: entry.ownLabel(data),
    formMode: entry.formMode,
    menuEntity: entry.menuEntity,
  }
}

// 1. Calendar → appointment → Back goes to the calendar.
{
  const store = createMemoryStore()
  mount(store, entryMount(store, "/calendar", "/calendar", {}))
  mount(
    store,
    entryMount(store, "/appointments/[appointment_id]", "/appointments/appt-1", {
      clientId: CLIENT_A,
      clientName: "Ada Client",
      appointmentId: "appt-1",
      appointmentDate: "2026-11-12",
    })
  )
  const back = resolveBackTarget(store, "/appointments/appt-1", {
    href: `/clients/${CLIENT_A}/appointments`,
    label: "← Back to appointments",
  })
  assert.equal(back?.href, "/calendar")
  assert.match(back?.label ?? "", /calendar/i)
}

// 2. Session note → result → edit result → Save → result → Back goes to the session note.
{
  const store = createMemoryStore()
  mount(
    store,
    entryMount(
      store,
      "/session-notes/[session_note_id]",
      "/session-notes/note-1",
      {
        clientId: CLIENT_A,
        sessionNoteId: "note-1",
        sessionNoteDate: "2026-11-12",
      }
    )
  )
  mount(
    store,
    entryMount(
      store,
      "/clients/[client_id]/results/[result_id]",
      `/clients/${CLIENT_A}/results/res-1`,
      {
        clientId: CLIENT_A,
        resultId: "res-1",
        resultDate: "2026-11-12",
      }
    )
  )
  mount(
    store,
    entryMount(
      store,
      "/clients/[client_id]/assessments/edit/[instance_id]",
      `/clients/${CLIENT_A}/assessments/edit/inst-1`,
      { clientId: CLIENT_A }
    )
  )
  // Save → result again (opener is the guided form; keep session note).
  mount(
    store,
    entryMount(
      store,
      "/clients/[client_id]/results/[result_id]",
      `/clients/${CLIENT_A}/results/res-1`,
      {
        clientId: CLIENT_A,
        resultId: "res-1",
        resultDate: "2026-11-12",
      }
    )
  )
  const back = resolveBackTarget(
    store,
    `/clients/${CLIENT_A}/results/res-1`,
    {
      href: `/clients/${CLIENT_A}/assessments`,
      label: "← Back to assessments",
    }
  )
  assert.equal(back?.href, "/session-notes/note-1")
  assert.match(back?.label ?? "", /session note/i)
}

// 3. Session note → result → Back to session note, then Back again (no loop).
{
  const store = createMemoryStore()
  mount(
    store,
    entryMount(store, "/clients/[client_id]", `/clients/${CLIENT_A}`, {
      clientId: CLIENT_A,
      clientName: "Ada Client",
    })
  )
  mount(
    store,
    entryMount(
      store,
      "/session-notes/[session_note_id]",
      "/session-notes/note-2",
      {
        clientId: CLIENT_A,
        sessionNoteId: "note-2",
        sessionNoteDate: "2026-11-10",
      }
    )
  )
  mount(
    store,
    entryMount(
      store,
      "/clients/[client_id]/results/[result_id]",
      `/clients/${CLIENT_A}/results/res-2`,
      { clientId: CLIENT_A, resultId: "res-2", resultDate: "2026-11-10" }
    )
  )
  const backToNote = resolveBackTarget(
    store,
    `/clients/${CLIENT_A}/results/res-2`,
    {
      href: `/clients/${CLIENT_A}/assessments`,
      label: "← Back to assessments",
    }
  )
  assert.equal(backToNote?.href, "/session-notes/note-2")

  // "Returning is not opening": mount session note again from result.
  mount(
    store,
    entryMount(
      store,
      "/session-notes/[session_note_id]",
      "/session-notes/note-2",
      {
        clientId: CLIENT_A,
        sessionNoteId: "note-2",
        sessionNoteDate: "2026-11-10",
      }
    )
  )
  const backFromNote = resolveBackTarget(store, "/session-notes/note-2", {
    href: `/clients/${CLIENT_A}/session-notes`,
    label: "← Back to session notes",
  })
  assert.equal(backFromNote?.href, `/clients/${CLIENT_A}`)
}

// 4. A client → that client's appointment → Back goes to the client.
{
  const store = createMemoryStore()
  mount(
    store,
    entryMount(store, "/clients/[client_id]", `/clients/${CLIENT_A}`, {
      clientId: CLIENT_A,
      clientName: "Ada Client",
    })
  )
  mount(
    store,
    entryMount(store, "/appointments/[appointment_id]", "/appointments/appt-2", {
      clientId: CLIENT_A,
      appointmentId: "appt-2",
      appointmentDate: "2026-11-01",
    })
  )
  const back = resolveBackTarget(store, "/appointments/appt-2", {
    href: `/clients/${CLIENT_A}/appointments`,
    label: "← Back to appointments",
  })
  assert.equal(back?.href, `/clients/${CLIENT_A}`)
  assert.match(back?.label ?? "", /Ada Client/)
}

// 5. A result opened in a fresh tab → Back goes to Assessments (client).
{
  const store = createMemoryStore()
  mount(
    store,
    entryMount(
      store,
      "/clients/[client_id]/results/[result_id]",
      `/clients/${CLIENT_A}/results/res-fresh`,
      { clientId: CLIENT_A, resultId: "res-fresh", resultDate: "2026-11-05" }
    )
  )
  const back = resolveBackTarget(
    store,
    `/clients/${CLIENT_A}/results/res-fresh`,
    {
      href: `/clients/${CLIENT_A}/assessments`,
      label: "← Back to assessments",
    }
  )
  assert.equal(back?.href, `/clients/${CLIENT_A}/assessments`)
}

// 6. An opener from a different client is ignored.
{
  const store = createMemoryStore()
  mount(
    store,
    entryMount(store, "/clients/[client_id]", `/clients/${CLIENT_B}`, {
      clientId: CLIENT_B,
      clientName: "Other Client",
    })
  )
  mount(
    store,
    entryMount(store, "/appointments/[appointment_id]", "/appointments/appt-3", {
      clientId: CLIENT_A,
      appointmentId: "appt-3",
      appointmentDate: "2026-11-03",
    })
  )
  const back = resolveBackTarget(store, "/appointments/appt-3", {
    href: `/clients/${CLIENT_A}/appointments`,
    label: "← Back to appointments",
  })
  assert.equal(back?.href, `/clients/${CLIENT_A}/appointments`)
}

// 7. New appointment from calendar → Save → new appointment → Back to calendar.
{
  const store = createMemoryStore()
  mount(store, entryMount(store, "/calendar", "/calendar", {}))
  mount(
    store,
    entryMount(store, "/appointments/new", `/appointments/new?clientId=${CLIENT_A}`, {
      clientId: CLIENT_A,
      queryClientId: CLIENT_A,
    })
  )
  const formBack = resolveBackTarget(
    store,
    `/appointments/new?clientId=${CLIENT_A}`,
    {
      href: `/clients/${CLIENT_A}/appointments`,
      label: "← Back to appointments",
    }
  )
  assert.equal(formBack?.href, "/calendar")

  mount(
    store,
    entryMount(store, "/appointments/[appointment_id]", "/appointments/appt-new", {
      clientId: CLIENT_A,
      appointmentId: "appt-new",
      appointmentDate: "2026-11-20",
    })
  )
  const recordBack = resolveBackTarget(store, "/appointments/appt-new", {
    href: `/clients/${CLIENT_A}/appointments`,
    label: "← Back to appointments",
  })
  assert.equal(recordBack?.href, "/calendar")
}

// 8. Professional → its Organisation → Back returns to the professional (NV-2 entity→entity).
{
  const store = createMemoryStore()
  const proHref = "/contacts/professionals/pro-1"
  const orgHref = "/contacts/organisations/org-1"
  mount(
    store,
    entryMount(store, "/contacts/professionals", "/contacts/professionals", {})
  )
  mount(
    store,
    entryMount(
      store,
      "/contacts/professionals/[professional_id]",
      proHref,
      { professionalId: "pro-1", professionalName: "Dr Referrer" }
    )
  )
  mount(
    store,
    entryMount(
      store,
      "/contacts/organisations/[organisation_id]",
      orgHref,
      { organisationId: "org-1", organisationName: "Woollahra Medical" }
    )
  )
  const back = resolveBackTarget(store, orgHref, {
    href: "/contacts/organisations",
    label: "← Back to organisations",
  })
  assert.equal(back?.href, proHref)
  assert.match(back?.label ?? "", /Dr Referrer/)
}

// 9. Organisation → one of its Professionals → Back returns to the organisation.
{
  const store = createMemoryStore()
  const orgHref = "/contacts/organisations/org-2"
  const proHref = "/contacts/professionals/pro-2"
  mount(
    store,
    entryMount(store, "/contacts/organisations", "/contacts/organisations", {})
  )
  mount(
    store,
    entryMount(
      store,
      "/contacts/organisations/[organisation_id]",
      orgHref,
      { organisationId: "org-2", organisationName: "Sample Clinic" }
    )
  )
  mount(
    store,
    entryMount(
      store,
      "/contacts/professionals/[professional_id]",
      proHref,
      { professionalId: "pro-2", professionalName: "Dr Member" }
    )
  )
  const back = resolveBackTarget(store, proHref, {
    href: "/contacts/professionals",
    label: "← Back to professionals",
  })
  assert.equal(back?.href, orgHref)
  assert.match(back?.label ?? "", /Sample Clinic/)
}

// 10. Professional → a Client they referred → Back returns to the professional (cross-family).
{
  const store = createMemoryStore()
  const proHref = "/contacts/professionals/pro-3"
  const clientHref = `/clients/${CLIENT_A}`
  mount(
    store,
    entryMount(store, "/contacts/professionals", "/contacts/professionals", {})
  )
  mount(
    store,
    entryMount(
      store,
      "/contacts/professionals/[professional_id]",
      proHref,
      { professionalId: "pro-3", professionalName: "Dr GP" }
    )
  )
  mount(
    store,
    entryMount(store, "/clients/[client_id]", clientHref, {
      clientId: CLIENT_A,
      clientName: "Ada Client",
    })
  )
  const back = resolveBackTarget(store, clientHref, {
    href: "/clients",
    label: "← Back to clients",
  })
  assert.equal(back?.href, proHref)
  assert.match(back?.label ?? "", /Dr GP/)
}

// 11. NV-10 Create and return: Edit professional → New organisation → Save →
// Edit professional → Save → professional → Back still goes to Professionals.
{
  const store = createMemoryStore()
  const proHref = "/contacts/professionals/pro-handoff"
  const editHref = "/contacts/professionals/pro-handoff/edit"
  const newOrgHref = "/contacts/organisations/new?returnTo=" + encodeURIComponent(editHref)

  mount(
    store,
    entryMount(store, "/contacts/professionals", "/contacts/professionals", {})
  )
  mount(
    store,
    entryMount(
      store,
      "/contacts/professionals/[professional_id]",
      proHref,
      { professionalId: "pro-handoff", professionalName: "Dr Handoff" }
    )
  )
  mount(
    store,
    entryMount(
      store,
      "/contacts/professionals/[professional_id]/edit",
      editHref,
      { professionalId: "pro-handoff", professionalName: "Dr Handoff" }
    )
  )
  // Handoff form (NV-10): parent memory ignores the form opener.
  mount(
    store,
    entryMount(store, "/contacts/organisations/new", newOrgHref, {})
  )
  // Save → back to Edit professional via safeReturnTo (not via Back).
  mount(
    store,
    entryMount(
      store,
      "/contacts/professionals/[professional_id]/edit",
      editHref,
      { professionalId: "pro-handoff", professionalName: "Dr Handoff" }
    )
  )
  // Save → the professional.
  mount(
    store,
    entryMount(
      store,
      "/contacts/professionals/[professional_id]",
      proHref,
      { professionalId: "pro-handoff", professionalName: "Dr Handoff" }
    )
  )
  const back = resolveBackTarget(store, proHref, {
    href: "/contacts/professionals",
    label: "← Back to professionals",
  })
  assert.equal(back?.href, "/contacts/professionals")
}

console.log("parent-memory.selftest.ts: ok")
