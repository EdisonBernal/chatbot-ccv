'use client'

import { useState } from 'react'
import type { EPS } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Pencil, Trash2, Plus } from 'lucide-react'

interface EPSClientProps {
  eps: EPS[]
}

export function EPSClient({ eps: initialEps }: EPSClientProps) {
  const [epsList, setEpsList] = useState(initialEps)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAdd = async () => {
    if (!name.trim() || !code.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/eps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, code, is_active: true }),
      })
      if (res.ok) {
        const newEps = await res.json()
        setEpsList([...epsList, newEps])
        setName('')
        setCode('')
      }
    } catch (e) {

    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta aseguradora?')) return
    try {
      const res = await fetch(`/api/eps/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setEpsList(epsList.filter(e => e.id !== id))
      }
    } catch (e) {

    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Agregar Aseguradora</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              placeholder="Código"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <Button onClick={handleAdd} disabled={loading}>
              <Plus className="w-4 h-4 mr-2" />
              Agregar
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {epsList.map(e => (
          <Card key={e.id}>
            <CardContent className="pt-6 flex items-center justify-between">
              <div>
                <p className="font-medium">{e.name}</p>
                <p className="text-sm text-muted-foreground">{e.code}</p>
                {e.is_active && <Badge variant="outline">Activa</Badge>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditingId(e.id)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleDelete(e.id)}>
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
