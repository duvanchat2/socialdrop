'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import {
  Users, Plus, Trash2, Zap, RefreshCw, TrendingUp, Hash,
  Clock, BarChart2, ExternalLink, ChevronRight, X,
} from 'lucide-react';

const USER_ID = 'demo-user';

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface Competitor {
  id: string;
  username: string;
  platform: string;
  displayName?: string;
  avatar?: string;
  followers?: number;
  following?: number;
  postsCount?: number;
  bio?: string;
  isActive: boolean;
  createdAt: string;
  analyses: CompetitorAnalysis[];
  _count?: { posts: number };
}

interface CompetitorAnalysis {
  id: string;
  summary: string;
  hooks: string[];
  themes: string[];
  bestFormats: string[];
  recommendations: string[];
  createdAt: string;
}

interface PostAnalysis {
  competitorId: string;
  username: string;
  postsAnalyzed: number;
  engagementRate: string | null;
  postsPerWeek: string;
  bestPostingTime: { hour: number; label: string } | null;
  bestDay: { day: number; label: string } | null;
  bestFormat: string | null;
  formats: { format: string; count: number; avgEngagement: number }[];
  topHashtags: { tag: string; count: number; avgEngagement: number }[];
  topPosts: {
    postId: string; url?: string; thumbnail?: string;
    likes: number; comments: number; caption?: string;
    mediaType: string; hashtags: string[]; publishedAt: string;
  }[];
  hourHeatmap: { hour: number; avgEngagement: number; count: number }[];
  dayHeatmap: { day: number; label: string; avgEngagement: number; count: number }[];
}

interface Trends {
  topHashtags: { tag: string; count: number }[];
  topFormats: { format: string; count: number }[];
  bestHour: { hour: number; posts: number } | null;
  totalPostsAnalyzed: number;
}

const PLATFORM_COLORS: Record<string, string> = {
  INSTAGRAM: '#E1306C', TIKTOK: '#000000', FACEBOOK: '#1877F2',
  YOUTUBE: '#FF0000', TWITTER: '#1DA1F2', LINKEDIN: '#0077B5',
};
const PLATFORM_EMOJI: Record<string, string> = {
  INSTAGRAM: '📸', TIKTOK: '🎵', FACEBOOK: '👥', YOUTUBE: '▶️', TWITTER: '🐦', LINKEDIN: '💼',
};
const PLATFORMS = ['INSTAGRAM', 'TIKTOK', 'FACEBOOK', 'YOUTUBE', 'TWITTER', 'LINKEDIN'];
const TABS = ['Resumen', 'Mejores posts', 'Hashtags', 'Horarios', 'Comparativa'] as const;
type Tab = typeof TABS[number];

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('es-CO');
}

