'use client'

import type { AppointmentRequest, AppointmentStatus } from '@/lib/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Eye } from 'lucide-react'
import { format } from 'date-fns'

interface AppointmentsTableProps {
  appointments: AppointmentRequest[]
  onView?: (appointment: AppointmentRequest) => void
}

const statusColors: Record<AppointmentStatus, string> = {
  pendiente: 'bg-yellow-100 text-yellow-800',
  en_revision: 'bg-blue-100 text-blue-800',
  confirmada: 'bg-green-100 text-green-800',
  cancelada: 'bg-gray-100 text-gray-800',
}

export function AppointmentsTable({ appointments, onView }: AppointmentsTableProps) {
  if (appointments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No appointments found
      </div>
    )
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Patient</TableHead>
            <TableHead>Specialty</TableHead>
            <TableHead>Requested Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Doctor</TableHead>
            <TableHead className="w-20">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {appointments.map((appointment) => (
            <TableRow key={appointment.id}>
              <TableCell className="font-medium">
                {appointment.patient?.full_name || appointment.patient_id}
              </TableCell>
              <TableCell>{appointment.specialty?.name || appointment.specialty_id}</TableCell>
              <TableCell>
                {appointment.requested_date ? format(new Date(appointment.requested_date), 'MMM dd, yyyy') : '—'}
              </TableCell>
              <TableCell>
                <Badge className={statusColors[appointment.status]}>
                  {appointment.status}
                </Badge>
              </TableCell>
              <TableCell>{appointment.creator?.full_name || 'Unassigned'}</TableCell>
              <TableCell>
                {onView && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onView(appointment)}
                  >
                    <Eye className="w-4 h-4" />
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
