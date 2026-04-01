'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ChatbotConfig, ChatbotStep } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Plus, GripVertical, Trash2, Eye, Play } from 'lucide-react'
import { ChatbotStepCard } from './chatbot-step-card'
import { ChatbotStepDialog } from './chatbot-step-dialog'
import { ChatbotPreview } from './chatbot-preview'

interface ChatbotEditorClientProps {
  config: ChatbotConfig
  initialSteps: ChatbotStep[]
}

export function ChatbotEditorClient({ config, initialSteps }: ChatbotEditorClientProps) {
  const router = useRouter()
  const [steps, setSteps] = useState<ChatbotStep[]>(initialSteps)
  const [showStepDialog, setShowStepDialog] = useState(false)
  const [selectedStep, setSelectedStep] = useState<ChatbotStep | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleAddStep = () => {
    setSelectedStep(null)
    setShowStepDialog(true)
  }

  const handleEditStep = (step: ChatbotStep) => {
    setSelectedStep(step)
    setShowStepDialog(true)
  }

  const handleSaveStep = async (formData: any) => {
    try {
      setLoading(true)
      if (selectedStep) {
        const res = await fetch(`/api/chatbot/steps/${selectedStep.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
        if (!res.ok) throw new Error('Failed to update step')
        const updated = await res.json()
        setSteps(s => s.map(step => step.id === updated.id ? updated : step))
      } else {
        const res = await fetch(`/api/chatbot/${config.id}/steps`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
        if (!res.ok) throw new Error('Failed to create step')
        const created = await res.json()
        setSteps(s => [...s, created])
      }
      setShowStepDialog(false)
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteStep = async (stepId: string) => {
    try {
      setLoading(true)
      const res = await fetch(`/api/chatbot/steps/${stepId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete step')
      setSteps(s => s.filter(step => step.id !== stepId))
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/dashboard/admin/chatbot')}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{config.name}</h1>
            <p className="text-sm text-muted-foreground">
              {config.description || 'Sin descripción'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={config.is_active ? 'default' : 'outline'}>
            {config.is_active ? 'Activo' : 'Inactivo'}
          </Badge>
          <Button
            variant="outline"
            onClick={() => setShowPreview(true)}
            className="gap-2"
          >
            <Eye className="w-4 h-4" />
            Vista Previa
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Información general */}
        <Card>
          <CardHeader>
            <CardTitle>Información del Chatbot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {config.welcome_message && (
              <div>
                <p className="text-sm font-medium mb-2">Mensaje de Bienvenida</p>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                  {config.welcome_message}
                </p>
              </div>
            )}
            {config.fallback_message && (
              <div>
                <p className="text-sm font-medium mb-2">Mensaje por Defecto</p>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                  {config.fallback_message}
                </p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium mb-2">Reintentos Máximos</p>
              <p className="text-sm text-muted-foreground">{config.max_retries} intentos</p>
            </div>
          </CardContent>
        </Card>

        {/* Pasos */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Pasos del Flujo</h2>
            <Button onClick={handleAddStep} className="gap-2">
              <Plus className="w-4 h-4" />
              Agregar Paso
            </Button>
          </div>

          {steps.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <h3 className="font-semibold mb-2">Sin pasos configurados</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Agrega pasos para automatizar las respuestas del agente
                </p>
                <Button onClick={handleAddStep} variant="outline" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Crear Paso
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {steps.map((step, index) => (
                <ChatbotStepCard
                  key={step.id}
                  step={step}
                  stepIndex={index}
                  onEdit={() => handleEditStep(step)}
                  onDelete={() => handleDeleteStep(step.id)}
                  loading={loading}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <ChatbotStepDialog
        open={showStepDialog}
        onOpenChange={setShowStepDialog}
        step={selectedStep}
        allSteps={steps}
        onSave={handleSaveStep}
        loading={loading}
      />

      <ChatbotPreview
        open={showPreview}
        onOpenChange={setShowPreview}
        config={config}
        steps={steps}
      />
    </div>
  )
}
