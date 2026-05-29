'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Bot, Send, User, Loader2, AlertCircle, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import Image from 'next/image'

const BACKEND_URL =
  'https://script.google.com/macros/s/AKfycbzO3GkI7tPQ7aZXzjmIzg7FXFSyGE86ihlNHG0FfCNQJOAxJS8gLHGp23S3Ebm7_zXy/exec'

const WELCOME_MESSAGE = '¡Hola! Buenos días. Bienvenido a su cuenta UpCrop.'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isError?: boolean
}

/**
 * Extracts the text response from different backend formats:
 * 1. data.answer
 * 2. data.candidates[0].content.parts[0].text (Gemini format)
 * 3. data.error
 */
function extractResponseText(data: unknown): { text: string; isError: boolean } {
  if (!data || typeof data !== 'object') {
    return { text: 'Respuesta inválida del servidor.', isError: true }
  }

  const response = data as Record<string, unknown>

  // Check for direct answer
  if (response.answer && typeof response.answer === 'string') {
    return { text: response.answer, isError: false }
  }

  // Check for Gemini format
  if (response.candidates && Array.isArray(response.candidates)) {
    try {
      const candidate = response.candidates[0] as Record<string, unknown>
      const content = candidate?.content as Record<string, unknown>
      const parts = content?.parts as Array<Record<string, unknown>>
      const text = parts?.[0]?.text as string
      if (text) {
        return { text, isError: false }
      }
    } catch {
      // Fall through to error handling
    }
  }

  // Check for error response
  if (response.error && typeof response.error === 'string') {
    return { text: response.error, isError: true }
  }

  // Fallback: try to stringify if it's an object
  if (typeof response === 'object') {
    return { text: JSON.stringify(response), isError: false }
  }

  return { text: 'No se pudo interpretar la respuesta.', isError: true }
}

export function AIAssistantChat() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [userEmail, setUserEmail] = useState<string>('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Get user email from Supabase session
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? '')
    })
  }, [])

  // Initialize with welcome message when chat opens
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: WELCOME_MESSAGE,
          timestamp: new Date(),
        },
      ])
    }
  }, [isOpen, messages.length])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const sendMessage = async () => {
    const question = input.trim()
    if (!question || isLoading) return

    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          question,
          email: userEmail,
        }),
      })

      const data = await response.json()
      const { text, isError } = extractResponseText(data)

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: text,
        timestamp: new Date(),
        isError,
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Error de conexión: ${error instanceof Error ? error.message : 'No se pudo conectar con el servidor.'}`,
        timestamp: new Date(),
        isError: true,
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      {/* Floating Chat Button with UpCrop Logo */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full
          bg-card border border-border hover:bg-secondary
          shadow-lg shadow-black/10 hover:shadow-xl hover:shadow-primary/20
          dark:bg-black dark:border-transparent dark:hover:bg-neutral-900
          dark:shadow-black/40 dark:hover:shadow-black/50
          transition-all duration-300 flex items-center justify-center overflow-hidden ${
          isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'
        }`}
        aria-label="Abrir chat de asistente"
      >
        <Image 
          src="/logo-upcrop.png" 
          alt="UpCrop Chat" 
          width={36} 
          height={36}
          className="object-contain"
        />
      </button>

      {/* Chat Window */}
      <div
        className={`fixed bottom-6 right-6 z-50 w-[380px] h-[520px] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ${
          isOpen
            ? 'scale-100 opacity-100 translate-y-0'
            : 'scale-95 opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        {/* Fixed Header - Always stays at top */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-[#4A6CF7] to-[#5B7DF8] px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
              <Image 
                src="/logo-upcrop.png" 
                alt="UpCrop" 
                width={28} 
                height={28}
                className="object-contain"
              />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">IA UpCrop</h3>
              <p className="text-blue-100 text-xs">En linea</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            aria-label="Cerrar chat"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Scrollable Messages Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4"
          style={{ height: 'calc(100% - 130px)' }}
        >
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                      message.isError
                        ? 'bg-red-500/10 border border-red-500/20'
                        : 'bg-[#4A6CF7]/10 border border-[#4A6CF7]/20'
                    }`}
                  >
                    {message.isError ? (
                      <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                    ) : (
                      <Bot className="w-3.5 h-3.5 text-[#4A6CF7]" />
                    )}
                  </div>
                )}

                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                    message.role === 'user'
                      ? 'bg-[#4A6CF7] text-white rounded-br-md'
                      : message.isError
                        ? 'bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-300 rounded-bl-md'
                        : 'bg-secondary border border-border text-foreground rounded-bl-md'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none text-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:bg-secondary [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_strong]:text-[#4A6CF7] [&_code]:bg-secondary [&_code]:px-1 [&_code]:rounded [&_p]:text-foreground">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm">{message.content}</p>
                  )}
                  <p
                    className={`text-[10px] mt-1 ${
                      message.role === 'user' ? 'text-blue-100' : 'text-muted-foreground'
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString('es-CL', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>

                {message.role === 'user' && (
                  <div className="w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center flex-shrink-0">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2 justify-start">
                <div className="w-7 h-7 rounded-full bg-[#4A6CF7]/10 border border-[#4A6CF7]/20 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3.5 h-3.5 text-[#4A6CF7]" />
                </div>
                <div className="bg-secondary border border-border rounded-2xl rounded-bl-md px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#4A6CF7] animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-[#4A6CF7] animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-[#4A6CF7] animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Fixed Input Area - Always stays at bottom */}
        <div className="sticky bottom-0 z-10 p-3 border-t border-border bg-card shrink-0">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu mensaje..."
              disabled={isLoading}
              className="flex-1 bg-secondary border-border rounded-full text-sm h-10 px-4"
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="bg-[#4A6CF7] hover:bg-[#3B5DE7] text-white rounded-full h-10 w-10"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
