'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { AppointmentRequest, Patient, Specialty } from '@/lib/types'
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_COLORS } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Search, Eye, Trash2 } from 'lucide-react'
import { AppointmentFormDialog } from './appointment-form-dialog'
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface AppointmentsClientProps {
  initialAppointments: AppointmentRequest[]
  patients: Patient[]
  specialties: Specialty[]
  currentUserId: string
}

export function AppointmentsClient({
  initialAppointments,
  patients,
  specialties,
  currentUserId,
}: AppointmentsClientProps) {
  const [appointments, setAppointments] = useState<AppointmentRequest[]>(initialAppointments)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [deleteItem, setDeleteItem] = useState<AppointmentRequest | null>(null)
  const [isPending, startTransition] = useTransition()

  const filtered = appointments.filter((a) => {
    const matchesSearch =
      a.patient?.full_name.toLowerCase().includes(search.toLowerCase()) ||
      a.specialty?.name.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || a.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleSaved = (appt: AppointmentRequest) => {
    setAppointments((prev) => [appt, ...prev])
    toast.success('Solicitud creada correctamente.')
    setFormOpen(false)
  }

  const handleDelete = async () => {
    if (!deleteItem) return
    startTransition(async () => {
      const res = await fetch(`/api/appointments/${deleteItem.id}`, { method: 'DELETE' })
      if (res.ok) {
        setAppointments((prev) => prev.filter((a) => a.id !== deleteItem.id))
        toast.success('Solicitud eliminada.')
      } else {
        toast.error('No se pudo eliminar la solicitud.')
      }
      setDeleteItem(null)
    })
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Solicitudes de citas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {appointments.length} solicitud{appointments.length !== 1 ? 'es' : ''}
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" />
          Nueva solicitud
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por paciente o especialidad..."
            className="pl-9 w-72"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="en_revision">En revisión</SelectItem>
            <SelectItem value="confirmada">Confirmada</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Paciente</TableHead>
              <TableHead>Especialidad</TableHead>
              <TableHead>Fecha solicitada</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Creada</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  {search || statusFilter !== 'all'
                    ? 'No se encontraron solicitudes con ese filtro.'
                    : 'No hay solicitudes registradas aún.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((appt) => (
                <TableRow key={appt.id}>
                  <TableCell className="font-medium">
                    {appt.patient?.full_name ?? '—'}
                    <div className="text-xs text-muted-foreground">
                      {appt.patient?.document_number}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{appt.specialty?.name ?? '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {appt.requested_date
                      ? format(new Date(appt.requested_date), 'd MMM yyyy', { locale: es })
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-xs ${APPOINTMENT_STATUS_COLORS[appt.status]}`}
                    >
                      {APPOINTMENT_STATUS_LABELS[appt.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(appt.created_at), 'd MMM yyyy', { locale: es })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                        <Link href={`/dashboard/appointments/${appt.id}`}>
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteItem(appt)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AppointmentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        patients={patients}
        specialties={specialties}
        currentUserId={currentUserId}
        onSaved={handleSaved}
      />
      <DeleteConfirmDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        title="Eliminar solicitud"
        description={`¿Estás seguro de eliminar la solicitud de ${deleteItem?.patient?.full_name}?`}
        onConfirm={handleDelete}
        loading={isPending}
      />
    </div>
  )
}
