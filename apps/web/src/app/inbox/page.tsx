'use client';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Inbox, Send, Tag } from 'lucide-react';
import { PlatformChip, Platform } from '@/components/PlatformChip';

interface Contact {
  id: string;
  platform: Platform;
  accountId: string;
  username?: string;
  name?: string;
  tags: string[];
  createdAt: string;
}

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
      <div className="w-72 flex-shrink-0 bg-surface flex flex-col">
        <div className="p-4 border-b border-white/[0.04]">
          <div className="flex items-center gap-2">
            <Inbox size={18} className="text-accent" />
            <h1 className="font-display font-semibold text-ink">Bandeja</h1>
            {contacts.length > 0 && (
              <span className="ml-auto text-xs bg-accent text-ink px-2 py-0.5 rounded-pill font-mono-nums">
                {contacts.length}
              </span>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-ink-muted text-sm">Cargando...</div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-ink-muted gap-2 px-4 text-center">
              <Inbox size={32} />
              <p className="text-sm">Sin contactos aún. Los mensajes y comentarios aparecerán aquí.</p>
            </div>
          ) : (
            contacts.map(contact => (
              <button
                key={contact.id}
                onClick={() => setSelected(contact)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors text-left border-b border-white/[0.04] ${
                  selected?.id === contact.id ? 'bg-accent/15' : ''
                }`}
              >
                <div className="w-9 h-9 rounded-pill bg-accent/15 text-accent flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {initials(contact)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <PlatformChip platform={contact.platform} size="sm" />
                    <span className="text-sm font-medium text-ink truncate">
                      {contact.name ?? contact.username ?? contact.accountId}
                    </span>
                  </div>
                  {contact.tags.length > 0 && (
                    <div className="flex gap-1 mt-0.5">
                      {contact.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-xs bg-surface-2 text-ink-muted px-1.5 py-0.5 rounded">
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
        <div className="flex-1 flex flex-col bg-base">
          {/* Contact header */}
          <div className="px-6 py-4 bg-surface border-b border-white/[0.04] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-pill bg-accent/15 text-accent flex items-center justify-center text-xs font-bold">
                {initials(selected)}
              </div>
              <div>
                <div className="font-medium text-ink flex items-center gap-1.5">
                  <PlatformChip platform={selected.platform} size="sm" />
                  {selected.name ?? selected.username ?? selected.accountId}
                </div>
                <div className="text-xs text-ink-muted">ID: {selected.accountId}</div>
              </div>
            </div>
            {selected.tags.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Tag size={14} className="text-ink-muted" />
                {selected.tags.map(tag => (
                  <span key={tag} className="text-xs bg-accent/15 text-accent px-2 py-0.5 rounded-pill">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Messages area placeholder */}
          <div className="flex-1 flex items-center justify-center text-ink-muted">
            <p className="text-sm">Historial de mensajes próximamente</p>
          </div>

          {/* Reply input */}
          <div className="px-4 py-3 bg-surface border-t border-white/[0.04]">
            <div className="flex gap-2">
              <input
                value={reply}
                onChange={e => setReply(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && reply.trim()) { e.preventDefault(); replyMutation.mutate(); } }}
                placeholder="Escribe una respuesta..."
                className="flex-1 px-4 py-2 rounded-lg bg-surface-2 text-sm text-ink outline-none focus:ring-2 focus:ring-accent"
              />
              <button
                onClick={() => replyMutation.mutate()}
                disabled={!reply.trim() || replyMutation.isPending}
                className="px-4 py-2 bg-accent hover:opacity-90 disabled:opacity-50 text-ink rounded-pill text-sm font-medium transition-colors flex items-center gap-1.5"
              >
                <Send size={14} /> Enviar
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-ink-muted gap-3">
          <Inbox size={40} />
          <p className="text-sm">Selecciona un contacto para ver la conversación</p>
        </div>
      )}
    </div>
  );
}
