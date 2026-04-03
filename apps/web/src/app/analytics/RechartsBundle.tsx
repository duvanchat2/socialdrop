'use client';
import { useState } from 'react';
import {
  BarChart, Bar, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LineChart, Line, RadialBarChart, RadialBar,
} from 'recharts';
import { useTheme } from '@/components/ThemeProvider';

type Tab = 'overview' | 'engagement' | 'community' | 'reach' | 'content' | 'goals' | 'top' | 'insights';

interface OverviewStats { published: number; pending: number; failed: number; total: number; today: number; }
interface PlatformStat  { platform: string; accountName: string; published: number; pending: number; failed: number; }
interface Post          { id: string; content: string; status: string; scheduledAt: string; integrations: { integration: { platform: string } }[]; }
interface MetricFollower  { id: string; platform: string; followersCount: number; followingCount?: number; postsCount?: number; recordedAt: string; }
interface MetricPost      { id: string; platform: string; platformPostId: string; caption?: string; mediaUrl?: string; likes: number; comments: number; shares: number; saves: number; reach: number; impressions: number; views: number; engagementRate?: number; publishedAt?: string; recordedAt: string; }
interface MetricsOverview { totalFollowers: number; totalPosts: number; totalLikes: number; totalComments: number; totalReach: number; totalImpressions: number; avgEngagementRate: number; period: string; }
interface GrowthGoal      { id: string; userId: string; platform: string; metric: string; target: number; deadline: string; }

interface Props {
  tab: Tab;
  range: string;
  overview?: OverviewStats;
  byPlatform: PlatformStat[];
  posts: Post[];
  followerData: { date: string; value: number }[];
  engagementData: { date: string; value: number }[];
  reachData: { date: string; value: number }[];
  likesData: { date: string; value: number }[];
  commentsData: { date: string; value: number }[];
  savesData: { date: string; value: number }[];
  sharesData: { date: string; value: number }[];
  gainedLost: { day: string; gained: number; lost: number }[];
  postTypeData: { type: string; value: number }[];
  postsByDay: { day: string; posts: number }[];
  heatmap: { day: string; hours: number[] }[];
  published: number;
  total: number;
  KpiCard: React.ComponentType<{ icon: string; iconBg: string; label: string; value: string | number; sub?: string }>;
  SectionTitle: React.ComponentType<{ children: React.ReactNode }>;
  PostCard: React.ComponentType<{ post: Post }>;
  HeatCell: React.ComponentType<{ value: number }>;
  metricsFollowers?: MetricFollower[];
  metricsPosts?: MetricPost[];
  metricsOverview?: MetricsOverview;
  // Goals tab
  goals?: GrowthGoal[];
  goalForm?: { platform: string; metric: string; target: string; deadline: string };
  setGoalForm?: (f: { platform: string; metric: string; target: string; deadline: string }) => void;
  onCreateGoal?: (data: { platform: string; metric: string; target: number; deadline: string }) => void;
  onDeleteGoal?: (id: string) => void;
  // Top content
  topByEngagement?: MetricPost[];
  topByViews?: MetricPost[];
}

const HOURS_LABELS = ['00', '03', '06', '09', '12', '15', '18', '21'];
const PLATFORM_COLORS: Record<string, string> = {
  INSTAGRAM: '#E1306C', TIKTOK: '#000000', FACEBOOK: '#1877F2',
  YOUTUBE: '#FF0000', TWITTER: '#1DA1F2',
};

function useChartTheme() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  return {
    isDark,
    gridStroke:   isDark ? '#374151' : '#f3f4f6',
    tooltipStyle: isDark
      ? { fontSize: 12, borderRadius: 8, backgroundColor: '#1f2937', color: '#f9fafb', border: '1px solid #374151', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.5)' }
      : { fontSize: 12, borderRadius: 8, backgroundColor: '#ffffff', color: '#374151', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' },
  };
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm">
      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">{title}</h4>
      {children}
    </div>
  );
}

function MiniChart({ data, color, height = 200 }: { data: { date: string; value: number }[]; color: string; height?: number }) {
  const { gridStroke, tooltipStyle } = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.15} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} width={35} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#grad-${color.replace('#', '')})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── TAB 1: Overview ────────────────────────────────────────────────────────────
