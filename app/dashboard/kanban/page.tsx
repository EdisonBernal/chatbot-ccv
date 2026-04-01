import { getAppointments } from '@/lib/services/appointments'
import { KanbanClient } from '@/components/kanban/kanban-client'

export default async function KanbanPage() {
  const appointments = await getAppointments()
  return <KanbanClient initialAppointments={appointments} />
}
