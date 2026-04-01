import { getDashboardMetrics, getCurrentUser } from '@/lib/services/users'
import { getConversations } from '@/lib/services/conversations'
import { MetricCard } from '@/components/dashboard/metric-card'
import { RecentConversations } from '@/components/dashboard/recent-conversations'
import {
  Clock,
  CheckCircle2,
  Headphones,
  MessagesSquare,
  MessageSquare,
  MessageCircle,
  Bot,
  CalendarPlus,
} from 'lucide-react'

export default async function DashboardPage() {
  const [metrics, recentConversations, user] = await Promise.all([
    getDashboardMetrics(),
    getConversations(),
    getCurrentUser(),
  ])

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Bienvenido{user ? `, ${user.full_name}` : ''}. Resumen del chatbot y conversaciones.
        </p>
      </div>

      {/* Estado de conversaciones */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Estado de conversaciones</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Sin atender"
            value={metrics.new_conversations}
            icon={Clock}
            colorClass="text-amber-600"
            bgClass="bg-amber-50"
            description="esperan respuesta"
          />
          <MetricCard
            title="Escaladas a agente"
            value={metrics.in_attention_conversations}
            icon={Headphones}
            colorClass="text-blue-600"
            bgClass="bg-blue-50"
            description="atendidas por humano"
          />
          <MetricCard
            title="Resueltas"
            value={metrics.closed_conversations}
            icon={CheckCircle2}
            colorClass="text-emerald-600"
            bgClass="bg-emerald-50"
            description="conversaciones cerradas"
          />
          <MetricCard
            title="Total"
            value={metrics.total_conversations}
            icon={MessagesSquare}
            colorClass="text-primary"
            bgClass="bg-primary/10"
            description="conversaciones totales"
          />
        </div>
      </div>

      {/* Actividad de hoy */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Actividad de hoy</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Conversaciones"
            value={metrics.conversations_today}
            icon={MessageSquare}
            colorClass="text-violet-600"
            bgClass="bg-violet-50"
            description="iniciadas hoy"
            size="sm"
          />
          <MetricCard
            title="Mensajes"
            value={metrics.messages_today}
            icon={MessageCircle}
            colorClass="text-blue-600"
            bgClass="bg-blue-50"
            description="intercambiados hoy"
            size="sm"
          />
          <MetricCard
            title="Mensajes del bot"
            value={metrics.bot_messages_today}
            icon={Bot}
            colorClass="text-emerald-600"
            bgClass="bg-emerald-50"
            description="respuestas automáticas"
            size="sm"
          />
          <MetricCard
            title="Citas creadas"
            value={metrics.appointments_today}
            icon={CalendarPlus}
            colorClass="text-amber-600"
            bgClass="bg-amber-50"
            description="solicitudes hoy"
            size="sm"
          />
        </div>
      </div>

      {/* Conversaciones recientes */}
      <RecentConversations conversations={recentConversations.slice(0, 8)} />
    </div>
  )
}
