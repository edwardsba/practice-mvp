import Link from "next/link"

import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { ListPageHeader } from "@/components/ui/list-page-header"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getAssessmentDefinitions } from "@/lib/actions/assessment-definitions"
import { requirePractitionerContext } from "@/lib/auth"

function formatYesNo(value: boolean) {
  return value ? "Yes" : "No"
}

function formatStatus(isActive: boolean) {
  return isActive ? "Active" : "Inactive"
}

export default async function AssessmentDefinitionsPage() {
  await requirePractitionerContext()
  const definitions = await getAssessmentDefinitions()

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton fallbackHref="/practice" label="← Back to practice" />
        <ListPageHeader heading="Assessment Definitions" />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Questions</TableHead>
              <TableHead>Client completable</TableHead>
              <TableHead>Practitioner completable</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {definitions.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-20 text-center text-muted-foreground"
                >
                  No assessment definitions found.
                </TableCell>
              </TableRow>
            ) : (
              definitions.map((definition) => (
                <TableRow key={definition.assessmentDefinitionId}>
                  <TableCell>
                    <Link
                      href={`/settings/assessments/${encodeURIComponent(definition.assessmentCode)}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {definition.assessmentName}
                    </Link>
                  </TableCell>
                  <TableCell>{definition.assessmentCode}</TableCell>
                  <TableCell>{definition.assessmentType}</TableCell>
                  <TableCell>{definition.elementCount}</TableCell>
                  <TableCell>
                    {formatYesNo(definition.clientCompletable)}
                  </TableCell>
                  <TableCell>
                    {formatYesNo(definition.practitionerCompletable)}
                  </TableCell>
                  <TableCell>{formatStatus(definition.isActive)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  )
}
