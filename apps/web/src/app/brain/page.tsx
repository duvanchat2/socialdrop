'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import {
  Loader2, Brain, TrendingUp, Zap, Target, Calendar,
  Flame, BarChart2, Clock, CheckCircle2, RefreshCw,
  Sparkles, BookOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';

const USER_ID = 'demo-user';

interface BrainData {
  userId: string;
  viralHooks: string[];
  viralTopics: string[];
  viralFormats: string[];
  bestHashtags: string[];
  patternSummary: string | null;
  accuracyScore: number | null;
  lastLearnedAt: string | null;
  nextLearnAt: string | null;
}

interface PerformanceStats {
  totalScripts: number;
  publishedScripts: number;
  viralCount: number;
  scriptsWithMetrics: number;
  avgEngagement: number | null;
  accuracyScore: number | null;
  viralRate: number;
}

interface ViralScript {
  id: string;
  platform: string;
  topic: string;
  hook: string;
  likes: number | null;
  saves: number | null;
  reach: number | null;
  engagementRate: number | null;
  publishedAt: string | null;
}

interface LearningEntry {
  date: string;
  event: string;
  upcoming?: boolean;
}

interface PerformanceData {
  brain: BrainData;
  stats: PerformanceStats;
  recentViral: ViralScript[];
  learningTimeline: LearningEntry[];
}

/* ─── Stat Card ─────────────────────────────────────────────────────── */
function StatCard({
  label, value, sub, icon: Icon, accent = 'indigo',
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accent?: 'indigo' | 'orange' | 'green' | 'purple';
}) {
  const colors = {
    indigo: 'bg-indigo-500/10 text-indigo-400',
    orange: 'bg-orange-500/10 text-orange-400',
    green: 'bg-green-500/10 text-green-400',
    purple: 'bg-purple-500/10 text-purple-400',
  };
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${colors[accent]}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-100">{value}</p>
        {sub && <p className="text-xs text-gray-500">{sub}</p>}
      </div>
    </div>
  );
}

