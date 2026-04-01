import { getAppointments } from '@/lib/services/appointments'
import { getPatients } from '@/lib/services/patients'
import { getSpecialties } from '@/lib/services/specialties'
import { getCurrentUser } from '@/lib/services/users'
import { AppointmentsClient } from '@/components/appointments/appointments-client'

export default async function AppointmentsPage() {
  const [appointments, patients, specialties, currentUser] = await Promise.all([
    getAppointments(),
    getPatients(),
    getSpecialties(true),
    getCurrentUser(),
  ])
  return (
    <AppointmentsClient
      initialAppointments={appointments}
      patients={patients}
      specialties={specialties}
      currentUserId={currentUser?.id ?? ''}
    />
  )
}
