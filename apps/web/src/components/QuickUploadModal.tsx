'use client';
import { useCallback, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { uploadFileXHR } from '@/lib/uploadMedia';
import { getVideoMeta } from '@/lib/videoThumbnail';
import { compressVideo, compressImage } from '@/lib/compressMedia';
import { toast } from 'sonner';
import { X, Upload, Loader2, Film, Image as ImageIcon, CheckCircle2, AlertCircle } from 'lucide-react';

const PLATFORM_OPTIONS = [
  { id: 'INSTAGRAM', label: 'IG',       color: '#E1306C' },
  { id: 'TIKTOK',    label: 'TikTok',   color: '#000000' },
  { id: 'FACEBOOK',  label: 'FB',       color: '#1877F2' },
  { id: 'TWITTER',   label: 'X',        color: '#1DA1F2' },
  { id: 'YOUTUBE',   label: 'YouTube',  color: '#FF0000' },
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
  status: 'queued' | 'compressing' | 'uploading' | 'done' | 'error';
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

  const hasSocial  = selectedPlatforms.some(p => p !== 'YOUTUBE');
  const hasYoutube = selectedPlatforms.includes('YOUTUBE');

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
      { id, originalFile: file, thumbnail: '', originalSize: file.size, status: 'compressing', progress: 0, caption: '', ytDescription: '', ytTags: '' },
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
      let compressed: File;
      if (isVideo) {
        compressed = await compressVideo(
          file,
          (pct) => updateEntry(id, { status: 'compressing', progress: pct }),
          undefined,
          () => updateEntry(id, { status: 'queued', progress: 0 }),
        );
      } else {
        compressed = await compressImage(file);
      }
      updateEntry(id, { compressedSize: compressed.size, status: 'uploading', progress: 0 });
      const result = await uploadFileXHR(compressed, (pct) => updateEntry(id, { progress: pct }));
      updateEntry(id, { status: 'done', progress: 100, uploadedUrl: result.url, uploadedFileName: result.fileName });
    } catch (err) {
      updateEntry(id, { status: 'error', error: (err as Error).message });
    }
  }, [updateEntry]);

  const handleFiles = useCallback((list: FileList | File[]) => {
    Array.from(list).forEach(processFile);
  }, [processFile]);

  // Auto-upload when opened via drag (initialFiles)
  useInitialUpload(initialFiles, handleFiles);

  if (!date) return null;

  const pendingCount = entries.filter((e) => e.status === 'queued' || e.status === 'compressing' || e.status === 'uploading').length;
  const readyUrls    = entries.filter((e) => e.status === 'done').map((e) => e.uploadedUrl!);

  const handleSave = () => {
    const first = entries[0];
    const text  = first?.caption || '(Borrador sin contenido)';
    const scheduledAt = new Date(date);
    scheduledAt.setHours(9, 0, 0, 0);
    createPost.mutate({
      content: text,
      scheduledAt: scheduledAt.toISOString(),
      platforms: selectedPlatforms,
      status: 'DRAFT',
      mediaUrls: readyUrls,
      ...(hasYoutube && {
        youtubeTitle: text.slice(0, 100),
        youtubeDescription: first?.ytDescription || undefined,
        youtubeTags: first?.ytTags || undefined,
      }),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-lg">Nuevo borrador</h3>
            <p className="text-xs text-gray-500">
              {date.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={18} /></button>
        </div>

        {/* Platform selector */}
        <div>
          <p className="text-xs text-gray-500 mb-2">Plataformas</p>
          <div className="flex flex-wrap gap-1.5">
            {PLATFORM_OPTIONS.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => togglePlatform(p.id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                  selectedPlatforms.includes(p.id)
                    ? 'border-indigo-500 bg-indigo-950 text-white'
                    : 'border-gray-700 bg-gray-800 text-gray-400'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Upload zone */}
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-800 rounded-lg p-4 text-center cursor-pointer hover:border-gray-600 bg-gray-950"
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          <div className="flex flex-col items-center gap-1 text-gray-400">
            <Upload size={20} />
            <p className="text-sm">Haz clic o arrastra archivos</p>
            <p className="text-xs text-gray-600">Los videos se comprimirán automáticamente</p>
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
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={createPost.isPending || pendingCount > 0}
            className="px-3 py-1.5 text-sm rounded-lg bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white font-medium"
          >
            {createPost.isPending ? 'Guardando…' : 'Guardar borrador'}
          </button>
        </div>
      </div>
    </div>
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
    <div className="bg-gray-800 rounded-xl p-3 space-y-2">
      {/* File info */}
      <div className="flex gap-2 items-center">
        <div className="w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-gray-700 relative">
          {e.thumbnail ? (
            <img src={e.thumbnail} alt={e.originalFile.name} className="w-full h-full object-cover" />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              {isVideo ? <Film size={16} /> : <ImageIcon size={16} />}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-200 truncate">{e.originalFile.name}</p>
          <p className="text-[10px] text-gray-500">
            {fmtSize(e.originalSize)}
            {e.compressedSize != null && e.compressedSize < e.originalSize && (
              <span className="text-green-400 ml-1">→ {fmtSize(e.compressedSize)}</span>
            )}
          </p>
          {e.status === 'queued' && (
            <p className="text-[10px] text-yellow-500 flex items-center gap-1">
              <Loader2 className="animate-spin" size={9} />En cola…
            </p>
          )}
          {e.status === 'compressing' && (
            <p className="text-[10px] text-gray-400 flex items-center gap-1">
              <Loader2 className="animate-spin" size={9} />Comprimiendo… {e.progress}%
            </p>
          )}
          {e.status === 'uploading' && (
            <p className="text-[10px] text-gray-400 flex items-center gap-1">
              <Loader2 className="animate-spin" size={9} />Subiendo… {e.progress}%
            </p>
          )}
          {e.status === 'done' && (
            <p className="text-[10px] text-green-400 flex items-center gap-1">
              <CheckCircle2 size={9} />Subido
            </p>
          )}
          {e.status === 'error' && (
            <p className="text-[10px] text-red-400 flex items-center gap-1 truncate">
              <AlertCircle size={9} />{e.error}
            </p>
          )}
        </div>

        <button type="button" onClick={onRemove} className="text-gray-500 hover:text-red-400 shrink-0 p-1">
          <X size={12} />
        </button>
      </div>

      {/* Caption fields */}
      {showFields && (
        <div className="space-y-2 pt-1 border-t border-gray-700">
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5 block">
              {hasYoutube ? 'Caption / Título YouTube' : 'Caption'}
            </label>
            <textarea
              rows={2}
              placeholder={hasYoutube ? 'Caption o título del video…' : 'Caption…'}
              value={e.caption}
              onChange={(ev) => onUpdate({ caption: ev.target.value })}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          {hasYoutube && (
            <>
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5 block">
                  Descripción{hasSocial ? ' (YT + redes)' : ' YouTube'} <span className="normal-case text-gray-600">(opcional)</span>
                </label>
                <textarea
                  rows={2}
                  maxLength={5000}
                  placeholder="Descripción del video…"
                  value={e.ytDescription}
                  onChange={(ev) => onUpdate({ ytDescription: ev.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-red-500/60 resize-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5 block">
                  Tags YouTube <span className="normal-case text-gray-600">(separados por coma)</span>
                </label>
                <input
                  type="text"
                  placeholder="shorts, tutorial, vlog"
                  value={e.ytTags}
                  onChange={(ev) => onUpdate({ ytTags: ev.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-red-500/60"
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
