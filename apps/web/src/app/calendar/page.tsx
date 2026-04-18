'use client';
import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { StatusBadge, PostStatus } from '@/components/StatusBadge';
import { EditPostModal, EditablePost } from '@/components/EditPostModal';
import { QuickUploadModal } from '@/components/QuickUploadModal';
import {
  Calendar as CalIcon, ChevronLeft, ChevronRight, Plus, List, LayoutGrid, X, Pencil,
} from 'lucide-react';
import { toast } from 'sonner';

const PLATFORM_COLORS: Record<string, string> = {
  FACEBOOK: '#4F46E5',   // indigo-600
  INSTAGRAM: '#E1306C',
  TWITTER: '#1DA1F2',
  LINKEDIN: '#0EA5E9',   // sky-500
  TIKTOK: '#000000',
  YOUTUBE: '#FF0000',
};

const PLATFORM_LABELS: Record<string, string> = {
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  TWITTER: 'Twitter / X',
  LINKEDIN: 'LinkedIn',
  TIKTOK: 'TikTok',
  YOUTUBE: 'YouTube',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface Post {
  id: string;
  content: string;
  status: PostStatus;
  scheduledAt: string;
  integrations: { integration: { platform: string } }[];
}

type ViewMode = 'grid' | 'list';

function getSavedView(): ViewMode {
  if (typeof window === 'undefined') return 'grid';
  const v = localStorage.getItem('calendar-view');
  return v === 'list' ? 'list' : 'grid';
}

/** Build a 7×N grid of dates covering the given month (with adjacent month fills). */
function buildMonthGrid(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1);
  const start = new Date(firstOfMonth);
  start.setDate(1 - firstOfMonth.getDay()); // back up to Sunday

  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(d);
  }
  // Trim to the last week that still contains the current month (5 or 6 weeks)
  const needSixWeeks = cells[35].getMonth() === month;
  return cells.slice(0, needSixWeeks ? 42 : 35);
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

