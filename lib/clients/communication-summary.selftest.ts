import assert from "node:assert/strict"

import { formatCommunicationSummary } from "@/lib/clients/communication-summary"

const allOn = formatCommunicationSummary({
  commsOptOut: false,
  reminderOptOut: false,
  preSessionOptOut: false,
  postSessionOptOut: false,
  adminCommsOptOut: false,
  onlineBookingPermitted: true,
})
assert.equal(allOn, "All emails on · Online booking permitted")

const someOptOuts = formatCommunicationSummary({
  commsOptOut: false,
  reminderOptOut: true,
  preSessionOptOut: false,
  postSessionOptOut: false,
  adminCommsOptOut: true,
  onlineBookingPermitted: false,
})
assert.equal(
  someOptOuts,
  "Opted out: reminder emails, admin emails · Online booking not permitted"
)

const globalOptOut = formatCommunicationSummary({
  commsOptOut: true,
  reminderOptOut: true,
  preSessionOptOut: true,
  postSessionOptOut: true,
  adminCommsOptOut: true,
  onlineBookingPermitted: true,
})
assert.equal(globalOptOut, "Opted out of all contact")

const bookingOff = formatCommunicationSummary({
  commsOptOut: false,
  reminderOptOut: false,
  preSessionOptOut: false,
  postSessionOptOut: false,
  adminCommsOptOut: false,
  onlineBookingPermitted: false,
})
assert.equal(bookingOff, "All emails on · Online booking not permitted")

const preAndPost = formatCommunicationSummary({
  commsOptOut: false,
  reminderOptOut: false,
  preSessionOptOut: true,
  postSessionOptOut: true,
  adminCommsOptOut: false,
  onlineBookingPermitted: true,
})
assert.equal(
  preAndPost,
  "Opted out: pre-session emails, post-session emails · Online booking permitted"
)

console.log("communication-summary.selftest.ts: ok")
