'use client';
import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { uploadFileXHR } from '@/lib/uploadMedia';
import { getVideoMeta } from '@/lib/videoThumbnail';
import { toast } from 'sonner';
import { X, Upload, Loader2, Film, Image as ImageIcon, CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
  date: Date | null;
  initialFiles?: File[];
  /** Platform IDs already selected in the calendar — used to show YouTube fields */
  platforms?: string[];
  onClose: () => void;
}

interface FileEntry {
  id: string;
  originalFile: File;
  thumbnail: string;
  duration?: number;
  originalSize: number;
  status: 'uploading' | 'done' | 'error';
  progress: number;
  uploadedUrl?: string;
  uploadedFileName?: string;
  error?: string;
  /** Per-file caption */
  caption: string;
  /** Per-file YouTube title */
  ytTitle: string;
}

export function QuickUploadModal({ date, initialFiles = [], platforms = [], onClose }: Props) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [saving, setSaving] = useState(false);

  const youtubeSelected = platforms.includes('YOUTUBE');

  const updateEntry = useCallback((id: string, patch: Partial<FileEntry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const processFile = useCallback(async (file: File) => {
    const id = Math.random().toString(36).slice(2, 10);
    const isVideo = file.type.startsWith('video/');
    const baseName = file.name.replace(/\.[^.]+$/, '');

    setEntries((prev) => [
      ...prev,
      {
        id,
        originalFile: file,
        thumbnail: '',
        originalSize: file.size,
        status: 'uploading',
        progress: 0,
        caption: '',
        ytTitle: baseName,
      },
    ]);

    // Thumbnail (non-blocking)
    try {
      if (isVideo) {
        const meta = await getVideoMeta(file);
        updateEntry(id, { thumbnail: meta.thumbnail, duration: meta.duration });
      } else {
        updateEntry(id, { thumbnail: URL.createObjectURL(file) });
      }
    } catch { /* non-critical */ }

    // Upload directly (no client-side video compression — server handles it in background)
    try {
      const result = await uploadFileXHR(file, (pct) => updateEntry(id, { progress: pct }));
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

  const pendingCount = entries.filter((e) => e.status === 'uploading').length;
  const doneEntries = entries.filter((e) => e.status === 'done');

  const handleSave = async () => {
    if (youtubeSelected && doneEntries.some((e) => !e.ytTitle)) {
      toast.error('Todos los videos necesitan título para YouTube');
      return;
    }

    setSaving(true);
    try {
      const scheduledAt = new Date(date);
      scheduledAt.setHours(9, 0, 0, 0);

      if (doneEntries.length === 0) {
        // Text-only draft
        await apiFetch(`/api/posts?userId=demo-user`, {
          method: 'POST',
          body: JSON.stringify({
            content: '(Borrador sin contenido)',
            scheduledAt: scheduledAt.toISOString(),
            platforms: [],
            status: 'DRAFT',
            mediaUrls: [],
          }),
        });
      } else {
        // One post per file
        for (const entry of doneEntries) {
          await apiFetch(`/api/posts?userId=demo-user`, {
            method: 'POST',
            body: JSON.stringify({
              content: entry.caption || '(Borrador sin contenido)',
              scheduledAt: scheduledAt.toISOString(),
              platforms: [],
              status: 'DRAFT',
              mediaUrls: [entry.uploadedUrl!],
              ...(youtubeSelected && entry.ytTitle && { youtubeTitle: entry.ytTitle }),
            }),
          });
        }
      }

      const count = doneEntries.length;
      toast.success(count > 1 ? `${count} borradores creados` : 'Borrador creado');
      qc.invalidateQueries({ queryKey: ['posts-all'] });
      onClose();
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-lg">Nuevo borrador</h3>
            <p className="text-xs text-gray-500">
              {date.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={18} /></button>
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
            <p className="text-xs text-gray-600">Los videos se comprimirán automáticamente en el servidor</p>
          </div>
        </div>

        {/* Per-file cards */}
        {entries.length > 0 && (
          <div className="space-y-3">
            {entries.map((e) => (
              <FileCard
                key={e.id}
                entry={e}
                youtubeSelected={youtubeSelected}
                onRemove={() => {
                  setEntries((prev) => {
                    const found = prev.find((x) => x.id === e.id);
                    if (found?.thumbnail?.startsWith('blob:')) URL.revokeObjectURL(found.thumbnail);
                    return prev.filter((x) => x.id !== e.id);
                  });
                }}
                onCaptionChange={(caption) => updateEntry(e.id, { caption })}
                onYtTitleChange={(ytTitle) => updateEntry(e.id, { ytTitle })}
              />
            ))}
          </div>
        )}

        <div className="flex gap-2 justify-end pt-1">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || pendingCount > 0}
            className="px-3 py-1.5 text-sm rounded-lg bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white font-medium"
          >
            {saving
              ? 'Guardando…'
              : doneEntries.length > 1
              ? `Guardar ${doneEntries.length} borradores`
              : 'Guardar borrador'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── FileCard ─────────────────────────────────────────────────────────── */
interface FileCardProps {
  entry: FileEntry;
  youtubeSelected: boolean;
  onRemove: () => void;
  onCaptionChange: (v: string) => void;
  onYtTitleChange: (v: string) => void;
}

function FileCard({ entry: e, youtubeSelected, onRemove, onCaptionChange, onYtTitleChange }: FileCardProps) {
  const isVideo = e.originalFile.type.startsWith('video/');

  return (
    <div className="border border-gray-700 rounded-lg p-3 bg-gray-800">
      {/* File header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-14 h-10 shrink-0 rounded-lg overflow-hidden bg-gray-700 relative">
          {e.thumbnail ? (
            <img src={e.thumbnail} alt={e.originalFile.name} className="w-full h-full object-cover" />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              {isVideo ? <Film size={14} /> : <ImageIcon size={14} />}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-200 truncate max-w-[200px]">
            {e.originalFile.name}
          </p>
          <p className="text-xs text-gray-500">
            {e.duration != null ? `${Math.round(e.duration)}s · ` : ''}
            {fmtSize(e.originalSize)}
          </p>
        </div>
        <button type="button" onClick={onRemove} className="text-gray-500 hover:text-red-400 shrink-0 p-1">
          <X size={12} />
        </button>
      </div>

      {/* Progress */}
      {e.status === 'uploading' && (
        <div className="mb-2 space-y-0.5">
          <p className="text-[10px] text-gray-400 flex items-center gap-1">
            <Loader2 className="animate-spin" size={9} />Subiendo… {e.progress}%
          </p>
          <div className="w-full bg-gray-700 rounded-full h-1">
            <div className="bg-indigo-500 h-1 rounded-full transition-all" style={{ width: `${e.progress}%` }} />
          </div>
        </div>
      )}
      {e.status === 'done' && (
        <p className="text-[10px] text-green-400 flex items-center gap-1 mb-2">
          <CheckCircle2 size={9} />Subido
        </p>
      )}
      {e.status === 'error' && (
        <p className="text-[10px] text-red-400 flex items-center gap-1 mb-2 truncate">
          <AlertCircle size={9} />{e.error}
        </p>
      )}

      {/* Caption textarea (always shown) */}
      <textarea
        rows={2}
        placeholder={`Caption para ${e.originalFile.name}…`}
        value={e.caption}
        onChange={(ev) => onCaptionChange(ev.target.value)}
        className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
      />

      {/* YouTube title (when YouTube platform selected) */}
      {youtubeSelected && (
        <input
          type="text"
          maxLength={100}
          placeholder="Título para YouTube (requerido) *"
          value={e.ytTitle}
          onChange={(ev) => onYtTitleChange(ev.target.value)}
          className="w-full mt-1.5 bg-gray-900 border border-red-900/50 rounded p-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-red-500"
        />
      )}
    </div>
  );
}

function fmtSize(b: number) {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

// Runs handleFiles(initialFiles) only once on mount
function useInitialUpload(initial: File[], handleFiles: (f: File[]) => void) {
  const ran = useRef(false);
  if (!ran.current && initial.length > 0) {
    ran.current = true;
    setTimeout(() => handleFiles(initial), 0);
  }
}
