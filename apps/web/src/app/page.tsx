'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { apiFetch } from '@/lib/api';
import { StatusBadge, PostStatus } from '@/components/StatusBadge';
import { PlatformChip, Platform } from '@/components/PlatformChip';
import { EditPostModal, EditablePost } from '@/components/EditPostModal';
import { PlatformBreakdownChart, PlatformStat } from '@/components/PlatformBreakdownChart';
import { BestTimesHeatmap, BestTimes } from '@/components/BestTimesHeatmap';
import { OnboardingChecklist } from '@/components/OnboardingChecklist';
import { Loader2, X, RefreshCw, AlertCircle, Pencil } from 'lucide-react';
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

  const STAT_CARDS: { label: string; value: number | string; color: string; clickable: boolean; delta?: number | null }[] = [
    { label: 'Publicados hoy', value: stats.data?.today ?? 0, color: 'text-green-400', clickable: false },
    { label: 'Programados', value: stats.data?.pending ?? 0, color: 'text-blue-400', clickable: false },
    { label: 'Fallidos', value: stats.data?.failed ?? 0, color: 'text-red-400', clickable: true },
    { label: 'Total', value: stats.data?.total ?? 0, color: 'text-gray-300', clickable: false },
    { label: 'Seguidores', value: kpis.data?.followers ?? 0, color: 'text-indigo-400', clickable: false, delta: kpis.data?.followersDeltaWoW },
    { label: 'Engagement', value: `${(kpis.data?.avgEngagementRate ?? 0).toFixed(2)}%`, color: 'text-pink-400', clickable: false },
    { label: 'Alcance', value: kpis.data?.totalReach ?? 0, color: 'text-yellow-400', clickable: false },
    { label: 'Tasa de éxito', value: `${(kpis.data?.publishSuccessRate ?? 0).toFixed(1)}%`, color: 'text-teal-400', clickable: false, delta: postsDeltaWoW },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <OnboardingChecklist userId={userId} hasPosts={(posts.data ?? []).length > 0} />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map(({ label, value, color, clickable, delta }) => (
          <div
            key={label}
            data-testid={`stat-card-${label.toLowerCase().replace(/\s+/g, '-')}`}
            onClick={() => clickable && setShowFailedDrawer(true)}
            className={`bg-gray-900 border border-gray-800 rounded-xl p-4 transition-all ${
              clickable ? 'cursor-pointer hover:border-red-800 hover:bg-gray-800/80' : ''
            }`}
          >
            <p className="text-sm text-gray-400">{label}</p>
            <p className={`text-3xl font-bold mt-1 ${color}`}>
              {(stats.isLoading || kpis.isLoading) ? <Loader2 className="animate-spin" size={24} /> : value}
            </p>
            {delta !== undefined && delta !== null && (
              <p className={`text-xs mt-1 ${delta >= 0 ? 'text-green-400/80' : 'text-red-400/80'}`}>
                {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}% vs semana anterior
              </p>
            )}
            {clickable && typeof value === 'number' && value > 0 && (
              <p className="text-xs text-red-400/70 mt-1">Click para ver detalles →</p>
            )}
          </div>
        ))}
      </div>

      {!byPlatform.isLoading && <PlatformBreakdownChart data={byPlatform.data ?? []} />}

      <BestTimesHeatmap data={bestTimes.data} />

      {/* Recent posts table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h2 className="font-semibold">Posts Recientes</h2>
        </div>
        {posts.isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="animate-spin text-gray-400" size={24} /></div>
        ) : (posts.data ?? []).length === 0 ? (
          <div className="text-center p-8 text-gray-500 text-sm">No hay posts todavía</div>
        ) : (
          <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-left">
                <th className="px-4 py-3 font-medium">Caption</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Plataformas</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">Fecha (Bogotá)</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {(posts.data ?? []).map(post => (
                <tr key={post.id} className="border-t border-gray-800 hover:bg-gray-800/50">
                  <td className="px-4 py-3 max-w-xs truncate">{post.content}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex gap-1 flex-wrap">
                      {post.integrations.map((pi, i) => (
                        <PlatformChip key={i} platform={pi.integration.platform} size="sm" />
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-gray-400">
                    {fmtBogota(post.scheduledAt)}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={post.status} /></td>
                  <td className="px-4 py-3">
                    {(post.status === 'SCHEDULED' || post.status === 'ERROR' || post.status === 'PENDING') && (
                      <button
                        data-testid={`edit-post-btn-${post.id}`}
                        onClick={() => setEditPost(post as EditablePost)}
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
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
              className="fixed right-0 top-0 h-full w-full max-w-lg bg-gray-900 border-l border-gray-700 z-50 flex flex-col shadow-2xl"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 flex-shrink-0">
              <div className="flex items-center gap-2">
                <AlertCircle size={18} className="text-red-400" />
                <h2 className="font-semibold text-lg">Posts Fallidos</h2>
                {failedPosts.data && (
                  <span className="text-xs bg-red-900 text-red-300 px-2 py-0.5 rounded-full">
                    {failedPosts.data.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowFailedDrawer(false)}
                className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {failedPosts.isLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="animate-spin text-gray-400" size={24} />
                </div>
              ) : (failedPosts.data ?? []).length === 0 ? (
                <div className="text-center p-12 text-gray-500">
                  <p>No hay posts fallidos 🎉</p>
                </div>
              ) : (
                (failedPosts.data ?? []).map(post => (
                  <div key={post.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
                    {/* Caption */}
                    <div>
                      <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide font-medium">Caption</p>
                      <p className="text-sm text-gray-200 line-clamp-2">{post.content}</p>
                    </div>

                    {/* Post-level error */}
                    {post.errorMessage && (
                      <div className="bg-red-950/50 border border-red-900/50 rounded-lg p-3">
                        <p className="text-xs text-red-300 font-medium mb-0.5">Error general</p>
                        <p className="text-xs text-red-400 font-mono">{post.errorMessage}</p>
                      </div>
                    )}

                    {/* Per-platform errors */}
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Plataformas</p>
                      {post.integrations.map((pi, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <PlatformChip platform={pi.integration.platform} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-300 font-medium capitalize">
                                {pi.integration.platform}
                              </span>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                pi.status === 'ERROR'
                                  ? 'bg-red-900 text-red-300'
                                  : pi.status === 'PUBLISHED'
                                  ? 'bg-green-900 text-green-300'
                                  : 'bg-gray-700 text-gray-400'
                              }`}>
                                {pi.status}
                              </span>
                            </div>
                            {pi.errorMessage && (
                              <p className="text-xs text-red-400 font-mono mt-1 break-all">{pi.errorMessage}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Date & Retry */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-gray-500">
                        {fmtBogota(post.scheduledAt)}
                      </span>
                      <button
                        onClick={() => retryMutation.mutate(post.id)}
                        disabled={retryMutation.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 rounded-lg text-xs font-medium transition-colors"
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
