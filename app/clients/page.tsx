import { AppShell } from "@/components/app-shell"
import { getActiveClients } from "@/app/clients/actions"
import { AddClientDialog } from "@/app/clients/add-client-dialog"
import { ClientsTable } from "@/app/clients/clients-table"
import { ListPageHeader } from "@/components/ui/list-page-header"

export default async function ClientsPage() {
  const clients = await getActiveClients()

  return (
    <AppShell>
      <ListPageHeader heading="Clients" action={<AddClientDialog />} />
      <ClientsTable clients={clients} />
    </AppShell>
  )
}
