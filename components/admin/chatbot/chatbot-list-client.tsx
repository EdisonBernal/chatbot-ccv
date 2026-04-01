'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ChatbotConfig } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit, Trash2, Power, AlertCircle } from 'lucide-react'
import { ChatbotConfigDialog } from './chatbot-config-dialog'
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog'

interface ChatbotListClientProps {
  initialConfigs: ChatbotConfig[]
}

export function ChatbotListClient({ initialConfigs }: ChatbotListClientProps) {
  const router = useRouter()
  const [configs, setConfigs] = useState<ChatbotConfig[]>(initialConfigs)
  const [showDialog, setShowDialog] = useState(false)
  const [selectedConfig, setSelectedConfig] = useState<ChatbotConfig | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleCreate = () => {
    setSelectedConfig(null)
    setShowDialog(true)
  }

  const handleEdit = (config: ChatbotConfig) => {
    setSelectedConfig(config)
    setShowDialog(true)
  }

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      setLoading(true)
      const res = await fetch(`/api/chatbot/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive }),
      })
      if (!res.ok) throw new Error('Failed to toggle')
      
      setConfigs(c => c.map(cfg => cfg.id === id ? { ...cfg, is_active: !isActive } : cfg))
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      setLoading(true)
      const res = await fetch(`/api/chatbot/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      
      setConfigs(c => c.filter(cfg => cfg.id !== id))
      setDeleteId(null)
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (formData: any) => {
    try {
      setLoading(true)
      if (selectedConfig) {
        const res = await fetch(`/api/chatbot/${selectedConfig.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
        if (!res.ok) throw new Error('Failed to update')
        const updated = await res.json()
        setConfigs(c => c.map(cfg => cfg.id === updated.id ? updated : cfg))
      } else {
        const res = await fetch('/api/chatbot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
        if (!res.ok) throw new Error('Failed to create')
        const created = await res.json()
        setConfigs(c => [created, ...c])
      }
      setShowDialog(false)
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Configuración de Chatbot</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Administra los pasos automáticos que ejecuta el agente
          </p>
        </div>
        <Button onClick={handleCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Nuevo Chatbot
        </Button>
      </div>

      {configs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Sin configuraciones</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Crea tu primer chatbot para automatizar respuestas
            </p>
            <Button onClick={handleCreate} variant="outline" className="gap-2">
              <Plus className="w-4 h-4" />
              Crear Chatbot
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {configs.map(config => (
            <Card key={config.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold">{config.name}</h3>
                      <Badge variant={config.is_active ? 'default' : 'outline'}>
                        {config.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </div>
                    {config.description && (
                      <p className="text-sm text-muted-foreground mt-1">{config.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggle(config.id, config.is_active)}
                      disabled={loading}
                      className="gap-1"
                    >
                      <Power className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/dashboard/admin/chatbot/${config.id}`)}
                      className="gap-1"
                    >
                      <Edit className="w-4 h-4" />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteId(config.id)}
                      disabled={loading}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {config.welcome_message && (
                <CardContent className="py-3 border-t">
                  <p className="text-sm text-muted-foreground">
                    <strong>Bienvenida:</strong> {config.welcome_message}
                  </p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <ChatbotConfigDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        config={selectedConfig}
        onSave={handleSave}
        loading={loading}
      />

      <DeleteConfirmDialog
        open={deleteId !== null}
        onOpenChange={open => !open && setDeleteId(null)}
        title="Eliminar Chatbot"
        description="¿Estás seguro de que deseas eliminar esta configuración? Esta acción no se puede deshacer."
        onConfirm={() => deleteId && handleDelete(deleteId)}
        loading={loading}
      />
    </div>
  )
}
