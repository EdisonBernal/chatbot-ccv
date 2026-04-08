'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import type { Conversation, ConversationMessage, ConversationStatus, Patient } from '@/lib/types'
import {
  CONVERSATION_STATUS_LABELS,
  CONVERSATION_STATUS_COLORS,
} from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import {
  ArrowLeft, Phone, User, Send, MessageSquare, Clock,
} from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { AudioPlayer } from '@/components/conversations/audio-player'

interface ConversationDetailClientProps {
  conversation: Conversation
  messages: ConversationMessage[]
  currentUserId: string
  patients: Patient[]
}

export function ConversationDetailClient({
  conversation: initialConv,
  messages: initialMessages,
  currentUserId,
  patients,
}: ConversationDetailClientProps) {
  const [conversation, setConversation] = useState(initialConv)
  const [messages, setMessages] = useState(initialMessages)
  const [reply, setReply] = useState('')
  const [isPending, startTransition] = useTransition()
  const [isSending, startSending] = useTransition()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Mark as read when component mounts or messages change
  useEffect(() => {
    if (conversation.whatsapp_number && messages.length > 0) {
      fetch(`/api/conversations/${conversation.id}/read`, { method: 'POST' }).catch(() => {})
    }
  }, [conversation.whatsapp_number, conversation.id, messages.length])

  const handleStatusChange = (newStatus: ConversationStatus) => {
    startTransition(async () => {
      const res = await fetch(`/api/conversations/${conversation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        setConversation((prev) => ({ ...prev, status: newStatus }))
        toast.success(`Estado actualizado a "${CONVERSATION_STATUS_LABELS[newStatus]}".`)
      } else {
        toast.error('Error al actualizar el estado.')
      }
    })
  }

  const handleSendReply = () => {
    if (!reply.trim()) return
    startSending(async () => {
      const res = await fetch(`/api/conversations/${conversation.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: reply.trim() }),
      })
      if (res.ok) {
        const newMsg: ConversationMessage = await res.json()
        setMessages((prev) => [...prev, newMsg])
        setReply('')
        toast.success('Mensaje enviado.')
      } else {
        toast.error('Error al enviar el mensaje.')
      }
    })
  }

  const handleLinkPatient = (patientId: string) => {
    startTransition(async () => {
      const res = await fetch(`/api/conversations/${conversation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: patientId || null }),
      })
      if (res.ok) {
        const linkedPatient = patients.find((p) => p.id === patientId) ?? undefined
        setConversation((prev) => ({ ...prev, patient_id: patientId || null, patient: linkedPatient }))
        toast.success('Paciente vinculado.')
      } else {
        toast.error('Error al vincular el paciente.')
      }
    })
  }

  return (
    <div className="flex flex-col gap-4 p-6 h-[calc(100vh-4rem)] max-w-6xl">
      {/* Back */}
      <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-2 w-fit">
        <Link href="/dashboard/conversations">
          <ArrowLeft className="w-4 h-4" />
          Volver
        </Link>
      </Button>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">
            {conversation.patient?.full_name ?? conversation.whatsapp_number}
          </h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="w-3.5 h-3.5" />
            {conversation.whatsapp_number}
          </div>
        </div>
        <Badge
          variant="outline"
          className={`text-sm px-3 py-1 ${CONVERSATION_STATUS_COLORS[conversation.status]}`}
        >
          {CONVERSATION_STATUS_LABELS[conversation.status]}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 min-h-0">
        {/* Chat column */}
        <div className="md:col-span-2 flex flex-col gap-3 min-h-0">
          <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader className="pb-2 shrink-0">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-muted-foreground" />
                Mensajes ({messages.length})
              </CardTitle>
            </CardHeader>
            <Separator />
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {messages.length === 0 && (
                <p className="text-sm text-muted-foreground text-center mt-8">
                  Sin mensajes aún.
                </p>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'flex flex-col gap-0.5 max-w-4/5',
                    msg.sender_type === 'staff' ? 'ml-auto items-end' : 'mr-auto items-start'
                  )}
                >
                  <div
                    className={cn(
                      'rounded-2xl px-4 py-2.5 text-sm',
                      msg.sender_type === 'staff'
                        ? 'bg-primary text-primary-foreground rounded-tr-sm'
                        : 'bg-muted text-foreground rounded-tl-sm'
                    )}
                  >
                    {msg.media_url && (msg.media_type === 'audio' || msg.media_url.match(/\.(ogg|mp3|m4a|wav|webm|amr|opus)(\?|$)/i)) ? (
                      <div className="mb-1">
                        <AudioPlayer
                          src={msg.media_url}
                          isStaff={msg.sender_type === 'staff'}
                          onPlayed={msg.sender_type === 'patient' && msg.id ? () => {
                            fetch(`/api/conversations/${conversation.id}/played`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ messageId: msg.id }),
                            }).catch(() => {})
                          } : undefined}
                        />
                      </div>
                    ) : msg.media_url ? (
                      <img
                        src={msg.media_url}
                        alt="Imagen adjunta"
                        className="max-w-full rounded mb-1 cursor-pointer"
                        onClick={() => window.open(msg.media_url!, '_blank')}
                      />
                    ) : null}
                    {msg.message_text && !(msg.media_url && (msg.media_type === 'audio' || msg.media_url.match(/\.(ogg|mp3|m4a|wav|webm|amr|opus)(\?|$)/i)) && msg.message_text === '🎤 Audio') && (
                      <p>{msg.message_text}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground px-1">
                    {format(new Date(msg.created_at), 'd MMM, HH:mm', { locale: es })}
                  </span>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <Separator />
            <div className="p-3 flex gap-2 shrink-0">
              <Textarea
                placeholder="Escribe un mensaje..."
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={2}
                className="resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSendReply()
                }}
              />
              <Button
                size="icon"
                onClick={handleSendReply}
                disabled={!reply.trim() || isSending}
                className="shrink-0 self-end"
              >
                {isSending ? <Spinner /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </Card>
        </div>

        {/* Right panel */}
        <div className="flex flex-col gap-4">
          {/* Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                Estado de la conversación
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Select
                value={conversation.status}
                onValueChange={(v) => handleStatusChange(v as ConversationStatus)}
                disabled={isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nueva">Nueva</SelectItem>
                  <SelectItem value="en_atencion">En atención</SelectItem>
                  <SelectItem value="resuelta">Resuelta</SelectItem>
                  <SelectItem value="archivada">Archivada</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Patient */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                Paciente vinculado
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Select
                value={conversation.patient_id ?? 'none'}
                onValueChange={(v) => handleLinkPatient(v === 'none' ? '' : v)}
                disabled={isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vincular paciente..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin vincular</SelectItem>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {conversation.patient && (
                <div className="flex flex-col gap-0.5 text-xs text-muted-foreground mt-1">
                  <span>CC {conversation.patient.document_number}</span>
                  <span>{conversation.patient.phone_number}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
