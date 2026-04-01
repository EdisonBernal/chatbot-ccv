'use client'

import { useState, useTransition } from 'react'
import type { Patient, EPS, PatientFormData } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'

interface PatientFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patient: Patient | null
  epsList: EPS[]
  onSaved: (patient: Patient, isEdit: boolean) => void
}

const EMPTY: PatientFormData = {
  document_number: '',
  full_name: '',
  phone_number: '',
  email: '',
  eps_id: '',
}

export function PatientFormDialog({
  open,
  onOpenChange,
  patient,
  epsList,
  onSaved,
}: PatientFormDialogProps) {
  const isEdit = !!patient
  const [form, setForm] = useState<PatientFormData>(
    patient
      ? {
          document_number: patient.document_number,
          full_name: patient.full_name,
          phone_number: patient.phone_number,
          email: patient.email ?? '',
          eps_id: patient.eps_id ?? '',
        }
      : EMPTY
  )
  const [isPending, startTransition] = useTransition()

  // Reset when opening/changing patient
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setForm(
        patient
          ? {
              document_number: patient.document_number,
              full_name: patient.full_name,
              phone_number: patient.phone_number,
              email: patient.email ?? '',
              eps_id: patient.eps_id ?? '',
            }
          : EMPTY
      )
    }
    onOpenChange(open)
  }

  const set = (field: keyof PatientFormData, value: string) =>
    setForm((f) => ({ ...f, [field]: value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.document_number || !form.full_name || !form.phone_number) {
      toast.error('Por favor completa los campos obligatorios.')
      return
    }
    startTransition(async () => {
      const payload: PatientFormData = {
        ...form,
        email: form.email || undefined,
        eps_id: form.eps_id || undefined,
      }
      const url = isEdit ? `/api/patients/${patient!.id}` : '/api/patients'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? 'Error al guardar el paciente.')
        return
      }
      const saved: Patient = await res.json()
      onSaved(saved, isEdit)
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar paciente' : 'Nuevo paciente'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="full_name">Nombre completo *</Label>
            <Input
              id="full_name"
              value={form.full_name}
              onChange={(e) => set('full_name', e.target.value)}
              placeholder="Juan García López"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="document_number">Número de documento *</Label>
            <Input
              id="document_number"
              value={form.document_number}
              onChange={(e) => set('document_number', e.target.value)}
              placeholder="123456789"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone_number">Teléfono *</Label>
            <Input
              id="phone_number"
              value={form.phone_number}
              onChange={(e) => set('phone_number', e.target.value)}
              placeholder="+57 300 0000000"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              value={form.email ?? ''}
              onChange={(e) => set('email', e.target.value)}
              placeholder="correo@ejemplo.com"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="eps_id">EPS</Label>
            <Select value={form.eps_id ?? ''} onValueChange={(v) => set('eps_id', v)}>
              <SelectTrigger id="eps_id">
                <SelectValue placeholder="Seleccionar EPS..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin EPS</SelectItem>
                {epsList.map((eps) => (
                  <SelectItem key={eps.id} value={eps.id}>
                    {eps.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Spinner className="mr-2" />}
              {isEdit ? 'Guardar cambios' : 'Crear paciente'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