export default function CalendarPage() {
  const qc = useQueryClient();
  const today = new Date();

  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [view, setView] = useState<ViewMode>('grid');
  const [selected, setSelected] = useState<Post | null>(null);
  const [editPost, setEditPost] = useState<EditablePost | null>(null);
  const [quickUploadDate, setQuickUploadDate] = useState<Date | null>(null);
  const [quickUploadFiles, setQuickUploadFiles] = useState<File[]>([]);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  useEffect(() => setView(getSavedView()), []);
  useEffect(() => { localStorage.setItem('calendar-view', view); }, [view]);

  const { data: posts = [] } = useQuery({
    queryKey: ['posts-all'],
    queryFn: () => apiFetch<Post[]>('/api/posts?userId=demo-user'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, scheduledAt }: { id: string; scheduledAt: string }) =>
      apiFetch(`/api/posts/${id}?userId=demo-user`, {
        method: 'PATCH',
        body: JSON.stringify({ scheduledAt }),
      }),
    onSuccess: () => {
      toast.success('Post reprogramado');
      qc.invalidateQueries({ queryKey: ['posts-all'] });
    },
    onError: (e: Error) => toast.error(`No se pudo reprogramar: ${e.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/posts/${id}?userId=demo-user`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['posts-all'] }); setSelected(null); },
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/posts/${id}/retry`, { method: 'POST' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['posts-all'] }); setSelected(null); },
  });

  const grid = useMemo(
    () => buildMonthGrid(cursor.getFullYear(), cursor.getMonth()),
    [cursor],
  );

  const postsByDay = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const p of posts) {
      const d = startOfDay(new Date(p.scheduledAt));
      const key = d.toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return map;
  }, [posts]);

  const counts = useMemo(() => {
    let scheduled = 0, published = 0;
    for (const p of posts) {
      if (p.status === 'SCHEDULED' || p.status === 'PENDING') scheduled++;
      else if (p.status === 'PUBLISHED') published++;
    }
    return { scheduled, published };
  }, [posts]);

  const goPrev = () => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
  const goNext = () => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));
  const goToday = () => setCursor(new Date(today.getFullYear(), today.getMonth(), 1));

  const handleDropOnDay = (targetDate: Date, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverKey(null);

    // Case 1 — dropping an existing post (drag started from a day cell)
    const postId = e.dataTransfer.getData('application/x-post-id');
    if (postId) {
      const source = posts.find((p) => p.id === postId);
      if (!source) return;
      const newDate = new Date(targetDate);
      const oldDate = new Date(source.scheduledAt);
      newDate.setHours(oldDate.getHours(), oldDate.getMinutes(), 0, 0);
      if (sameDay(newDate, oldDate)) return;
      updateMutation.mutate({ id: postId, scheduledAt: newDate.toISOString() });
      return;
    }

    // Case 2 — dropping files from OS → open QuickUpload
    if (e.dataTransfer.files.length > 0) {
      setQuickUploadFiles(Array.from(e.dataTransfer.files));
      setQuickUploadDate(targetDate);
    }
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <header>
        <h1 className="text-2xl font-bold">Calendar</h1>
        <p className="text-sm text-gray-400">View and manage your scheduled posts.</p>
      </header>

      {/* Toolbar card */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button
            onClick={goPrev}
            className="p-2 rounded-lg border border-gray-800 hover:bg-gray-800 text-gray-300"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="font-semibold mx-2">
            {MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}
          </span>
          <button
            onClick={goNext}
            className="p-2 rounded-lg border border-gray-800 hover:bg-gray-800 text-gray-300"
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={goToday}
            className="ml-1 px-3 py-1.5 rounded-lg border border-gray-800 hover:bg-gray-800 text-sm text-gray-300"
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-1 bg-gray-950 border border-gray-800 rounded-lg p-1">
          <button
            onClick={() => setView('list')}
            className={`p-1.5 rounded-md ${view === 'list' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            aria-label="List view"
          >
            <List size={16} />
          </button>
          <button
            onClick={() => setView('grid')}
            className={`p-1.5 rounded-md ${view === 'grid' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            aria-label="Grid view"
          >
            <LayoutGrid size={16} />
          </button>
        </div>

        <span className="px-3 py-1 rounded-full text-xs border border-indigo-500/40 text-indigo-400 bg-indigo-950/40">
          {counts.scheduled} scheduled
        </span>
        <span className="px-3 py-1 rounded-full text-xs border border-emerald-500/40 text-emerald-400 bg-emerald-950/40">
          {counts.published} published
        </span>

        <Link
          href="/posts/new"
          className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-sm font-medium"
        >
          <Plus size={16} />
          New Post
        </Link>
      </div>

      {/* Schedule card */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <CalIcon size={16} className="text-indigo-400" />
          <h2 className="font-semibold">{MONTH_NAMES[cursor.getMonth()]} Schedule</h2>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Click on a post to view details or a day to create a new post.
        </p>

        {view === 'grid' ? (
          <>
            {/* Day-name row */}
            <div className="grid grid-cols-7 text-xs text-gray-500 mb-1">
              {DAY_NAMES.map((d) => (
                <div key={d} className="px-2 py-1">{d}</div>
              ))}
            </div>

            {/* Month grid */}
            <div className="grid grid-cols-7 border-l border-t border-gray-800 rounded-lg overflow-hidden">
              {grid.map((date) => {
                const key = date.toDateString();
                const inMonth = date.getMonth() === cursor.getMonth();
                const isToday = sameDay(date, today);
                const dayPosts = postsByDay.get(key) ?? [];
                const isDragOver = dragOverKey === key;

                return (
                  <div
                    key={key}
                    onClick={(e) => {
                      // Only create-post when the empty area is clicked (not a post pill)
                      if ((e.target as HTMLElement).closest('[data-post-pill]')) return;
                      setQuickUploadFiles([]);
                      setQuickUploadDate(date);
                    }}
                    onDragOver={(e) => { e.preventDefault(); setDragOverKey(key); }}
                    onDragLeave={() => setDragOverKey((prev) => (prev === key ? null : prev))}
                    onDrop={(e) => handleDropOnDay(date, e)}
                    className={`relative min-h-[92px] border-r border-b border-gray-800 p-2 cursor-pointer transition-colors ${
                      isDragOver ? 'bg-indigo-950/40' : 'hover:bg-gray-800/40'
                    } ${inMonth ? '' : 'bg-gray-950/40'}`}
                  >
                    <div className="flex items-center justify-start">
                      {isToday ? (
                        <span className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-xs font-semibold text-white">
                          {date.getDate()}
                        </span>
                      ) : (
                        <span className={`text-xs ${inMonth ? 'text-gray-300' : 'text-gray-600'}`}>
                          {date.getDate()}
                        </span>
                      )}
                    </div>

                    <div className="mt-1 space-y-1">
                      {dayPosts.slice(0, 3).map((p) => {
                        const plat = p.integrations[0]?.integration?.platform ?? 'FACEBOOK';
                        return (
                          <div
                            key={p.id}
                            data-post-pill
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('application/x-post-id', p.id);
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onClick={(e) => { e.stopPropagation(); setSelected(p); }}
                            title={`${PLATFORM_LABELS[plat] ?? plat} — ${p.content.slice(0, 60)}`}
                            className="truncate text-[11px] px-2 py-0.5 rounded text-white cursor-grab active:cursor-grabbing"
                            style={{ background: PLATFORM_COLORS[plat] ?? '#6366f1' }}
                          >
                            {p.content.slice(0, 30) || '(sin contenido)'}
                          </div>
                        );
                      })}
                      {dayPosts.length > 3 && (
                        <div className="text-[10px] text-gray-500">+{dayPosts.length - 3} más</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <ListView posts={posts} onSelect={setSelected} />
        )}
      </div>

      {/* Post detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-start">
              <h3 className="font-semibold text-lg">Detalle del Post</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <p className="text-gray-300 text-sm">{selected.content}</p>
            <div className="flex items-center gap-2">
              <StatusBadge status={selected.status} />
              <span className="text-xs text-gray-400">
                {new Date(selected.scheduledAt).toLocaleString('es-CO', {
                  timeZone: 'America/Bogota',
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
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

      <QuickUploadModal
        date={quickUploadDate}
        initialFiles={quickUploadFiles}
        onClose={() => {
          setQuickUploadDate(null);
          setQuickUploadFiles([]);
        }}
      />
    </div>
  );
}

function ListView({ posts, onSelect }: { posts: Post[]; onSelect: (p: Post) => void }) {
  const upcoming = posts
    .slice()
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  if (upcoming.length === 0) {
    return <p className="text-sm text-gray-500 py-6 text-center">No hay posts.</p>;
  }

  return (
    <ul className="divide-y divide-gray-800">
      {upcoming.map((p) => {
        const plat = p.integrations[0]?.integration?.platform ?? 'FACEBOOK';
        return (
          <li
            key={p.id}
            onClick={() => onSelect(p)}
            className="flex items-center gap-3 py-3 cursor-pointer hover:bg-gray-800/40 px-2 rounded-md"
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: PLATFORM_COLORS[plat] ?? '#6366f1' }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm truncate">{p.content || '(sin contenido)'}</p>
              <p className="text-xs text-gray-500">
                {PLATFORM_LABELS[plat] ?? plat} ·{' '}
                {new Date(p.scheduledAt).toLocaleString('es-CO', {
                  timeZone: 'America/Bogota',
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <StatusBadge status={p.status} />
          </li>
        );
      })}
    </ul>
  );
}
