'use client'

import type { Patient } from '@/lib/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Edit2, Trash2 } from 'lucide-react'

interface PatientsTableProps {
  patients: Patient[]
  onEdit?: (patient: Patient) => void
  onDelete?: (patientId: string) => void
}

export function PatientsTable({ patients, onEdit, onDelete }: PatientsTableProps) {
  if (patients.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No patients found
      </div>
    )
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Document</TableHead>
            <TableHead>EPS</TableHead>
            <TableHead className="w-20">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {patients.map((patient) => (
            <TableRow key={patient.id}>
              <TableCell className="font-medium">
                {patient.full_name}
              </TableCell>
              <TableCell>{patient.email || '—'}</TableCell>
              <TableCell>{patient.phone_number}</TableCell>
              <TableCell>{patient.document_number}</TableCell>
              <TableCell>{patient.eps ? patient.eps.name : 'N/A'}</TableCell>
              <TableCell className="flex gap-2">
                {onEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(patient)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(patient.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
