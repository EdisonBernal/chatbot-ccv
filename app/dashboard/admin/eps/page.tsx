import { getEPS } from '@/lib/services/eps'
import { EPSClient } from '@/components/admin/eps-client'

export default async function EPSPage() {
  const epsList = await getEPS()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Aseguradoras (EPS)</h1>
        <p className="text-sm text-muted-foreground mt-1">Gestiona las aseguradoras aceptadas en la clínica</p>
      </div>
      <EPSClient eps={epsList} />
    </div>
  )
}
