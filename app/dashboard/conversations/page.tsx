import { getConversations } from '@/lib/services/conversations'
import { WhatsAppConversationsClient } from '@/components/conversations/whatsapp-conversations-client'

export default async function ConversationsPage() {
  const conversations = await getConversations()
  // Sanitize server data to ensure it's JSON-serializable and does not
  // contain unexpected getters that may run during serialization.
  const safe = JSON.parse(JSON.stringify(conversations || []))
  return <WhatsAppConversationsClient initialConversations={safe} />
}
