import { getUsers } from '@/lib/services/users'
import { UsersClient } from '@/components/admin/users-client'

export default async function UsersPage() {
  const users = await getUsers()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Usuarios y Permisos</h1>
        <p className="text-sm text-muted-foreground mt-1">Gestiona los usuarios del sistema y sus permisos</p>
      </div>
      <UsersClient users={users} />
    </div>
  )
}
