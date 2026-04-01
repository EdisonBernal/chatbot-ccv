'use client'

import { useState, useEffect } from 'react'
import type { ChatbotActionType, ChatbotStepAction } from '@/lib/types'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { CHATBOT_ACTION_LABELS } from '@/lib/types'
import { useQuery } from '@/hooks/use-query'

interface ChatbotActionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  stepId: string
  action?: ChatbotStepAction | null
  onSaved?: () => void
}

export function ChatbotActionDialog({ open, onOpenChange, stepId, action, onSaved }: ChatbotActionDialogProps) {
  const [formData, setFormData] = useState({
    action_type: 'send_message' as ChatbotActionType,
    message_template: '',
    appointment_specialty_id: '',
    info_field_name: '',
    info_field_label: '',
    delay_seconds: 0,
    redirect_to_agent: false,
    is_active: true,
  })
  const [loading, setLoading] = useState(false)
  const { data: specialties } = useQuery<any[]>('/api/specialties')

  const isEditing = !!action

  useEffect(() => {
    if (action) {
      setFormData({
        action_type: action.action_type,
        message_template: action.message_template || '',
        appointment_specialty_id: action.appointment_specialty_id || '',
        info_field_name: action.info_field_name || '',
        info_field_label: action.info_field_label || '',
        delay_seconds: action.delay_seconds || 0,
        redirect_to_agent: action.redirect_to_agent,
        is_active: action.is_active,
      })
    } else {
      setFormData({
        action_type: 'send_message',
        message_template: '',
        appointment_specialty_id: '',
        info_field_name: '',
        info_field_label: '',
        delay_seconds: 0,
        redirect_to_agent: false,
        is_active: true,
      })
    }
  }, [action, open])

  const handleSave = async () => {
    try {
      setLoading(true)
      if (isEditing) {
        const res = await fetch(`/api/chatbot/actions/${action.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
        if (!res.ok) throw new Error('Failed to update action')
      } else {
        const res = await fetch(`/api/chatbot/steps/${stepId}/actions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
        if (!res.ok) throw new Error('Failed to create action')
      }
      onSaved?.()
      onOpenChange(false)
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Acción' : 'Agregar Acción'}</DialogTitle>
          <DialogDescription>
            Configura qué acción ejecutará el chatbot en este paso
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="action">Tipo de Acción *</Label>
            <Select
              value={formData.action_type}
              onValueChange={(val: any) =>
                setFormData({ ...formData, action_type: val })
              }
            >
              <SelectTrigger id="action" disabled={loading}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CHATBOT_ACTION_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(formData.action_type === 'send_message' ||
            formData.action_type === 'send_reminder' ||
            formData.action_type === 'send_confirmation') && (
            <div>
              <Label htmlFor="message">Mensaje *</Label>
              <Textarea
                id="message"
                value={formData.message_template || ''}
                onChange={e => setFormData({ ...formData, message_template: e.target.value })}
                placeholder="Usa {{nombre}}, {{email}}, {{telefono}} para variables dinámicas"
                rows={3}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {"Variables disponibles: {{nombre}}, {{email}}, {{telefono}}, etc."}
              </p>
            </div>
          )}

          {formData.action_type === 'create_appointment_request' && (
            <div>
              <Label htmlFor="specialty">Especialidad *</Label>
              <Select
                value={formData.appointment_specialty_id}
                onValueChange={val => setFormData({ ...formData, appointment_specialty_id: val })}
              >
                <SelectTrigger id="specialty" disabled={loading}>
                  <SelectValue placeholder="Selecciona una especialidad" />
                </SelectTrigger>
                <SelectContent>
                  {specialties?.map(spec => (
                    <SelectItem key={spec.id} value={spec.id}>
                      {spec.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {formData.action_type === 'collect_info' && (
            <>
              <div>
                <Label htmlFor="field">Nombre del Campo *</Label>
                <Input
                  id="field"
                  value={formData.info_field_name || ''}
                  onChange={e => setFormData({ ...formData, info_field_name: e.target.value })}
                  placeholder="Ej: email, phone"
                  disabled={loading}
                />
              </div>
              <div>
                <Label htmlFor="label">Etiqueta a Mostrar</Label>
                <Input
                  id="label"
                  value={formData.info_field_label || ''}
                  onChange={e => setFormData({ ...formData, info_field_label: e.target.value })}
                  placeholder="Ej: ¿Cuál es tu email?"
                  disabled={loading}
                />
              </div>
            </>
          )}

          <div>
            <Label htmlFor="delay">Retardo (segundos)</Label>
            <Input
              id="delay"
              type="number"
              value={formData.delay_seconds || 0}
              onChange={e =>
                setFormData({ ...formData, delay_seconds: parseInt(e.target.value) || 0 })
              }
              min="0"
              disabled={loading}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="escalate">Derivar a agente después de esta acción</Label>
            <Switch
              id="escalate"
              checked={formData.redirect_to_agent}
              onCheckedChange={checked =>
                setFormData({ ...formData, redirect_to_agent: checked })
              }
              disabled={loading}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="active">Activa</Label>
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
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEditing ? 'Actualizar' : 'Crear Acción'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
