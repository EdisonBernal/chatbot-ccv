import Link from 'next/link'
import type { Conversation } from '@/lib/types'
import { CONVERSATION_STATUS_LABELS, CONVERSATION_STATUS_COLORS } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MessageSquare, ArrowRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface RecentConversationsProps {
  conversations: Conversation[]
}

export function RecentConversations({ conversations }: RecentConversationsProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-muted-foreground" />
          Conversaciones recientes
        </CardTitle>
        <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
          <Link href="/dashboard/conversations">
            Ver todas <ArrowRight className="w-3 h-3 ml-1" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {conversations.length === 0 ? (
          <p className="text-sm text-muted-foreground px-6 py-4">No hay conversaciones recientes.</p>
        ) : (
          <div className="divide-y divide-border">
            {conversations.map((conv) => (
              <Link
                key={conv.id}
                href={`/dashboard/conversations/${conv.id}`}
                className="flex items-center gap-3 px-6 py-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-medium text-foreground truncate">
                    {conv.patient?.full_name ?? '—'}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {conv.whatsapp_number} ·{' '}
                    {conv.last_message_at
                      ? formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true, locale: es })
                      : 'Sin mensajes'}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={`text-xs shrink-0 ${CONVERSATION_STATUS_COLORS[conv.status]}`}
                >
                  {CONVERSATION_STATUS_LABELS[conv.status]}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
