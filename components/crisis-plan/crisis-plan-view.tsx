import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  BECOMING_UNWELL_OPTIONS,
  CRISIS_RESPONSE_OPTIONS,
  DOING_WELL_OPTIONS,
  EMERGENCY_NUMBERS_OPTIONS,
  GET_BETTER_OPTIONS,
  STAY_WELL_OPTIONS,
  UNWELL_OPTIONS,
  optionLabel,
} from "@/lib/crisis-plans/fields"
import type {
  CrisisPlanRow,
  EmergencyContactRow,
  MultiSelectSectionJson,
} from "@/lib/crisis-plans/types"

function formatDisplayDate(value: string | null) {
  if (!value) return "—"
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function ViewList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">None selected</p>
  }
  return (
    <ul className="list-inside list-disc space-y-1 text-sm">
      {items.map((item, index) => (
        <li key={`${index}-${item}`}>{item}</li>
      ))}
    </ul>
  )
}

function sectionLabels(
  options: { key: string; label: string }[],
  section: MultiSelectSectionJson
) {
  return [
    ...section.selected.map((key) => optionLabel(options, key)),
    ...section.other,
  ]
}

export function CrisisPlanView({
  plan,
  contacts,
  clientName,
}: {
  plan: CrisisPlanRow
  contacts: EmergencyContactRow[]
  clientName: string
}) {
  const emptyMulti = { selected: [], other: [] }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Crisis plan details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Client</dt>
              <dd className="font-medium">{clientName}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Date of plan</dt>
              <dd className="font-medium">{formatDisplayDate(plan.dateOfPlan)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Emergency contacts</CardTitle>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No emergency contacts.</p>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact) => (
                    <TableRow key={contact.contactId}>
                      <TableCell>{contact.role ?? "—"}</TableCell>
                      <TableCell>{contact.name}</TableCell>
                      <TableCell>{contact.phone ?? "—"}</TableCell>
                      <TableCell>{contact.email ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Emergency numbers</CardTitle>
        </CardHeader>
        <CardContent>
          <ViewList
            items={sectionLabels(
              EMERGENCY_NUMBERS_OPTIONS,
              plan.emergencyNumbersJson ?? emptyMulti
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Doing well / Staying well</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold">
              Signs that I am doing well
            </h3>
            <ViewList
              items={sectionLabels(
                DOING_WELL_OPTIONS,
                plan.doingWellJson ?? emptyMulti
              )}
            />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">
              Things I need to do to stay well
            </h3>
            <ViewList
              items={sectionLabels(
                STAY_WELL_OPTIONS,
                plan.stayWellJson ?? emptyMulti
              )}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Becoming unwell / Getting better</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold">
              Signs that I am becoming unwell
            </h3>
            <ViewList
              items={sectionLabels(
                BECOMING_UNWELL_OPTIONS,
                plan.becomingUnwellJson ?? emptyMulti
              )}
            />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">
              Things I need to do to get better
            </h3>
            <ViewList
              items={sectionLabels(
                GET_BETTER_OPTIONS,
                plan.getBetterJson ?? emptyMulti
              )}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Unwell / Crisis response</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold">
              Signs that I am unwell or in crisis
            </h3>
            <ViewList
              items={sectionLabels(
                UNWELL_OPTIONS,
                plan.unwellJson ?? emptyMulti
              )}
            />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">
              Things to do when I am unwell — Crisis response
            </h3>
            <ViewList
              items={sectionLabels(
                CRISIS_RESPONSE_OPTIONS,
                plan.crisisResponseJson ?? emptyMulti
              )}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
