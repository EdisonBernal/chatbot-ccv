'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { AppointmentRequest, AppointmentStatus } from '@/lib/types'
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_COLORS,
} from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Clock, Search, CheckCircle, XCircle, Eye, ArrowRight } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'

const COLUMNS: { status: AppointmentStatus; label: string; icon: React.ElementType; color: string }[] = [
  { status: 'pendiente', label: 'Pendientes', icon: Clock, color: 'text-amber-600' },
  { status: 'en_revision', label: 'En revisión', icon: Search, color: 'text-blue-600' },
  { status: 'confirmada', label: 'Confirmadas', icon: CheckCircle, color: 'text-emerald-600' },
  { status: 'cancelada', label: 'Canceladas', icon: XCircle, color: 'text-red-600' },
]

const STATUS_NEXT: Partial<Record<AppointmentStatus, AppointmentStatus>> = {
  pendiente: 'en_revision',
  en_revision: 'confirmada',
}

interface KanbanClientProps {
  initialAppointments: AppointmentRequest[]
}

export function KanbanClient({ initialAppointments }: KanbanClientProps) {
  const [appointments, setAppointments] = useState<AppointmentRequest[]>(initialAppointments)
  const [pending, startTransition] = useTransition()
  const [movingId, setMovingId] = useState<string | null>(null)

  const byStatus = (status: AppointmentStatus) =>
    appointments.filter((a) => a.status === status)

  const handleAdvance = (appt: AppointmentRequest, nextStatus: AppointmentStatus) => {
    setMovingId(appt.id)
    startTransition(async () => {
      const res = await fetch(`/api/appointments/${appt.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
          old_status: appt.status,
          notes: 'Movido desde el Kanban',
          created_by: 'system',
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setAppointments((prev) =>
          prev.map((a) => (a.id === appt.id ? { ...a, status: nextStatus } : a))
        )
        toast.success(`Movido a "${APPOINTMENT_STATUS_LABELS[nextStatus]}".`)
      } else {
        toast.error('Error al mover la tarjeta.')
      }
      setMovingId(null)
    })
  }

  return (
    <div className="flex flex-col gap-6 p-6 h-full">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Kanban de solicitudes</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Vista por estado de {appointments.length} solicitudes
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 flex-1 overflow-hidden">
        {COLUMNS.map(({ status, label, icon: Icon, color }) => {
          const cards = byStatus(status)
          return (
            <div key={status} className="flex flex-col gap-3 min-h-0">
              {/* Column header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <span className="text-sm font-semibold text-foreground">{label}</span>
                </div>
                <Badge variant="secondary" className="text-xs font-medium">
                  {cards.length}
                </Badge>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2 overflow-y-auto flex-1 pb-2">
                {cards.length === 0 && (
                  <div className="rounded-lg border-2 border-dashed border-border p-4 text-center">
                    <p className="text-xs text-muted-foreground">Sin solicitudes</p>
                  </div>
                )}
                {cards.map((appt) => {
                  const nextStatus = STATUS_NEXT[status]
                  const isMoving = movingId === appt.id
                  return (
                    <Card
                      key={appt.id}
                      className="shadow-none hover:shadow-sm transition-shadow"
                    >
                      <CardContent className="p-3 flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-medium text-foreground leading-tight line-clamp-2">
                            {appt.patient?.full_name ?? '—'}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            asChild
                          >
                            <Link href={`/dashboard/appointments/${appt.id}`}>
                              <Eye className="w-3 h-3" />
                            </Link>
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {appt.specialty?.name ?? '—'}
                        </p>
                        {appt.requested_date && (
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(appt.requested_date), 'd MMM yyyy', { locale: es })}
                          </p>
                        )}
                        {nextStatus && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1 mt-1"
                            onClick={() => handleAdvance(appt, nextStatus)}
                            disabled={isMoving || pending}
                          >
                            {APPOINTMENT_STATUS_LABELS[nextStatus]}
                            <ArrowRight className="w-3 h-3" />
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
