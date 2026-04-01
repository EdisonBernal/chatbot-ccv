import { getChatbotConfigs } from '@/lib/services/chatbot'
import { ChatbotListClient } from '@/components/admin/chatbot/chatbot-list-client'

export const metadata = {
  title: 'Configuración de Chatbot',
  description: 'Administrar pasos automáticos del agente',
}

export default async function ChatbotAdminPage() {
  const configs = await getChatbotConfigs()
  return <ChatbotListClient initialConfigs={configs} />
}
