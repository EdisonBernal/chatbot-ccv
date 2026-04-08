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
  SheetDescription,
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
  AlertCircle,
  Paperclip,
  X,
  ImageIcon,
  Mic,
  Trash2,
  ChevronDown,
  Reply,
  Smile,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/client'
import { AudioPlayer } from '@/components/conversations/audio-player'
import EmojiPicker, { Theme } from 'emoji-picker-react'
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

  // Merge-upsert: if msg already exists in prev, merge (keeping local fields like replied_message),
  // otherwise append. This prevents broadcast from discarding rich local data.
  const upsertMessage = (prev: ConversationMessage[], newMsg: ConversationMessage): ConversationMessage[] => {
    const idx = prev.findIndex((m) => m.id === newMsg.id)
    if (idx !== -1) {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], ...newMsg, replied_message: newMsg.replied_message || updated[idx].replied_message }
      return updated
    }
    return [...prev, newMsg]
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
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [contextData, setContextData] = useState<Record<string, string>>({})
  const [isLoadingContext, setIsLoadingContext] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [recordingWaveform, setRecordingWaveform] = useState<number[]>([])
  const [replyingTo, setReplyingTo] = useState<ConversationMessage | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sendOnStopRef = useRef(false)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const waveformIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const lastMessageRef = useRef<HTMLDivElement>(null)
  const messageRefsMap = useRef<Map<string, HTMLDivElement>>(new Map())
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const selectedConversationRef = useRef<Conversation | null>(null)
  const viewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const messagesCacheRef = useRef<Map<string, ConversationMessage[]>>(new Map())
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isPrefetching, setIsPrefetching] = useState(true)

  // ── Prefetch messages for all conversations on mount (WhatsApp-style) ──
  // This pre-loads all conversations' messages into cache so navigation is instant.
  useEffect(() => {
    if (initialConversations.length === 0) {
      setIsPrefetching(false)
      return
    }

    let cancelled = false

    const prefetch = async () => {
      // Helper to build replied_message references
      const buildRefs = (msgs: ConversationMessage[]) => {
        const map = new Map(msgs.map(m => [m.id, m]))
        for (const m of msgs) {
          if (m.reply_to_message_id) m.replied_message = map.get(m.reply_to_message_id) || null
        }
      }

      // Fetch conversations in small batches to avoid overwhelming the server
      const batchSize = 5
      for (let i = 0; i < initialConversations.length; i += batchSize) {
        if (cancelled) break
        const batch = initialConversations.slice(i, i + batchSize)
        await Promise.allSettled(
          batch.map(async (conv) => {
            // Skip if already cached (e.g. user clicked a conv before prefetch reached it)
            if (messagesCacheRef.current.has(conv.id)) return
            try {
              const res = await fetch(`/api/conversations/${conv.id}/messages`)
              if (res.ok && !cancelled) {
                const msgs: ConversationMessage[] = await res.json()
                buildRefs(msgs)
                // Only store if not already cached by a user click
                if (!messagesCacheRef.current.has(conv.id)) {
                  messagesCacheRef.current.set(conv.id, msgs)
                }
              }
            } catch {
              // skip failed prefetch silently
            }
          })
        )
      }
      if (!cancelled) setIsPrefetching(false)
    }

    prefetch()
    return () => { cancelled = true }
  }, [])

  // Debounced call to update last_view_at so the server knows the user is
  // still viewing this conversation (keeps unread counts accurate on refresh).
  const debouncedUpdateView = (conversationId: string) => {
    if (viewDebounceRef.current) clearTimeout(viewDebounceRef.current)
    viewDebounceRef.current = setTimeout(() => {
      fetch(`/api/conversations/${conversationId}/view`, { method: 'POST' }).catch(() => {})
    }, 1000)
  }

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

  // Scroll when loading finishes — the Spinner is replaced by actual messages
  useEffect(() => {
    if (!isLoadingMessages && selectedConversation && messages.length > 0) {
      scheduleScrollToBottom()
    }
  }, [isLoadingMessages])

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
                    updated[idx] = { ...updated[idx], ...msg, replied_message: updated[idx].replied_message || msg.replied_message }
                    return updated
                  }
                  // Check if this broadcast matches an optimistic temp message
                  if (msg.sender_type === 'staff') {
                    const tempIdx = prev.findIndex((m) => m.id.startsWith('temp-') && m.message_text === msg.message_text)
                    if (tempIdx !== -1) {
                      const updated = [...prev]
                      updated[tempIdx] = { ...msg, replied_message: updated[tempIdx].replied_message || msg.replied_message }
                      return updated
                    }
                  }
                  // For new messages, resolve replied_message from existing messages
                  if (msg.reply_to_message_id && !msg.replied_message) {
                    const repliedMsg = prev.find((m) => m.id === msg.reply_to_message_id)
                    if (repliedMsg) msg.replied_message = repliedMsg
                  }
                  
                  const updated = dedupeById([...prev, msg])
                  window.setTimeout(() => scheduleScrollToBottom(), 25)
                  return updated
                } catch (e) {
                  return prev
                }
              })
              debouncedUpdateView(sel.id)
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
                    // Preserve replied_message from local state
                    updated[idx] = { ...updated[idx], ...msg, replied_message: updated[idx].replied_message || msg.replied_message }
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
        // ignore
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
                } else if (selectedConversationRef.current?.id === msg.conversation_id) {
                  // User is viewing this conversation — keep it marked as read
                  conv.unread_count = 0
                  conv.last_view_at = new Date().toISOString()
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
            // UPDATE events are for delivery status changes / metadata (twilio_sid).
            // Do NOT increment unread_count or reorder conversations — that is
            // handled by the INSERT event only.
            setConversations((prev) => {
              try {
                return prev.map((c) =>
                  c.id === msg.conversation_id
                    ? { ...c, last_message: msg.message_text || c.last_message }
                    : c
                )
              } catch (e) {
                return prev
              }
            })
          })
          .on('broadcast', { event: 'STATUS_CHANGE' }, (payload) => {
            const raw: any = payload?.payload ?? payload ?? {}
            const conversationId = raw.conversation_id
            const newStatus = raw.status
            if (!conversationId || !newStatus) return

            // Update conversation list
            setConversations((prev) =>
              prev.map((c) =>
                c.id === conversationId ? { ...c, status: newStatus } : c
              )
            )
            // Update selected conversation if it's the one that changed
            setSelectedConversation((prev) =>
              prev && prev.id === conversationId ? { ...prev, status: newStatus } : prev
            )
          })
          .on('broadcast', { event: 'NEW_CONVERSATION' }, (payload) => {
            const raw: any = payload?.payload ?? payload ?? {}
            const conversationId = raw.conversation_id
            console.log('[realtime] NEW_CONVERSATION received:', conversationId, raw)
            if (!conversationId) return

            // Fetch the full conversation (with patient data) and prepend it
            fetch('/api/conversations')
              .then((res) => res.json())
              .then((allConvs: Conversation[]) => {
                const newConv = allConvs.find((c: Conversation) => c.id === conversationId)
                if (!newConv) return
                setConversations((prev) => {
                  // Don't add if already exists
                  if (prev.some((c) => c.id === conversationId)) return prev
                  return [{ ...newConv, unread_count: 1 }, ...prev]
                })
              })
              .catch(() => {})
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
                    updated[idx] = { ...updated[idx], ...msg, replied_message: updated[idx].replied_message || msg.replied_message }
                    return updated
                  }
                  // Check if this broadcast matches an optimistic temp message
                  if (msg.sender_type === 'staff') {
                    const tempIdx = prev.findIndex((m) => m.id.startsWith('temp-') && m.message_text === msg.message_text)
                    if (tempIdx !== -1) {
                      const updated = [...prev]
                      updated[tempIdx] = { ...msg, replied_message: updated[tempIdx].replied_message || msg.replied_message }
                      return updated
                    }
                  }
                  // For new messages, resolve replied_message from existing messages
                  if (msg.reply_to_message_id && !msg.replied_message) {
                    const repliedMsg = prev.find((m) => m.id === msg.reply_to_message_id)
                    if (repliedMsg) msg.replied_message = repliedMsg
                  }
                  const updated = dedupeById([...prev, msg])
                  window.setTimeout(() => scheduleScrollToBottom(), 10)
                  return updated
                } catch (e) {
                  return prev
                }
              })
              debouncedUpdateView(sel.id)
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

  // Helper to build replied_message references within a messages array
  const buildReplyRefs = (msgs: ConversationMessage[]) => {
    const msgMap = new Map(msgs.map(m => [m.id, m]))
    for (const m of msgs) {
      if (m.reply_to_message_id) {
        m.replied_message = msgMap.get(m.reply_to_message_id) || null
      }
    }
  }

  // Cargar mensajes cuando se selecciona una conversación
  const handleSelectConversation = async (conv: Conversation) => {
    // Instantly show cached messages if available (no spinner)
    const cached = messagesCacheRef.current.get(conv.id)
    if (cached) {
      setMessages(cached)
      setSelectedConversation(conv)
      setReplyingTo(null)
      setShowEmojiPicker(false)
      setIsLoadingMessages(false)
      scheduleScrollToBottom()
    } else {
      setMessages([])
      setSelectedConversation(conv)
      setReplyingTo(null)
      setShowEmojiPicker(false)
      setIsLoadingMessages(true)
    }

    // Mark as read immediately (don't wait for fetch)
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conv.id
          ? { ...c, last_view_at: new Date().toISOString(), unread_count: 0 }
          : c
      )
    )
    fetch(`/api/conversations/${conv.id}/read`, { method: 'POST' }).catch(() => {})
    fetch(`/api/conversations/${conv.id}/view`, { method: 'POST' }).catch(() => {})

    // Fetch fresh messages in background
    try {
      const res = await fetch(`/api/conversations/${conv.id}/messages`)
      if (res.ok) {
        const msgs: ConversationMessage[] = await res.json()
        buildReplyRefs(msgs)
        messagesCacheRef.current.set(conv.id, msgs)
        // Only update if user is still viewing this conversation
        if (selectedConversationRef.current?.id === conv.id) {
          setMessages(msgs)
          setIsLoadingMessages(false)
          scheduleScrollToBottom()
        }
      }
    } catch {
      if (!cached) toast.error('Error al cargar los mensajes')
    } finally {
      setIsLoadingMessages(false)
    }
  }

  // Enviar respuesta — optimistic UI: message appears instantly
  const handleSendReply = async () => {
    if (!reply.trim() && !mediaFile) return
    if (!selectedConversation) return

    // Capture current values before clearing
    const currentReply = reply.trim()
    const currentMediaFile = mediaFile
    const currentMediaPreview = mediaPreview
    const currentReplyingTo = replyingTo
    const convId = selectedConversation.id

    // Build optimistic message
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const optimisticMsg: ConversationMessage = {
      id: tempId,
      conversation_id: convId,
      message_text: currentReply || (currentMediaFile?.type.startsWith('image/') ? '📷 Imagen' : ''),
      sender_type: 'staff',
      sender_id: null,
      media_url: currentMediaFile?.type.startsWith('image/') ? currentMediaPreview : null,
      media_type: currentMediaFile?.type.startsWith('image/') ? 'image' : null,
      reply_to_message_id: currentReplyingTo?.id || null,
      replied_message: currentReplyingTo || null,
      twilio_sid: null,
      message_index: null,
      delivery_status: 'queued',
      created_at: new Date().toISOString(),
    }

    // Immediately update UI — clear inputs, show message
    setMessages((prev) => [...prev, optimisticMsg])
    setReply('')
    setMediaFile(null)
    setMediaPreview(null)
    setReplyingTo(null)
    setShowEmojiPicker(false)
    scheduleScrollToBottom()

    // Send in background — no isSending spinner
    try {
      let res: Response
      if (currentMediaFile) {
        const formData = new FormData()
        formData.append('body', currentReply)
        formData.append('media', currentMediaFile)
        if (currentReplyingTo) formData.append('replyToMessageId', currentReplyingTo.id)
        res = await fetch(`/api/conversations/${convId}/reply`, {
          method: 'POST',
          body: formData,
        })
      } else {
        res = await fetch(`/api/conversations/${convId}/reply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            body: currentReply,
            ...(currentReplyingTo ? { replyToMessageId: currentReplyingTo.id } : {}),
          }),
        })
      }
      if (res.ok) {
        const newMsg = await res.json()
        if (currentReplyingTo && !newMsg.replied_message) {
          newMsg.replied_message = currentReplyingTo
        }
        // Replace optimistic message with real one
        setMessages((prev) => prev.map((m) => m.id === tempId ? { ...newMsg, replied_message: newMsg.replied_message || currentReplyingTo } : m))
        // Update cache
        if (messagesCacheRef.current.has(convId)) {
          setMessages((prev) => { messagesCacheRef.current.set(convId, prev); return prev })
        }
      } else {
        // Mark optimistic message as failed
        setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, delivery_status: 'failed' as const } : m))
        toast.error('Error al enviar el mensaje')
      }
    } catch {
      setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, delivery_status: 'failed' as const } : m))
      toast.error('Error al enviar el mensaje')
    }
  }

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Accept images and audio
    if (!file.type.startsWith('image/') && !file.type.startsWith('audio/')) {
      toast.error('Solo se permiten imágenes y archivos de audio')
      return
    }
    // Max 16MB for audio, 10MB for images
    const maxSize = file.type.startsWith('audio/') ? 16 * 1024 * 1024 : 10 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error(file.type.startsWith('audio/') ? 'El audio no puede superar 16MB' : 'La imagen no puede superar 10MB')
      return
    }
    if (file.type.startsWith('audio/')) {
      // For audio files from file picker, send directly
      const blob = new Blob([file], { type: file.type })
      doSendAudio(blob)
    } else {
      setMediaFile(file)
      const url = URL.createObjectURL(file)
      setMediaPreview(url)
    }
    // Reset the input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRemoveMedia = () => {
    setMediaFile(null)
    if (mediaPreview) URL.revokeObjectURL(mediaPreview)
    setMediaPreview(null)
  }

  // ── Reply-to-message handler ──────────────────────────────────────
  const handleReplyToMessage = (msg: ConversationMessage) => {
    setReplyingTo(msg)
    setShowEmojiPicker(false)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  const cancelReplyTo = () => {
    setReplyingTo(null)
  }

  // Scroll to original message when clicking on a reply quote
  const scrollToMessage = (messageId: string) => {
    const el = messageRefsMap.current.get(messageId)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Flash highlight
      el.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'transition-all')
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-primary', 'ring-offset-2', 'transition-all')
      }, 1500)
    }
  }

  // Get a short preview text for a message (for reply quotes)
  const getMessagePreview = (msg: ConversationMessage) => {
    if (msg.media_type === 'audio') return '🎤 Audio'
    if (msg.media_type === 'image') return '📷 Imagen'
    if (msg.media_url) return '📎 Archivo'
    const text = msg.message_text || ''
    return text.length > 80 ? text.slice(0, 80) + '…' : text
  }

  // Emoji picker handler
  const handleEmojiSelect = (emojiData: { emoji: string }) => {
    setReply((prev) => prev + emojiData.emoji)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  // Handle paste from clipboard (Ctrl+V screenshots)
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (!file) return
        if (file.size > 10 * 1024 * 1024) {
          toast.error('La imagen no puede superar 10MB')
          return
        }
        setMediaFile(file)
        const url = URL.createObjectURL(file)
        setMediaPreview(url)
        return
      }
    }
  }

  // ── Audio recording handlers ──────────────────────────────────────
  const startRecording = async () => {
    try {
      // Request mic with mono channel — avoids stereo mix issues on some hardware
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 16000,
        }
      })

      // Log mic track settings for debug
      const track = stream.getAudioTracks()[0]
      console.log('[recording] Mic track:', track.label, track.getSettings())

      // Prefer webm (Chrome native) over mp4
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
        ? 'audio/ogg;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/webm'
      console.log('[recording] Using mimeType:', mimeType)

      // Record raw mic stream — NO AudioContext (it can interfere with browser audio processing)
      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []
      sendOnStopRef.current = false

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        if (waveformIntervalRef.current) {
          clearInterval(waveformIntervalRef.current)
          waveformIntervalRef.current = null
        }

        if (sendOnStopRef.current && audioChunksRef.current.length > 0) {
          const blob = new Blob(audioChunksRef.current, { type: mimeType })
          await doSendAudio(blob)
        }
        audioChunksRef.current = []
      }

      recorder.start()
      setIsRecording(true)
      setRecordingDuration(0)
      setRecordingWaveform([])

      // Timer for duration
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1)
      }, 1000)

      // Fake waveform (no AudioContext to avoid interference)
      waveformIntervalRef.current = setInterval(() => {
        const level = 0.3 + Math.random() * 0.5
        setRecordingWaveform((prev) => [...prev.slice(-40), level])
      }, 100)
    } catch {
      toast.error('No se pudo acceder al micrófono')
    }
  }

  const stopAndSendRecording = () => {
    sendOnStopRef.current = true
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
  }

  const cancelRecording = () => {
    sendOnStopRef.current = false
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
    setRecordingDuration(0)
    setRecordingWaveform([])
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
  }

  const doSendAudio = async (blob: Blob) => {
    if (!selectedConversation) return
    const convId = selectedConversation.id

    // Build optimistic audio message
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const optimisticMsg: ConversationMessage = {
      id: tempId,
      conversation_id: convId,
      message_text: '🎤 Audio',
      sender_type: 'staff',
      sender_id: null,
      media_url: null,
      media_type: 'audio',
      reply_to_message_id: null,
      replied_message: null,
      twilio_sid: null,
      message_index: null,
      delivery_status: 'queued',
      created_at: new Date().toISOString(),
    }

    // Show optimistic message immediately
    setMessages((prev) => [...prev, optimisticMsg])
    scheduleScrollToBottom()

    try {
      const ext = blob.type.includes('ogg') ? 'ogg'
        : blob.type.includes('mp4') ? 'mp4'
        : blob.type.includes('mpeg') ? 'mp3'
        : 'webm'
      const file = new File([blob], `voice-note-${Date.now()}.${ext}`, { type: blob.type })
      const formData = new FormData()
      formData.append('body', '')
      formData.append('media', file)
      const res = await fetch(`/api/conversations/${convId}/reply`, {
        method: 'POST',
        body: formData,
      })
      if (res.ok) {
        const newMsg = await res.json()
        // Replace optimistic with real message (now has media_url for playback)
        setMessages((prev) => prev.map((m) => m.id === tempId ? newMsg : m))
        if (messagesCacheRef.current.has(convId)) {
          setMessages((prev) => { messagesCacheRef.current.set(convId, prev); return prev })
        }
      } else {
        setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, delivery_status: 'failed' as const } : m))
        toast.error('Error al enviar el audio')
      }
    } catch {
      setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, delivery_status: 'failed' as const } : m))
      toast.error('Error al enviar el audio')
    }
  }

  const formatRecordingTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      if (waveformIntervalRef.current) clearInterval(waveformIntervalRef.current)
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop() } catch { /* ignore */ }
      }
    }
  }, [])

  // Verificar si hay mensajes nuevos (last_view_at < last_message_at)
  const hasNewMessages = (conv: Conversation) => {
    if (!conv.last_message_at) return false
    if (!conv.last_view_at) return true
    return new Date(conv.last_message_at) > new Date(conv.last_view_at)
  }

  // Escape global para salir del chat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedConversation) {
        setSelectedConversation(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedConversation])

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

        {/* Prefetch progress bar */}
        {isPrefetching && (
          <div className="px-3 pb-2 flex items-center gap-2">
            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary/60 rounded-full animate-pulse" style={{ width: '100%' }} />
            </div>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">Cargando chats…</span>
          </div>
        )}

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
                <SheetContent className="w-80 sm:w-96 flex flex-col">
                  <SheetHeader>
                    <SheetTitle>Datos recopilados</SheetTitle>
                    <SheetDescription className="sr-only">Información recopilada por el chatbot durante la conversación</SheetDescription>
                  </SheetHeader>
                  <div className="mt-4 flex-1 overflow-y-auto">
                    {isLoadingContext ? (
                      <div className="flex justify-center py-8">
                        <Spinner className="w-5 h-5" />
                      </div>
                    ) : Object.keys(contextData).length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No hay datos recopilados aún
                      </p>
                    ) : (() => {
                      // Separate personal info (collect_info fields) from flow responses
                      const personalKeys: [string, string][] = []
                      const flowKeys: [string, string][] = []
                      for (const [key, value] of Object.entries(contextData)) {
                        if (key.startsWith('response_')) {
                          flowKeys.push([key, value])
                        } else {
                          personalKeys.push([key, value])
                        }
                      }

                      const formatLabel = (key: string): string => {
                        const cleaned = key.replace(/^response_/, '').replace(/_/g, ' ')
                        return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
                      }

                      const renderItem = ([key, value]: [string, string]) => (
                        <div key={key} className="flex items-center gap-2 py-1.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground">{formatLabel(key)}</p>
                            <p className="text-sm font-medium wrap-break-word">{value}</p>
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
                      )

                      return (
                        <div className="space-y-1">
                          {/* Personal info section */}
                          {personalKeys.length > 0 && (
                            <div className="rounded-lg border p-3 space-y-0.5">
                              {personalKeys.map(renderItem)}
                            </div>
                          )}

                          {/* Flow responses section */}
                          {flowKeys.length > 0 && (
                            <div className="rounded-lg border p-3 space-y-0.5 mt-3">
                              <p className="text-xs font-medium text-muted-foreground mb-2">Opciones seleccionadas</p>
                              {flowKeys.map(renderItem)}
                            </div>
                          )}
                        </div>
                      )
                    })()}
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
                  ref={(el) => {
                    if (index === messages.length - 1) (lastMessageRef as any).current = el
                    if (el) messageRefsMap.current.set(msg.id, el)
                    else messageRefsMap.current.delete(msg.id)
                  }}
                  className={cn(
                    'flex group',
                    msg.sender_type === 'staff' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {/* Message bubble */}
                  <div
                    className={cn(
                      'relative max-w-xs px-3 py-2 rounded-lg text-sm wrap-break-words group/msg',
                      msg.sender_type === 'staff'
                        ? 'bg-primary text-primary-foreground rounded-br-none'
                        : 'bg-muted text-foreground rounded-bl-none'
                    )}
                  >
                    {/* Hover action button — inside bubble, top-right */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className={cn(
                            'absolute top-1 opacity-0 group-hover/msg:opacity-100 transition-opacity',
                            'h-5 w-5 flex items-center justify-center rounded-full z-10',
                            msg.sender_type === 'staff'
                              ? 'right-1 hover:bg-primary-foreground/20 text-primary-foreground/70'
                              : 'right-1 hover:bg-foreground/10 text-muted-foreground',
                          )}
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align={msg.sender_type === 'staff' ? 'end' : 'start'} className="w-40">
                        <DropdownMenuItem onSelect={() => handleReplyToMessage(msg)}>
                          <Reply className="w-4 h-4 mr-2" />
                          Responder
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => {
                          navigator.clipboard.writeText(msg.message_text || '')
                          toast.success('Texto copiado')
                        }}>
                          <Copy className="w-4 h-4 mr-2" />
                          Copiar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {/* Reply quote */}
                    {msg.replied_message && (
                        <div
                          className={cn(
                            'mb-2 px-2 py-1.5 rounded cursor-pointer border-l-3',
                            msg.sender_type === 'staff'
                              ? 'bg-primary-foreground/15 border-primary-foreground/50'
                              : 'bg-background/50 border-primary/50'
                          )}
                          onClick={() => msg.replied_message && scrollToMessage(msg.replied_message.id)}
                        >
                          <p className={cn(
                            'text-[11px] font-semibold mb-0.5',
                            msg.replied_message.sender_type === 'staff' ? '' : 'text-emerald-400'
                          )}>
                            {msg.replied_message.sender_type === 'staff' ? 'Tú' : 'Paciente'}
                          </p>
                          <p className={cn(
                            'text-xs line-clamp-2',
                            msg.sender_type === 'staff' ? 'opacity-80' : 'opacity-70'
                          )}>
                            {getMessagePreview(msg.replied_message)}
                          </p>
                        </div>
                      )}
                      {msg.media_url && (msg.media_type === 'audio' || msg.media_url.match(/\.(ogg|mp3|m4a|wav|webm|amr|opus)(\?|$)/i)) ? (
                        <div className="mb-1">
                          <AudioPlayer
                            src={msg.media_url}
                            isStaff={msg.sender_type === 'staff'}
                            onPlayed={msg.sender_type === 'patient' && msg.id ? () => {
                              fetch(`/api/conversations/${msg.conversation_id}/played`, {
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
                      {msg.message_text && !(msg.media_url && (msg.media_type === 'audio' || msg.media_url.match(/\.(ogg|mp3|m4a|wav|webm|amr|opus)(\?|$)/i)) && (msg.message_text === '🎤 Audio')) && <p>{msg.message_text}</p>}
                      <div className="flex items-center justify-end gap-2 mt-1">
                        <p className="text-xs opacity-70">
                          {format(new Date(msg.created_at), 'HH:mm', { locale: es })}
                        </p>
                        {msg.sender_type === 'staff' && (
                          <span
                            title={msg.delivery_status === 'failed' ? 'Error al enviar el mensaje' : undefined}
                            className={cn(
                              'flex items-center gap-1 text-xs font-semibold',
                              msg.delivery_status === 'read'
                                ? 'text-blue-400'
                                : msg.delivery_status === 'failed'
                                ? 'text-red-500'
                                : msg.delivery_status === 'queued'
                                ? 'text-amber-500'
                                : 'text-muted-foreground'
                            )}
                          >
                            {msg.delivery_status === 'failed' ? (
                              <AlertCircle className="w-3 h-3" />
                            ) : msg.delivery_status === 'queued' ? (
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
            {/* WhatsApp-style recording bar */}
            {isRecording && (
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0 rounded-full border-2 border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                  onClick={cancelRecording}
                  title="Cancelar grabación"
                >
                  <Trash2 className="w-5 h-5" />
                </Button>
                <div className="flex-1 flex items-center gap-2 bg-background rounded-full px-4 py-2">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                  </span>
                  <span className="text-sm font-mono font-medium text-foreground min-w-[3ch]">
                    {formatRecordingTime(recordingDuration)}
                  </span>
                  <div className="flex-1 flex items-center justify-center gap-0.5 h-8 overflow-hidden">
                    {recordingWaveform.map((level, i) => (
                      <div
                        key={i}
                        className="w-1 rounded-full bg-muted-foreground/60 transition-all duration-100"
                        style={{ height: `${Math.max(4, level * 28)}px` }}
                      />
                    ))}
                    {recordingWaveform.length < 41 && Array.from({ length: 41 - recordingWaveform.length }).map((_, i) => (
                      <div
                        key={`empty-${i}`}
                        className="w-1 rounded-full bg-muted-foreground/20"
                        style={{ height: '4px' }}
                      />
                    ))}
                  </div>
                </div>
                <Button
                  size="icon"
                  className="h-10 w-10 shrink-0 rounded-full bg-[#25D366] hover:bg-[#1fb855] text-white"
                  onClick={stopAndSendRecording}
                  title="Enviar nota de voz"
                >
                  <Send className="w-5 h-5" />
                </Button>
              </div>
            )}
            {!isRecording && (
            <>
            {/* Reply-to preview bar */}
            {replyingTo && (
              <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-muted rounded-md border-l-3 border-primary">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-primary">
                    {replyingTo.sender_type === 'staff' ? 'Tú' : (selectedConversation?.patient?.full_name || 'Paciente')}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {getMessagePreview(replyingTo)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={cancelReplyTo}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
            {mediaPreview && (
              <div className="flex items-center gap-2 mb-2 p-2 bg-muted rounded-md">
                <img
                  src={mediaPreview}
                  alt="Vista previa"
                  className="w-16 h-16 object-cover rounded"
                />
                <span className="text-xs text-muted-foreground flex-1 truncate">{mediaFile?.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={handleRemoveMedia}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
            {/* Emoji picker */}
            {showEmojiPicker && (
              <div className="mb-2">
                <EmojiPicker
                  onEmojiClick={handleEmojiSelect}
                  theme={Theme.AUTO}
                  width="100%"
                  height={350}
                  searchPlaceHolder="Buscar emoji..."
                  previewConfig={{ showPreview: false }}
                  lazyLoadEmojis
                />
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="file"
                accept="image/*,audio/*"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 p-0 shrink-0"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                title="Emojis"
              >
                <Smile className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 p-0 shrink-0"
                onClick={() => fileInputRef.current?.click()}
                title="Adjuntar imagen"
              >
                <Paperclip className="w-4 h-4" />
              </Button>
              <Textarea
                ref={textareaRef}
                placeholder="Escribe un mensaje..."
                value={reply}
                onChange={(e) => {
                  setReply(e.target.value)
                  // Debounced typing indicator — fire at most once every 25s (matches WA indicator duration)
                  if (e.target.value.trim() && !typingDebounceRef.current && selectedConversation) {
                    fetch(`/api/conversations/${selectedConversation.id}/typing`, { method: 'POST' }).catch(() => {})
                    typingDebounceRef.current = setTimeout(() => { typingDebounceRef.current = null }, 25000)
                  }
                }}
                onBlur={() => {}}
                onPaste={handlePaste}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    handleSendReply()
                  }
                }}
                onFocus={() => setShowEmojiPicker(false)}
                className="min-h-10 max-h-24 text-sm resize-none"
              />
              <Button
                onClick={handleSendReply}
                disabled={!reply.trim() && !mediaFile}
                className="h-10 w-10 p-0 shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
              {!reply.trim() && !mediaFile && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 p-0 shrink-0"
                  onClick={startRecording}
                  title="Grabar nota de voz"
                >
                  <Mic className="w-4 h-4" />
                </Button>
              )}
            </div>
            </>
            )}
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
