'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Youtube, MessageSquare, Bot, RefreshCw, Reply, Trash2, ToggleLeft, ToggleRight, Zap } from 'lucide-react';

const USER_ID = 'demo-user';

interface YtComment {
  id: string;
  videoId: string;
  videoTitle: string | null;
  commentId: string;
  authorName: string;
  text: string;
  likeCount: number;
  replyCount: number;
  publishedAt: string | null;
  isShort: boolean;
  replied: boolean;
  repliedAt: string | null;
  replyText: string | null;
}

interface AutoReply {
  id: string;
  keyword: string;
  replyTemplate: string;
  isEnabled: boolean;
  createdAt: string;
}

interface Stats {
  total: number;
  unreplied: number;
  shorts: number;
  autoReplied: number;
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

// ─── Comment card ─────────────────────────────────────────────────────────────
function CommentCard({ comment, onReply }: { comment: YtComment; onReply: (c: YtComment) => void }) {
  return (
    <div className={`bg-gray-900 border rounded-xl p-4 space-y-2 ${comment.replied ? 'border-green-800/50' : 'border-gray-800'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-sm text-white">{comment.authorName}</span>
            {comment.isShort && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/40 text-red-400 border border-red-800/50 font-medium">
                #Short
              </span>
            )}
            {comment.replied && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-900/40 text-green-400 border border-green-800/50 font-medium">
                ✓ respondido
              </span>
            )}
          </div>
          <p className="text-sm text-gray-300 break-words">{comment.text}</p>
          {comment.videoTitle && (
            <p className="text-[11px] text-gray-500 mt-1 truncate">
              📹 {comment.videoTitle}
            </p>
          )}
          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-500">
            {comment.publishedAt && <span>{new Date(comment.publishedAt).toLocaleDateString('es')}</span>}
            <span>👍 {comment.likeCount}</span>
            <span>💬 {comment.replyCount}</span>
          </div>
        </div>
        {!comment.replied && (
          <button
            onClick={() => onReply(comment)}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs text-indigo-400 hover:text-white bg-indigo-950/40 hover:bg-indigo-700 rounded-lg border border-indigo-800 transition-colors"
          >
            <Reply size={12} /> Responder
          </button>
        )}
      </div>
      {comment.replyText && (
        <div className="mt-2 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-400">
          <span className="text-gray-500">Tu respuesta:</span> {comment.replyText}
        </div>
      )}
    </div>
  );
}

// ─── Reply modal ─────────────────────────────────────────────────────────────
function ReplyModal({ comment, onClose, onSent }: {
  comment: YtComment;
  onClose: () => void;
  onSent: () => void;
}) {
  const [text, setText] = useState('');
  const mut = useMutation({
    mutationFn: () =>
      apiFetch(`/api/youtube/comments/${comment.commentId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ userId: USER_ID, text }),
      }),
    onSuccess: () => { toast.success('Respuesta enviada'); onSent(); onClose(); },
    onError: (e: Error) => toast.error(`Error: ${e.message}`),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 w-full max-w-lg space-y-4">
        <h3 className="font-semibold text-white">Responder a {comment.authorName}</h3>
        <p className="text-sm text-gray-400 bg-gray-800 rounded-lg p-3">&ldquo;{comment.text}&rdquo;</p>
        <textarea
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe tu respuesta..."
          className="w-full px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 text-white text-sm resize-none"
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">
            Cancelar
          </button>
          <button
            onClick={() => mut.mutate()}
            disabled={!text.trim() || mut.isPending}
            className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {mut.isPending ? 'Enviando...' : 'Enviar respuesta'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function YouTubePage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'comments' | 'autoreplies'>('comments');
  const [filter, setFilter] = useState<'all' | 'unreplied' | 'shorts'>('all');
  const [replyTarget, setReplyTarget] = useState<YtComment | null>(null);
  const [newKeyword, setNewKeyword] = useState('');
  const [newTemplate, setNewTemplate] = useState('');

  // ── Queries ─────────────────────────────────────────────────────────────
  const { data: stats } = useQuery<Stats>({
    queryKey: ['yt-stats', USER_ID],
    queryFn: () => apiFetch(`/api/youtube/stats?userId=${USER_ID}`),
    refetchInterval: 30000,
  });

  const { data: comments = [], isFetching: fetchingComments } = useQuery<YtComment[]>({
    queryKey: ['yt-comments', USER_ID, filter],
    queryFn: () => {
      const params = new URLSearchParams({ userId: USER_ID, limit: '100' });
      if (filter === 'unreplied') params.set('onlyUnreplied', 'true');
      if (filter === 'shorts') params.set('onlyShorts', 'true');
      return apiFetch(`/api/youtube/comments?${params}`);
    },
    refetchInterval: 60000,
  });

  const { data: autoReplies = [] } = useQuery<AutoReply[]>({
    queryKey: ['yt-auto-replies', USER_ID],
    queryFn: () => apiFetch(`/api/youtube/auto-replies?userId=${USER_ID}`),
  });

  // ── Mutations ────────────────────────────────────────────────────────────
  const pollMut = useMutation({
    mutationFn: () => apiFetch<{ polled: number; newComments: number; autoReplied: number }>(
      `/api/youtube/poll?userId=${USER_ID}`, { method: 'POST' }),
    onSuccess: (r) => {
      toast.success(`Poll completado: ${r.newComments} nuevos comentarios, ${r.autoReplied} auto-respondidos`);
      qc.invalidateQueries({ queryKey: ['yt-comments'] });
      qc.invalidateQueries({ queryKey: ['yt-stats'] });
    },
    onError: (e: Error) => toast.error(`Error: ${e.message}`),
  });

  const createAutoReplyMut = useMutation({
    mutationFn: () =>
      apiFetch('/api/youtube/auto-replies', {
        method: 'POST',
        body: JSON.stringify({ userId: USER_ID, keyword: newKeyword, replyTemplate: newTemplate }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['yt-auto-replies'] });
      setNewKeyword('');
      setNewTemplate('');
      toast.success('Regla creada');
    },
    onError: (e: Error) => toast.error(`Error: ${e.message}`),
  });

  const toggleAutoReplyMut = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/youtube/auto-replies/${id}/toggle?userId=${USER_ID}`, { method: 'PATCH' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['yt-auto-replies'] }),
  });

  const deleteAutoReplyMut = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/youtube/auto-replies/${id}?userId=${USER_ID}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['yt-auto-replies'] }),
  });

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Youtube size={22} className="text-red-500" />
          <h1 className="text-2xl font-bold">YouTube — Comentarios</h1>
        </div>
        <button
          onClick={() => pollMut.mutate()}
          disabled={pollMut.isPending}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg transition-colors"
        >
          <RefreshCw size={14} className={pollMut.isPending ? 'animate-spin' : ''} />
          {pollMut.isPending ? 'Obteniendo...' : 'Actualizar ahora'}
        </button>
      </header>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total" value={stats.total} color="text-white" />
          <StatCard label="Sin responder" value={stats.unreplied} color="text-yellow-400" />
          <StatCard label="Shorts" value={stats.shorts} color="text-red-400" />
          <StatCard label="Auto-respondidos" value={stats.autoReplied} color="text-green-400" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex rounded-xl overflow-hidden border border-gray-800 text-sm w-fit">
        {[
          { id: 'comments', label: 'Comentarios', icon: MessageSquare },
          { id: 'autoreplies', label: 'Auto-respuestas', icon: Bot },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id as any)}
            className={`flex items-center gap-2 px-4 py-2 transition-colors ${
              tab === id ? 'bg-red-600 text-white' : 'bg-gray-900 text-gray-400 hover:text-white'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ── Comments tab ───────────────────────────────────────────────────── */}
      {tab === 'comments' && (
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'unreplied', label: '⏳ Sin responder' },
              { id: 'shorts', label: '🎬 Solo Shorts' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id as any)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  filter === f.id
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
            {fetchingComments && <span className="text-xs text-gray-500 animate-pulse">actualizando…</span>}
            <span className="ml-auto text-xs text-gray-500">{comments.length} comentarios</span>
          </div>

          {/* Comment list */}
          <div className="space-y-2">
            {comments.length === 0 && (
              <div className="py-16 text-center text-gray-500 bg-gray-900 border border-gray-800 rounded-xl">
                <Youtube size={32} className="mx-auto mb-3 text-gray-600" />
                <p className="text-sm">No hay comentarios todavía.</p>
                <p className="text-xs mt-1">Haz clic en &quot;Actualizar ahora&quot; para obtenerlos.</p>
              </div>
            )}
            {comments.map((c) => (
              <CommentCard key={c.id} comment={c} onReply={setReplyTarget} />
            ))}
          </div>
        </div>
      )}

