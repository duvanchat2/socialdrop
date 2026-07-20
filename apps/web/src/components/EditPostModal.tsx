'use client';
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { StatusBadge, PostStatus } from './StatusBadge';
import { PlatformChip, Platform } from './PlatformChip';

const PLATFORMS: { id: Platform; label: string }[] = [
  { id: 'FACEBOOK',  label: 'Facebook' },
  { id: 'INSTAGRAM', label: 'Instagram' },
  { id: 'TWITTER',   label: 'X / Twitter' },
  { id: 'TIKTOK',    label: 'TikTok' },
  { id: 'YOUTUBE',   label: 'YouTube' },
];

const USER_ID = 'demo-user';

export interface EditablePost {
  id: string;
  content: string;
  status: PostStatus;
  scheduledAt: string;
  integrations: { integration: { platform: string } }[];
  metadata?: { youtube?: { title?: string; description?: string; tags?: string[] } };
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  post: EditablePost | null;
  onClose: () => void;
}

export function EditPostModal({ post, onClose }: Props) {
  const qc = useQueryClient();
  const [content,       setContent]       = useState('');
  const [scheduledAt,   setScheduledAt]   = useState('');
  const [platforms,     setPlatforms]     = useState<string[]>([]);
  const [ytDescription, setYtDescription] = useState('');
  const [ytTags,        setYtTags]        = useState('');

  useEffect(() => {
    if (post) {
      setContent(post.content);
      setScheduledAt(toLocalInput(post.scheduledAt));
      setPlatforms(post.integrations.map(pi => pi.integration.platform));
      setYtDescription(post.metadata?.youtube?.description ?? '');
      setYtTags(post.metadata?.youtube?.tags?.join(', ') ?? '');
    }
  }, [post]);

  const updateMutation = useMutation({
    mutationFn: (data: object) =>
      apiFetch(`/api/posts/${post!.id}?userId=${USER_ID}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast.success('Post actualizado correctamente');
      qc.invalidateQueries({ queryKey: ['posts'] });
      qc.invalidateQueries({ queryKey: ['posts-all'] });
      qc.invalidateQueries({ queryKey: ['posts-calendar'] });
      qc.invalidateQueries({ queryKey: ['posts-failed'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      onClose();
    },
    onError: (e: Error) => toast.error(`Error: ${e.message}`),
  });

  // DRAFTs are fully editable too
  const canEdit = post != null && (post.status === 'SCHEDULED' || post.status === 'ERROR'
    || post.status === 'PENDING' || post.status === 'DRAFT');

  const youtubeSelected = platforms.includes('YOUTUBE');

  function handleSave() {
    if (!content.trim())   { toast.error('El caption no puede estar vacío'); return; }
    if (!platforms.length) { toast.error('Selecciona al menos una plataforma'); return; }
    if (!scheduledAt)      { toast.error('Selecciona una fecha y hora'); return; }
    updateMutation.mutate({
      content,
      scheduledAt: new Date(scheduledAt).toISOString(),
      platforms,
      ...(youtubeSelected && content && {
        youtubeTitle: content.slice(0, 100),
        youtubeDescription: ytDescription || undefined,
        youtubeTags: ytTags || undefined,
      }),
    });
  }

  function togglePlatform(id: string) {
    setPlatforms(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  return (
    <AnimatePresence>
      {post && (
        <motion.div
          data-testid="edit-post-modal"
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.div
            className="bg-surface rounded-card w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
        <div className="flex justify-between items-center">
          <h3 className="font-display font-semibold text-lg text-ink">Editar Post</h3>
          <button onClick={onClose} className="text-ink-muted hover:text-ink"><X size={20} /></button>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge status={post.status} />
          {!canEdit && (
            <span className="text-xs text-ink-muted">
              {post.status === 'PUBLISHED' ? 'Los posts publicados no se pueden editar' : 'No editable en este estado'}
            </span>
          )}
        </div>

        {/* Caption — also used as YouTube title */}
        <div>
          <label className="block text-sm font-medium text-ink mb-1">
            {youtubeSelected ? 'Caption / Título YouTube' : 'Caption'}
          </label>
          <textarea
            rows={4}
            value={content}
            onChange={e => setContent(e.target.value)}
            disabled={!canEdit}
            className="w-full bg-surface-2 rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-accent resize-none disabled:opacity-50"
          />
          {youtubeSelected && content.length > 100 && (
            <p className="text-xs text-warning mt-0.5">El título de YouTube se recortará a 100 caracteres</p>
          )}
        </div>

        {/* YouTube extras */}
        {youtubeSelected && canEdit && (
          <div className="p-3 bg-surface-2 rounded-card space-y-3">
            <p className="text-xs font-semibold text-warning flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-warning inline-block" />
              YouTube (extras opcionales)
            </p>
            <div>
              <label className="text-xs text-ink-muted mb-1 block">Descripción</label>
              <textarea
                rows={2}
                maxLength={5000}
                placeholder="Descripción del video..."
                value={ytDescription}
                onChange={e => setYtDescription(e.target.value)}
                className="w-full bg-base rounded-lg px-3 py-2 text-sm text-ink placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-warning resize-none"
              />
            </div>
            <div>
              <label className="text-xs text-ink-muted mb-1 block">Tags (separados por coma)</label>
              <input
                type="text"
                placeholder="shorts, tutorial, vlog"
                value={ytTags}
                onChange={e => setYtTags(e.target.value)}
                className="w-full bg-base rounded-lg px-3 py-2 text-sm text-ink placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-warning"
              />
            </div>
          </div>
        )}

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Fecha y hora</label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={e => setScheduledAt(e.target.value)}
            disabled={!canEdit}
            className="bg-surface-2 rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
          />
        </div>

        {/* Platforms */}
        <div>
          <label className="block text-sm font-medium text-ink mb-2">Plataformas</label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map(p => (
              <button
                key={p.id}
                type="button"
                disabled={!canEdit}
                onClick={() => togglePlatform(p.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-xs font-medium transition-all disabled:opacity-50 ${
                  platforms.includes(p.id)
                    ? 'bg-accent/15 text-ink'
                    : 'bg-surface-2 text-ink-muted'
                }`}
              >
                <PlatformChip platform={p.id} size="sm" />
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-surface-2 hover:bg-surface rounded-pill text-sm font-medium text-ink"
          >
            Cancelar
          </button>
          {canEdit && (
            <button
              data-testid="save-post-btn"
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="px-4 py-2 bg-accent hover:opacity-90 disabled:opacity-50 rounded-pill text-sm font-medium text-ink"
            >
              {updateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
            </button>
          )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
