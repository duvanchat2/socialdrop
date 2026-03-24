'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { StatusBadge, PostStatus } from '@/components/StatusBadge';
import { PlatformIcon, Platform } from '@/components/PlatformIcon';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, X, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface StatsOverview { published: number; pending: number; failed: number; total: number; today: number; }

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

  const stats = useQuery({
    queryKey: ['stats'],
    queryFn: () => apiFetch<StatsOverview>(`/api/stats/overview?userId=${userId}`),
  });

  const posts = useQuery({
    queryKey: ['posts'],
    queryFn: () => apiFetch<Post[]>(`/api/posts?userId=${userId}&limit=20`),
  });

  const failedPosts = useQuery({
    queryKey: ['posts-failed'],
    queryFn: () => apiFetch<Post[]>(`/api/posts?userId=${userId}&status=ERROR&limit=50`),
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

  const STAT_CARDS = [
    { label: 'Publicados hoy', value: stats.data?.today ?? 0, color: 'text-green-400', clickable: false },
    { label: 'Programados', value: stats.data?.pending ?? 0, color: 'text-blue-400', clickable: false },
    { label: 'Fallidos', value: stats.data?.failed ?? 0, color: 'text-red-400', clickable: true },
    { label: 'Total', value: stats.data?.total ?? 0, color: 'text-gray-300', clickable: false },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map(({ label, value, color, clickable }) => (
          <div
            key={label}
            onClick={() => clickable && setShowFailedDrawer(true)}
            className={`bg-gray-900 border border-gray-800 rounded-xl p-4 transition-all ${
              clickable ? 'cursor-pointer hover:border-red-800 hover:bg-gray-800/80' : ''
            }`}
          >
            <p className="text-sm text-gray-400">{label}</p>
            <p className={`text-3xl font-bold mt-1 ${color}`}>
              {stats.isLoading ? <Loader2 className="animate-spin" size={24} /> : value}
            </p>
            {clickable && value > 0 && (
              <p className="text-xs text-red-400/70 mt-1">Click para ver detalles →</p>
            )}
          </div>
        ))}
      </div>

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
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-left">
                <th className="px-4 py-3 font-medium">Caption</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Plataformas</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">Fecha</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {(posts.data ?? []).map(post => (
                <tr key={post.id} className="border-t border-gray-800 hover:bg-gray-800/50 cursor-pointer">
                  <td className="px-4 py-3 max-w-xs truncate">{post.content}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex gap-1 flex-wrap">
                      {post.integrations.map((pi, i) => (
                        <PlatformIcon key={i} platform={pi.integration.platform} size={20} />
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-gray-400">
                    {format(new Date(post.scheduledAt), 'dd MMM yyyy HH:mm', { locale: es })}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={post.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Failed Posts Drawer ── */}
      {showFailedDrawer && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 z-40"
            onClick={() => setShowFailedDrawer(false)}
          />
          {/* Drawer */}
          <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-gray-900 border-l border-gray-700 z-50 flex flex-col shadow-2xl">
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
                          <PlatformIcon platform={pi.integration.platform} size={18} />
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
                        {format(new Date(post.scheduledAt), 'dd MMM yyyy HH:mm', { locale: es })}
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
          </div>
        </>
      )}
    </div>
  );
}
