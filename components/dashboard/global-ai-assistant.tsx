'use client'

import dynamic from 'next/dynamic'

const AIAssistantChat = dynamic(
  () => import('@/components/dashboard/ai-assistant-chat').then((m) => ({ default: m.AIAssistantChat })),
  { ssr: false },
)

export function GlobalAIAssistant() {
  return <AIAssistantChat />
}