function OverviewTab({ overview, byPlatform, posts, followerData, published, KpiCard, SectionTitle, PostCard, metricsFollowers, metricsOverview }: Props) {
  const { gridStroke, tooltipStyle } = useChartTheme();
  const totalFollowers = metricsOverview?.totalFollowers
    ?? (metricsFollowers && metricsFollowers.length > 0 ? metricsFollowers.reduce((s, m) => s + m.followersCount, 0) : null);
  const followersDisplay = totalFollowers !== null ? totalFollowers.toLocaleString('es-CO') : '1,247';
  const totalReach = metricsOverview?.totalReach;
  const totalImpressions = metricsOverview?.totalImpressions;
  const engRate = metricsOverview?.avgEngagementRate;
  const totalLikes = metricsOverview?.totalLikes;
  const totalComments = metricsOverview?.totalComments;

  return (
    <div className="space-y-6">
      <SectionTitle>Audiencia</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard icon="👥" iconBg="bg-purple-100" label="Seguidores"        value={followersDisplay} sub={totalFollowers !== null ? 'real · sincronizado' : undefined} />
        <KpiCard icon="📈" iconBg="bg-green-100"  label="Seguidores nuevos" value="124"   sub="+8.3% vs semana ant." />
        <KpiCard icon="🚀" iconBg="bg-teal-100"   label="% Crecimiento"     value="9.9%"  sub="últimos 30 días" />
      </div>
      <ChartCard title="Crecimiento de seguidores">
        <MiniChart data={followerData} color="#6366f1" height={220} />
      </ChartCard>
      <SectionTitle>Publicaciones</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard icon="📝" iconBg="bg-indigo-100" label="Posts publicados"      value={published || '--'} />
        <KpiCard icon="👁️" iconBg="bg-purple-100" label="Vistas / Impresiones"  value={totalImpressions ? totalImpressions.toLocaleString('es-CO') : '18,420'} />
        <KpiCard icon="📡" iconBg="bg-yellow-100" label="Alcance"               value={totalReach ? totalReach.toLocaleString('es-CO') : '9,840'} />
      </div>
      <SectionTitle>Engagement</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard icon="💬" iconBg="bg-pink-100"  label="Interacciones"         value={totalLikes != null && totalComments != null ? (totalLikes + totalComments).toLocaleString('es-CO') : '842'} />
        <KpiCard icon="📊" iconBg="bg-green-100" label="Tasa de eng. promedio" value={engRate ? `${engRate.toFixed(1)}%` : '3.8%'} />
        <KpiCard icon="🎯" iconBg="bg-teal-100"  label="Eng. en alcance"       value="8.6%" />
      </div>
      {byPlatform.length > 0 && (
        <>
          <SectionTitle>Por plataforma</SectionTitle>
          <ChartCard title="Posts publicados por plataforma">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byPlatform}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="platform" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} width={30} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="published" fill="#6366f1" radius={[4, 4, 0, 0]} name="Publicados" />
                <Bar dataKey="pending"   fill="#f59e0b" radius={[4, 4, 0, 0]} name="Pendientes" />
                <Bar dataKey="failed"    fill="#ef4444" radius={[4, 4, 0, 0]} name="Fallidos" />
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </>
      )}
      <SectionTitle>Posts recientes</SectionTitle>
      {posts.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {posts.slice(0, 10).map(p => <PostCard key={p.id} post={p} />)}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-8 text-center text-gray-400 text-sm shadow-sm">
          No hay posts publicados aún
        </div>
      )}
    </div>
  );
}

