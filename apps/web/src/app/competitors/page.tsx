'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Users, Plus, Trash2, Zap, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

interface Competitor {
  id: string;
  userId: string;
  username: string;
  platform: string;
  displayName?: string;
  followers?: number;
  notes?: string;
  createdAt: string;
  analyses: CompetitorAnalysis[];
}

interface CompetitorAnalysis {
  id: string;
  competitorId: string;
  summary: string;
  hooks: string[];
  themes: string[];
  bestFormats: string[];
  recommendations: string[];
  createdAt: string;
}

interface BenchmarkData {
  userId: string;
  myMetrics: Record<string, { followersCount: number; platform: string }>;
  competitors: Array<{
    id: string;
    username: string;
    platform: string;
    followers: number | null;
    myFollowers: number | null;
  }>;
}

const PLATFORM_COLORS: Record<string, string> = {
  INSTAGRAM: '#E1306C', TIKTOK: '#000000', FACEBOOK: '#1877F2',
  YOUTUBE: '#FF0000', TWITTER: '#1DA1F2', LINKEDIN: '#0077B5',
};

const PLATFORM_EMOJI: Record<string, string> = {
  INSTAGRAM: '📸', TIKTOK: '🎵', FACEBOOK: '👥', YOUTUBE: '▶️', TWITTER: '🐦', LINKEDIN: '💼',
};

const PLATFORMS = ['INSTAGRAM', 'TIKTOK', 'FACEBOOK', 'YOUTUBE', 'TWITTER', 'LINKEDIN'];

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

