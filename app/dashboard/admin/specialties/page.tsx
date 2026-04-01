import { getSpecialties } from '@/lib/services/specialties'
import { SpecialtiesClient } from '@/components/admin/specialties-client'

export default async function SpecialtiesPage() {
  const specialties = await getSpecialties()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Especialidades Médicas</h1>
        <p className="text-sm text-muted-foreground mt-1">Gestiona las especialidades disponibles en la clínica</p>
      </div>
      <SpecialtiesClient specialties={specialties} />
    </div>
  )
}