      {/* ── Auto-replies tab ───────────────────────────────────────────────── */}
      {tab === 'autoreplies' && (
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={16} className="text-yellow-400" />
              <h3 className="font-semibold text-sm text-white">Nueva regla de auto-respuesta</h3>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Cuando un comentario contenga la <strong>keyword</strong>, se responde automáticamente con la <strong>plantilla</strong>.
              Se aplica al siguiente ciclo de polling (cada 15 min).
            </p>
            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Keyword</label>
                <input
                  type="text"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  placeholder="precio, link, info..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Respuesta automática</label>
                <input
                  type="text"
                  value={newTemplate}
                  onChange={(e) => setNewTemplate(e.target.value)}
                  placeholder="¡Hola! Mira el link en la descripción 👇"
                  className="w-full px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 text-white text-sm"
                />
              </div>
            </div>
            <button
              onClick={() => createAutoReplyMut.mutate()}
              disabled={!newKeyword.trim() || !newTemplate.trim() || createAutoReplyMut.isPending}
              className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {createAutoReplyMut.isPending ? 'Creando...' : '+ Crear regla'}
            </button>
          </div>

          {/* Rules list */}
          <div className="space-y-2">
            {autoReplies.length === 0 && (
              <div className="py-10 text-center text-gray-500 bg-gray-900 border border-gray-800 rounded-xl text-sm">
                No hay reglas todavía. Crea una arriba.
              </div>
            )}
            {autoReplies.map((rule) => (
              <div
                key={rule.id}
                className={`flex items-start gap-3 bg-gray-900 border rounded-xl p-4 ${
                  rule.isEnabled ? 'border-gray-700' : 'border-gray-800 opacity-60'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono bg-yellow-900/30 text-yellow-400 border border-yellow-800/40 rounded px-1.5 py-0.5">
                      {rule.keyword}
                    </span>
                    {!rule.isEnabled && (
                      <span className="text-[10px] text-gray-500">desactivada</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-300">{rule.replyTemplate}</p>
                  <p className="text-[11px] text-gray-600 mt-1">
                    Creada {new Date(rule.createdAt).toLocaleDateString('es')}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => toggleAutoReplyMut.mutate(rule.id)}
                    title={rule.isEnabled ? 'Desactivar' : 'Activar'}
                    className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    {rule.isEnabled
                      ? <ToggleRight size={18} className="text-green-400" />
                      : <ToggleLeft size={18} />}
                  </button>
                  <button
                    onClick={() => deleteAutoReplyMut.mutate(rule.id)}
                    className="p-1.5 text-gray-400 hover:text-red-400 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reply modal */}
      {replyTarget && (
        <ReplyModal
          comment={replyTarget}
          onClose={() => setReplyTarget(null)}
          onSent={() => {
            qc.invalidateQueries({ queryKey: ['yt-comments'] });
            qc.invalidateQueries({ queryKey: ['yt-stats'] });
          }}
        />
      )}
    </div>
  );
}
