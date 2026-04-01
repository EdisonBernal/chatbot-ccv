'use client'

import { useState, useEffect } from 'react'
import type { ChatbotConfig } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Loader2 } from 'lucide-react'

interface ChatbotConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: ChatbotConfig | null
  onSave: (data: any) => Promise<void>
  loading: boolean
}

export function ChatbotConfigDialog({
  open,
  onOpenChange,
  config,
  onSave,
  loading,
}: ChatbotConfigDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true,
    welcome_message: '',
    fallback_message: 'Lo siento, no entiendo. ¿Puedo ayudarte de otra forma?',
    escalation_message: 'Conectándote con un agente...',
    max_retries: 3,
  })

  useEffect(() => {
    if (config) {
      setFormData({
        name: config.name,
        description: config.description || '',
        is_active: config.is_active,
        welcome_message: config.welcome_message || '',
        fallback_message: config.fallback_message,
        escalation_message: config.escalation_message,
        max_retries: config.max_retries,
      })
    } else {
      setFormData({
        name: '',
        description: '',
        is_active: true,
        welcome_message: '',
        fallback_message: 'Lo siento, no entiendo. ¿Puedo ayudarte de otra forma?',
        escalation_message: 'Conectándote con un agente...',
        max_retries: 3,
      })
    }
  }, [config])

  const handleSave = async () => {
    await onSave(formData)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{config ? 'Editar Chatbot' : 'Crear Chatbot'}</DialogTitle>
          <DialogDescription>
            Configura los parámetros principales del chatbot automático
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Chatbot de Citas"
              disabled={loading}
            />
          </div>

          <div>
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descripción del chatbot..."
              rows={2}
              disabled={loading}
            />
          </div>

          <div>
            <Label htmlFor="welcome">Mensaje de Bienvenida</Label>
            <Textarea
              id="welcome"
              value={formData.welcome_message}
              onChange={e => setFormData({ ...formData, welcome_message: e.target.value })}
              placeholder="Mensaje que ve el usuario al iniciar..."
              rows={2}
              disabled={loading}
            />
          </div>

          <div>
            <Label htmlFor="fallback">Mensaje por Defecto (cuando no entiende)</Label>
            <Textarea
              id="fallback"
              value={formData.fallback_message}
              onChange={e => setFormData({ ...formData, fallback_message: e.target.value })}
              rows={2}
              disabled={loading}
            />
          </div>

          <div>
            <Label htmlFor="escalation">Mensaje de Escalación (derivar a agente)</Label>
            <Textarea
              id="escalation"
              value={formData.escalation_message}
              onChange={e => setFormData({ ...formData, escalation_message: e.target.value })}
              rows={2}
              disabled={loading}
            />
          </div>

          <div>
            <Label htmlFor="retries">Reintentos Máximos</Label>
            <Input
              id="retries"
              type="number"
              value={formData.max_retries}
              onChange={e => setFormData({ ...formData, max_retries: parseInt(e.target.value) })}
              min="1"
              max="10"
              disabled={loading}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="active">Activo</Label>
            <Switch
              id="active"
              checked={formData.is_active}
              onCheckedChange={checked => setFormData({ ...formData, is_active: checked })}
              disabled={loading}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading || !formData.name}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {config ? 'Actualizar' : 'Crear'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
