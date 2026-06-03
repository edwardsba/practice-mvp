import { AppShell } from "@/components/app-shell"
import { getActiveClients } from "@/app/clients/actions"
import { AddClientDialog } from "@/app/clients/add-client-dialog"
import { ClientsTable } from "@/app/clients/clients-table"

export default async function ClientsPage() {
  const clients = await getActiveClients()

  return (
    <AppShell title="Clients">
      <div className="mb-6 flex items-center justify-between gap-4">
        <p className="text-muted-foreground">
          {clients.length} active client{clients.length === 1 ? "" : "s"}
        </p>
        <AddClientDialog />
      </div>
      <ClientsTable clients={clients} />
    </AppShell>
  )
}
