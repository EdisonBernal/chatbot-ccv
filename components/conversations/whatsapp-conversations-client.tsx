 'use client'

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import type { Conversation, ConversationMessage } from '@/lib/types'
import { CONVERSATION_STATUS_LABELS, CONVERSATION_STATUS_COLORS } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Search,
  Send,
  Phone,
  Clock,
  MoreVertical,
  Dot,
  ArrowLeft,
  UserCircle,
  RefreshCw,
  XCircle,
  ClipboardList,
  Copy,
  Check,
  LogOut,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/client'
import { useTwilioConversations } from '@/hooks/use-twilio-conversations'
interface WhatsAppConversationsClientProps {
  initialConversations: Conversation[]
}

export function WhatsAppConversationsClient({
  initialConversations,
}: WhatsAppConversationsClientProps) {
  // Helper to dedupe arrays of items with `id` while preserving order
  const dedupeById = <T extends { id: string }>(items: T[]): T[] => {
    const seen = new Set<string>()
    const out: T[] = []
    for (const it of items) {
      if (!it || !it.id) continue
      if (seen.has(it.id)) continue
      seen.add(it.id)
      out.push(it)
    }
    return out
  }

  const extractBroadcastMessage = (raw: any) => {
    if (!raw) return null
    return (
      raw.new ??
      raw.record ??
      raw.payload?.record ??
      raw.payload ??
      raw.messages?.[0]?.payload?.record ??
      raw.messages?.[0]?.payload ??
      raw.messages?.[0] ??
      raw
    )
  }

  const [conversations, setConversations] = useState<Conversation[]>(initialConversations)
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [search, setSearch] = useState('')
  const [reply, setReply] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [contextData, setContextData] = useState<Record<string, string>>({})
  const [isLoadingContext, setIsLoadingContext] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const lastMessageRef = useRef<HTMLDivElement>(null)
  const selectedConversationRef = useRef<Conversation | null>(null)

  // Twilio Conversations SDK: handles Read Horizon + delivery status updates
  const handleMessageUpdated = useCallback((messageSid: string, status: string) => {
    // Update the delivery_status of the matching message in our local state
    setMessages((prev) =>
      prev.map((m) =>
        m.twilio_sid === messageSid
          ? { ...m, delivery_status: status as any }
          : m
      )
    )
  }, [])

  const { advanceReadHorizon, isConnected: isTwilioConnected } = useTwilioConversations({
    conversationId: selectedConversation?.id ?? null,
    enabled: !!selectedConversation?.whatsapp_number,
    onMessageUpdated: handleMessageUpdated,
  })

  // Scroll automático cuando hay nuevos mensajes
  const performScrollToBottom = () => {
    let container = messagesContainerRef.current

    if (!container) {
      container = document.querySelector<HTMLDivElement>('.overflow-y-auto.p-4.flex.flex-col.gap-3') || null
    }

    if (container) {
      container.scrollTop = container.scrollHeight
      return
    }

    if (lastMessageRef.current) {
      lastMessageRef.current.scrollIntoView({ behavior: 'auto', block: 'end' })
      return
    }

    bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' })
  }

  const scheduleScrollToBottom = () => {
    performScrollToBottom()
    window.requestAnimationFrame(performScrollToBottom)
    window.setTimeout(performScrollToBottom, 30)
    window.setTimeout(performScrollToBottom, 80)
    window.setTimeout(performScrollToBottom, 150)
    window.setTimeout(performScrollToBottom, 300)
    window.setTimeout(performScrollToBottom, 500)
    window.setTimeout(performScrollToBottom, 700)
  }

  useLayoutEffect(() => {
    if (!selectedConversation || messages.length === 0) return
    scheduleScrollToBottom()
  }, [selectedConversation?.id, messages.length])

  // Fallback in case the layout kicks later (e.g., image heights, font load)
  useEffect(() => {
    if (!selectedConversation || messages.length === 0) return
    scheduleScrollToBottom()
    const fallbackTimeout = window.setTimeout(() => {
      scheduleScrollToBottom()
    }, 60)
    const longTimeout = window.setTimeout(() => {
      scheduleScrollToBottom()
    }, 400)
    return () => {
      window.clearTimeout(fallbackTimeout)
      window.clearTimeout(longTimeout)
    }
  }, [selectedConversation?.id, messages.length])

  useEffect(() => {
    if (messages.length === 0) return
    scheduleScrollToBottom()
  }, [messages])

  // Suscripción realtime para nuevos mensajes (actualiza la UI automáticamente)
  // keep a ref updated for the selected conversation so the subscription
  // handler can append incoming messages without recreating the channel.
  useEffect(() => {
    selectedConversationRef.current = selectedConversation
  }, [selectedConversation])

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()

    

    // Use Broadcast instead of Postgres changes: subscribe to a global topic
    // for conversation previews and, when a convo is selected, subscribe to
    // a per-conversation private topic to receive its messages.

    // Ensure Realtime Authorization is set (will use current auth session)
    // Wrap async call in IIFE because useEffect callback cannot be async
    ;(async () => {
      try {
        // setAuth is async; call and ignore if not available
        // @ts-ignore
        if (supabase.realtime?.setAuth) await supabase.realtime.setAuth()
      } catch (e) {
        // ignore
      }
    })()

    // We'll create channels only after ensuring Realtime Authorization
    let globalChannel: any = null
    let perConvChannel: any = null

    const subscribeToConversation = (conversationId?: string | null) => {
      try {
        if (perConvChannel) {
          supabase.removeChannel(perConvChannel)
          perConvChannel = null
        }

        if (!conversationId) return

        const topic = `topic:conversation:${conversationId}`
        perConvChannel = supabase
          .channel(topic, { config: { private: true } })
          .on('broadcast', { event: 'INSERT' }, (payload) => {
            const raw: any = payload || {}
            const msg = extractBroadcastMessage(raw)
            const sel = selectedConversationRef.current
            if (msg && sel && msg.conversation_id === sel.id) {
              setMessages((prev) => {
                try {
                  if (!msg.id) return prev
                  const idx = prev.findIndex((m) => m.id === msg.id)
                  if (idx !== -1) {
                    const updated = [...prev]
                    updated[idx] = { ...updated[idx], ...msg }
                    return updated
                  }
                  
                  const updated = dedupeById([...prev, msg])
                  window.setTimeout(() => scheduleScrollToBottom(), 25)
                  return updated
                } catch (e) {
                  return prev
                }
              })
            }
          })
          .on('broadcast', { event: 'UPDATE' }, (payload) => {
            const raw: any = payload || {}
            const msg = extractBroadcastMessage(raw)
            const sel = selectedConversationRef.current
            
            if (msg && sel && msg.conversation_id === sel.id) {
              setMessages((prev) => {
                try {
                  if (!msg.id) return prev
                  const idx = prev.findIndex((m) => m.id === msg.id)
                  if (idx !== -1) {
                    const updated = [...prev]
                    updated[idx] = { ...updated[idx], ...msg }
                    return updated
                  }
                  
                  const updated = dedupeById([...prev, msg])
                  window.setTimeout(() => scheduleScrollToBottom(), 25)
                  return updated
                } catch (e) {
                  return prev
                }
              })
            }
          })
          .subscribe(() => {})
      } catch (e) {
        console.warn('[realtime] subscribeToConversation error', e)
      }
    }

    ;(async () => {
      try {
        // Try to get the current session token and call setAuth with it
        let token: string | null = null
        try {
          const sess = await (supabase.auth.getSession ? supabase.auth.getSession() : Promise.resolve(null))
          token = sess?.data?.session?.access_token ?? null
        } catch (e) {
          // ignore
        }

          try {
            // @ts-ignore
            if (supabase.realtime?.setAuth) {
              if (token) await supabase.realtime.setAuth(token)
              else await supabase.realtime.setAuth()
            }
          } catch (e) {
            // ignore
          }
        globalChannel = supabase
          .channel('topic:conversations', { config: { private: true } })
          .on('broadcast', { event: 'INSERT' }, (payload) => {
            const raw: any = payload || {}
            const msg = extractBroadcastMessage(raw)
            
            if (!msg || !msg.conversation_id) return
            setConversations((prev) => {
              try {
                const updated = prev.map((c) =>
                  c.id === msg.conversation_id
                    ? { ...c, last_message: msg.message_text, last_message_at: msg.created_at }
                    : c
                )
                const idx = updated.findIndex((c) => c.id === msg.conversation_id)
                if (idx === -1) return updated
                const [conv] = updated.splice(idx, 1)

                // Only increment unread_count for incoming (patient) messages
                // and only if this conversation is not currently selected/open.
                if (msg.sender_type === 'patient' && selectedConversationRef.current?.id !== msg.conversation_id) {
                  conv.unread_count = (conv.unread_count || 0) + 1
                }

                return [conv, ...updated]
              } catch (e) {
                return prev
              }
            })
          })
          .on('broadcast', { event: 'UPDATE' }, (payload) => {
            const raw: any = payload || {}
            const msg = extractBroadcastMessage(raw)
            
            if (!msg || !msg.conversation_id) return
            setConversations((prev) => {
              try {
                const updated = prev.map((c) =>
                  c.id === msg.conversation_id
                    ? { ...c, last_message: msg.message_text, last_message_at: msg.created_at }
                    : c
                )
                const idx = updated.findIndex((c) => c.id === msg.conversation_id)
                if (idx === -1) return updated
                const [conv] = updated.splice(idx, 1)

                if (msg.sender_type === 'patient' && selectedConversationRef.current?.id !== msg.conversation_id) {
                  conv.unread_count = (conv.unread_count || 0) + 1
                }

                return [conv, ...updated]
              } catch (e) {
                return prev
              }
            })
          })
          .subscribe(() => {})

        // Subscribe to currently selected conversation (if any)
        subscribeToConversation(selectedConversationRef.current?.id)
      } catch (e) {
        // ignore
      }
    })()

    return () => {
      try {
        if (perConvChannel) {
          try { supabase.removeChannel(perConvChannel) } catch (e) { /* ignore */ }
        }
        if (globalChannel) {
          try { supabase.removeChannel(globalChannel) } catch (e) { /* ignore */ }
        }
      } catch (e) {
        /* ignore */
      }
    }
  }, [])

  // When the selected conversation changes, subscribe/unsubscribe to its topic
  useEffect(() => {
    // Use the exposed window client if available to manage channels created earlier
    try {
      const supabase = createBrowserSupabaseClient()
      // If setAuth exists, ensure it's called so private broadcast channels work
      // @ts-ignore
      if (supabase.realtime?.setAuth) supabase.realtime.setAuth().catch(() => {})
      // Remove previous per-conv channel and subscribe to new one via same logic
      // (createBrowserSupabaseClient returns same singleton when used in the app)
      const topic = selectedConversation ? `topic:conversation:${selectedConversation.id}` : null
      // create a short-lived channel for the selected conversation; the mount effect
      // already manages global channel.
      if (topic) {
        const ch = supabase.channel(topic, { config: { private: true } })
          .on('broadcast', { event: 'INSERT' }, (payload) => {
            const raw: any = payload || {}
            const msg = extractBroadcastMessage(raw)
            const sel = selectedConversationRef.current
            if (msg && sel && msg.conversation_id === sel.id) {
              setMessages((prev) => {
                try {
                  if (!msg.id) return prev
                  const idx = prev.findIndex((m) => m.id === msg.id)
                  if (idx !== -1) {
                    const updated = [...prev]
                    updated[idx] = { ...updated[idx], ...msg }
                    return updated
                  }
                  const updated = dedupeById([...prev, msg])
                  window.setTimeout(() => scheduleScrollToBottom(), 10)
                  return updated
                } catch (e) {
                  return prev
                }
              })
            }
          })
          .on('broadcast', { event: 'UPDATE' }, (payload) => {
            const raw: any = payload || {}
            const msg = extractBroadcastMessage(raw)
            const sel = selectedConversationRef.current
            if (msg && sel && msg.conversation_id === sel.id) {
              setMessages((prev) => {
                try {
                  if (!msg.id) return prev
                  const idx = prev.findIndex((m) => m.id === msg.id)
                  if (idx !== -1) {
                    const updated = [...prev]
                    updated[idx] = { ...updated[idx], ...msg }
                    return updated
                  }
                  const updated = dedupeById([...prev, msg])
                  window.setTimeout(() => scheduleScrollToBottom(), 10)
                  return updated
                } catch (e) {
                  return prev
                }
              })
            }
          })
          .subscribe(() => {})

        return () => {
          try { supabase.removeChannel(ch) } catch (e) { }
        }
      }
    } catch (e) {
      // ignore
    }
  }, [selectedConversation])

  // Note: polling removed — using Supabase Realtime WebSocket subscription instead.

  // Note: polling removed — conversation previews are updated via Realtime subscription.

  // Handler: cambiar estado de conversación
  const handleStatusChange = async (newStatus: string, label: string) => {
    if (!selectedConversation) return
    const convId = selectedConversation.id
    try {
      const res = await fetch(`/api/conversations/${convId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        setSelectedConversation((prev) => prev ? { ...prev, status: newStatus as any } : prev)
        setConversations((prev) =>
          prev.map((c) => c.id === convId ? { ...c, status: newStatus as any } : c)
        )
        toast.success(`Estado cambiado a "${label}"`)
      } else {
        toast.error('Error al cambiar el estado')
      }
    } catch {
      toast.error('Error al cambiar el estado')
    }
  }

  // Handler: cerrar conversación
  const handleCloseConversation = async () => {
    if (!selectedConversation) return
    const convId = selectedConversation.id
    try {
      const res = await fetch(`/api/conversations/${convId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cerrada' }),
      })
      if (res.ok) {
        setSelectedConversation((prev) => prev ? { ...prev, status: 'cerrada' } : prev)
        setConversations((prev) =>
          prev.map((c) => c.id === convId ? { ...c, status: 'cerrada' as any } : c)
        )
        // Limpiar sesión del chatbot para que reinicie con bienvenida
        await fetch(`/api/conversations/${convId}/context`, { method: 'DELETE' }).catch(() => {})
        toast.success('Conversación cerrada')
      } else {
        toast.error('Error al cerrar la conversación')
      }
    } catch {
      toast.error('Error al cerrar la conversación')
    }
  }

  // Cargar datos recopilados del chatbot
  const loadContextData = async () => {
    if (!selectedConversation) return
    setIsLoadingContext(true)
    try {
      const res = await fetch(`/api/conversations/${selectedConversation.id}/context`)
      if (res.ok) {
        const data = await res.json()
        setContextData(data)
      }
    } catch {
      toast.error('Error al cargar datos')
    } finally {
      setIsLoadingContext(false)
    }
  }

  // Copiar dato al portapapeles
  const handleCopyValue = (key: string, value: string) => {
    navigator.clipboard.writeText(value)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  // Filtrar conversaciones por búsqueda
  const filtered = conversations.filter((c) =>
    c.patient?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.whatsapp_number.includes(search)
  )

  // Cargar mensajes cuando se selecciona una conversación
  const handleSelectConversation = async (conv: Conversation) => {
    setIsLoadingMessages(true)
    try {
      const res = await fetch(`/api/conversations/${conv.id}/messages`)
      if (res.ok) {
        const msgs = await res.json()
        setMessages(msgs)
        setSelectedConversation(conv)

        // Marcar mensajes como leídos (para chulitos de lectura)
        await fetch(`/api/conversations/${conv.id}/read`, { method: 'POST' })

        // Advance Read Horizon via SDK (triggers blue checks on WhatsApp)
        // This will fire once the hook connects; also call it explicitly
        advanceReadHorizon()

        // Optimistic update: mark staff messages as read locally so ticks turn blue immediately
        setMessages((prev) => prev.map((m) => (m.sender_type === 'staff' ? { ...m, delivery_status: 'read' } : m)))

        scheduleScrollToBottom()

        // Actualizar last_view_at
        await fetch(`/api/conversations/${conv.id}/view`, { method: 'POST' })
        // Actualizar la conversación en la lista
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conv.id
              ? { ...c, last_view_at: new Date().toISOString(), unread_count: 0 }
              : c
          )
        )
      }
    } catch (error) {
      console.error('Error loading messages:', error)
      toast.error('Error al cargar los mensajes')
    } finally {
      setIsLoadingMessages(false)
    }
  }

  // Enviar respuesta
  const handleSendReply = async () => {
    if (!reply.trim() || !selectedConversation) return
    setIsSending(true)
    try {
      const res = await fetch(`/api/conversations/${selectedConversation.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: reply.trim() }),
      })
      if (res.ok) {
        const newMsg = await res.json()
        setMessages((prev) => dedupeById([...prev, newMsg]))
        setReply('')

        toast.success('Mensaje enviado')
      } else {
        toast.error('Error al enviar el mensaje')
      }
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Error al enviar el mensaje')
    } finally {
      setIsSending(false)
    }
  }

  // Verificar si hay mensajes nuevos (last_view_at < last_message_at)
  const hasNewMessages = (conv: Conversation) => {
    if (!conv.last_message_at) return false
    if (!conv.last_view_at) return true
    return new Date(conv.last_message_at) > new Date(conv.last_view_at)
  }

  return (
    <div className="flex h-[calc(100vh-6rem)] gap-0 overflow-hidden rounded-lg border border-border bg-card">
      {/* Lista de conversaciones - Izquierda */}
      <div
        className={cn(
          'flex flex-col border-r border-border transition-all duration-300',
          selectedConversation ? 'hidden md:flex md:w-80' : 'w-full md:w-80'
        )}
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between gap-2">
          <h2 className="font-semibold text-foreground">Mensajes</h2>
          <Badge variant="secondary" className="text-xs">
            {conversations.length}
          </Badge>
        </div>

        {/* Búsqueda */}
        <div className="px-3 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              className="pl-8 text-sm h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Lista de conversaciones */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {conversations.length === 0
                ? 'Sin conversaciones aún'
                : 'No hay resultados de búsqueda'}
            </div>
          ) : (
            filtered.map((conv) => {
              const isNew = hasNewMessages(conv)
              const unread = conv.unread_count ?? (isNew ? 1 : 0)
              const unreadLabel = unread > 99 ? '99+' : String(unread)
              return (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className={cn(
                    'w-full px-3 py-3 border-b border-border text-left hover:bg-muted/50 transition-colors',
                    selectedConversation?.id === conv.id && 'bg-primary/10'
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <p className={cn('text-sm truncate', isNew && 'font-semibold')}>
                        {conv.patient?.full_name || conv.whatsapp_number}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {conv.last_message_at
                          ? formatDistanceToNow(new Date(conv.last_message_at), {
                              addSuffix: false,
                              locale: es,
                            })
                          : '—'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                  <p
                    className={cn(
                      'text-xs truncate flex-1',
                      isNew ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {conv.last_message || 'Sin mensajes'}
                  </p>
                  {unread > 0 && (
                    <span className="min-w-5 h-5 px-1 rounded-full bg-green-500 text-white text-xs font-medium flex items-center justify-center">
                      {unreadLabel}
                    </span>
                  )}
                </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Chat detallado - Derecha */}
      {selectedConversation ? (
        <div className="flex flex-col flex-1">
          {/* Header del chat */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
            <div className="flex items-center gap-3 flex-1">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-8 w-8"
                onClick={() => setSelectedConversation(null)}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <p className="text-sm font-semibold">
                  {selectedConversation.patient?.full_name || selectedConversation.whatsapp_number}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Phone className="w-3 h-3" />
                  {selectedConversation.whatsapp_number}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`text-xs ${CONVERSATION_STATUS_COLORS[selectedConversation.status]}`}
              >
                {CONVERSATION_STATUS_LABELS[selectedConversation.status]}
              </Badge>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Datos recopilados" onClick={loadContextData}>
                    <ClipboardList className="w-4 h-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-80 sm:w-96">
                  <SheetHeader>
                    <SheetTitle>Datos recopilados</SheetTitle>
                  </SheetHeader>
                  <div className="mt-4 space-y-3">
                    {isLoadingContext ? (
                      <div className="flex justify-center py-8">
                        <Spinner className="w-5 h-5" />
                      </div>
                    ) : Object.keys(contextData).length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No hay datos recopilados aún
                      </p>
                    ) : (
                      Object.entries(contextData).map(([key, value]) => (
                        <div key={key} className="flex items-start gap-2 rounded-lg border p-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-muted-foreground capitalize">
                              {key.replace(/_/g, ' ')}
                            </p>
                            <p className="text-sm mt-0.5 wrap-break-word">{value}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => handleCopyValue(key, value)}
                          >
                            {copiedKey === key ? (
                              <Check className="w-3.5 h-3.5 text-green-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </SheetContent>
              </Sheet>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Cambiar estado
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {(Object.entries(CONVERSATION_STATUS_LABELS) as [string, string][]).map(([value, label]) => (
                        <DropdownMenuItem
                          key={value}
                          disabled={selectedConversation.status === value}
                          onSelect={() => handleStatusChange(value, label)}
                        >
                          <span className={`inline-block w-2 h-2 rounded-full mr-2 ${value === 'nueva' ? 'bg-blue-500' : value === 'en_atencion' ? 'bg-amber-500' : 'bg-gray-400'}`} />
                          {label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                  {selectedConversation.patient_id && (
                    <DropdownMenuItem
                      onSelect={() => {
                        window.open(`/dashboard/patients/${selectedConversation.patient_id}`, '_blank')
                      }}
                    >
                      <UserCircle className="w-4 h-4 mr-2" />
                      Ver paciente
                    </DropdownMenuItem>
                  )}
                  {selectedConversation.status !== 'cerrada' && (
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={handleCloseConversation}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Cerrar conversación
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => setSelectedConversation(null)}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Salir del chat
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Mensajes */}
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-background">
            {isLoadingMessages ? (
              <div className="flex items-center justify-center h-full">
                <Spinner className="w-5 h-5" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                Sin mensajes aún
              </div>
            ) : (
              messages.map((msg, index) => (
                <div
                  key={msg.id}
                  ref={index === messages.length - 1 ? lastMessageRef : undefined}
                  className={cn(
                    'flex',
                    msg.sender_type === 'staff' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-xs px-3 py-2 rounded-lg text-sm wrap-break-words',
                      msg.sender_type === 'staff'
                        ? 'bg-primary text-primary-foreground rounded-br-none'
                        : 'bg-muted text-foreground rounded-bl-none'
                    )}
                  >
                    <p>{msg.message_text}</p>
                    <div className="flex items-center justify-end gap-2 mt-1">
                      <p className="text-xs opacity-70">
                        {format(new Date(msg.created_at), 'HH:mm', { locale: es })}
                      </p>
                      {msg.sender_type === 'staff' && (
                        <span
                          className={cn(
                            'flex items-center gap-1 text-xs font-semibold',
                            msg.delivery_status === 'read'
                              ? 'text-blue-400'
                              : msg.delivery_status === 'queued'
                              ? 'text-amber-500'
                              : 'text-muted-foreground'
                          )}
                        >
                          {msg.delivery_status === 'queued' ? (
                            <Clock className="w-3 h-3" />
                          ) : msg.delivery_status === 'delivered' ? (
                            '✓✓'
                          ) : msg.delivery_status === 'read' ? (
                            '✓✓'
                          ) : (
                            '✓'
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input para responder */}
          <div className="px-4 py-3 border-t border-border bg-muted/20">
            <div className="flex gap-2">
              <Textarea
                placeholder="Escribe un mensaje..."
                value={reply}
                onChange={(e) => {
                  setReply(e.target.value)
                }}
                onBlur={() => {}}

                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    handleSendReply()
                  }
                }}
                className="min-h-10 max-h-24 text-sm resize-none"
              />
              <Button
                onClick={handleSendReply}
                disabled={!reply.trim() || isSending}
                className="h-10 w-10 p-0 shrink-0"
              >
                {isSending ? <Spinner className="w-4 h-4" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center text-muted-foreground">
          <p className="text-sm">Selecciona una conversación para ver los mensajes</p>
        </div>
      )}
    </div>
  )
}
