'use client';
import { useCallback, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { apiFetch } from '@/lib/api';
import { uploadFileXHR } from '@/lib/uploadMedia';
import { getVideoMeta } from '@/lib/videoThumbnail';
import { compressImage } from '@/lib/compressMedia';
import { toast } from 'sonner';
import { X, Upload, Loader2, Film, Image as ImageIcon, CheckCircle2, AlertCircle } from 'lucide-react';
import { PlatformChip, Platform } from './PlatformChip';

const PLATFORM_OPTIONS: { id: Platform; label: string }[] = [
  { id: 'INSTAGRAM', label: 'IG' },
  { id: 'TIKTOK',    label: 'TikTok' },
  { id: 'FACEBOOK',  label: 'FB' },
  { id: 'TWITTER',   label: 'X' },
  { id: 'YOUTUBE',   label: 'YouTube' },
];

interface Props {
  date: Date | null;
  initialFiles?: File[];
  onClose: () => void;
}

interface FileEntry {
  id: string;
  originalFile: File;
  thumbnail: string;
  duration?: number;
  originalSize: number;
  compressedSize?: number;
  status: 'compressing' | 'uploading' | 'done' | 'error';
  progress: number;
  uploadedUrl?: string;
  uploadedFileName?: string;
  error?: string;
  caption: string;
  ytDescription: string;
  ytTags: string;
}

export function QuickUploadModal({ date, initialFiles = [], onClose }: Props) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [instagramType, setInstagramType] = useState<'POST' | 'REEL' | 'STORY'>('REEL');

  const hasSocial    = selectedPlatforms.some(p => p !== 'YOUTUBE');
  const hasYoutube   = selectedPlatforms.includes('YOUTUBE');
  const hasInstagram = selectedPlatforms.includes('INSTAGRAM');

  const togglePlatform = (id: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const createPost = useMutation({
    mutationFn: (data: object) =>
      apiFetch(`/api/posts?userId=demo-user`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      toast.success('Borrador creado en el calendario');
      qc.invalidateQueries({ queryKey: ['posts-all'] });
      qc.invalidateQueries({ queryKey: ['posts-calendar'] });
      onClose();
    },
    onError: (e: Error) => toast.error(`Error: ${e.message}`),
  });

  const updateEntry = useCallback((id: string, patch: Partial<FileEntry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const processFile = useCallback(async (file: File) => {
    const id = Math.random().toString(36).slice(2, 10);
    const isVideo = file.type.startsWith('video/');

    setEntries((prev) => [
      ...prev,
      { id, originalFile: file, thumbnail: '', originalSize: file.size, status: isVideo ? 'uploading' : 'compressing', progress: 0, caption: '', ytDescription: '', ytTags: '' },
    ]);

    try {
      if (isVideo) {
        const meta = await getVideoMeta(file);
        updateEntry(id, { thumbnail: meta.thumbnail, duration: meta.duration });
      } else {
        updateEntry(id, { thumbnail: URL.createObjectURL(file) });
      }
    } catch { /* non-critical */ }

    try {
      if (isVideo) {
        // Upload original — no re-encoding, preserves full quality
        updateEntry(id, { status: 'uploading', progress: 0 });
        const result = await uploadFileXHR(file, (pct) => updateEntry(id, { progress: pct }));
        updateEntry(id, { status: 'done', progress: 100, uploadedUrl: result.url, uploadedFileName: result.fileName });
      } else {
        const compressed = await compressImage(file);
        updateEntry(id, { compressedSize: compressed.size, status: 'uploading', progress: 0 });
        const result = await uploadFileXHR(compressed, (pct) => updateEntry(id, { progress: pct }));
        updateEntry(id, { status: 'done', progress: 100, uploadedUrl: result.url, uploadedFileName: result.fileName });
      }
    } catch (err) {
      updateEntry(id, { status: 'error', error: (err as Error).message });
    }
  }, [updateEntry]);

  const handleFiles = useCallback((list: FileList | File[]) => {
    Array.from(list).forEach(processFile);
  }, [processFile]);

  // Auto-upload when opened via drag (initialFiles)
  useInitialUpload(initialFiles, handleFiles);

  const pendingCount = entries.filter((e) => e.status === 'compressing' || e.status === 'uploading').length;
  const readyUrls    = entries.filter((e) => e.status === 'done').map((e) => e.uploadedUrl!);

  const handleSave = () => {
    const first = entries[0];
    const text  = first?.caption || '(Borrador sin contenido)';
    const scheduledAt = new Date(date!);
    scheduledAt.setHours(9, 0, 0, 0);
    createPost.mutate({
      content: text,
      scheduledAt: scheduledAt.toISOString(),
      platforms: selectedPlatforms,
      status: 'DRAFT',
      mediaUrls: readyUrls,
      ...(hasInstagram && { instagramType }),
      ...(hasYoutube && {
        youtubeTitle: text.slice(0, 100),
        youtubeDescription: first?.ytDescription || undefined,
        youtubeTags: first?.ytTags || undefined,
      }),
    });
  };

  return (
    <AnimatePresence>
      {date && (
        <motion.div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.div
            className="bg-surface rounded-card w-full max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-display font-semibold text-lg text-ink">Nuevo borrador</h3>
            <p className="text-xs text-ink-muted">
              {date.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink"><X size={18} /></button>
        </div>

        {/* Platform selector */}
        <div>
          <p className="text-xs text-ink-muted mb-2">Plataformas</p>
          <div className="flex flex-wrap gap-1.5">
            {PLATFORM_OPTIONS.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => togglePlatform(p.id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-pill text-xs font-medium transition-all ${
                  selectedPlatforms.includes(p.id)
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

        {/* Instagram type selector */}
        {hasInstagram && (
          <div className="p-3 bg-surface-2 rounded-card">
            <p className="text-xs text-accent font-semibold mb-2">Tipo Instagram</p>
            <div className="flex gap-2">
              {(['POST', 'REEL', 'STORY'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setInstagramType(type)}
                  className={`flex-1 py-1.5 rounded-pill text-xs font-semibold transition-all ${
                    instagramType === type
                      ? 'bg-accent text-ink'
                      : 'bg-base text-ink-muted hover:bg-surface'
                  }`}
                >
                  {type === 'POST' ? '📷 Post' : type === 'REEL' ? '🎬 Reel' : '⏱ Historia'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Upload zone */}
        <div
          onClick={() => inputRef.current?.click()}
          className="rounded-lg p-4 text-center cursor-pointer bg-surface-2 hover:bg-base transition-colors"
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          <div className="flex flex-col items-center gap-1 text-ink-muted">
            <Upload size={20} />
            <p className="text-sm">Haz clic o arrastra archivos</p>
            <p className="text-xs text-ink-muted">Imágenes y videos · Calidad original</p>
          </div>
        </div>

        {/* File list with per-file captions */}
        {entries.length > 0 && (
          <div className="space-y-3">
            {entries.map((e) => (
              <FileRow
                key={e.id}
                entry={e}
                hasSocial={hasSocial}
                hasYoutube={hasYoutube}
                onUpdate={(patch) => updateEntry(e.id, patch)}
                onRemove={() => {
                  setEntries((prev) => {
                    const found = prev.find((x) => x.id === e.id);
                    if (found?.thumbnail?.startsWith('blob:')) URL.revokeObjectURL(found.thumbnail);
                    return prev.filter((x) => x.id !== e.id);
                  });
                }}
              />
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-pill bg-surface-2 hover:bg-base text-ink">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={createPost.isPending || pendingCount > 0}
            className="px-3 py-1.5 text-sm rounded-pill bg-accent hover:opacity-90 disabled:opacity-50 text-ink font-medium"
          >
            {createPost.isPending ? 'Guardando…' : 'Guardar borrador'}
          </button>
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── FileRow ──────────────────────────────────────────────────────── */
interface FileRowProps {
  entry: FileEntry;
  hasSocial: boolean;
  hasYoutube: boolean;
  onUpdate: (patch: Partial<FileEntry>) => void;
  onRemove: () => void;
}

function FileRow({ entry: e, hasSocial, hasYoutube, onUpdate, onRemove }: FileRowProps) {
  const isVideo    = e.originalFile.type.startsWith('video/');
  const showFields = hasSocial || hasYoutube;

  return (
    <div className="bg-surface-2 rounded-card p-3 space-y-2">
      {/* File info */}
      <div className="flex gap-2 items-center">
        <div className="w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-surface relative">
          {e.thumbnail ? (
            <img src={e.thumbnail} alt={e.originalFile.name} className="w-full h-full object-cover" />
          ) : (
            <div className="flex items-center justify-center h-full text-ink-muted">
              {isVideo ? <Film size={16} /> : <ImageIcon size={16} />}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs text-ink truncate">{e.originalFile.name}</p>
          <p className="text-[10px] text-ink-muted">
            {fmtSize(e.originalSize)}
            {e.compressedSize != null && e.compressedSize < e.originalSize && (
              <span className="text-positive ml-1">→ {fmtSize(e.compressedSize)}</span>
            )}
          </p>
          {e.status === 'compressing' && (
            <p className="text-[10px] text-ink-muted flex items-center gap-1">
              <Loader2 className="animate-spin" size={9} />Comprimiendo… {e.progress}%
            </p>
          )}
          {e.status === 'uploading' && (
            <p className="text-[10px] text-ink-muted flex items-center gap-1">
              <Loader2 className="animate-spin" size={9} />Subiendo… {e.progress}%
            </p>
          )}
          {e.status === 'done' && (
            <p className="text-[10px] text-positive flex items-center gap-1">
              <CheckCircle2 size={9} />Subido
            </p>
          )}
          {e.status === 'error' && (
            <p className="text-[10px] text-warning flex items-center gap-1 truncate">
              <AlertCircle size={9} />{e.error}
            </p>
          )}
        </div>

        <button type="button" onClick={onRemove} className="text-ink-muted hover:text-warning shrink-0 p-1">
          <X size={12} />
        </button>
      </div>

      {/* Caption fields */}
      {showFields && (
        <div className="space-y-2 pt-1">
          <div>
            <label className="text-[10px] text-ink-muted uppercase tracking-wide mb-0.5 block">
              {hasYoutube ? 'Caption / Título YouTube' : 'Caption'}
            </label>
            <textarea
              rows={2}
              placeholder={hasYoutube ? 'Caption o título del video…' : 'Caption…'}
              value={e.caption}
              onChange={(ev) => onUpdate({ caption: ev.target.value })}
              className="w-full bg-base rounded-lg px-2.5 py-1.5 text-xs text-ink placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            />
          </div>

          {hasYoutube && (
            <>
              <div>
                <label className="text-[10px] text-ink-muted uppercase tracking-wide mb-0.5 block">
                  Descripción{hasSocial ? ' (YT + redes)' : ' YouTube'} <span className="normal-case text-ink-muted">(opcional)</span>
                </label>
                <textarea
                  rows={2}
                  maxLength={5000}
                  placeholder="Descripción del video…"
                  value={e.ytDescription}
                  onChange={(ev) => onUpdate({ ytDescription: ev.target.value })}
                  className="w-full bg-base rounded-lg px-2.5 py-1.5 text-xs text-ink placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-warning resize-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-ink-muted uppercase tracking-wide mb-0.5 block">
                  Tags YouTube <span className="normal-case text-ink-muted">(separados por coma)</span>
                </label>
                <input
                  type="text"
                  placeholder="shorts, tutorial, vlog"
                  value={e.ytTags}
                  onChange={(ev) => onUpdate({ ytTags: ev.target.value })}
                  className="w-full bg-base rounded-lg px-2.5 py-1.5 text-xs text-ink placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-warning"
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function fmtSize(b: number) {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function useInitialUpload(initial: File[], handleFiles: (f: File[]) => void) {
  const ran = useRef(false);
  if (!ran.current && initial.length > 0) {
    ran.current = true;
    setTimeout(() => handleFiles(initial), 0);
  }
}
