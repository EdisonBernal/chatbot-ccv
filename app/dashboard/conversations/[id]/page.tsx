import { getConversationById, getConversationMessages } from '@/lib/services/conversations'
import { getCurrentUser } from '@/lib/services/users'
import { getPatients } from '@/lib/services/patients'
import { notFound } from 'next/navigation'
import { ConversationDetailClient } from '@/components/conversations/conversation-detail-client'

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [conversation, messages, currentUser, patients] = await Promise.all([
    getConversationById(id),
    getConversationMessages(id),
    getCurrentUser(),
    getPatients(),
  ])
  if (!conversation) notFound()
  return (
    <ConversationDetailClient
      conversation={conversation}
      messages={messages}
      currentUserId={currentUser?.id ?? ''}
      patients={patients}
    />
  )
}
