"use client"

import { useEffect, useRef, useState } from "react"

interface CourseAIAssistantProps {
  courseId: string
  moduleId?: string
  courseName?: string
}

interface AIMessage {
  role: "user" | "assistant"
  content: string
  isError?: boolean
}

export function CourseAIAssistant({ courseId, moduleId, courseName }: CourseAIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // Greeting added as first message when opened
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50)
    }
  }, [messages, isOpen])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || isLoading) return

    setInput("")
    const updatedMessages: AIMessage[] = [...messages, { role: "user", content: text }]
    setMessages(updatedMessages)
    setIsLoading(true)

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          moduleId,
          messages: updatedMessages
            .filter(m => !m.isError)
            .map(m => ({ role: m.role, content: m.content }))
            .slice(-20),
        }),
      })

      const data = await res.json()

      if (data.success) {
        setMessages(prev => [...prev, { role: "assistant", content: data.data.message }])
      } else {
        setMessages(prev => [
          ...prev,
          { role: "assistant", content: data.error || "Error al obtener respuesta.", isError: true },
        ])
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "Error de conexión. Por favor intenta de nuevo.", isError: true },
      ])
    } finally {
      setIsLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend(e)
    }
  }

  const SparkleIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
    </svg>
  )

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 z-40 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl px-4 py-3 shadow-xl transition group"
        aria-label="Abrir asistente IA del curso"
      >
        <SparkleIcon />
        <span className="text-sm font-semibold hidden sm:inline">Asistente IA</span>
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 left-6 z-50 w-80 h-[500px] flex flex-col rounded-2xl border border-zinc-700 bg-ap-ink shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700 bg-ap-ink/95 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
            <SparkleIcon />
          </div>
          <div>
            <p className="text-sm font-semibold text-ap-ivory leading-none">Asistente IA</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              {moduleId ? "Contexto: módulo actual" : "Contexto: curso completo"}
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-zinc-400 hover:text-ap-ivory transition text-lg leading-none"
          aria-label="Cerrar"
        >
          ×
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Welcome message */}
        {messages.length === 0 && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <div className="bg-white/8 border border-white/10 rounded-xl rounded-tl-sm px-3 py-2 max-w-[85%]">
              <p className="text-sm text-zinc-300 leading-relaxed">
                ¡Hola! Soy tu asistente de IA para{" "}
                <span className="text-ap-ivory font-medium">{courseName || "este curso"}</span>.
                Puedo ayudarte a entender el contenido y responder tus dudas. ¿En qué puedo ayudarte?
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            {msg.role === "assistant" && (
              <div className="w-6 h-6 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
            )}
            <div
              className={`px-3 py-2 rounded-xl max-w-[85%] text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white rounded-tr-sm"
                  : msg.isError
                  ? "bg-red-900/30 border border-red-800/30 text-red-400 rounded-tl-sm"
                  : "bg-white/8 border border-white/10 text-zinc-300 rounded-tl-sm"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <div className="bg-white/8 border border-white/10 rounded-xl rounded-tl-sm px-3 py-2">
              <div className="flex gap-1 items-center h-5">
                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Disclaimer */}
      <p className="text-[10px] text-zinc-600 text-center py-1 shrink-0">
        Generado por IA · Puede contener errores
      </p>

      {/* Input */}
      <form onSubmit={handleSend} className="px-3 pb-3 shrink-0">
        <div className="flex gap-2 items-end bg-white/5 border border-zinc-700 rounded-xl px-3 py-2 focus-within:border-indigo-500/50 transition">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu pregunta..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-ap-ivory placeholder:text-zinc-500 outline-none resize-none max-h-24 leading-relaxed"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Enviar"
          >
            <svg className="w-3.5 h-3.5 rotate-90" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  )
}
