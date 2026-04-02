'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ChatbotStep, ChatbotStepAction, ChatbotTriggerType } from '@/lib/types'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Plus, Trash2, Edit, GripVertical } from 'lucide-react'
import { CHATBOT_TRIGGER_LABELS, CHATBOT_ACTION_LABELS } from '@/lib/types'
import { ChatbotActionDialog } from './chatbot-action-dialog'

interface ChatbotStepDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  step: ChatbotStep | null
  allSteps: ChatbotStep[]
  onSave: (data: any) => Promise<void>
  loading: boolean
}

export function ChatbotStepDialog({
  open,
  onOpenChange,
  step,
  allSteps,
  onSave,
  loading,
}: ChatbotStepDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    trigger_type: 'message_received' as ChatbotTriggerType,
    trigger_keywords: [] as string[],
    trigger_delay_minutes: undefined as number | undefined,
    condition_requires_pending_apt: false,
    goto_step_name: '' as string,
    keyword_routes: {} as Record<string, string>,
    is_active: true,
  })
  const [keywordInput, setKeywordInput] = useState('')
  const [showActionDialog, setShowActionDialog] = useState(false)
  const [editingAction, setEditingAction] = useState<ChatbotStepAction | null>(null)
  const [actions, setActions] = useState<ChatbotStepAction[]>([])
  const [actionsLoading, setActionsLoading] = useState(false)

  const fetchActions = useCallback(async (stepId: string) => {
    setActionsLoading(true)
    try {
      const res = await fetch(`/api/chatbot/steps/${stepId}/actions`)
      if (res.ok) {
        const data = await res.json()
        setActions(data)
      }
    } catch {
      // ignore
    } finally {
      setActionsLoading(false)
    }
  }, [])

  const handleDeleteAction = async (actionId: string) => {
    if (!confirm('¿Eliminar esta acción?')) return
    try {
      const res = await fetch(`/api/chatbot/actions/${actionId}`, { method: 'DELETE' })
      if (res.ok) {
        setActions(prev => prev.filter(a => a.id !== actionId))
      }
    } catch {
      alert('Error al eliminar la acción')
    }
  }

  useEffect(() => {
    if (step) {
      setFormData({
        name: step.name,
        description: step.description || '',
        trigger_type: step.trigger_type,
        trigger_keywords: step.trigger_keywords || [],
        trigger_delay_minutes: step.trigger_delay_minutes || undefined,
        condition_requires_pending_apt: step.condition_requires_pending_apt,
        goto_step_name: step.goto_step_name || '',
        keyword_routes: step.keyword_routes || {},
        is_active: step.is_active,
      })
      // Load actions from the step object or fetch from API
      if (step.actions && step.actions.length > 0) {
        setActions(step.actions)
      } else {
        fetchActions(step.id)
      }
    } else {
      setFormData({
        name: '',
        description: '',
        trigger_type: 'message_received',
        trigger_keywords: [],
        trigger_delay_minutes: undefined,
        condition_requires_pending_apt: false,
        goto_step_name: '',
        keyword_routes: {},
        is_active: true,
      })
      setActions([])
    }
    setKeywordInput('')
    setEditingAction(null)
  }, [step, open, fetchActions])

  const handleAddKeyword = () => {
    if (keywordInput.trim()) {
      const updatedKeywords = [...(formData.trigger_keywords || []), keywordInput.trim()]
      setFormData({
        ...formData,
        trigger_keywords: updatedKeywords,
      })
      setKeywordInput('')
    }
  }

  const handleRemoveKeyword = (keyword: string) => {
    setFormData({
      ...formData,
      trigger_keywords: (formData.trigger_keywords || []).filter(k => k !== keyword),
    })
  }

  const handleSave = async () => {
    let keywords = Array.isArray(formData.trigger_keywords) ? formData.trigger_keywords : []

    // If user typed a keyword but did not press +, include it in save
    const pendingKeyword = keywordInput.trim()
    if (formData.trigger_type === 'keyword' && pendingKeyword) {
      keywords = [...keywords, pendingKeyword]
    }

    // Clean up keyword_routes: remove empty values and keywords not in the list
    const cleanRoutes: Record<string, string> = {}
    if (formData.trigger_type === 'keyword') {
      for (const kw of keywords) {
        const route = formData.keyword_routes[kw]
        if (route) cleanRoutes[kw] = route
      }
    }

    const payload = {
      ...formData,
      trigger_keywords: formData.trigger_type === 'keyword' ? keywords : [],
      goto_step_name: formData.goto_step_name || null,
      keyword_routes: Object.keys(cleanRoutes).length > 0 ? cleanRoutes : null,
    }

    await onSave(payload)
  }

  // Available steps for routing (exclude current step)
  const routeTargetSteps = allSteps.filter(s => !step || s.id !== step.id)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{step ? 'Editar Paso' : 'Crear Paso'}</DialogTitle>
          <DialogDescription>
            Configura los detalles del paso del chatbot y sus acciones
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="config" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="config">Configuración</TabsTrigger>
            <TabsTrigger value="routing">Enrutamiento</TabsTrigger>
            <TabsTrigger value="actions">Acciones</TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-4">
            <div>
              <Label htmlFor="name">Nombre del Paso *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Saludo inicial"
                disabled={loading}
              />
            </div>

            <div>
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descripción del paso..."
                rows={2}
                disabled={loading}
              />
            </div>

            <div>
              <Label htmlFor="trigger">Trigger / Activador *</Label>
              <Select
                value={formData.trigger_type}
                onValueChange={(val: any) =>
                  setFormData({ ...formData, trigger_type: val })
                }
              >
                <SelectTrigger id="trigger" disabled={loading}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CHATBOT_TRIGGER_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.trigger_type === 'keyword' && (
              <div>
                <Label>Palabras Clave</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={keywordInput}
                    onChange={e => setKeywordInput(e.target.value)}
                    placeholder="Escribe palabra clave..."
                    disabled={loading}
                    onKeyPress={e => e.key === 'Enter' && handleAddKeyword()}
                  />
                  <Button
                    onClick={handleAddKeyword}
                    size="sm"
                    disabled={loading || !keywordInput.trim()}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(formData.trigger_keywords || []).map(kw => (
                    <div
                      key={kw}
                      className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm flex items-center gap-2"
                    >
                      {kw}
                      <button
                        onClick={() => handleRemoveKeyword(kw)}
                        disabled={loading}
                        className="hover:bg-primary/20 rounded-full p-0.5"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {formData.trigger_type === 'after_delay' && (
              <div>
                <Label htmlFor="delay">Minutos de Retardo *</Label>
                <Input
                  id="delay"
                  type="number"
                  value={formData.trigger_delay_minutes || ''}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      trigger_delay_minutes: e.target.value ? parseInt(e.target.value) : undefined,
                    })
                  }
                  min="1"
                  disabled={loading}
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label htmlFor="pending-apt">Requiere cita pendiente</Label>
              <Switch
                id="pending-apt"
                checked={formData.condition_requires_pending_apt}
                onCheckedChange={checked =>
                  setFormData({ ...formData, condition_requires_pending_apt: checked })
                }
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
          </TabsContent>

          <TabsContent value="routing" className="space-y-4">
            <div>
              <Label htmlFor="goto">Siguiente paso por defecto</Label>
              <Select
                value={formData.goto_step_name || '_none_'}
                onValueChange={(val) =>
                  setFormData({ ...formData, goto_step_name: val === '_none_' ? '' : val })
                }
              >
                <SelectTrigger id="goto" disabled={loading}>
                  <SelectValue placeholder="Secuencial (siguiente paso)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none_">Secuencial (siguiente paso)</SelectItem>
                  {routeTargetSteps.map((s) => (
                    <SelectItem key={s.id} value={s.name}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Si no se configuran rutas por palabra clave, el chatbot irá a este paso
              </p>
            </div>

            {formData.trigger_type === 'keyword' && (formData.trigger_keywords || []).length > 0 && (
              <div>
                <Label>Rutas por Palabra Clave</Label>
                <p className="text-xs text-muted-foreground mb-3">
                  Configura a qué paso ir según la opción que elija el usuario. Si se deja en "Por defecto", usará el siguiente paso configurado arriba.
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {(formData.trigger_keywords || []).map((kw) => (
                    <div key={kw} className="flex items-center gap-2">
                      <span className="text-sm min-w-24 truncate shrink-0" title={kw}>
                        {kw}
                      </span>
                      <Select
                        value={formData.keyword_routes[kw] || '_default_'}
                        onValueChange={(val) => {
                          const newRoutes = { ...formData.keyword_routes }
                          if (val === '_default_') {
                            delete newRoutes[kw]
                          } else {
                            newRoutes[kw] = val
                          }
                          setFormData({ ...formData, keyword_routes: newRoutes })
                        }}
                      >
                        <SelectTrigger className="flex-1" disabled={loading}>
                          <SelectValue placeholder="Por defecto" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_default_">→ Por defecto</SelectItem>
                          {routeTargetSteps.map((s) => (
                            <SelectItem key={s.id} value={s.name}>
                              → {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="actions" className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                Las acciones de <strong>envío</strong> (Enviar Mensaje) se ejecutan al <em>entrar</em> al paso.
                Las acciones de <strong>lógica</strong> (Recopilar Info, Derivar a Agente) se ejecutan cuando el usuario responde.
              </p>

              {step ? (
                <>
                  {actionsLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : actions.length > 0 ? (
                    <div className="space-y-2 mb-4">
                      {actions
                        .sort((a, b) => a.action_number - b.action_number)
                        .map((act, idx) => (
                        <div
                          key={act.id}
                          className="flex items-center gap-2 rounded-lg border p-3 bg-muted/30"
                        >
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">
                              {CHATBOT_ACTION_LABELS[act.action_type] || act.action_type}
                            </p>
                            {act.message_template && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {act.message_template.substring(0, 60)}{act.message_template.length > 60 ? '...' : ''}
                              </p>
                            )}
                            {act.action_type === 'collect_info' && act.info_field_name && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Campo: <span className="font-medium">{act.info_field_name}</span>
                              </p>
                            )}
                            {!act.is_active && (
                              <p className="text-xs text-amber-500 mt-0.5">Desactivada</p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => {
                              setEditingAction(act)
                              setShowActionDialog(true)
                            }}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => handleDeleteAction(act.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4 mb-4">
                      No hay acciones configuradas
                    </p>
                  )}

                  <Button
                    onClick={() => {
                      setEditingAction(null)
                      setShowActionDialog(true)
                    }}
                    className="gap-2 w-full"
                    disabled={loading}
                  >
                    <Plus className="w-4 h-4" />
                    Agregar Acción
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Crea el paso primero para agregar acciones
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading || !formData.name}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {step ? 'Actualizar' : 'Crear'}
          </Button>
        </DialogFooter>
      </DialogContent>

      {step && (
        <ChatbotActionDialog
          open={showActionDialog}
          onOpenChange={setShowActionDialog}
          stepId={step.id}
          action={editingAction}
          onSaved={() => fetchActions(step.id)}
        />
      )}
    </Dialog>
  )
}
