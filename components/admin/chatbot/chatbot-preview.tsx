'use client'

import type { ChatbotConfig, ChatbotStep } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronRight, MessageCircle } from 'lucide-react'
import { CHATBOT_TRIGGER_LABELS, CHATBOT_ACTION_LABELS } from '@/lib/types'

interface ChatbotPreviewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: ChatbotConfig
  steps: ChatbotStep[]
}

export function ChatbotPreview({
  open,
  onOpenChange,
  config,
  steps,
}: ChatbotPreviewProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vista Previa del Flujo</DialogTitle>
          <DialogDescription>
            Visualiza cómo funcionará el chatbot
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Información general */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{config.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {config.welcome_message && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Bienvenida</p>
                  <div className="bg-primary/5 border border-primary/20 p-3 rounded text-sm">
                    💬 {config.welcome_message}
                  </div>
                </div>
              )}
              {config.fallback_message && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Mensaje por defecto</p>
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded text-sm">
                    ⚠️ {config.fallback_message}
                  </div>
                </div>
              )}
              {config.escalation_message && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Escalación</p>
                  <div className="bg-red-50 border border-red-200 p-3 rounded text-sm">
                    🔴 {config.escalation_message}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pasos */}
          {steps.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Sin pasos configurados
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium">Flujo de Pasos ({steps.length})</p>
              {steps.map((step, idx) => (
                <div key={step.id} className="space-y-2">
                  {idx > 0 && (
                    <div className="flex justify-center">
                      <ChevronRight className="w-5 h-5 text-muted-foreground rotate-90" />
                    </div>
                  )}
                  <Card className={!step.is_active ? 'opacity-50' : ''}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-sm">
                            Paso {idx + 1}: {step.name}
                          </CardTitle>
                          {step.description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {step.description}
                            </p>
                          )}
                        </div>
                        <Badge variant={step.is_active ? 'default' : 'outline'} className="text-xs">
                          {CHATBOT_TRIGGER_LABELS[step.trigger_type]}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {/* Trigger */}
                      <div className="text-xs">
                        <p className="font-medium text-muted-foreground mb-1">Trigger:</p>
                        <div className="bg-muted p-2 rounded">
                          {step.trigger_type === 'keyword' && step.trigger_keywords?.length ? (
                            <p>
                              Cuando el usuario escriba:{' '}
                              <strong>{step.trigger_keywords.join(' o ')}</strong>
                            </p>
                          ) : step.trigger_type === 'after_delay' ? (
                            <p>
                              Después de <strong>{step.trigger_delay_minutes} minutos</strong> sin
                              respuesta
                            </p>
                          ) : step.trigger_type === 'has_pending_appointment' ? (
                            <p>Cuando el usuario tenga cita pendiente</p>
                          ) : step.trigger_type === 'new_patient' ? (
                            <p>Cuando sea un paciente nuevo</p>
                          ) : (
                            <p>Al recibir un mensaje</p>
                          )}
                        </div>
                      </div>

                      {/* Acciones */}
                      {step.actions && step.actions.length > 0 && (
                        <div className="text-xs">
                          <p className="font-medium text-muted-foreground mb-1">
                            Acciones ({step.actions.length}):
                          </p>
                          <div className="space-y-2">
                            {step.actions.map((action, actionIdx) => (
                              <div
                                key={action.id}
                                className="bg-blue-50 border border-blue-200 p-2 rounded"
                              >
                                <div className="flex items-start gap-2">
                                  <span className="bg-blue-200 text-blue-900 px-2 py-0.5 rounded text-xs font-semibold">
                                    {actionIdx + 1}
                                  </span>
                                  <div className="flex-1">
                                    <p className="font-medium">
                                      {CHATBOT_ACTION_LABELS[action.action_type]}
                                    </p>
                                    {action.message_template && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        "{action.message_template}"
                                      </p>
                                    )}
                                    {action.delay_seconds ? (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        ⏱️ Con retardo de {action.delay_seconds}s
                                      </p>
                                    ) : null}
                                    {action.redirect_to_agent && (
                                      <p className="text-xs text-red-600 mt-1 font-medium">
                                        → Derivará a un agente
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {step.condition_requires_pending_apt && (
                        <div className="text-xs bg-yellow-50 border border-yellow-200 p-2 rounded">
                          <p className="font-medium">
                            ⚠️ Solo se ejecuta si hay cita pendiente
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          )}

          {/* Información útil */}
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-2 text-muted-foreground">
              <p>
                • Los pasos se ejecutan secuencialmente según el trigger configurado
              </p>
              <p>{"• Usa variables como {{nombre}}, {{email}}, {{telefono}} en los mensajes"}</p>
              <p>
                • Si no se cumple el trigger, se ejecutará el mensaje por defecto
              </p>
              <p>
                • Después de {config.max_retries} intentos sin éxito, se escalará a un agente
              </p>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}
