'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useState, useEffect } from 'react';
import { StatusBadge, PostStatus } from '@/components/StatusBadge';
import { EditPostModal, EditablePost } from '@/components/EditPostModal';
import { X, Pencil } from 'lucide-react';

const PLATFORM_COLORS: Record<string, string> = {
  FACEBOOK: '#1877F2', INSTAGRAM: '#E1306C', TWITTER: '#1DA1F2',
  TIKTOK: '#69C9D0', YOUTUBE: '#FF0000',
};

interface Post {
  id: string; content: string; status: PostStatus; scheduledAt: string;
  integrations: { integration: { platform: string } }[];
}

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  backgroundColor: string;
  borderColor: string;
  extendedProps: Post;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FullCalendarWrapper({ events, onEventClick }: { events: CalendarEvent[]; onEventClick: (info: any) => void }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [FullCalCmp, setFC] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [plugins, setPlugins] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      import('@fullcalendar/react'),
      import('@fullcalendar/daygrid'),
      import('@fullcalendar/interaction'),
    ]).then(([fc, day, inter]) => {
      setFC(() => fc.default);
      setPlugins([day.default, inter.default]);
    });
  }, []);

  if (!FullCalCmp || plugins.length === 0) {
    return <div className="h-96 flex items-center justify-center text-gray-500">Cargando calendario...</div>;
  }

  return (
    <FullCalCmp
      plugins={plugins}
      initialView="dayGridMonth"
      events={events}
      eventClick={onEventClick}
      locale="es"
      height="auto"
      headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,dayGridWeek' }}
    />
  );
}

export default function CalendarPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Post | null>(null);
  const [editPost, setEditPost]  = useState<EditablePost | null>(null);

  const { data: posts = [] } = useQuery({
    queryKey: ['posts-all'],
    queryFn: () => apiFetch<Post[]>('/api/posts?userId=demo-user'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/posts/${id}?userId=demo-user`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['posts-all'] }); setSelected(null); },
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/posts/${id}/retry`, { method: 'POST' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['posts-all'] }); setSelected(null); },
  });

  const events: CalendarEvent[] = posts.map(p => {
    const platform = p.integrations[0]?.integration?.platform ?? 'FACEBOOK';
    return {
      id: p.id,
      title: p.content.slice(0, 40),
      start: p.scheduledAt,
      backgroundColor: PLATFORM_COLORS[platform] ?? '#6366f1',
      borderColor: 'transparent',
      extendedProps: p,
    };
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Calendario</h1>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 calendar-dark">
        <FullCalendarWrapper
          events={events}
          onEventClick={(info) => setSelected(info.event.extendedProps as Post)}
        />
      </div>

      {/* Event detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-start">
              <h3 className="font-semibold text-lg">Detalle del Post</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <p className="text-gray-300 text-sm">{selected.content}</p>
            <div className="flex items-center gap-2">
              <StatusBadge status={selected.status} />
              <span className="text-xs text-gray-400">
                {new Date(selected.scheduledAt).toLocaleString('es-CO', {
                  timeZone: 'America/Bogota',
                  day: '2-digit', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </div>
            <div className="flex gap-2 pt-2">
              {(selected.status === 'SCHEDULED' || selected.status === 'ERROR' || selected.status === 'PENDING') && (
                <button
                  onClick={() => { setEditPost(selected as EditablePost); setSelected(null); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 rounded-lg text-sm font-medium"
                >
                  <Pencil size={14} /> Editar
                </button>
              )}
              {selected.status === 'ERROR' && (
                <button
                  onClick={() => retryMutation.mutate(selected.id)}
                  className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 rounded-lg text-sm font-medium"
                >
                  Reintentar
                </button>
              )}
              <button
                onClick={() => { if (confirm('¿Eliminar este post?')) deleteMutation.mutate(selected.id); }}
                className="px-3 py-1.5 bg-red-700 hover:bg-red-600 rounded-lg text-sm font-medium"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
      <EditPostModal post={editPost} onClose={() => setEditPost(null)} />
    </div>
  );
}
