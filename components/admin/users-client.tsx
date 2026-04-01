'use client'

import { useState } from 'react'
import type { User } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Pencil, Trash2, Shield, Users } from 'lucide-react'

interface UsersClientProps {
  users: User[]
}

export function UsersClient({ users: initialUsers }: UsersClientProps) {
  const [users, setUsers] = useState(initialUsers)

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este usuario?')) return
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setUsers(users.filter(u => u.id !== id))
      }
    } catch (e) {
      console.error('Error deleting user:', e)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3">
        {users.map(user => (
          <Card key={user.id}>
            <CardContent className="pt-6 flex items-center justify-between">
              <div>
                <p className="font-medium">{user.full_name}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                <div className="flex gap-2 mt-2">
                  {user.role === 'admin' ? (
                    <Badge className="bg-red-100 text-red-800 flex gap-1">
                      <Shield className="w-3 h-3" />
                      Administrador
                    </Badge>
                  ) : (
                    <Badge className="bg-blue-100 text-blue-800 flex gap-1">
                      <Users className="w-3 h-3" />
                      Recepción
                    </Badge>
                  )}
                  {user.is_active && <Badge variant="outline">Activo</Badge>}
                </div>
              </div>
              <Button size="sm" variant="destructive" onClick={() => handleDelete(user.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
