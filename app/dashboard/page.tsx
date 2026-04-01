import { getDashboardMetrics, getCurrentUser } from '@/lib/services/users'
import { getAppointments } from '@/lib/services/appointments'
import { getConversations } from '@/lib/services/conversations'
import { MetricCard } from '@/components/dashboard/metric-card'
import { RecentAppointments } from '@/components/dashboard/recent-appointments'
import { RecentConversations } from '@/components/dashboard/recent-conversations'
import {
  Clock,
  CheckCircle,
  XCircle,
  Search,
  CalendarDays,
  MessageSquare,
  Headphones,
} from 'lucide-react'

export default async function DashboardPage() {
  const [metrics, recentAppointments, recentConversations, user] = await Promise.all([
    getDashboardMetrics(),
    getAppointments(),
    getConversations(),
    getCurrentUser(),
  ])

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Bienvenido{user ? `, ${user.full_name}` : ''}. Resumen del estado actual.
        </p>
      </div>

      {/* Primary metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Pendientes"
          value={metrics.pending_requests}
          icon={Clock}
          colorClass="text-amber-600"
          bgClass="bg-amber-50"
          description="solicitudes por atender"
        />
        <MetricCard
          title="En revisión"
          value={metrics.reviewing_requests}
          icon={Search}
          colorClass="text-blue-600"
          bgClass="bg-blue-50"
          description="solicitudes en proceso"
        />
        <MetricCard
          title="Confirmadas"
          value={metrics.confirmed_requests}
          icon={CheckCircle}
          colorClass="text-emerald-600"
          bgClass="bg-emerald-50"
          description="citas confirmadas"
        />
        <MetricCard
          title="Canceladas"
          value={metrics.cancelled_requests}
          icon={XCircle}
          colorClass="text-red-600"
          bgClass="bg-red-50"
          description="solicitudes canceladas"
        />
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Solicitudes hoy"
          value={metrics.total_today}
          icon={CalendarDays}
          colorClass="text-primary"
          bgClass="bg-primary/10"
          description="creadas hoy"
          size="sm"
        />
        <MetricCard
          title="Conversaciones nuevas"
          value={metrics.new_conversations}
          icon={MessageSquare}
          colorClass="text-blue-600"
          bgClass="bg-blue-50"
          description="sin atender"
          size="sm"
        />
        <MetricCard
          title="En atención"
          value={metrics.in_attention_conversations}
          icon={Headphones}
          colorClass="text-amber-600"
          bgClass="bg-amber-50"
          description="conversaciones activas"
          size="sm"
        />
      </div>

      {/* Recent data */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentAppointments appointments={recentAppointments.slice(0, 6)} />
        <RecentConversations conversations={recentConversations.slice(0, 6)} />
      </div>
    </div>
  )
}
