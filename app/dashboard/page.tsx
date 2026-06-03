import Link from "next/link"

import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function DashboardPage() {
  return (
    <AppShell title="Welcome">
      <p className="mb-6 text-muted-foreground">
        Manage your practice, clients, and assessments from one place.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Clients</CardTitle>
            <CardDescription>
              View and manage client records for your practice.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/clients">Go to Clients</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Practice Settings</CardTitle>
            <CardDescription>
              Update practice details, contact information, and timezone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link href="/practice">Practice Settings</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