function Pill({ text, color = '#6366f1' }: { text: string; color?: string }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-medium mr-1 mb-1"
      style={{ background: `${color}22`, color }}
    >
      {text}
    </span>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function CompetitorsPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal]         = useState(false);
  const [form, setForm]                   = useState({ username: '', platform: 'INSTAGRAM' });
  const [selectedId, setSelectedId]       = useState<string | null>(null);
  const [tab, setTab]                     = useState<Tab>('Resumen');
  const [analyzing, setAnalyzing]         = useState<Set<string>>(new Set());

  const { data: competitors = [], isLoading } = useQuery({
    queryKey: ['competitors'],
    queryFn: () => apiFetch<Competitor[]>(`/api/competitors?userId=${USER_ID}`),
  });

  const selected = competitors.find((c) => c.id === selectedId) ?? null;

  const { data: _postAnalysisRaw } = useQuery({
    queryKey: ['competitor-analysis', selectedId],
    queryFn: () => apiFetch<PostAnalysis | { message: string }>(`/api/competitors/${selectedId}/analysis`),
    enabled: !!selectedId,
  });
  // API returns {message} when no posts — treat as null
  const postAnalysis: PostAnalysis | null = (_postAnalysisRaw && 'formats' in (_postAnalysisRaw as any))
    ? (_postAnalysisRaw as PostAnalysis)
    : null;

  const { data: trends } = useQuery({
    queryKey: ['competitor-trends'],
    queryFn: () => apiFetch<Trends>(`/api/competitors/trends?userId=${USER_ID}`),
  });

  const addMutation = useMutation({
    mutationFn: (d: { username: string; platform: string }) =>
      apiFetch('/api/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...d, userId: USER_ID }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['competitors'] });
      setShowModal(false);
      setForm({ username: '', platform: 'INSTAGRAM' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/competitors/${id}`, { method: 'DELETE' }),
    onSuccess: (_d, id) => {
      void qc.invalidateQueries({ queryKey: ['competitors'] });
      if (selectedId === id) setSelectedId(null);
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/competitors/${id}/analyze?userId=${USER_ID}`, { method: 'POST' }),
    onSuccess: (_d, id) => {
      void qc.invalidateQueries({ queryKey: ['competitors'] });
      setAnalyzing((prev) => { const s = new Set(prev); s.delete(id); return s; });
    },
    onError: (_e, id) => {
      setAnalyzing((prev) => { const s = new Set(prev); s.delete(id); return s; });
    },
  });

  function handleAnalyze(id: string) {
    setAnalyzing((prev) => new Set(prev).add(id));
    analyzeMutation.mutate(id);
  }

  return (
    <div className="flex h-full min-h-screen bg-gray-950">
      {/* ── Left sidebar ── */}
      <aside className="w-72 shrink-0 border-r border-gray-800 bg-gray-900 flex flex-col">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-indigo-400" />
            <h1 className="font-semibold text-sm">Competidores</h1>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isLoading && (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <RefreshCw className="animate-spin" size={16} />
            </div>
          )}

          {!isLoading && competitors.length === 0 && (
            <div className="text-center py-10 px-4">
              <Users size={32} className="mx-auto text-gray-700 mb-3" />
              <p className="text-xs text-gray-500">Agrega competidores para empezar.</p>
              <button
                onClick={() => setShowModal(true)}
                className="mt-3 text-xs text-indigo-400 hover:text-indigo-300"
              >
                + Agregar competidor
              </button>
            </div>
          )}

          {competitors.map((c) => {
            const color = PLATFORM_COLORS[c.platform] ?? '#6366f1';
            const isSelected = c.id === selectedId;
            return (
              <div
                key={c.id}
                onClick={() => { setSelectedId(c.id); setTab('Resumen'); }}
                className={`rounded-lg p-3 cursor-pointer transition-all group ${
                  isSelected ? 'bg-indigo-950/60 border border-indigo-700/50' : 'hover:bg-gray-800 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar / initial */}
                  <div
                    className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-sm font-bold overflow-hidden"
                    style={{ background: `${color}33`, color }}
                  >
                    {c.avatar
                      ? <img src={c.avatar} alt="" className="w-full h-full object-cover" />
                      : c.username[0].toUpperCase()
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-gray-100">@{c.username}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px]" style={{ color }}>{PLATFORM_EMOJI[c.platform]} {c.platform}</span>
                      {c.followers != null && (
                        <span className="text-[10px] text-gray-500">{fmtNum(c.followers)}</span>
                      )}
                      {(c._count?.posts ?? 0) > 0 && (
                        <span className="text-[10px] text-indigo-400">{c._count!.posts} posts</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleAnalyze(c.id); }}
                      disabled={analyzing.has(c.id)}
                      className="p-1 text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
                      title="Analizar con IA"
                    >
                      <Zap size={12} className={analyzing.has(c.id) ? 'animate-pulse' : ''} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(c.id); }}
                      className="p-1 text-gray-500 hover:text-red-400"
                      title="Eliminar"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  {isSelected && <ChevronRight size={12} className="text-indigo-400 shrink-0" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Trends footer */}
        {trends && trends.totalPostsAnalyzed > 0 && (
          <div className="p-3 border-t border-gray-800 space-y-1">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Tendencias globales</p>
            <p className="text-xs text-gray-400">
              {trends.topFormats[0]?.format ?? '—'} domina •{' '}
              {trends.bestHour ? `Mejor hora: ${trends.bestHour.hour}:00` : ''}
            </p>
            <p className="text-[10px] text-gray-600">{trends.totalPostsAnalyzed} posts analizados</p>
          </div>
        )}
      </aside>

      {/* ── Main panel ── */}
      <main className="flex-1 overflow-y-auto">
        {!selected ? (
          <EmptyState onAdd={() => setShowModal(true)} hasData={competitors.length > 0} />
        ) : (
          <CompetitorDetail
            competitor={selected}
            analysis={postAnalysis ?? null}
            tab={tab}
            onTabChange={setTab}
            onAnalyze={() => handleAnalyze(selected.id)}
            analyzing={analyzing.has(selected.id)}
          />
        )}
      </main>

      {/* ── Add modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Agregar competidor</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Nombre de usuario</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  placeholder="ej. cocacola"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Plataforma</label>
                <select
                  value={form.platform}
                  onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                >
                  {PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_EMOJI[p]} {p}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-3 py-2 text-sm border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={() => addMutation.mutate(form)}
                disabled={!form.username || addMutation.isPending}
                className="flex-1 px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-white font-medium"
              >
                {addMutation.isPending ? 'Guardando…' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Empty state ────────────────────────────────────────────────────────── */
function EmptyState({ onAdd, hasData }: { onAdd: () => void; hasData: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-20 text-center px-8">
      <Users size={48} className="text-gray-700 mb-4" />
      <h2 className="text-lg font-semibold text-gray-300 mb-2">
        {hasData ? 'Selecciona un competidor' : 'Inteligencia Competitiva'}
      </h2>
      <p className="text-sm text-gray-500 max-w-sm">
        {hasData
          ? 'Haz clic en un competidor del panel izquierdo para ver su análisis.'
          : 'Agrega competidores y usa la extensión de Chrome para capturar sus datos de Instagram.'}
      </p>
      {!hasData && (
        <button
          onClick={onAdd}
          className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg"
        >
          + Agregar competidor
        </button>
      )}
      {!hasData && (
        <div className="mt-6 bg-gray-900 border border-gray-800 rounded-xl p-4 text-left max-w-sm">
          <p className="text-xs font-semibold text-gray-400 mb-2">📦 Cómo usar la extensión</p>
          <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
            <li>Carga <code className="text-indigo-400">apps/extension/</code> en chrome://extensions</li>
            <li>Navega al perfil del competidor en Instagram</li>
            <li>Haz clic en el ícono de SocialDrop</li>
            <li>Presiona "Analizar este perfil"</li>
          </ol>
        </div>
      )}
    </div>
  );
}

/* ─── Competitor detail ──────────────────────────────────────────────────── */
function CompetitorDetail({
  competitor: c,
  analysis: a,
  tab,
  onTabChange,
  onAnalyze,
  analyzing,
}: {
  competitor: Competitor;
  analysis: PostAnalysis | null;
  tab: Tab;
  onTabChange: (t: Tab) => void;
  onAnalyze: () => void;
  analyzing: boolean;
}) {
  const color = PLATFORM_COLORS[c.platform] ?? '#6366f1';
  const latestAiAnalysis = c.analyses[0] ?? null;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Profile header */}
      <div className="flex items-start gap-4">
        <div
          className="w-16 h-16 rounded-full shrink-0 flex items-center justify-center text-2xl font-bold overflow-hidden"
          style={{ background: `${color}22`, color }}
        >
          {c.avatar
            ? <img src={c.avatar} alt="" className="w-full h-full object-cover" />
            : c.username[0].toUpperCase()
          }
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold">@{c.username}</h2>
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: `${color}22`, color }}
            >
              {PLATFORM_EMOJI[c.platform]} {c.platform}
            </span>
            <a
              href={`https://www.instagram.com/${c.username}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 text-gray-500 hover:text-indigo-400"
            >
              <ExternalLink size={13} />
            </a>
          </div>
          {c.displayName && <p className="text-sm text-gray-400 mt-0.5">{c.displayName}</p>}
          {c.bio && <p className="text-xs text-gray-500 mt-1 max-w-md">{c.bio}</p>}
          <div className="flex gap-4 mt-2 text-sm text-gray-300">
            {c.followers != null && <span><b>{fmtNum(c.followers)}</b> <span className="text-gray-500 text-xs">seguidores</span></span>}
            {c.following != null && <span><b>{fmtNum(c.following)}</b> <span className="text-gray-500 text-xs">seguidos</span></span>}
            {c.postsCount != null && <span><b>{fmtNum(c.postsCount)}</b> <span className="text-gray-500 text-xs">posts</span></span>}
          </div>
        </div>
        <button
          onClick={onAnalyze}
          disabled={analyzing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
        >
          <Zap size={13} className={analyzing ? 'animate-pulse' : ''} />
          {analyzing ? 'Analizando…' : 'Análisis IA'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 rounded-lg p-1 border border-gray-800">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => onTabChange(t)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tab === t
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'Resumen'       && <TabResumen analysis={a} aiAnalysis={latestAiAnalysis} />}
      {tab === 'Mejores posts' && <TabTopPosts analysis={a} />}
      {tab === 'Hashtags'      && <TabHashtags analysis={a} />}
      {tab === 'Horarios'      && <TabSchedule analysis={a} />}
      {tab === 'Comparativa'   && <TabComparativa competitor={c} />}
    </div>
  );
}

/* ─── Tab: Resumen ───────────────────────────────────────────────────────── */
function TabResumen({ analysis: a, aiAnalysis }: { analysis: PostAnalysis | null; aiAnalysis: CompetitorAnalysis | null }) {
  if (!a && !aiAnalysis) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
        <p className="text-gray-500 text-sm">Sin datos aún. Usa la extensión de Chrome para capturar posts.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {a && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Posts analizados', value: a.postsAnalyzed, icon: BarChart2 },
              { label: 'Posts / semana', value: a.postsPerWeek, icon: TrendingUp },
              { label: 'Engagement rate', value: a.engagementRate ?? '—', icon: Zap },
              { label: 'Mejor formato', value: a.bestFormat ?? '—', icon: Hash },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <Icon size={14} className="text-indigo-400 mb-2" />
                <p className="text-lg font-bold text-white">{value}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Format breakdown */}
          {a.formats.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Rendimiento por formato</p>
              <div className="space-y-2">
                {a.formats.sort((x, y) => y.avgEngagement - x.avgEngagement).map((f) => (
                  <div key={f.format} className="flex items-center gap-3">
                    <span className="text-xs text-gray-300 w-20 shrink-0">{f.format}</span>
                    <div className="flex-1 bg-gray-800 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-indigo-500"
                        style={{ width: `${Math.min(100, (f.avgEngagement / (a.formats[0]?.avgEngagement || 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-16 text-right">{fmtNum(f.avgEngagement)} eng</span>
                    <span className="text-[10px] text-gray-600 w-14 text-right">{f.count} posts</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Best time */}
          {(a.bestPostingTime || a.bestDay) && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
              <Clock size={18} className="text-indigo-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-white">Mejor momento para publicar</p>
                <p className="text-xs text-gray-400">
                  {a.bestDay?.label ?? ''}{a.bestDay && a.bestPostingTime ? ' · ' : ''}{a.bestPostingTime?.label ?? ''}
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* AI analysis */}
      {aiAnalysis && (
        <div className="bg-indigo-950/20 border border-indigo-800/30 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Análisis IA</p>
          <p className="text-sm text-gray-300 leading-relaxed">{aiAnalysis.summary}</p>
          {aiAnalysis.hooks.length > 0 && (
            <div><p className="text-[10px] text-gray-500 uppercase mb-1">Hooks</p><div className="flex flex-wrap">{aiAnalysis.hooks.map((h, i) => <Pill key={i} text={h} color="#6366f1" />)}</div></div>
          )}
          {aiAnalysis.themes.length > 0 && (
            <div><p className="text-[10px] text-gray-500 uppercase mb-1">Temas</p><div className="flex flex-wrap">{aiAnalysis.themes.map((t, i) => <Pill key={i} text={t} color="#14b8a6" />)}</div></div>
          )}
          {aiAnalysis.recommendations.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-500 uppercase mb-1">Recomendaciones</p>
              <ol className="space-y-1">
                {aiAnalysis.recommendations.map((r, i) => (
                  <li key={i} className="flex gap-2 text-xs text-gray-300">
                    <span className="shrink-0 w-4 h-4 rounded-full bg-indigo-900/60 text-indigo-400 flex items-center justify-center text-[9px] font-bold mt-0.5">{i + 1}</span>
                    {r}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Tab: Mejores posts ─────────────────────────────────────────────────── */
function TabTopPosts({ analysis: a }: { analysis: PostAnalysis | null }) {
  if (!a?.topPosts.length) return <NoDataCard />;
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">Top 5 posts por engagement</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {a.topPosts.map((p, i) => (
          <div key={p.postId} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex gap-3 p-3">
            <div className="relative w-16 h-16 shrink-0 bg-gray-800 rounded-lg overflow-hidden">
              {p.thumbnail
                ? <img src={p.thumbnail} alt="" className="w-full h-full object-cover" />
                : <span className="flex items-center justify-center h-full text-gray-600 text-xl">
                    {p.mediaType === 'VIDEO' ? '🎬' : '🖼️'}
                  </span>
              }
              <span className="absolute top-1 left-1 bg-black/70 text-white text-[9px] px-1 rounded font-bold">#{i + 1}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-300 line-clamp-2 mb-1">{p.caption ?? '(sin caption)'}</p>
              <div className="flex gap-3 text-xs text-gray-400">
                <span>❤️ {fmtNum(p.likes)}</span>
                <span>💬 {fmtNum(p.comments)}</span>
              </div>
              {p.hashtags.slice(0, 3).length > 0 && (
                <div className="flex flex-wrap mt-1">
                  {p.hashtags.slice(0, 3).map((h) => (
                    <span key={h} className="text-[9px] text-indigo-400 mr-1">#{h}</span>
                  ))}
                </div>
              )}
              {p.url && (
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-400 hover:underline flex items-center gap-0.5 mt-1">
                  Ver post <ExternalLink size={9} />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Tab: Hashtags ──────────────────────────────────────────────────────── */
function TabHashtags({ analysis: a }: { analysis: PostAnalysis | null }) {
  if (!a?.topHashtags.length) return <NoDataCard />;

  const maxCount = a.topHashtags[0]?.count ?? 1;
  return (
    <div className="space-y-4">
      {/* Tag cloud */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Nube de hashtags</p>
        <div className="flex flex-wrap gap-2">
          {a.topHashtags.map(({ tag, count }) => {
            const size = 10 + Math.round((count / maxCount) * 12);
            return (
              <span
                key={tag}
                className="text-indigo-400 hover:text-indigo-300 cursor-default transition-colors"
                style={{ fontSize: `${size}px` }}
              >
                #{tag}
              </span>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Hashtag</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Usos</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Eng. promedio</th>
            </tr>
          </thead>
          <tbody>
            {a.topHashtags.slice(0, 15).map(({ tag, count, avgEngagement }) => (
              <tr key={tag} className="border-b border-gray-800/50 hover:bg-gray-800/50">
                <td className="px-4 py-2 text-indigo-400 font-mono text-xs">#{tag}</td>
                <td className="px-4 py-2 text-right text-gray-300">{count}</td>
                <td className="px-4 py-2 text-right text-gray-400">{fmtNum(avgEngagement)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Tab: Horarios ──────────────────────────────────────────────────────── */
function TabSchedule({ analysis: a }: { analysis: PostAnalysis | null }) {
  if (!a?.hourHeatmap.length) return <NoDataCard />;

  const maxHourEng = Math.max(...a.hourHeatmap.map((h) => h.avgEngagement), 1);
  const maxDayEng  = Math.max(...a.dayHeatmap.map((d) => d.avgEngagement), 1);

  return (
    <div className="space-y-4">
      {/* Hour heatmap */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Engagement por hora del día (UTC)</p>
        <div className="flex gap-0.5 items-end h-16">
          {a.hourHeatmap.map(({ hour, avgEngagement }) => {
            const pct = avgEngagement / maxHourEng;
            return (
              <div key={hour} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                <div
                  className="w-full rounded-t-sm bg-indigo-500 transition-all"
                  style={{ height: `${Math.max(4, pct * 56)}px`, opacity: 0.3 + pct * 0.7 }}
                />
                {hour % 6 === 0 && (
                  <span className="text-[8px] text-gray-600">{hour}</span>
                )}
                {/* Tooltip */}
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-800 text-[9px] text-white px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                  {hour}:00 · {fmtNum(avgEngagement)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Day heatmap */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Engagement por día de la semana</p>
        <div className="grid grid-cols-7 gap-1">
          {a.dayHeatmap.map(({ day, label, avgEngagement, count }) => {
            const pct = avgEngagement / maxDayEng;
            const bg = `rgba(99,102,241,${0.15 + pct * 0.75})`;
            return (
              <div
                key={day}
                className="rounded-lg p-2 text-center cursor-default"
                style={{ background: bg }}
              >
                <p className="text-[10px] text-gray-300 font-medium">{label}</p>
                <p className="text-xs font-bold text-white mt-0.5">{fmtNum(avgEngagement)}</p>
                <p className="text-[9px] text-gray-500">{count} posts</p>
              </div>
            );
          })}
        </div>
        {a.bestDay && (
          <p className="text-xs text-indigo-400 mt-3">
            ✓ Mejor día: <b>{a.bestDay.label}</b>
            {a.bestPostingTime && <span> a las <b>{a.bestPostingTime.label}</b></span>}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Tab: Comparativa ───────────────────────────────────────────────────── */
function TabComparativa({ competitor: c }: { competitor: Competitor }) {
  const { data: benchmark } = useQuery({
    queryKey: ['competitors-benchmark'],
    queryFn: () => apiFetch<{ myMetrics: Record<string, { followersCount: number }>; competitors: { id: string; username: string; platform: string; followers: number | null; myFollowers: number | null }[] }>(`/api/competitors/benchmark?userId=${USER_ID}`),
  });

  const myFollowers = benchmark?.myMetrics?.[c.platform]?.followersCount ?? null;
  const theirFollowers = c.followers ?? null;
  const diff = myFollowers != null && theirFollowers != null ? myFollowers - theirFollowers : null;

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Tú vs @{c.username}</p>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Tus seguidores', value: myFollowers != null ? fmtNum(myFollowers) : '—', highlight: diff != null && diff >= 0 },
            { label: `@${c.username}`, value: theirFollowers != null ? fmtNum(theirFollowers) : '—', highlight: diff != null && diff < 0 },
          ].map(({ label, value, highlight }) => (
            <div
              key={label}
              className={`rounded-xl p-4 border ${
                highlight ? 'border-indigo-600/50 bg-indigo-950/30' : 'border-gray-700 bg-gray-800'
              }`}
            >
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className="text-2xl font-bold text-white">{value}</p>
            </div>
          ))}
        </div>
        {diff != null && (
          <p className={`mt-3 text-sm font-semibold ${diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {diff >= 0
              ? `✓ Llevas ${fmtNum(Math.abs(diff))} seguidores más`
              : `⚠ Te faltan ${fmtNum(Math.abs(diff))} seguidores para alcanzarle`}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── No data card ───────────────────────────────────────────────────────── */
function NoDataCard() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
      <p className="text-gray-500 text-sm mb-2">Sin datos de posts aún.</p>
      <p className="text-xs text-gray-600">
        Usa la extensión de Chrome para capturar posts de este competidor.
      </p>
    </div>
  );
}
