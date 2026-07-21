'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { apiFetch } from '@/lib/api';
import { StatusBadge, PostStatus } from '@/components/StatusBadge';
import { PlatformChip, Platform } from '@/components/PlatformChip';
import { EditPostModal, EditablePost } from '@/components/EditPostModal';
import { Stagger, FadeUp, CountUp } from '@/components/motion';
import { PlatformBreakdownChart, PlatformStat } from '@/components/PlatformBreakdownChart';
import { BestTimesHeatmap, BestTimes } from '@/components/BestTimesHeatmap';
import { OnboardingChecklist } from '@/components/OnboardingChecklist';
import Link from 'next/link';
import { Loader2, X, RefreshCw, AlertCircle, AlertTriangle, Pencil } from 'lucide-react';
import { toast } from 'sonner';

function fmtBogota(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

interface StatsOverview { published: number; pending: number; failed: number; total: number; today: number; }

interface DashboardKpis {
  followers: number;
  followersDeltaWoW: number;
  avgEngagementRate: number;
  totalReach: number;
  totalImpressions: number;
  publishSuccessRate: number;
  postsThisWeek: number;
  postsLastWeek: number;
}

interface PostIntegrationDetail {
  id: string;
  status: string;
  errorMessage?: string;
  integration: { platform: Platform; accountName?: string };
}

interface Post {
  id: string;
  content: string;
  status: PostStatus;
  scheduledAt: string;
  errorMessage?: string;
  integrations: PostIntegrationDetail[];
}

interface IntegrationSummary {
  id: string;
  platform: Platform;
  accountName?: string;
  needsReauth: boolean;
}

export default function DashboardPage() {
  const userId = 'demo-user';
  const qc = useQueryClient();
  const [showFailedDrawer, setShowFailedDrawer] = useState(false);
  const [editPost, setEditPost] = useState<EditablePost | null>(null);

  const stats = useQuery({
    queryKey: ['stats'],
    queryFn: () => apiFetch<StatsOverview>(`/api/stats/overview?userId=${userId}`),
  });

  const kpis = useQuery({
    queryKey: ['stats-dashboard'],
    queryFn: () => apiFetch<DashboardKpis>(`/api/stats/dashboard?userId=${userId}&period=7d`),
  });

  const byPlatform = useQuery({
    queryKey: ['stats-by-platform'],
    queryFn: () => apiFetch<PlatformStat[]>(`/api/stats/by-platform?userId=${userId}`),
  });

  const bestTimes = useQuery({
    queryKey: ['stats-best-times'],
    queryFn: () => apiFetch<BestTimes>(`/api/stats/best-times?userId=${userId}`),
  });

  const posts = useQuery({
    queryKey: ['posts'],
    queryFn: async () => (await apiFetch<{ posts: Post[] }>(`/api/posts?userId=${userId}&limit=20`)).posts,
  });

  const integrations = useQuery({
    queryKey: ['integrations'],
    queryFn: () => apiFetch<IntegrationSummary[]>(`/api/integrations?userId=${userId}`),
  });
  const needsReauthIntegrations = (integrations.data ?? []).filter((i) => i.needsReauth);

  const failedPosts = useQuery({
    queryKey: ['posts-failed'],
    queryFn: async () => (await apiFetch<{ posts: Post[] }>(`/api/posts?userId=${userId}&status=ERROR&limit=50`)).posts,
    enabled: showFailedDrawer,
  });

  const retryMutation = useMutation({
    mutationFn: (postId: string) => apiFetch(`/api/posts/${postId}/retry`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Post enviado a reintento ✓');
      qc.invalidateQueries({ queryKey: ['posts-failed'] });
      qc.invalidateQueries({ queryKey: ['posts'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
    onError: (e: Error) => toast.error(`Error: ${e.message}`),
  });

  const postsDeltaWoW = kpis.data && kpis.data.postsLastWeek > 0
    ? +(((kpis.data.postsThisWeek - kpis.data.postsLastWeek) / kpis.data.postsLastWeek) * 100).toFixed(1)
    : null;

  const STAT_CARDS: { label: string; value: number | string; warn?: boolean; clickable: boolean; delta?: number | null }[] = [
    { label: 'Publicados hoy', value: stats.data?.today ?? 0, clickable: false },
    { label: 'Programados', value: stats.data?.pending ?? 0, clickable: false },
    { label: 'Fallidos', value: stats.data?.failed ?? 0, warn: (stats.data?.failed ?? 0) > 0, clickable: true },
    { label: 'Total', value: stats.data?.total ?? 0, clickable: false },
    { label: 'Seguidores', value: kpis.data?.followers ?? 0, clickable: false, delta: kpis.data?.followersDeltaWoW },
    { label: 'Engagement', value: `${(kpis.data?.avgEngagementRate ?? 0).toFixed(2)}%`, clickable: false },
    { label: 'Alcance', value: kpis.data?.totalReach ?? 0, clickable: false },
    { label: 'Tasa de éxito', value: `${(kpis.data?.publishSuccessRate ?? 0).toFixed(1)}%`, clickable: false, delta: postsDeltaWoW },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold text-ink">Dashboard</h1>

      <OnboardingChecklist userId={userId} hasPosts={(posts.data ?? []).length > 0} />

      {needsReauthIntegrations.length > 0 && (
        <div className="bg-warning/15 rounded-card p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-warning shrink-0" />
          <p className="text-sm text-warning flex-1">
            {needsReauthIntegrations.length === 1
              ? `${needsReauthIntegrations[0].accountName ?? needsReauthIntegrations[0].platform} necesita reconexión — sus posts fallarán hasta que reconectes la cuenta.`
              : `${needsReauthIntegrations.length} cuentas necesitan reconexión — sus posts fallarán hasta que las reconectes.`}
          </p>
          <Link
            href="/integrations"
            className="shrink-0 px-3 py-1.5 bg-warning/15 hover:bg-warning/25 rounded-pill text-xs font-medium text-warning"
          >
            Reconectar
          </Link>
        </div>
      )}

      {/* Stat cards */}
      <Stagger className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map(({ label, value, warn, clickable, delta }) => (
          <FadeUp
            key={label}
            data-testid={`stat-card-${label.toLowerCase().replace(/\s+/g, '-')}`}
            onClick={() => clickable && setShowFailedDrawer(true)}
            className={`bg-surface rounded-card p-4 transition-colors ${
              clickable ? 'cursor-pointer hover:bg-surface-2' : ''
            }`}
          >
            <p className="text-xs text-ink-muted">{label}</p>
            <p className={`font-mono-nums text-[32px] tabular-nums mt-1 ${warn ? 'text-warning' : 'text-ink'}`}>
              {(stats.isLoading || kpis.isLoading) ? (
                <Loader2 className="animate-spin" size={24} />
              ) : typeof value === 'number' ? (
                <CountUp value={value} />
              ) : (
                value
              )}
            </p>
            {delta !== undefined && delta !== null && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15, duration: 0.2 }}
                className={`text-xs mt-1 font-mono-nums ${delta >= 0 ? 'text-positive' : 'text-warning'}`}
              >
                {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% vs semana anterior
              </motion.p>
            )}
            {clickable && typeof value === 'number' && value > 0 && (
              <p className="text-xs text-warning mt-1">Click para ver detalles →</p>
            )}
          </FadeUp>
        ))}
      </Stagger>

      {!byPlatform.isLoading && <PlatformBreakdownChart data={byPlatform.data ?? []} />}

      <BestTimesHeatmap data={bestTimes.data} />

      {/* Recent posts table */}
      <div className="bg-surface rounded-card overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.04]">
          <h2 className="font-display font-semibold text-ink">Posts Recientes</h2>
        </div>
        {posts.isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="animate-spin text-ink-muted" size={24} /></div>
        ) : (posts.data ?? []).length === 0 ? (
          <div className="text-center p-8 text-ink-muted text-sm">No hay posts todavía</div>
        ) : (
          <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-white/[0.04]">
                <th className="px-4 py-3 font-medium text-[11px] uppercase tracking-wide text-ink-muted">Caption</th>
                <th className="px-4 py-3 font-medium text-[11px] uppercase tracking-wide text-ink-muted hidden md:table-cell">Plataformas</th>
                <th className="px-4 py-3 font-medium text-[11px] uppercase tracking-wide text-ink-muted hidden lg:table-cell text-right">Fecha (Bogotá)</th>
                <th className="px-4 py-3 font-medium text-[11px] uppercase tracking-wide text-ink-muted">Estado</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {(posts.data ?? []).map(post => (
                <tr key={post.id} className="hover:bg-surface-2 transition-colors">
                  <td className="px-4 py-3 max-w-xs truncate text-ink">{post.content}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex gap-1 flex-wrap">
                      {post.integrations.map((pi, i) => (
                        <PlatformChip key={i} platform={pi.integration.platform} size="sm" />
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-ink-muted font-mono-nums text-xs text-right tabular-nums">
                    {fmtBogota(post.scheduledAt)}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={post.status} /></td>
                  <td className="px-4 py-3">
                    {(post.status === 'SCHEDULED' || post.status === 'ERROR' || post.status === 'PENDING') && (
                      <button
                        data-testid={`edit-post-btn-${post.id}`}
                        onClick={() => setEditPost(post as EditablePost)}
                        className="p-1.5 text-ink-muted hover:text-ink hover:bg-surface-2 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <EditPostModal post={editPost} onClose={() => setEditPost(null)} />

      {/* ── Failed Posts Drawer ── */}
      <AnimatePresence>
        {showFailedDrawer && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black/60 z-40"
              onClick={() => setShowFailedDrawer(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            />
            {/* Drawer */}
            <motion.div
              className="fixed right-0 top-0 h-full w-full max-w-lg bg-surface z-50 flex flex-col shadow-2xl"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04] flex-shrink-0">
              <div className="flex items-center gap-2">
                <AlertCircle size={18} className="text-warning" />
                <h2 className="font-display font-semibold text-lg text-ink">Posts Fallidos</h2>
                {failedPosts.data && (
                  <span className="text-xs bg-warning/15 text-warning px-2 py-0.5 rounded-pill font-mono-nums">
                    {failedPosts.data.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowFailedDrawer(false)}
                className="p-1.5 hover:bg-surface-2 rounded-lg transition-colors"
              >
                <X size={20} className="text-ink-muted" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {failedPosts.isLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="animate-spin text-ink-muted" size={24} />
                </div>
              ) : (failedPosts.data ?? []).length === 0 ? (
                <div className="text-center p-12 text-ink-muted">
                  <p>No hay posts fallidos 🎉</p>
                </div>
              ) : (
                (failedPosts.data ?? []).map(post => (
                  <div key={post.id} className="bg-surface-2 rounded-card p-4 space-y-3">
                    {/* Caption */}
                    <div>
                      <p className="text-[11px] text-ink-muted mb-1 uppercase tracking-wide font-medium">Caption</p>
                      <p className="text-sm text-ink line-clamp-2">{post.content}</p>
                    </div>

                    {/* Post-level error */}
                    {post.errorMessage && (
                      <div className="bg-warning/10 rounded-lg p-3">
                        <p className="text-xs text-warning font-medium mb-0.5">Error general</p>
                        <p className="text-xs text-warning font-mono-nums">{post.errorMessage}</p>
                      </div>
                    )}

                    {/* Per-platform errors */}
                    <div className="space-y-2">
                      <p className="text-[11px] text-ink-muted uppercase tracking-wide font-medium">Plataformas</p>
                      {post.integrations.map((pi, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <PlatformChip platform={pi.integration.platform} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-ink font-medium capitalize">
                                {pi.integration.platform}
                              </span>
                              <StatusBadge status={pi.status as PostStatus} />
                            </div>
                            {pi.errorMessage && (
                              <p className="text-xs text-warning font-mono-nums mt-1 break-all">{pi.errorMessage}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Date & Retry */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-ink-muted font-mono-nums">
                        {fmtBogota(post.scheduledAt)}
                      </span>
                      <button
                        onClick={() => retryMutation.mutate(post.id)}
                        disabled={retryMutation.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:opacity-90 disabled:opacity-50 rounded-pill text-xs font-medium text-ink transition-colors"
                      >
                        <RefreshCw size={12} className={retryMutation.isPending ? 'animate-spin' : ''} />
                        Reintentar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
