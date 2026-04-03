'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import dynamic from 'next/dynamic';
import { RefreshCw } from 'lucide-react';

// ── Recharts (dynamic, browser-only) ──────────────────────────────────────────
const RechartsBundle = dynamic(() => import('./RechartsBundle'), { ssr: false });

// ── Types ─────────────────────────────────────────────────────────────────────
interface OverviewStats { published: number; pending: number; failed: number; total: number; today: number; }
interface PlatformStat  { platform: string; accountName: string; published: number; pending: number; failed: number; }
interface Post          { id: string; content: string; status: string; scheduledAt: string; integrations: { integration: { platform: string } }[]; }
interface Integration   { id: string; platform: string; accountName: string; }

interface MetricFollower  { id: string; platform: string; followersCount: number; followingCount?: number; postsCount?: number; recordedAt: string; }
interface MetricPost      { id: string; platform: string; platformPostId: string; caption?: string; mediaUrl?: string; likes: number; comments: number; shares: number; saves: number; reach: number; impressions: number; views: number; engagementRate?: number; publishedAt?: string; recordedAt: string; }
interface MetricsOverview { totalFollowers: number; newFollowers: number; growthPct: number; totalPosts: number; totalLikes: number; totalComments: number; totalReach: number; totalImpressions: number; avgEngagementRate: number; period: string; }
interface GrowthGoal      { id: string; userId: string; platform: string; metric: string; target: number; deadline: string; createdAt: string; }

type Tab = 'overview' | 'engagement' | 'community' | 'reach' | 'content' | 'goals' | 'top' | 'insights';
type Range = '7d' | '14d' | '30d' | '90d';

const PLATFORM_COLORS: Record<string, string> = {
  INSTAGRAM: '#E1306C', TIKTOK: '#000000', FACEBOOK: '#1877F2',
  YOUTUBE: '#FF0000', TWITTER: '#1DA1F2',
};

const PLATFORM_EMOJI: Record<string, string> = {
  INSTAGRAM: '📸', TIKTOK: '🎵', FACEBOOK: '👥', YOUTUBE: '▶️', TWITTER: '🐦',
};

const PLATFORM_LABELS: Record<string, string> = {
  INSTAGRAM: 'Instagram', TIKTOK: 'TikTok', FACEBOOK: 'Facebook',
  YOUTUBE: 'YouTube', TWITTER: 'Twitter',
};

function displayName(accountName: string | null | undefined, platform: string): string {
  if (!accountName) return PLATFORM_LABELS[platform] ?? platform;
  if (accountName.startsWith('-') || accountName.length > 40 || /^[A-Za-z0-9+/=_-]{30,}$/.test(accountName)) {
    return PLATFORM_LABELS[platform] ?? platform;
  }
  return accountName;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ icon, iconBg, label, value, sub }: { icon: string; iconBg: string; label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl flex-shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">{value}</div>
        <div className="text-sm text-gray-500 dark:text-gray-400 font-medium truncate">{label}</div>
        {sub && <div className="text-xs text-green-500 font-medium">{sub}</div>}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
      {children}
    </h3>
  );
}

function PostCard({ post }: { post: Post }) {
  const platform = post.integrations[0]?.integration?.platform ?? 'FACEBOOK';
  const color = PLATFORM_COLORS[platform] ?? '#6366f1';
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="h-28 flex items-center justify-center text-3xl" style={{ background: `${color}22` }}>
        {PLATFORM_EMOJI[platform] ?? '📄'}
      </div>
      <div className="p-3">
        <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">{post.content}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: `${color}22`, color }}>
            {platform}
          </span>
          <span className="text-xs text-gray-400">
            {new Date(post.scheduledAt).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>
    </div>
  );
}

function HeatCell({ value }: { value: number }) {
  const bg = value > 70 ? 'bg-red-400' : value > 40 ? 'bg-yellow-300' : value > 10 ? 'bg-green-200' : 'bg-gray-100 dark:bg-gray-700';
  return <div className={`w-6 h-6 rounded-sm ${bg}`} title={`${value}%`} />;
}

