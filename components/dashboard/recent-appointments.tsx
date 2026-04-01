import Link from 'next/link'
import type { AppointmentRequest } from '@/lib/types'
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_COLORS } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CalendarClock, ArrowRight } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface RecentAppointmentsProps {
  appointments: AppointmentRequest[]
}

export function RecentAppointments({ appointments }: RecentAppointmentsProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-muted-foreground" />
          Solicitudes recientes
        </CardTitle>
        <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
          <Link href="/dashboard/appointments">
            Ver todas <ArrowRight className="w-3 h-3 ml-1" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {appointments.length === 0 ? (
          <p className="text-sm text-muted-foreground px-6 py-4">No hay solicitudes recientes.</p>
        ) : (
          <div className="divide-y divide-border">
            {appointments.map((appt) => (
              <Link
                key={appt.id}
                href={`/dashboard/appointments/${appt.id}`}
                className="flex items-center gap-3 px-6 py-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-medium text-foreground truncate">
                    {appt.patient?.full_name ?? '—'}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {appt.specialty?.name ?? '—'} ·{' '}
                    {format(new Date(appt.created_at), 'd MMM yyyy', { locale: es })}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={`text-xs shrink-0 ${APPOINTMENT_STATUS_COLORS[appt.status]}`}
                >
                  {APPOINTMENT_STATUS_LABELS[appt.status]}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
