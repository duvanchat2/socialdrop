'use client';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Inbox, Send, Tag, Instagram, Facebook } from 'lucide-react';

interface Contact {
  id: string;
  platform: string;
  accountId: string;
  username?: string;
  name?: string;
  tags: string[];
  createdAt: string;
}

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  INSTAGRAM: <Instagram size={14} className="text-pink-500" />,
  FACEBOOK: <Facebook size={14} className="text-blue-500" />,
};

function initials(contact: Contact): string {
  const n = contact.name ?? contact.username ?? contact.accountId;
  return n.slice(0, 2).toUpperCase();
}

export default function InboxPage() {
  const [selected, setSelected] = useState<Contact | null>(null);
  const [reply, setReply] = useState('');

  const { data: contacts = [], isLoading } = useQuery<Contact[]>({
    queryKey: ['inbox'],
    queryFn: () => apiFetch('/api/inbox'),
  });

  const replyMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/inbox/${selected?.accountId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: reply }),
      }),
    onSuccess: () => setReply(''),
  });

  return (
    <div className="flex h-[calc(100vh-56px-48px)] -m-6 overflow-hidden">
      {/* Contact list */}
      <div className="w-72 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Inbox size={18} className="text-indigo-500" />
            <h1 className="font-semibold text-gray-900 dark:text-white">Bandeja</h1>
            {contacts.length > 0 && (
              <span className="ml-auto text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                {contacts.length}
              </span>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Cargando...</div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400 dark:text-gray-600 gap-2 px-4 text-center">
              <Inbox size={32} />
              <p className="text-sm">Sin contactos aún. Los mensajes y comentarios aparecerán aquí.</p>
            </div>
          ) : (
            contacts.map(contact => (
              <button
                key={contact.id}
                onClick={() => setSelected(contact)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left border-b border-gray-100 dark:border-gray-800 ${
                  selected?.id === contact.id ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {initials(contact)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {PLATFORM_ICONS[contact.platform]}
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {contact.name ?? contact.username ?? contact.accountId}
                    </span>
                  </div>
                  {contact.tags.length > 0 && (
                    <div className="flex gap-1 mt-0.5">
                      {contact.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main panel */}
      {selected ? (
        <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-950">
          {/* Contact header */}
          <div className="px-6 py-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold">
                {initials(selected)}
              </div>
              <div>
                <div className="font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                  {PLATFORM_ICONS[selected.platform]}
                  {selected.name ?? selected.username ?? selected.accountId}
                </div>
                <div className="text-xs text-gray-400">ID: {selected.accountId}</div>
              </div>
            </div>
            {selected.tags.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Tag size={14} className="text-gray-400" />
                {selected.tags.map(tag => (
                  <span key={tag} className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Messages area placeholder */}
          <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-600">
            <p className="text-sm">Historial de mensajes próximamente</p>
          </div>

          {/* Reply input */}
          <div className="px-4 py-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
            <div className="flex gap-2">
              <input
                value={reply}
                onChange={e => setReply(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && reply.trim()) { e.preventDefault(); replyMutation.mutate(); } }}
                placeholder="Escribe una respuesta..."
                className="flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white outline-none focus:border-indigo-400"
              />
              <button
                onClick={() => replyMutation.mutate()}
                disabled={!reply.trim() || replyMutation.isPending}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
              >
                <Send size={14} /> Enviar
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-600 gap-3">
          <Inbox size={40} />
          <p className="text-sm">Selecciona un contacto para ver la conversación</p>
        </div>
      )}
    </div>
  );
}