export default function CompetitorsPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]          = useState({ username: '', platform: 'INSTAGRAM' });
  const [expanded, setExpanded]  = useState<Set<string>>(new Set());
  const [analyzing, setAnalyzing]= useState<Set<string>>(new Set());

  const { data: competitors = [], isLoading } = useQuery({
    queryKey: ['competitors'],
    queryFn: () => apiFetch<Competitor[]>('/api/competitors?userId=demo-user'),
  });

  const { data: benchmark } = useQuery({
    queryKey: ['competitors-benchmark'],
    queryFn: () => apiFetch<BenchmarkData>('/api/competitors/benchmark?userId=demo-user'),
  });

  const addMutation = useMutation({
    mutationFn: (data: { username: string; platform: string }) =>
      apiFetch('/api/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, userId: 'demo-user' }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['competitors'] });
      setShowModal(false);
      setForm({ username: '', platform: 'INSTAGRAM' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/competitors/${id}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['competitors'] }),
  });

  const analyzeMutation = useMutation({
    mutationFn: (id: string) => apiFetch<CompetitorAnalysis>(`/api/competitors/${id}/analyze?userId=demo-user`, { method: 'POST' }),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: ['competitors'] });
      setAnalyzing(prev => { const s = new Set(prev); s.delete(id); return s; });
      setExpanded(prev => new Set(prev).add(id));
    },
    onError: (_err, id) => {
      setAnalyzing(prev => { const s = new Set(prev); s.delete(id); return s; });
    },
  });

  function toggleExpanded(id: string) {
    setExpanded(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }

  function handleAnalyze(id: string) {
    setAnalyzing(prev => new Set(prev).add(id));
    analyzeMutation.mutate(id);
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Users size={22} className="text-indigo-600 dark:text-indigo-400" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Inteligencia Competitiva</h1>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} />
          Agregar competidor
        </button>
      </div>

      <div className="p-6 max-w-screen-xl mx-auto space-y-8">

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center h-40 text-gray-400">
            <RefreshCw className="animate-spin mr-2" size={18} /> Cargando...
          </div>
        )}

        {/* Empty state */}
        {!isLoading && competitors.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-12 text-center shadow-sm">
            <Users size={48} className="mx-auto text-gray-200 dark:text-gray-700 mb-4" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">No tienes competidores rastreados aún.</p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
            >
              Agregar tu primer competidor
            </button>
          </div>
        )}

        {/* Competitor cards */}
        {competitors.length > 0 && (
          <div className="space-y-4">
            {competitors.map(competitor => {
              const color = PLATFORM_COLORS[competitor.platform] ?? '#6366f1';
              const emoji = PLATFORM_EMOJI[competitor.platform] ?? '🌐';
              const latestAnalysis = competitor.analyses[0];
              const isExpanded = expanded.has(competitor.id);
              const isAnalyzing = analyzing.has(competitor.id);

              return (
                <div key={competitor.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                  {/* Card header */}
                  <div className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
                        style={{ background: `${color}22` }}
                      >
                        {emoji}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 dark:text-white">@{competitor.username}</span>
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: `${color}22`, color }}
                          >
                            {competitor.platform}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          {competitor.followers != null && (
                            <span>👥 {competitor.followers.toLocaleString('es-CO')} seguidores</span>
                          )}
                          {latestAnalysis && (
                            <span>
                              Último análisis: {new Date(latestAnalysis.createdAt).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAnalyze(competitor.id)}
                        disabled={isAnalyzing}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-semibold rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors disabled:opacity-60"
                      >
                        <Zap size={12} className={isAnalyzing ? 'animate-pulse' : ''} />
                        {isAnalyzing ? 'Analizando...' : 'Analizar ahora'}
                      </button>
                      {latestAnalysis && (
                        <button
                          onClick={() => toggleExpanded(competitor.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                        >
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          Ver análisis
                        </button>
                      )}
                      <button
                        onClick={() => deleteMutation.mutate(competitor.id)}
                        className="p-1.5 text-gray-300 hover:text-red-400 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Analysis section */}
                  {isExpanded && latestAnalysis && (
                    <div className="border-t border-gray-100 dark:border-gray-700 p-5 space-y-4 bg-gray-50 dark:bg-gray-850">
                      {/* Summary */}
                      <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{latestAnalysis.summary}</p>

                      {/* Hooks */}
                      {latestAnalysis.hooks.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Hooks que usa</p>
                          <div className="flex flex-wrap">
                            {latestAnalysis.hooks.map((h, i) => <Pill key={i} text={h} color="#6366f1" />)}
                          </div>
                        </div>
                      )}

                      {/* Themes */}
                      {latestAnalysis.themes.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Temas principales</p>
                          <div className="flex flex-wrap">
                            {latestAnalysis.themes.map((t, i) => <Pill key={i} text={t} color="#14b8a6" />)}
                          </div>
                        </div>
                      )}

                      {/* Best formats */}
                      {latestAnalysis.bestFormats.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Formatos que funcionan</p>
                          <div className="flex flex-wrap">
                            {latestAnalysis.bestFormats.map((f, i) => <Pill key={i} text={f} color="#f59e0b" />)}
                          </div>
                        </div>
                      )}

                      {/* Recommendations */}
                      {latestAnalysis.recommendations.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Recomendaciones para ti</p>
                          <ol className="space-y-1.5">
                            {latestAnalysis.recommendations.map((r, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
                                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-xs flex items-center justify-center font-bold mt-0.5">
                                  {i + 1}
                                </span>
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
            })}
          </div>
        )}

        {/* Benchmark table */}
        {benchmark && benchmark.competitors.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Benchmark — Tú vs Competidores</h2>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cuenta</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Plataforma</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Seguidores</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {/* My account rows */}
                  {Object.entries(benchmark.myMetrics).map(([platform, m]) => (
                    <tr key={`me-${platform}`} className="border-b border-gray-50 dark:border-gray-750 bg-indigo-50 dark:bg-indigo-900/10">
                      <td className="px-5 py-3 font-semibold text-indigo-700 dark:text-indigo-300">Tú</td>
                      <td className="px-5 py-3">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${PLATFORM_COLORS[platform] ?? '#6366f1'}22`, color: PLATFORM_COLORS[platform] ?? '#6366f1' }}>
                          {PLATFORM_EMOJI[platform] ?? ''} {platform}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-gray-900 dark:text-white">{m.followersCount.toLocaleString('es-CO')}</td>
                      <td className="px-5 py-3 text-right text-gray-400">—</td>
                    </tr>
                  ))}
                  {/* Competitor rows */}
                  {benchmark.competitors.map(c => {
                    const diff = c.followers != null && c.myFollowers != null ? c.myFollowers - c.followers : null;
                    return (
                      <tr key={c.id} className="border-b border-gray-50 dark:border-gray-750 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                        <td className="px-5 py-3 text-gray-900 dark:text-white">@{c.username}</td>
                        <td className="px-5 py-3">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${PLATFORM_COLORS[c.platform] ?? '#6366f1'}22`, color: PLATFORM_COLORS[c.platform] ?? '#6366f1' }}>
                            {PLATFORM_EMOJI[c.platform] ?? ''} {c.platform}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right text-gray-700 dark:text-gray-300">
                          {c.followers != null ? c.followers.toLocaleString('es-CO') : '—'}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {diff != null ? (
                            <span className={`font-semibold ${diff > 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {diff > 0 ? `+${diff.toLocaleString('es-CO')}` : diff.toLocaleString('es-CO')}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add competitor modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5">Agregar competidor</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Nombre de usuario</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="ej. cocacola"
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Plataforma</label>
                <select
                  value={form.platform}
                  onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_EMOJI[p]} {p}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowModal(false); setForm({ username: '', platform: 'INSTAGRAM' }); }}
                className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => addMutation.mutate(form)}
                disabled={!form.username || addMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-60"
              >
                {addMutation.isPending ? 'Guardando...' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
