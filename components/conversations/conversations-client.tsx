'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Conversation } from '@/lib/types'
import { CONVERSATION_STATUS_LABELS, CONVERSATION_STATUS_COLORS } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Search, Eye, MessageSquare, Phone } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface ConversationsClientProps {
  initialConversations: Conversation[]
}

export function ConversationsClient({ initialConversations }: ConversationsClientProps) {
  const [conversations] = useState<Conversation[]>(initialConversations)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = conversations.filter((c) => {
    const matchesSearch =
      c.patient?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.whatsapp_number.includes(search)
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Conversaciones</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {conversations.length} conversacion{conversations.length !== 1 ? 'es' : ''} vía WhatsApp
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o número..."
            className="pl-9 w-72"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="nueva">Nueva</SelectItem>
            <SelectItem value="en_atencion">En atención</SelectItem>
            <SelectItem value="resuelta">Resuelta</SelectItem>
            <SelectItem value="archivada">Archivada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Paciente</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Último mensaje</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                  No hay conversaciones registradas.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((conv) => (
                <TableRow key={conv.id}>
                  <TableCell className="font-medium">
                    {conv.patient?.full_name ? (
                      conv.patient.full_name
                    ) : (
                      <span className="text-muted-foreground text-sm">Sin vincular</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-muted-foreground" />
                    {conv.whatsapp_number}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {conv.last_message_at
                      ? formatDistanceToNow(new Date(conv.last_message_at), {
                          addSuffix: true,
                          locale: es,
                        })
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-xs ${CONVERSATION_STATUS_COLORS[conv.status]}`}
                    >
                      {CONVERSATION_STATUS_LABELS[conv.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                      <Link href={`/dashboard/conversations/${conv.id}`}>
                        <Eye className="w-3.5 h-3.5" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