// ── TAB 2: Engagement ─────────────────────────────────────────────────────────
function EngagementTab({ engagementData, likesData, commentsData, savesData, sharesData, KpiCard, SectionTitle }: Props) {
  const { gridStroke, tooltipStyle } = useChartTheme();
  return (
    <div className="space-y-6">
      <SectionTitle>Tasas de engagement</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <KpiCard icon="📊" iconBg="bg-green-100"  label="Tasa eng. promedio"     value="3.8%" />
        <KpiCard icon="🎯" iconBg="bg-teal-100"   label="Eng. en alcance"        value="8.6%" />
        <KpiCard icon="💬" iconBg="bg-pink-100"   label="Interacciones totales"  value="842" />
        <KpiCard icon="⭐" iconBg="bg-yellow-100" label="Eng. promedio recibido" value="28.4" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Historial de tasa de engagement">
          <MiniChart data={engagementData} color="#10b981" />
        </ChartCard>
        <ChartCard title="Eng. promedio en alcance">
          <MiniChart data={engagementData.map(d => ({ ...d, value: +(d.value * 2.2).toFixed(1) }))} color="#14b8a6" />
        </ChartCard>
      </div>
      <ChartCard title="Engagement promedio por tipo de post">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={[
            { type: 'Posts',    eng: 3.2 },
            { type: 'Carrusel', eng: 5.8 },
            { type: 'Reels',    eng: 7.1 },
          ]}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis dataKey="type" tick={{ fontSize: 12, fill: '#9ca3af' }} />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} width={35} unit="%" />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="eng" radius={[6, 6, 0, 0]} name="Eng. rate %">
              {['#6366f1', '#ec4899', '#f59e0b'].map((c, i) => <Cell key={i} fill={c} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <SectionTitle>Me gusta</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <KpiCard icon="❤️" iconBg="bg-red-100"    label="Me gusta recibidos" value="612" />
        <KpiCard icon="💝" iconBg="bg-pink-100"   label="Promedio me gusta"  value="48" />
        <KpiCard icon="💬" iconBg="bg-blue-100"   label="Comentarios"        value="148" />
        <KpiCard icon="🗨️" iconBg="bg-indigo-100" label="Prom. comentarios"  value="12" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Historial de me gusta">
          <MiniChart data={likesData} color="#ef4444" />
        </ChartCard>
        <ChartCard title="Historial de comentarios">
          <MiniChart data={commentsData} color="#3b82f6" />
        </ChartCard>
      </div>
      <SectionTitle>Guardados y compartidos</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <KpiCard icon="🔖" iconBg="bg-pink-100"  label="Guardados"         value="284" />
        <KpiCard icon="💾" iconBg="bg-rose-100"  label="Prom. guardados"   value="22" />
        <KpiCard icon="🔁" iconBg="bg-teal-100"  label="Compartidos"       value="96" />
        <KpiCard icon="↗️" iconBg="bg-green-100" label="Prom. compartidos" value="8" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Historial de guardados">
          <MiniChart data={savesData} color="#ec4899" />
        </ChartCard>
        <ChartCard title="Historial de compartidos">
          <MiniChart data={sharesData} color="#14b8a6" />
        </ChartCard>
      </div>
    </div>
  );
}

// ── TAB 3: Community ──────────────────────────────────────────────────────────
function CommunityTab({ followerData, gainedLost, heatmap, KpiCard, SectionTitle, HeatCell }: Props) {
  const { gridStroke, tooltipStyle } = useChartTheme();
  const ageGenderData = [
    { label: '13–17', women: 8,  men: 5 },
    { label: '18–24', women: 32, men: 22 },
    { label: '25–34', women: 28, men: 18 },
    { label: '35–44', women: 14, men: 10 },
    { label: '45+',   women: 6,  men: 4 },
  ];
  const countries = [
    { name: 'Colombia',  pct: 42 }, { name: 'México',    pct: 18 },
    { name: 'Argentina', pct: 14 }, { name: 'España',    pct: 10 },
    { name: 'Venezuela', pct: 8  }, { name: 'Otros',     pct: 8 },
  ];
  return (
    <div className="space-y-6">
      <SectionTitle>Seguidores</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard icon="👥" iconBg="bg-purple-100" label="Seguidores totales" value="1,247" />
        <KpiCard icon="📈" iconBg="bg-green-100"  label="Evolución"          value="+124"   sub="últimos 30 días" />
        <KpiCard icon="🚀" iconBg="bg-teal-100"   label="% Evolución"        value="+11.1%" />
      </div>
      <ChartCard title="Crecimiento de seguidores">
        <MiniChart data={followerData} color="#8b5cf6" height={200} />
      </ChartCard>
      <ChartCard title="Ganados y perdidos por día">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={gainedLost}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} width={35} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="gained" fill="#10b981" radius={[4, 4, 0, 0]} name="Ganados" />
            <Bar dataKey="lost"   fill="#d1d5db" radius={[4, 4, 0, 0]} name="Perdidos" />
            <Legend />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Distribución por edad y género">
          <div className="space-y-2">
            {ageGenderData.map(row => (
              <div key={row.label} className="flex items-center gap-2 text-xs">
                <span className="w-10 text-gray-500 dark:text-gray-400 text-right">{row.label}</span>
                <div className="flex-1 flex gap-1 h-5 items-center">
                  <div className="h-4 rounded-sm bg-purple-400 opacity-80" style={{ width: `${row.women}%` }} />
                  <div className="h-4 rounded-sm bg-red-400 opacity-80"    style={{ width: `${row.men}%` }} />
                </div>
                <span className="text-gray-400">{row.women + row.men}%</span>
              </div>
            ))}
          </div>
        </ChartCard>
        <ChartCard title="Principales países">
          <div className="space-y-2">
            {countries.map(c => (
              <div key={c.name} className="flex items-center gap-2 text-xs">
                <span className="w-20 text-gray-600 dark:text-gray-300 truncate">{c.name}</span>
                <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-3">
                  <div className="h-3 rounded-full bg-indigo-400" style={{ width: `${c.pct}%` }} />
                </div>
                <span className="text-gray-500 dark:text-gray-400 w-8 text-right">{c.pct}%</span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
      <ChartCard title="Seguidores en línea — Mejor momento para publicar">
        <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold mb-3">
          📍 Tus seguidores están más activos los <strong>Miércoles a las 12:00</strong>
        </p>
        <div className="overflow-x-auto">
          <div className="inline-grid gap-1" style={{ gridTemplateColumns: `4rem repeat(${HOURS_LABELS.length}, 1.5rem)` }}>
            <div className="text-xs text-gray-400 text-right pr-1">Hora→</div>
            {HOURS_LABELS.map(h => <div key={h} className="text-xs text-gray-400 text-center">{h}</div>)}
            {heatmap.map(row => (
              <>
                <div key={row.day + '_label'} className="text-xs text-gray-500 dark:text-gray-400 text-right pr-1 flex items-center justify-end">{row.day}</div>
                {row.hours.map((v, i) => <HeatCell key={i} value={v} />)}
              </>
            ))}
          </div>
        </div>
      </ChartCard>
    </div>
  );
}

// ── TAB 4: Reach ──────────────────────────────────────────────────────────────
function ReachTab({ reachData, posts, KpiCard, SectionTitle, PostCard }: Props) {
  const { gridStroke, tooltipStyle } = useChartTheme();
  const combined = reachData.map(d => ({ date: d.date, reach: d.value, views: Math.round(d.value * 1.9) }));
  return (
    <div className="space-y-6">
      <SectionTitle>Totales</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KpiCard icon="👁️" iconBg="bg-purple-100" label="Total vistas / impresiones" value="18,420" sub="últimos 30 días" />
        <KpiCard icon="📡" iconBg="bg-yellow-100" label="Alcance total"               value="9,840"  sub="únicos" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard icon="📷" iconBg="bg-indigo-100" label="Prom. vistas / post"  value="1,537" />
        <KpiCard icon="🎯" iconBg="bg-green-100"  label="Prom. alcance / post" value="820" />
        <KpiCard icon="📊" iconBg="bg-teal-100"   label="Tasa alcance prom."   value="7.2%" />
      </div>
      <ChartCard title="Historial de alcance y vistas">
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={combined}>
            <defs>
              <linearGradient id="gradReach" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradViews" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} width={40} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="views" stroke="#8b5cf6" strokeWidth={2} fill="url(#gradViews)" name="Vistas"   dot={false} />
            <Area type="monotone" dataKey="reach" stroke="#f59e0b" strokeWidth={2} fill="url(#gradReach)" name="Alcance" dot={false} />
            <Legend />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
      <SectionTitle>Posts con mayor alcance</SectionTitle>
      {posts.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {posts.slice(0, 10).map(p => <PostCard key={p.id} post={p} />)}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-8 text-center text-gray-400 text-sm">
          No hay datos aún
        </div>
      )}
    </div>
  );
}

// ── TAB 5: Content ────────────────────────────────────────────────────────────
function ContentTab({ postTypeData, postsByDay, posts, followerData, KpiCard, SectionTitle, PostCard }: Props) {
  const { gridStroke, tooltipStyle } = useChartTheme();
  const total = postTypeData.reduce((a, b) => a + b.value, 0);
  const monthlyData = Array.from({ length: 12 }, (_, i) => ({
    month: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][i],
    '2025': Math.floor(Math.random() * 20 + 5),
    '2026': Math.floor(Math.random() * 25 + 8),
  }));
  return (
    <div className="space-y-6">
      <SectionTitle>Volumen de contenido</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <KpiCard icon="📝" iconBg="bg-indigo-100" label="Posts totales"    value={total || '--'} />
        <KpiCard icon="🖼️" iconBg="bg-pink-100"   label="Fotos"            value={postTypeData[0]?.value || '--'} />
        <KpiCard icon="🎠" iconBg="bg-teal-100"   label="Carruseles"       value={postTypeData[1]?.value || '--'} />
        <KpiCard icon="🎬" iconBg="bg-yellow-100" label="Reels publicados" value={postTypeData[2]?.value || '--'} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Distribución por tipo">
          {total > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={postTypeData.map(d => ({ name: d.type, value: d.value }))} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={3}
                  label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {postTypeData.map((_, i) => (
                    <Cell key={i} fill={['#6366f1','#14b8a6','#f59e0b','#ec4899'][i % 4]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex items-center justify-center text-gray-400 text-sm">Sin datos de posts</div>
          )}
        </ChartCard>
        <ChartCard title="Posts por día de la semana">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={postsByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="day"   tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} width={25} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="posts" radius={[4, 4, 0, 0]} name="Posts" fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      <ChartCard title="Distribución mensual — Comparación anual">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} />
            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} width={25} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="2025" fill="#d1d5db" radius={[3, 3, 0, 0]} name="2025" />
            <Bar dataKey="2026" fill="#6366f1" radius={[3, 3, 0, 0]} name="2026" />
            <Legend />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <SectionTitle>Posts recientes</SectionTitle>
      {posts.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {posts.slice(0, 10).map(p => <PostCard key={p.id} post={p} />)}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-8 text-center text-gray-400 text-sm">
          No hay posts aún
        </div>
      )}
    </div>
  );
}

// ── TAB 6: Goals ──────────────────────────────────────────────────────────────
function GoalsTab({ goals = [], metricsFollowers = [], goalForm, setGoalForm, onCreateGoal, onDeleteGoal, SectionTitle }: Props) {
  const METRICS = ['followers', 'likes', 'reach', 'impressions', 'views'];
  const PLATFORMS = ['INSTAGRAM', 'FACEBOOK', 'YOUTUBE', 'TIKTOK', 'TWITTER'];

  function calcProgress(goal: GrowthGoal) {
    const current = metricsFollowers.find(f => f.platform === goal.platform)?.followersCount ?? 0;
    const pct = goal.target > 0 ? Math.min(100, Math.round((current / goal.target) * 100)) : 0;
    const remaining = Math.max(0, goal.target - current);
    const daysLeft = Math.max(1, Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / 86400000));
    const perDay = Math.ceil(remaining / daysLeft);
    const color = pct >= 80 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-400' : 'bg-red-500';
    const label = pct >= 80 ? '🟢 En camino' : pct >= 40 ? '🟡 Atrás' : '🔴 Muy atrás';
    return { current, pct, remaining, perDay, daysLeft, color, label };
  }

  return (
    <div className="space-y-6">
      {/* Create goal form */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Nueva meta de crecimiento</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Plataforma</label>
            <select
              value={goalForm?.platform ?? 'INSTAGRAM'}
              onChange={e => setGoalForm?.({ ...goalForm!, platform: e.target.value })}
              className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Métrica</label>
            <select
              value={goalForm?.metric ?? 'followers'}
              onChange={e => setGoalForm?.({ ...goalForm!, metric: e.target.value })}
              className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {METRICS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Objetivo</label>
            <input
              type="number"
              value={goalForm?.target ?? ''}
              onChange={e => setGoalForm?.({ ...goalForm!, target: e.target.value })}
              placeholder="ej. 10000"
              className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Fecha límite</label>
            <input
              type="date"
              value={goalForm?.deadline ?? ''}
              onChange={e => setGoalForm?.({ ...goalForm!, deadline: e.target.value })}
              className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>
        <button
          onClick={() => {
            if (!goalForm?.target || !goalForm?.deadline) return;
            onCreateGoal?.({ platform: goalForm.platform, metric: goalForm.metric, target: parseInt(goalForm.target), deadline: goalForm.deadline });
          }}
          className="mt-3 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Guardar meta
        </button>
      </div>

      {/* Goal cards */}
      <SectionTitle>Mis metas activas</SectionTitle>
      {goals.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-8 text-center text-gray-400 text-sm">
          No tienes metas aún. Crea una arriba.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map(goal => {
            const { current, pct, remaining, perDay, daysLeft, color, label } = calcProgress(goal);
            return (
              <div key={goal.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {goal.platform} · {goal.metric}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Meta: {goal.target.toLocaleString('es-CO')} · vence {new Date(goal.deadline).toLocaleDateString('es-CO')}
                    </p>
                  </div>
                  <button
                    onClick={() => onDeleteGoal?.(goal.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors text-xs"
                  >
                    ✕
                  </button>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 mb-2">
                  <div className={`h-3 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
                  <span>{pct}% completado</span>
                  <span>{label}</span>
                </div>
                <p className="text-xs text-indigo-600 dark:text-indigo-400">
                  {goal.metric === 'followers'
                    ? `👥 Actualmente: ${current.toLocaleString('es-CO')} seguidores`
                    : `📊 Progreso actual: ${current.toLocaleString('es-CO')}`}
                </p>
                {remaining > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Te faltan {remaining.toLocaleString('es-CO')} · necesitas +{perDay.toLocaleString('es-CO')} por día ({daysLeft}d restantes)
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── TAB 7: Top Contenido ──────────────────────────────────────────────────────
function TopContenidoTab({ topByEngagement = [], topByViews = [], metricsPosts = [], SectionTitle }: Props) {
  const [sortBy, setSortBy] = useState<'engagement' | 'views' | 'likes' | 'comments' | 'shares'>('engagement');
  const { tooltipStyle, gridStroke } = useChartTheme();

  // Use API data or fall back to metricsPosts sorted client-side
  const sortedPosts = (() => {
    if (sortBy === 'engagement' && topByEngagement.length > 0) return topByEngagement;
    if (sortBy === 'views' && topByViews.length > 0) return topByViews;
    // Client-side sort for other fields
    return [...metricsPosts].sort((a, b) => {
      if (sortBy === 'likes') return b.likes - a.likes;
      if (sortBy === 'comments') return b.comments - a.comments;
      if (sortBy === 'shares') return b.shares - a.shares;
      return (b.engagementRate ?? 0) - (a.engagementRate ?? 0);
    }).slice(0, 10);
  })();

  const SORT_OPTIONS: { key: typeof sortBy; label: string }[] = [
    { key: 'engagement', label: 'Engagement' },
    { key: 'views',      label: 'Vistas' },
    { key: 'likes',      label: 'Likes' },
    { key: 'comments',   label: 'Comentarios' },
    { key: 'shares',     label: 'Shares' },
  ];

  return (
    <div className="space-y-6">
      {/* Sort selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Ordenar por:</span>
        {SORT_OPTIONS.map(o => (
          <button
            key={o.key}
            onClick={() => setSortBy(o.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              sortBy === o.key
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <SectionTitle>Top 10 publicaciones</SectionTitle>

      {sortedPosts.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-8 text-center text-gray-400 text-sm">
          No hay datos de posts aún. Haz un sync para importar métricas.
        </div>
      ) : (
        <div className="space-y-3">
          {sortedPosts.map((post, idx) => {
            const color = PLATFORM_COLORS[post.platform] ?? '#6366f1';
            const engRate = post.engagementRate
              ? post.engagementRate.toFixed(1)
              : post.reach > 0
              ? (((post.likes + post.comments) / post.reach) * 100).toFixed(1)
              : '—';
            return (
              <div key={post.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 flex gap-4 shadow-sm hover:shadow-md transition-shadow">
                {/* Rank + thumbnail */}
                <div className="flex-shrink-0 flex flex-col items-center gap-2">
                  <span className="text-xs font-bold text-gray-400 dark:text-gray-500">#{idx + 1}</span>
                  <div className="w-14 h-14 rounded-lg flex items-center justify-center text-2xl" style={{ background: `${color}22` }}>
                    {post.mediaUrl
                      ? <img src={post.mediaUrl} alt="" className="w-14 h-14 rounded-lg object-cover" />
                      : '📸'}
                  </div>
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${color}22`, color }}>
                      {post.platform}
                    </span>
                    <span className="text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-semibold">
                      {engRate}% eng.
                    </span>
                    {post.publishedAt && (
                      <span className="text-xs text-gray-400">
                        {new Date(post.publishedAt).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                  {post.caption && (
                    <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 mb-2">{post.caption}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                    <span>❤️ {post.likes.toLocaleString('es-CO')}</span>
                    <span>💬 {post.comments.toLocaleString('es-CO')}</span>
                    {post.shares > 0 && <span>🔁 {post.shares.toLocaleString('es-CO')}</span>}
                    {post.views > 0 && <span>👁️ {post.views.toLocaleString('es-CO')}</span>}
                    {post.reach > 0 && <span>📡 {post.reach.toLocaleString('es-CO')}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary bar chart */}
      {sortedPosts.length > 0 && (
        <ChartCard title="Comparativa de los top 10">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={sortedPosts.map((p, i) => ({
              name: `#${i + 1}`,
              likes: p.likes,
              comments: p.comments,
              shares: p.shares,
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} width={35} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="likes"    fill="#ef4444" radius={[3, 3, 0, 0]} name="Likes"       stackId="a" />
              <Bar dataKey="comments" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Comentarios" stackId="a" />
              <Bar dataKey="shares"   fill="#14b8a6" radius={[3, 3, 0, 0]} name="Shares"      stackId="a" />
              <Legend />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}

// ── TAB 8: Insights ───────────────────────────────────────────────────────────
function InsightsTab({ metricsPosts = [], metricsFollowers = [], followerData, heatmap, SectionTitle, KpiCard }: Props) {
  const { gridStroke, tooltipStyle } = useChartTheme();

  // Viral coefficient: (likes + comments) / reach * 100
  const totalLikes   = metricsPosts.reduce((s, p) => s + p.likes, 0);
  const totalComments= metricsPosts.reduce((s, p) => s + p.comments, 0);
  const totalReach   = metricsPosts.reduce((s, p) => s + p.reach, 0);
  const viralCoeff   = totalReach > 0 ? Math.min(100, +((totalLikes + totalComments) / totalReach * 100).toFixed(1)) : 0;

  // Reels vs Posts engagement (mock split since we don't have type field)
  const reelsData  = [{ format: 'Reels',    engagement: 7.1 }, { format: 'Posts',     engagement: 3.2 }, { format: 'Carruseles', engagement: 5.8 }];

  // Hashtag performance — extract #tags from captions
  const hashtagMap = new Map<string, { total: number; count: number }>();
  for (const p of metricsPosts) {
    if (!p.caption) continue;
    const tags = p.caption.match(/#[\w\u00C0-\u024F]+/g) ?? [];
    for (const tag of tags) {
      const eng = p.likes + p.comments;
      const prev = hashtagMap.get(tag) ?? { total: 0, count: 0 };
      hashtagMap.set(tag, { total: prev.total + eng, count: prev.count + 1 });
    }
  }
  const topHashtags = [...hashtagMap.entries()]
    .map(([tag, { total, count }]) => ({ tag, avg: Math.round(total / count) }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 10);

  // Follower growth velocity
  const velocityData = followerData.slice(-14).map((d, i, arr) => ({
    date: d.date,
    growth: i > 0 ? d.value - arr[i - 1].value : 0,
  }));
  const lastGrowth = velocityData.at(-1)?.growth ?? 0;
  const prevGrowth = velocityData.at(-3)?.growth ?? 0;
  const velocityLabel = lastGrowth > prevGrowth + 1
    ? `📈 Acelerando +${lastGrowth}/día`
    : lastGrowth < prevGrowth - 1
    ? `📉 Desacelerando`
    : `➡️ Estable`;

  // Best posting time from heatmap
  let bestDay = 'Miércoles'; let bestHour = '12:00';
  let maxVal = 0;
  const HOURS_LIST   = ['00:00','03:00','06:00','09:00','12:00','15:00','18:00','21:00'];
  heatmap.forEach(row => {
    row.hours.forEach((v, hi) => {
      if (v > maxVal) { maxVal = v; bestDay = row.day; bestHour = HOURS_LIST[hi]; }
    });
  });

  return (
    <div className="space-y-6">

      {/* Viral coefficient gauge */}
      <SectionTitle>Coeficiente viral</SectionTitle>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm flex flex-col items-center justify-center">
          <ResponsiveContainer width="100%" height={160}>
            <RadialBarChart
              cx="50%" cy="50%" innerRadius="60%" outerRadius="80%"
              startAngle={180} endAngle={0}
              data={[{ value: viralCoeff, fill: viralCoeff >= 50 ? '#10b981' : viralCoeff >= 25 ? '#f59e0b' : '#ef4444' }]}
            >
              <RadialBar dataKey="value" background={{ fill: '#f3f4f6' }} cornerRadius={8} />
            </RadialBarChart>
          </ResponsiveContainer>
          <p className="text-3xl font-bold text-gray-900 dark:text-white -mt-6">{viralCoeff}%</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Coeficiente viral (meta: 50%)</p>
          <p className="text-xs font-medium mt-2 text-center" style={{ color: viralCoeff >= 50 ? '#10b981' : viralCoeff >= 25 ? '#f59e0b' : '#ef4444' }}>
            {viralCoeff >= 50 ? '🟢 Excelente — contenido viral' : viralCoeff >= 25 ? '🟡 En desarrollo' : '🔴 Necesita mejora'}
          </p>
        </div>
        <div className="md:col-span-2">
          <ChartCard title="Reels vs Posts vs Carruseles — Engagement">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={reelsData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} unit="%" />
                <YAxis type="category" dataKey="format" tick={{ fontSize: 11, fill: '#9ca3af' }} width={80} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="engagement" radius={[0, 6, 6, 0]} name="Eng. rate %">
                  {reelsData.map((_, i) => <Cell key={i} fill={['#6366f1', '#ec4899', '#14b8a6'][i % 3]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>

      {/* Best posting time heatmap */}
      <ChartCard title="Mejor hora para publicar — Heatmap de engagement">
        <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold mb-3">
          Tu mejor hora: <strong>{bestDay} a las {bestHour}</strong>
        </p>
        <div className="overflow-x-auto">
          <div className="inline-grid gap-1" style={{ gridTemplateColumns: `4rem repeat(8, 1.5rem)` }}>
            <div className="text-xs text-gray-400 text-right pr-1">Hora→</div>
            {HOURS_LIST.map(h => <div key={h} className="text-xs text-gray-400 text-center">{h.slice(0,2)}</div>)}
            {heatmap.map(row => (
              <>
                <div key={row.day + '_ins'} className="text-xs text-gray-500 dark:text-gray-400 text-right pr-1 flex items-center justify-end">{row.day}</div>
                {row.hours.map((v, i) => (
                  <div key={i} className={`w-6 h-6 rounded-sm ${v > 70 ? 'bg-red-400' : v > 40 ? 'bg-yellow-300' : v > 10 ? 'bg-green-200' : 'bg-gray-100 dark:bg-gray-700'}`} title={`${v}%`} />
                ))}
              </>
            ))}
          </div>
        </div>
      </ChartCard>

      {/* Hashtag performance */}
      <SectionTitle>Rendimiento por hashtag</SectionTitle>
      {topHashtags.length > 0 ? (
        <ChartCard title="Top 10 hashtags por engagement promedio">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topHashtags} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <YAxis type="category" dataKey="tag" tick={{ fontSize: 10, fill: '#9ca3af' }} width={120} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="avg" fill="#6366f1" radius={[0, 6, 6, 0]} name="Eng. promedio" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 text-center text-gray-400 text-sm">
          No hay hashtags en los posts sincronizados. Haz un sync de métricas primero.
        </div>
      )}

      {/* Follower growth velocity */}
      <SectionTitle>Velocidad de crecimiento</SectionTitle>
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm">
        <p className="text-base font-bold text-gray-900 dark:text-white mb-1">{velocityLabel}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Últimos 14 días</p>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={velocityData}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} width={35} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="growth" stroke="#6366f1" strokeWidth={2} dot={false} name="Crecimiento/día" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Root export ───────────────────────────────────────────────────────────────
export default function RechartsBundle(props: Props) {
  const { tab } = props;
  if (tab === 'overview')   return <OverviewTab      {...props} />;
  if (tab === 'engagement') return <EngagementTab    {...props} />;
  if (tab === 'community')  return <CommunityTab     {...props} />;
  if (tab === 'reach')      return <ReachTab         {...props} />;
  if (tab === 'content')    return <ContentTab       {...props} />;
  if (tab === 'goals')      return <GoalsTab         {...props} />;
  if (tab === 'top')        return <TopContenidoTab  {...props} />;
  if (tab === 'insights')   return <InsightsTab      {...props} />;
  return null;
}
