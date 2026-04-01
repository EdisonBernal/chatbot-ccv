'use client'

import { useState } from 'react'
import type { Specialty } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Pencil, Trash2, Plus } from 'lucide-react'

interface SpecialtiesClientProps {
  specialties: Specialty[]
}

export function SpecialtiesClient({ specialties: initialSpecialties }: SpecialtiesClientProps) {
  const [specialties, setSpecialties] = useState(initialSpecialties)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAdd = async () => {
    if (!name.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/specialties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, is_active: true }),
      })
      if (res.ok) {
        const newSpecialty = await res.json()
        setSpecialties([...specialties, newSpecialty])
        setName('')
      }
    } catch (e) {
      console.error('Error adding specialty:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta especialidad?')) return
    try {
      const res = await fetch(`/api/specialties/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setSpecialties(specialties.filter(s => s.id !== id))
      }
    } catch (e) {
      console.error('Error deleting specialty:', e)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Agregar Especialidad</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Nombre de la especialidad"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button onClick={handleAdd} disabled={loading}>
              <Plus className="w-4 h-4 mr-2" />
              Agregar
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {specialties.map(specialty => (
          <Card key={specialty.id}>
            <CardContent className="pt-6 flex items-center justify-between">
              <div>
                <p className="font-medium">{specialty.name}</p>
                {specialty.is_active && <Badge variant="outline">Activa</Badge>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditingId(specialty.id)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleDelete(specialty.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
