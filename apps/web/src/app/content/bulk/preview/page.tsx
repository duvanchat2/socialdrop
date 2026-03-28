'use client';
import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft, Trash2, Loader2, CalendarCheck, Film, ChevronDown,
} from 'lucide-react';

const USER_ID = 'demo-user';

const PLATFORM_COLORS: Record<string, string> = {
  INSTAGRAM: '#E1306C', TIKTOK: '#010101', FACEBOOK: '#1877F2',
  YOUTUBE: '#FF0000', TWITTER: '#1DA1F2',
};
const PLATFORM_LABELS: Record<string, string> = {
  INSTAGRAM: 'IG', TIKTOK: 'TT', FACEBOOK: 'FB', YOUTUBE: 'YT', TWITTER: 'TW',
};

interface PostDraft {
  index: number;
  mediaUrl: string;
  mediaFileName: string;
  mediaType: 'IMAGE' | 'VIDEO';
  platform: string;
  scheduledAt: string;
  caption: string;
  youtubeTitle?: string;
  youtubeDescription?: string;
  youtubeTags?: string[];
  contentType?: string;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', { weekday: 'short', month: 'short', day: 'numeric' });
}
function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function BulkPreviewPage() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<PostDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('ALL');
  const [bulkCaption, setBulkCaption] = useState('');
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [expandedYT, setExpandedYT] = useState<Set<number>>(new Set());

  useEffect(() => {
    const raw = sessionStorage.getItem('bulk_config');
    if (!raw) { setError('No hay configuración. Vuelve al paso anterior.'); setLoading(false); return; }

    let config: Record<string, unknown>;
    try { config = JSON.parse(raw); } catch { setError('Configuración inválida.'); setLoading(false); return; }

    apiFetch<PostDraft[]>(`/api/bulk/distribute?userId=${USER_ID}`, {
      method: 'POST',
      body: JSON.stringify(config),
    })
      .then((data) => { setDrafts(data); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, []);

  const updateDraft = (idx: number, patch: Partial<PostDraft>) => {
    setDrafts((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  };

  const removeDraft = (idx: number) => {
    setDrafts((prev) => prev.filter((_, i) => i !== idx));
  };

  const applyBulkCaption = () => {
    if (!bulkCaption.trim()) return;
    const filtered = filterPlatform === 'ALL'
      ? drafts
      : drafts.filter((d) => d.platform === filterPlatform);
    setDrafts((prev) => prev.map((d) => {
      if (filterPlatform !== 'ALL' && d.platform !== filterPlatform) return d;
      return { ...d, caption: bulkCaption };
    }));
    toast.success(`Caption aplicado a ${filtered.length} posts`);
    setShowBulkEdit(false);
    setBulkCaption('');
  };

  const toggleYT = (idx: number) => {
    setExpandedYT((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const scheduleMutation = useMutation({
    mutationFn: () => apiFetch<{ created: number }>(`/api/bulk/schedule?userId=${USER_ID}`, {
      method: 'POST',
      body: JSON.stringify({ drafts }),
    }),
    onSuccess: (data: { created: number }) => {
      toast.success(`✓ ${data.created} posts programados`);
      sessionStorage.removeItem('bulk_config');
      router.push('/calendar');
    },
    onError: (e: Error) => toast.error(`Error: ${e.message}`),
  });

  const visibleDrafts = filterPlatform === 'ALL' ? drafts : drafts.filter((d) => d.platform === filterPlatform);
  const platforms = [...new Set(drafts.map((d) => d.platform))];
  const dateRange = drafts.length
    ? `${fmtDate(drafts[0].scheduledAt)} → ${fmtDate(drafts[drafts.length - 1].scheduledAt)}`
    : '';

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-16 gap-4">
      <Loader2 className="animate-spin text-indigo-400" size={32} />
      <p className="text-gray-400">Generando vista previa…</p>
    </div>
  );

  if (error) return (
    <div className="p-8 text-center space-y-4">
      <p className="text-red-400">{error}</p>
      <button onClick={() => router.push('/content/bulk')} className="px-4 py-2 bg-gray-800 rounded-lg text-sm">← Volver</button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/content/bulk')}
            className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold">Vista Previa</h1>
            <p className="text-xs text-gray-400">{drafts.length} posts · {dateRange}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <select
            value={filterPlatform}
            onChange={(e) => setFilterPlatform(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none"
          >
            <option value="ALL">Todas las plataformas</option>
            {platforms.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <button
            onClick={() => setShowBulkEdit(!showBulkEdit)}
            className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300"
          >
            Editar todos
          </button>
        </div>
      </div>

      {/* Bulk caption editor */}
      {showBulkEdit && (
        <div className="bg-gray-900 border border-indigo-700 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-indigo-300">
            Aplicar caption a {filterPlatform === 'ALL' ? 'todos' : filterPlatform} ({visibleDrafts.length} posts)
          </p>
          <textarea
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 resize-none focus:outline-none focus:border-indigo-500"
            rows={3}
            placeholder="Escribe el caption aquí…"
            value={bulkCaption}
            onChange={(e) => setBulkCaption(e.target.value)}
          />
          <div className="flex gap-2">
            <button onClick={applyBulkCaption} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium">Aplicar</button>
            <button onClick={() => setShowBulkEdit(false)} className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm">Cancelar</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-left border-b border-gray-800 text-xs">
                <th className="px-3 py-3 font-medium w-8">#</th>
                <th className="px-3 py-3 font-medium w-12">Arch.</th>
                <th className="px-3 py-3 font-medium w-28">Día</th>
                <th className="px-3 py-3 font-medium w-24">Hora</th>
                <th className="px-3 py-3 font-medium w-16">Red</th>
                <th className="px-3 py-3 font-medium">Caption</th>
                <th className="px-3 py-3 font-medium w-8"></th>
              </tr>
            </thead>
            <tbody>
              {visibleDrafts.map((draft, visIdx) => {
                const realIdx = drafts.indexOf(draft);
                const isYT = draft.platform === 'YOUTUBE';
                const ytExpanded = expandedYT.has(realIdx);

                return (
                  <>
                    <tr key={`${realIdx}-row`} className="border-t border-gray-800 hover:bg-gray-800/30">
                      {/* # */}
                      <td className="px-3 py-2 text-gray-500 text-xs">{visIdx + 1}</td>

                      {/* Thumbnail */}
                      <td className="px-3 py-2">
                        <div className="w-10 h-10 rounded bg-gray-800 flex items-center justify-center overflow-hidden">
                          {draft.mediaType === 'IMAGE'
                            ? <img src={draft.mediaUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            : <Film size={16} className="text-gray-500" />}
                        </div>
                      </td>

                      {/* Day */}
                      <td className="px-3 py-2 text-gray-300 text-xs">{fmtDate(draft.scheduledAt)}</td>

                      {/* Time */}
                      <td className="px-3 py-2">
                        <input
                          type="time"
                          value={fmtTime(draft.scheduledAt)}
                          onChange={(e) => {
                            const base = draft.scheduledAt.slice(0, 10);
                            const newDt = `${base}T${e.target.value}:00`;
                            updateDraft(realIdx, { scheduledAt: new Date(newDt).toISOString() });
                          }}
                          className="bg-gray-800 border border-gray-700 rounded px-1.5 py-1 text-xs text-gray-200 w-20 focus:outline-none focus:border-indigo-500"
                        />
                      </td>

                      {/* Platform badge */}
                      <td className="px-3 py-2">
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-white text-xs font-medium"
                          style={{ background: PLATFORM_COLORS[draft.platform] ?? '#555' }}
                        >
                          {PLATFORM_LABELS[draft.platform] ?? draft.platform}
                        </span>
                      </td>

                      {/* Caption */}
                      <td className="px-3 py-2">
                        <textarea
                          value={draft.caption}
                          onChange={(e) => updateDraft(realIdx, { caption: e.target.value })}
                          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 resize-none focus:outline-none focus:border-indigo-500"
                          rows={2}
                          placeholder="Caption…"
                        />
                        {isYT && (
                          <button
                            type="button"
                            onClick={() => toggleYT(realIdx)}
                            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 mt-1"
                          >
                            <ChevronDown size={12} className={ytExpanded ? 'rotate-180 transition-transform' : 'transition-transform'} />
                            {ytExpanded ? 'Ocultar' : 'YouTube: título, descripción, tags'}
                          </button>
                        )}
                      </td>

                      {/* Delete */}
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => removeDraft(realIdx)}
                          className="p-1 text-gray-500 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>

                    {/* YouTube extra fields row */}
                    {isYT && ytExpanded && (
                      <tr key={`${realIdx}-yt`} className="border-t border-gray-700/50 bg-gray-800/30">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="text-xs text-gray-400 mb-1 block">Título (YT)</label>
                              <input
                                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
                                value={draft.youtubeTitle ?? ''}
                                onChange={(e) => updateDraft(realIdx, { youtubeTitle: e.target.value })}
                                placeholder="Título del video…"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-400 mb-1 block">Descripción (YT)</label>
                              <input
                                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
                                value={draft.youtubeDescription ?? ''}
                                onChange={(e) => updateDraft(realIdx, { youtubeDescription: e.target.value })}
                                placeholder="Descripción…"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-400 mb-1 block">Tags (coma)</label>
                              <input
                                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
                                value={(draft.youtubeTags ?? []).join(', ')}
                                onChange={(e) => updateDraft(realIdx, { youtubeTags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
                                placeholder="react, tutorial, shorts…"
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer summary + schedule button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
        <div>
          <p className="text-sm text-gray-300">
            <span className="font-semibold text-white">{drafts.length}</span> posts listos para programar en{' '}
            <span className="font-semibold text-white">{platforms.length}</span> plataforma(s)
          </p>
          {dateRange && <p className="text-xs text-gray-500 mt-0.5">{dateRange}</p>}
          {drafts.some((d) => !d.caption) && (
            <p className="text-xs text-amber-400 mt-1">⚠ {drafts.filter((d) => !d.caption).length} post(s) sin caption</p>
          )}
        </div>

        <button
          onClick={() => scheduleMutation.mutate()}
          disabled={scheduleMutation.isPending || !drafts.length}
          className="flex items-center gap-2 px-8 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-xl font-semibold text-sm transition-colors whitespace-nowrap"
        >
          {scheduleMutation.isPending
            ? <><Loader2 size={16} className="animate-spin" /> Programando…</>
            : <><CalendarCheck size={16} /> Programar todo →</>}
        </button>
      </div>
    </div>
  );
}
