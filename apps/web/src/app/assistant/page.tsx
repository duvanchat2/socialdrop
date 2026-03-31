'use client';
import { useState, useRef, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { Send, Bot, User } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      text: '¡Hola! Soy tu asistente de contenido para redes sociales. Puedo ayudarte a escribir captions, planificar posts y mejorar tu presencia en redes. ¿En qué te puedo ayudar hoy?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage: Message = { role: 'user', text: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const data = await apiFetch<{ reply: string }>('/api/assistant/chat', {
        method: 'POST',
        body: JSON.stringify({ message: trimmed }),
      });
      setMessages((prev) => [...prev, { role: 'assistant', text: data.reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: `Error al conectar con el asistente. Por favor intenta de nuevo.` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      <h1 className="text-2xl font-bold mb-4">Asistente IA</h1>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4 mb-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                msg.role === 'user' ? 'bg-indigo-600' : 'bg-gray-700'
              }`}
            >
              {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
            </div>
            <div
              className={`max-w-[75%] px-4 py-2 rounded-xl text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-none'
                  : 'bg-gray-800 text-gray-100 rounded-tl-none'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 flex-row">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
              <Bot size={14} />
            </div>
            <div className="bg-gray-800 text-gray-400 px-4 py-2 rounded-xl rounded-tl-none text-sm">
              <span className="animate-pulse">Escribiendo...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe un mensaje..."
          disabled={loading}
          className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="flex items-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-colors"
        >
          <Send size={16} />
          Enviar
        </button>
      </form>
    </div>
  );
}
