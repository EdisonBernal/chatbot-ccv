'use client'

import type { ChatbotStep } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Edit, Trash2, GripVertical, AlertCircle } from 'lucide-react'
import { CHATBOT_TRIGGER_LABELS } from '@/lib/types'

interface ChatbotStepCardProps {
  step: ChatbotStep
  stepIndex: number
  onEdit: () => void
  onDelete: () => void
  loading: boolean
}

export function ChatbotStepCard({
  step,
  stepIndex,
  onEdit,
  onDelete,
  loading,
}: ChatbotStepCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-semibold text-sm">
              {stepIndex + 1}
            </div>
            <div className="flex-1">
              <CardTitle className="text-base">{step.name}</CardTitle>
              {step.description && (
                <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
              )}
              <div className="flex items-center gap-2 mt-3">
                <Badge variant="outline" className="text-xs">
                  {CHATBOT_TRIGGER_LABELS[step.trigger_type]}
                </Badge>
                {step.trigger_keywords && step.trigger_keywords.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {step.trigger_keywords.join(', ')}
                  </div>
                )}
                {step.trigger_delay_minutes && (
                  <Badge variant="secondary" className="text-xs">
                    {step.trigger_delay_minutes} min
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              disabled={loading}
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              disabled={loading}
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {step.actions && step.actions.length > 0 && (
        <CardContent className="py-3 border-t space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Acciones:</p>
          {step.actions.map((action, idx) => (
            <div key={action.id} className="text-xs bg-muted p-2 rounded flex items-center gap-2">
              <span className="bg-primary/20 text-primary px-2 py-1 rounded text-xs font-medium">
                {idx + 1}
              </span>
              <span className="text-muted-foreground">{action.action_type}</span>
              {action.message_template && (
                <span className="text-xs text-muted-foreground truncate">
                  "{action.message_template.substring(0, 30)}..."
                </span>
              )}
            </div>
          ))}
        </CardContent>
      )}

      {(step.goto_step_name || (step.keyword_routes && Object.keys(step.keyword_routes).length > 0)) && (
        <CardContent className="py-3 border-t space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Enrutamiento:</p>
          {step.goto_step_name && (
            <p className="text-xs text-muted-foreground">
              → Por defecto: <span className="text-primary font-medium">{step.goto_step_name}</span>
            </p>
          )}
          {step.keyword_routes && Object.entries(step.keyword_routes).map(([kw, target]) => (
            <p key={kw} className="text-xs text-muted-foreground">
              "{kw}" → <span className="text-primary font-medium">{target}</span>
            </p>
          ))}
        </CardContent>
      )}

      {!step.is_active && (
        <CardContent className="py-2 border-t bg-muted/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertCircle className="w-3 h-3" />
            Paso desactivado
          </div>
        </CardContent>
      )}
    </Card>
  )
}
