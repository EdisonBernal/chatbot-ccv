import { getPatients } from '@/lib/services/patients'
import { getEPS } from '@/lib/services/eps'
import { PatientsClient } from '@/components/patients/patients-client'

export default async function PatientsPage() {
  const [patients, epsList] = await Promise.all([getPatients(), getEPS(true)])
  return <PatientsClient initialPatients={patients} epsList={epsList} />
}
