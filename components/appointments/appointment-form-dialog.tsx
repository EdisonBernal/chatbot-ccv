'use client'

import { useState, useTransition } from 'react'
import type { AppointmentRequest, Patient, Specialty, AppointmentFormData } from '@/lib/types'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'

interface AppointmentFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  appointment?: AppointmentRequest | null
  patients: Patient[]
  specialties: Specialty[]
  currentUserId: string
  onSaved: (appt: AppointmentRequest) => void
}

export function AppointmentFormDialog({
  open,
  onOpenChange,
  appointment,
  patients,
  specialties,
  currentUserId,
  onSaved,
}: AppointmentFormDialogProps) {
  const isEdit = !!appointment
  const [form, setForm] = useState({
    patient_id: appointment?.patient_id ?? '',
    specialty_id: appointment?.specialty_id ?? '',
    requested_date: appointment?.requested_date ?? '',
    internal_notes: appointment?.internal_notes ?? '',
  })
  const [isPending, startTransition] = useTransition()

  const set = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }))

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setForm({
        patient_id: appointment?.patient_id ?? '',
        specialty_id: appointment?.specialty_id ?? '',
        requested_date: appointment?.requested_date ?? '',
        internal_notes: appointment?.internal_notes ?? '',
      })
    }
    onOpenChange(open)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.patient_id || !form.specialty_id) {
      toast.error('Selecciona paciente y especialidad.')
      return
    }
    startTransition(async () => {
      const payload = {
        ...form,
        requested_date: form.requested_date || null,
        internal_notes: form.internal_notes || null,
        created_by: currentUserId,
      }
      const url = isEdit ? `/api/appointments/${appointment!.id}` : '/api/appointments'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? 'Error al guardar.')
        return
      }
      const saved: AppointmentRequest = await res.json()
      onSaved(saved)
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar solicitud' : 'Nueva solicitud de cita'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Paciente *</Label>
            <Select value={form.patient_id} onValueChange={(v) => set('patient_id', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar paciente..." />
              </SelectTrigger>
              <SelectContent>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name} — {p.document_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Especialidad *</Label>
            <Select value={form.specialty_id} onValueChange={(v) => set('specialty_id', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar especialidad..." />
              </SelectTrigger>
              <SelectContent>
                {specialties.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="requested_date">Fecha preferida</Label>
            <Input
              id="requested_date"
              type="date"
              value={form.requested_date}
              onChange={(e) => set('requested_date', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="internal_notes">Notas internas</Label>
            <Textarea
              id="internal_notes"
              value={form.internal_notes}
              onChange={(e) => set('internal_notes', e.target.value)}
              placeholder="Observaciones adicionales..."
              rows={3}
            />
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Spinner className="mr-2" />}
              {isEdit ? 'Guardar cambios' : 'Crear solicitud'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
