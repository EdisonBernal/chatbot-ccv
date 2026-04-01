'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Patient, EPS, PatientFormData } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Search, Pencil, Trash2, Phone, Mail } from 'lucide-react'
import { PatientFormDialog } from './patient-form-dialog'
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog'
import { toast } from 'sonner'

interface PatientsClientProps {
  initialPatients: Patient[]
  epsList: EPS[]
}

export function PatientsClient({ initialPatients, epsList }: PatientsClientProps) {
  const router = useRouter()
  const [patients, setPatients] = useState<Patient[]>(initialPatients)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editPatient, setEditPatient] = useState<Patient | null>(null)
  const [deletePatient, setDeletePatient] = useState<Patient | null>(null)
  const [isPending, startTransition] = useTransition()

  const filtered = patients.filter(
    (p) =>
      p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      p.document_number.toLowerCase().includes(search.toLowerCase()) ||
      p.phone_number.includes(search)
  )

  const handleSaved = (patient: Patient, isEdit: boolean) => {
    if (isEdit) {
      setPatients((prev) => prev.map((p) => (p.id === patient.id ? patient : p)))
      toast.success('Paciente actualizado correctamente.')
    } else {
      setPatients((prev) => [patient, ...prev])
      toast.success('Paciente creado correctamente.')
    }
    setFormOpen(false)
    setEditPatient(null)
  }

  const handleDelete = async () => {
    if (!deletePatient) return
    startTransition(async () => {
      const res = await fetch(`/api/patients/${deletePatient.id}`, { method: 'DELETE' })
      if (res.ok) {
        setPatients((prev) => prev.filter((p) => p.id !== deletePatient.id))
        toast.success('Paciente eliminado.')
      } else {
        toast.error('No se pudo eliminar el paciente.')
      }
      setDeletePatient(null)
    })
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Pacientes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {patients.length} paciente{patients.length !== 1 ? 's' : ''} registrado{patients.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          onClick={() => { setEditPatient(null); setFormOpen(true) }}
          size="sm"
          className="gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Nuevo paciente
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, documento o teléfono..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>EPS</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                  {search ? 'No se encontraron pacientes con esa búsqueda.' : 'No hay pacientes registrados aún.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((patient) => (
                <TableRow key={patient.id}>
                  <TableCell className="font-medium">{patient.full_name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{patient.document_number}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-1.5 text-sm">
                        <Phone className="w-3 h-3 text-muted-foreground" />
                        {patient.phone_number}
                      </span>
                      {patient.email && (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Mail className="w-3 h-3" />
                          {patient.email}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {patient.eps ? (
                      <Badge variant="secondary" className="text-xs">{patient.eps.name}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => { setEditPatient(patient); setFormOpen(true) }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeletePatient(patient)}
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

      {/* Dialogs */}
      <PatientFormDialog
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditPatient(null) }}
        patient={editPatient}
        epsList={epsList}
        onSaved={handleSaved}
      />
      <DeleteConfirmDialog
        open={!!deletePatient}
        onOpenChange={(open) => !open && setDeletePatient(null)}
        title="Eliminar paciente"
        description={`¿Estás seguro de eliminar a ${deletePatient?.full_name}? Esta acción no se puede deshacer.`}
        onConfirm={handleDelete}
        loading={isPending}
      />
    </div>
  )
}
