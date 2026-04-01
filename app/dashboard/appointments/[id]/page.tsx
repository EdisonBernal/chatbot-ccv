import { getAppointmentById, getAppointmentHistory } from '@/lib/services/appointments'
import { getCurrentUser } from '@/lib/services/users'
import { getPatients } from '@/lib/services/patients'
import { getSpecialties } from '@/lib/services/specialties'
import { notFound } from 'next/navigation'
import { AppointmentDetailClient } from '@/components/appointments/appointment-detail-client'

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [appointment, history, currentUser, patients, specialties] = await Promise.all([
    getAppointmentById(id),
    getAppointmentHistory(id),
    getCurrentUser(),
    getPatients(),
    getSpecialties(true),
  ])
  if (!appointment) notFound()
  return (
    <AppointmentDetailClient
      appointment={appointment}
      history={history}
      currentUserId={currentUser?.id ?? ''}
      patients={patients}
      specialties={specialties}
    />
  )
}
