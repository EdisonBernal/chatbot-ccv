'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type {
  AppointmentRequest,
  AppointmentRequestHistory,
  AppointmentStatus,
  Patient,
  Specialty,
} from '@/lib/types'
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_COLORS,
} from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { AppointmentFormDialog } from './appointment-form-dialog'
import {
  ArrowLeft, Clock, User, Stethoscope, CalendarDays, StickyNote, History,
} from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'

const STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  pendiente: ['en_revision', 'cancelada'],
  en_revision: ['confirmada', 'cancelada', 'pendiente'],
  confirmada: ['cancelada'],
  cancelada: ['pendiente'],
}

interface AppointmentDetailClientProps {
  appointment: AppointmentRequest
  history: AppointmentRequestHistory[]
  currentUserId: string
  patients: Patient[]
  specialties: Specialty[]
}

export function AppointmentDetailClient({
  appointment: initialAppt,
  history: initialHistory,
  currentUserId,
  patients,
  specialties,
}: AppointmentDetailClientProps) {
  const router = useRouter()
  const [appointment, setAppointment] = useState(initialAppt)
  const [history, setHistory] = useState(initialHistory)
  const [newStatus, setNewStatus] = useState<AppointmentStatus | ''>('')
  const [statusNote, setStatusNote] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const availableTransitions = STATUS_TRANSITIONS[appointment.status]

  const handleStatusChange = () => {
    if (!newStatus) return
    startTransition(async () => {
      const res = await fetch(`/api/appointments/${appointment.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          notes: statusNote || undefined,
          old_status: appointment.status,
          created_by: currentUserId,
        }),
      })
      if (!res.ok) {
        toast.error('Error al cambiar el estado.')
        return
      }
      const updated = await res.json()
      setAppointment(updated.appointment)
      setHistory((prev) => [updated.history, ...prev])
      setNewStatus('')
      setStatusNote('')
      toast.success(`Estado cambiado a "${APPOINTMENT_STATUS_LABELS[newStatus]}".`)
    })
  }

  const handleEdited = (updated: AppointmentRequest) => {
    setAppointment(updated)
    setEditOpen(false)
    toast.success('Solicitud actualizada.')
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl">
      {/* Back + header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-2">
          <Link href="/dashboard/appointments">
            <ArrowLeft className="w-4 h-4" />
            Volver
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-foreground">
            {appointment.patient?.full_name ?? 'Solicitud'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Creada el {format(new Date(appointment.created_at), "d 'de' MMMM, yyyy", { locale: es })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`text-sm px-3 py-1 ${APPOINTMENT_STATUS_COLORS[appointment.status]}`}
          >
            {APPOINTMENT_STATUS_LABELS[appointment.status]}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            Editar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: info + status change */}
        <div className="md:col-span-2 flex flex-col gap-4">
          {/* Info card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Información de la solicitud
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <User className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Paciente</p>
                  <p className="text-sm font-medium">{appointment.patient?.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    CC {appointment.patient?.document_number} · {appointment.patient?.phone_number}
                  </p>
                </div>
              </div>
              <Separator />
              <div className="flex items-start gap-3">
                <Stethoscope className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Especialidad</p>
                  <p className="text-sm font-medium">{appointment.specialty?.name}</p>
                </div>
              </div>
              {appointment.requested_date && (
                <>
                  <Separator />
                  <div className="flex items-start gap-3">
                    <CalendarDays className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Fecha preferida</p>
                      <p className="text-sm font-medium">
                        {format(new Date(appointment.requested_date), "d 'de' MMMM, yyyy", { locale: es })}
                      </p>
                    </div>
                  </div>
                </>
              )}
              {appointment.internal_notes && (
                <>
                  <Separator />
                  <div className="flex items-start gap-3">
                    <StickyNote className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Notas internas</p>
                      <p className="text-sm">{appointment.internal_notes}</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Status change */}
          {availableTransitions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  Cambiar estado
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Nuevo estado</Label>
                  <Select
                    value={newStatus}
                    onValueChange={(v) => setNewStatus(v as AppointmentStatus)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar estado..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTransitions.map((s) => (
                        <SelectItem key={s} value={s}>
                          {APPOINTMENT_STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="status_note">Observación (opcional)</Label>
                  <Textarea
                    id="status_note"
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    placeholder="Motivo del cambio..."
                    rows={2}
                  />
                </div>
                <Button
                  onClick={handleStatusChange}
                  disabled={!newStatus || isPending}
                  size="sm"
                >
                  {isPending && <Spinner className="mr-2" />}
                  Aplicar cambio de estado
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: history */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <History className="w-4 h-4 text-muted-foreground" />
                Historial de actividad
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground px-4 pb-4">Sin historial.</p>
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {history.map((h) => (
                    <div key={h.id} className="px-4 py-3 flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-foreground">{h.action}</span>
                        {h.new_status && (
                          <Badge
                            variant="outline"
                            className={`text-xs shrink-0 ${APPOINTMENT_STATUS_COLORS[h.new_status]}`}
                          >
                            {APPOINTMENT_STATUS_LABELS[h.new_status]}
                          </Badge>
                        )}
                      </div>
                      {h.notes && (
                        <p className="text-xs text-muted-foreground">{h.notes}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(h.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                        {h.user ? ` · ${h.user.full_name}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AppointmentFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        appointment={appointment}
        patients={patients}
        specialties={specialties}
        currentUserId={currentUserId}
        onSaved={handleEdited}
      />
    </div>
  )
}
