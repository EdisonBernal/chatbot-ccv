import { getChatbotConfigById, getChatbotSteps } from '@/lib/services/chatbot'
import { ChatbotEditorClient } from '@/components/admin/chatbot/chatbot-editor-client'
import { notFound } from 'next/navigation'

export const metadata = {
  title: 'Chatbot',
  description: 'Configurar pasos del chatbot',
}

export default async function ChatbotEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const config = await getChatbotConfigById(id)
  
  if (!config) return notFound()
  
  const steps = await getChatbotSteps(id)

  return <ChatbotEditorClient config={config} initialSteps={steps} />
}