function makeDays(n: number, base: number, variance: number) {
  const out = [];
  const now = new Date();
  for (let i = n; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    out.push({
      date: d.toLocaleDateString('es-CO', { month: 'short', day: 'numeric' }),
      value: Math.max(0, Math.round(base + (Math.random() - 0.5) * variance)),
    });
  }
  return out;
}

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const HOURS = ['00', '03', '06', '09', '12', '15', '18', '21'];
const HEATMAP = DAYS.map(d => ({ day: d, hours: HOURS.map(() => Math.round(Math.random() * 100)) }));

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const qc = useQueryClient();
  const [tab, setTab]           = useState<Tab>('overview');
  const [range, setRange]       = useState<Range>('30d');
  const [platform, setPlatform] = useState<string>('ALL');
  const [mounted, setMounted]   = useState(false);
  const [syncMsg, setSyncMsg]   = useState('');

  // Goal form state
  const [goalForm, setGoalForm] = useState({ platform: 'INSTAGRAM', metric: 'followers', target: '', deadline: '' });

  useEffect(() => { setMounted(true); }, []);

  const { data: overview }          = useQuery({ queryKey: ['stats-overview'],  queryFn: () => apiFetch<OverviewStats>('/api/stats/overview?userId=demo-user') });
  const { data: byPlatform = [] }   = useQuery({ queryKey: ['stats-platform'],  queryFn: () => apiFetch<PlatformStat[]>('/api/stats/by-platform?userId=demo-user') });
  const { data: posts = [] }        = useQuery({ queryKey: ['posts-all'],       queryFn: () => apiFetch<Post[]>('/api/posts?userId=demo-user') });
  const { data: integrations = [] } = useQuery({ queryKey: ['integrations'],    queryFn: () => apiFetch<Integration[]>('/api/integrations?userId=demo-user') });

  const platformParam = platform !== 'ALL' ? `&platform=${platform}` : '';

  // ── Real metrics queries — all filtered by selected platform AND range ──────
  const { data: metricsFollowers = [] } = useQuery({
    queryKey: ['metrics-followers', platform, range],
    queryFn: () => apiFetch<MetricFollower[]>(`/api/metrics/followers?userId=demo-user${platformParam}&period=${range}`),
  });
  const { data: metricsPosts = [] } = useQuery({
    queryKey: ['metrics-posts', platform, range],
    queryFn: () => apiFetch<MetricPost[]>(
      `/api/metrics/posts?userId=demo-user${platformParam}&limit=25&period=${range}`,
    ),
  });
  const { data: metricsOverview } = useQuery({
    queryKey: ['metrics-overview', range, platform],
    queryFn: () => apiFetch<MetricsOverview>(
      `/api/metrics/overview?userId=demo-user&period=${range}${platformParam}`,
    ),
  });

  // Top content queries by different sortBy
  const { data: topByEngagement = [] } = useQuery({
    queryKey: ['metrics-top-engagement', platform, range],
    queryFn: () => apiFetch<MetricPost[]>(`/api/metrics/posts?userId=demo-user${platformParam}&limit=10&period=${range}&sortBy=engagement`),
    enabled: tab === 'top',
  });
  const { data: topByViews = [] } = useQuery({
    queryKey: ['metrics-top-views', platform, range],
    queryFn: () => apiFetch<MetricPost[]>(`/api/metrics/posts?userId=demo-user${platformParam}&limit=10&period=${range}&sortBy=views`),
    enabled: tab === 'top',
  });

  // Goals
  const { data: goals = [], refetch: refetchGoals } = useQuery({
    queryKey: ['metrics-goals'],
    queryFn: () => apiFetch<GrowthGoal[]>('/api/metrics/goals?userId=demo-user'),
    enabled: tab === 'goals',
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const syncMutation = useMutation({
    mutationFn: () => apiFetch<{ queued: boolean }>('/api/metrics/sync?userId=demo-user', { method: 'POST' }),
    onSuccess: () => {
      setSyncMsg('Sync en cola ✓');
      setTimeout(() => {
        void qc.invalidateQueries({ queryKey: ['metrics-followers'] });
        void qc.invalidateQueries({ queryKey: ['metrics-posts'] });
        void qc.invalidateQueries({ queryKey: ['metrics-overview'] });
        void qc.invalidateQueries({ queryKey: ['integrations'] });
        setSyncMsg('');
      }, 3000);
    },
    onError: () => setSyncMsg('Error al sincronizar'),
  });

  const createGoalMutation = useMutation({
    mutationFn: (data: { platform: string; metric: string; target: number; deadline: string }) =>
      apiFetch('/api/metrics/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, userId: 'demo-user' }),
      }),
    onSuccess: () => {
      setGoalForm({ platform: 'INSTAGRAM', metric: 'followers', target: '', deadline: '' });
      void refetchGoals();
    },
  });

  const deleteGoalMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/metrics/goals/${id}`, { method: 'DELETE' }),
    onSuccess: () => void refetchGoals(),
  });

  // ── Derived data ───────────────────────────────────────────────────────────
  const published      = overview?.published ?? 0;
  const total          = overview?.total ?? 0;
  const nDays          = range === '7d' ? 7 : range === '14d' ? 14 : range === '90d' ? 90 : 30;
  const followerData   = makeDays(nDays, metricsOverview?.totalFollowers || 1240, 80);
  const engagementData = makeDays(nDays, 3.8, 1.5);
  const reachData      = makeDays(nDays, metricsOverview?.totalReach || 4200, 600);
  const likesData      = makeDays(nDays, 48, 20);
  const commentsData   = makeDays(nDays, 12, 8);
  const savesData      = makeDays(nDays, 22, 10);
  const sharesData     = makeDays(nDays, 8, 5);
  const gainedLost     = DAYS.map(d => ({ day: d, gained: Math.round(Math.random() * 60 + 10), lost: -Math.round(Math.random() * 20) }));
  const postTypeData   = [
    { type: 'Posts',    value: Math.round(total * 0.5) || 4 },
    { type: 'Carrusel', value: Math.round(total * 0.3) || 2 },
    { type: 'Reels',    value: Math.round(total * 0.2) || 1 },
  ];
  const postsByDay = DAYS.map(d => ({ day: d, posts: Math.floor(Math.random() * 5) }));

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview',   label: 'Vista general' },
    { id: 'engagement', label: 'Engagement' },
    { id: 'community',  label: 'Comunidad' },
    { id: 'reach',      label: 'Alcance' },
    { id: 'content',    label: 'Contenido' },
    { id: 'goals',      label: 'Metas' },
    { id: 'top',        label: 'Top Contenido' },
    { id: 'insights',   label: 'Insights' },
  ];

  const RANGES: Range[] = ['7d', '14d', '30d', '90d'];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">

      {/* ── Top bar ── */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-4 flex flex-wrap items-center gap-4 shadow-sm sticky top-0 z-10">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mr-4">Analytics</h1>

        {/* Platform selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setPlatform('ALL')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              platform === 'ALL'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            Todas
          </button>
          {integrations.length > 0
            ? integrations.map(i => {
                const isActive = platform === i.platform;
                const label = displayName(i.accountName, i.platform);
                return (
                  <button
                    key={i.id}
                    onClick={() => setPlatform(i.platform)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      isActive
                        ? 'text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                    style={isActive ? { background: PLATFORM_COLORS[i.platform] ?? '#6366f1' } : {}}
                    title={i.platform}
                  >
                    <span>{PLATFORM_EMOJI[i.platform]}</span>
                    {label}
                  </button>
                );
              })
            : ['INSTAGRAM', 'TIKTOK', 'FACEBOOK'].map(p => (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    platform === p
                      ? 'text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                  style={platform === p ? { background: PLATFORM_COLORS[p] } : {}}
                >
                  <span>{PLATFORM_EMOJI[p]}</span>
                  {PLATFORM_LABELS[p] ?? p}
                </button>
              ))}
        </div>

        {/* Sync button */}
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors disabled:opacity-60"
        >
          <RefreshCw size={12} className={syncMutation.isPending ? 'animate-spin' : ''} />
          {syncMsg || 'Sync ahora'}
        </button>

        {/* Date range */}
        <div className="ml-auto flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
          {RANGES.map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                range === r
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* ── Horizontal tab bar ── */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6">
        <nav className="flex gap-0 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                tab === t.id
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Content ── */}
      <div className="p-6 space-y-8 max-w-screen-xl mx-auto">
        {!mounted ? (
          <div className="flex items-center justify-center h-64 text-gray-400">Cargando analytics...</div>
        ) : (
          <RechartsBundle
            tab={tab}
            range={range}
            overview={overview}
            byPlatform={byPlatform}
            posts={posts}
            followerData={followerData}
            engagementData={engagementData}
            reachData={reachData}
            likesData={likesData}
            commentsData={commentsData}
            savesData={savesData}
            sharesData={sharesData}
            gainedLost={gainedLost}
            postTypeData={postTypeData}
            postsByDay={postsByDay}
            heatmap={HEATMAP}
            published={published}
            total={total}
            KpiCard={KpiCard}
            SectionTitle={SectionTitle}
            PostCard={PostCard}
            HeatCell={HeatCell}
            metricsFollowers={metricsFollowers}
            metricsPosts={metricsPosts}
            metricsOverview={metricsOverview}
            goals={goals}
            goalForm={goalForm}
            setGoalForm={setGoalForm}
            onCreateGoal={(data) => createGoalMutation.mutate(data)}
            onDeleteGoal={(id) => deleteGoalMutation.mutate(id)}
            topByEngagement={topByEngagement}
            topByViews={topByViews}
          />
        )}
      </div>
    </div>
  );
}