/* ─── Platform badge ─────────────────────────────────────────────────── */
function PlatformBadge({ platform }: { platform: string }) {
  const colors: Record<string, string> = {
    INSTAGRAM: 'bg-pink-500/20 text-pink-300',
    TIKTOK: 'bg-gray-700 text-gray-200',
    YOUTUBE: 'bg-red-500/20 text-red-300',
    TWITTER: 'bg-sky-500/20 text-sky-300',
    FACEBOOK: 'bg-blue-500/20 text-blue-300',
    LINKEDIN: 'bg-blue-700/20 text-blue-400',
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colors[platform.toUpperCase()] ?? 'bg-gray-700 text-gray-300'}`}>
      {platform}
    </span>
  );
}

/* ─── Main page ─────────────────────────────────────────────────────── */
export default function BrainPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'viral' | 'patterns'>('overview');

  const { data, isLoading, isError } = useQuery<PerformanceData>({
    queryKey: ['brain-performance', USER_ID],
    queryFn: () => apiFetch(`/api/content-brain/performance?userId=${USER_ID}`),
    refetchInterval: 60_000,
  });

  const triggerMetrics = useMutation({
    mutationFn: () => apiFetch('/api/content-brain/collect-metrics', { method: 'POST' }),
    onSuccess: () => {
      toast.success('Colección de métricas iniciada');
      setTimeout(() => qc.invalidateQueries({ queryKey: ['brain-performance'] }), 3000);
    },
    onError: (e: Error) => toast.error(`Error: ${e.message}`),
  });

  const triggerLearn = useMutation({
    mutationFn: () =>
      apiFetch('/api/content-brain/update-brain', {
        method: 'POST',
        body: JSON.stringify({ userId: USER_ID }),
      }),
    onSuccess: () => {
      toast.success('Aprendizaje iniciado — puede tardar unos minutos');
      setTimeout(() => qc.invalidateQueries({ queryKey: ['brain-performance'] }), 10_000);
    },
    onError: (e: Error) => toast.error(`Error: ${e.message}`),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-indigo-400" size={32} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
        <Brain size={32} className="opacity-40" />
        <p className="text-sm">No se pudo cargar el cerebro de contenido</p>
      </div>
    );
  }

  const { brain, stats, recentViral, learningTimeline } = data;

  const tabs = [
    { id: 'overview', label: 'Resumen', icon: BarChart2 },
    { id: 'viral', label: 'Guiones virales', icon: Flame },
    { id: 'patterns', label: 'Patrones aprendidos', icon: Sparkles },
  ] as const;

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain size={26} className="text-indigo-400" />
            Mi Voz · Cerebro de Contenido
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            El cerebro aprende de tus publicaciones virales y mejora cada semana.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => triggerMetrics.mutate()}
            disabled={triggerMetrics.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 disabled:opacity-50"
          >
            {triggerMetrics.isPending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Recoger métricas
          </button>
          <button
            onClick={() => triggerLearn.mutate()}
            disabled={triggerLearn.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
          >
            {triggerLearn.isPending ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
            Actualizar cerebro
          </button>
        </div>
      </div>

      {/* Accuracy banner */}
      {brain.patternSummary && (
        <div className="bg-indigo-950/40 border border-indigo-800/40 rounded-xl p-4 flex gap-3">
          <Sparkles size={18} className="text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-indigo-300 mb-0.5">Insight del cerebro</p>
            <p className="text-sm text-gray-300">{brain.patternSummary}</p>
          </div>
          {brain.accuracyScore !== null && (
            <div className="ml-auto shrink-0 text-right">
              <p className="text-2xl font-bold text-indigo-400">{Math.round(brain.accuracyScore)}%</p>
              <p className="text-[10px] text-gray-500">precisión</p>
            </div>
          )}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Guiones publicados" value={stats.publishedScripts} icon={BookOpen} accent="indigo" />
        <StatCard
          label="Tasa viral"
          value={`${stats.viralRate.toFixed(1)}%`}
          sub={`${stats.viralCount} virales`}
          icon={Flame}
          accent="orange"
        />
        <StatCard
          label="Engagement promedio"
          value={stats.avgEngagement !== null ? `${stats.avgEngagement.toFixed(1)}%` : '—'}
          icon={TrendingUp}
          accent="green"
        />
        <StatCard
          label="Precisión del cerebro"
          value={brain.accuracyScore !== null ? `${Math.round(brain.accuracyScore)}%` : '—'}
          sub="basado en patrones"
          icon={Target}
          accent="purple"
        />
      </div>

      {/* Last / next learn */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
          <Clock size={16} className="text-gray-500 shrink-0" />
          <div>
            <p className="text-xs text-gray-500">Último aprendizaje</p>
            <p className="text-sm text-gray-200">
              {brain.lastLearnedAt
                ? formatDistanceToNow(new Date(brain.lastLearnedAt), { addSuffix: true, locale: es })
                : 'Nunca — ejecuta el primer aprendizaje'}
            </p>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
          <Calendar size={16} className="text-indigo-400 shrink-0" />
          <div>
            <p className="text-xs text-gray-500">Próxima actualización</p>
            <p className="text-sm text-gray-200">
              {brain.nextLearnAt
                ? format(new Date(brain.nextLearnAt), "EEEE d 'de' MMMM", { locale: es })
                : 'Cada domingo a medianoche'}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800">
        <div className="flex gap-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-indigo-500 text-white'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Timeline de aprendizaje</h2>
          {learningTimeline.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
              <Brain size={32} className="mx-auto text-gray-700 mb-3" />
              <p className="text-gray-400 text-sm">El cerebro aún no ha aprendido</p>
              <p className="text-gray-600 text-xs mt-1">Publica contenido y espera al domingo</p>
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800">
              {learningTimeline.map((entry, i) => (
                <div key={i} className="flex items-center gap-3 p-4">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${entry.upcoming ? 'bg-indigo-400' : 'bg-green-400'}`} />
                  <div className="flex-1">
                    <p className="text-sm text-gray-200">{entry.event}</p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(entry.date), "d 'de' MMMM yyyy, HH:mm", { locale: es })}
                    </p>
                  </div>
                  {entry.upcoming ? (
                    <span className="text-[10px] bg-indigo-950 text-indigo-400 border border-indigo-800 px-2 py-0.5 rounded-full">
                      próximo
                    </span>
                  ) : (
                    <CheckCircle2 size={14} className="text-green-400 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Quick stats summary */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Resumen del cerebro</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-gray-100">{stats.totalScripts}</p>
                <p className="text-xs text-gray-500">guiones totales</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-400">{stats.viralCount}</p>
                <p className="text-xs text-gray-500">virales</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-100">{stats.scriptsWithMetrics}</p>
                <p className="text-xs text-gray-500">con métricas</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'viral' && (
        <div className="space-y-3">
          {recentViral.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
              <Flame size={32} className="mx-auto text-gray-700 mb-3" />
              <p className="text-gray-400 text-sm">Aún no hay guiones virales</p>
              <p className="text-gray-600 text-xs mt-1">
                Un guión es viral cuando su engagement supera el 5%
              </p>
            </div>
          ) : (
            recentViral.map((script) => (
              <div key={script.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Flame size={16} className="text-orange-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <PlatformBadge platform={script.platform} />
                      <span className="text-xs text-gray-500">
                        {script.publishedAt
                          ? formatDistanceToNow(new Date(script.publishedAt), { addSuffix: true, locale: es })
                          : ''}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-gray-400 mb-0.5">{script.topic}</p>
                    <p className="text-sm text-gray-100 line-clamp-2">"{script.hook}"</p>
                    <div className="flex gap-4 mt-2 text-xs text-gray-500">
                      {script.likes !== null && <span>❤️ {script.likes.toLocaleString()}</span>}
                      {script.saves !== null && <span>🔖 {script.saves.toLocaleString()}</span>}
                      {script.reach !== null && <span>👁 {script.reach.toLocaleString()}</span>}
                      {script.engagementRate !== null && (
                        <span className="text-orange-400 font-semibold">{script.engagementRate.toFixed(1)}%</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'patterns' && (
        <div className="space-y-4">
          {!brain.lastLearnedAt ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
              <Sparkles size={32} className="mx-auto text-gray-700 mb-3" />
              <p className="text-gray-400 text-sm">El cerebro aún no ha aprendido patrones</p>
              <p className="text-gray-600 text-xs mt-1">
                Haz clic en "Actualizar cerebro" para iniciar el primer análisis
              </p>
              <button
                onClick={() => triggerLearn.mutate()}
                disabled={triggerLearn.isPending}
                className="mt-4 flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 mx-auto"
              >
                {triggerLearn.isPending ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                Iniciar aprendizaje
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PatternCard title="Hooks virales" items={brain.viralHooks} icon={Zap} color="orange" />
              <PatternCard title="Temas recurrentes" items={brain.viralTopics} icon={Target} color="indigo" />
              <PatternCard title="Formatos ganadores" items={brain.viralFormats} icon={BarChart2} color="green" />
              <PatternCard title="Mejores hashtags" items={brain.bestHashtags} icon={TrendingUp} color="purple" isHashtag />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── PatternCard ────────────────────────────────────────────────────── */
function PatternCard({
  title, items, icon: Icon, color, isHashtag = false,
}: {
  title: string;
  items: string[];
  icon: React.ElementType;
  color: 'orange' | 'indigo' | 'green' | 'purple';
  isHashtag?: boolean;
}) {
  const colorMap: Record<string, string> = {
    orange: 'text-orange-400 bg-orange-500/10',
    indigo: 'text-indigo-400 bg-indigo-500/10',
    green: 'text-green-400 bg-green-500/10',
    purple: 'text-purple-400 bg-purple-500/10',
  };
  const tagMap: Record<string, string> = {
    orange: 'bg-orange-500/10 text-orange-300 border-orange-800/40',
    indigo: 'bg-indigo-500/10 text-indigo-300 border-indigo-800/40',
    green: 'bg-green-500/10 text-green-300 border-green-800/40',
    purple: 'bg-purple-500/10 text-purple-300 border-purple-800/40',
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          <Icon size={14} />
        </div>
        <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-gray-600">Sin datos aún</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, i) => (
            <span
              key={i}
              className={`text-xs px-2 py-0.5 rounded-full border ${tagMap[color]}`}
            >
              {isHashtag ? `#${item}` : item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
