'use client';
import { useMemo, useState, useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { uploadFileXHR } from '@/lib/uploadMedia';
import { getVideoMeta } from '@/lib/videoThumbnail';
import { compressVideo, compressImage } from '@/lib/compressMedia';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Upload, X, Film, Image as ImageIcon, Loader2, Edit3, Users as UsersIcon,
  CalendarClock, Send, FileText, ListOrdered, CheckCircle2, AlertCircle, Info,
} from 'lucide-react';

const PLATFORM_COLORS: Record<string, string> = {
  FACEBOOK: '#1877F2',
  INSTAGRAM: '#E1306C',
  TWITTER: '#1DA1F2',
  TIKTOK: '#000000',
  LINKEDIN: '#0A66C2',
  YOUTUBE: '#FF0000',
};

interface Integration {
  id: string;
  platform: string;
  accountName: string | null;
  profileId: string | null;
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
  uploadedMediaType?: 'IMAGE' | 'VIDEO';
  error?: string;
  // Per-file captions
  caption: string;       // social caption AND YouTube title (sliced to 100)
  ytDescription: string; // YouTube description (also rich caption for social)
  ytTags: string;        // YouTube tags
}

const PLATFORM_ORDER = ['INSTAGRAM', 'TIKTOK', 'FACEBOOK', 'TWITTER', 'LINKEDIN', 'YOUTUBE'];
const MAX_FILES = 10;

export default function NewPostPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [scheduledAt, setScheduledAt] = useState('');
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [fileEntries, setFileEntries] = useState<FileEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [instagramType, setInstagramType] = useState<'POST' | 'REEL' | 'STORY'>('REEL');

  const userId = 'demo-user';

  const { data: integrations = [] } = useQuery({
    queryKey: ['integrations', userId],
    queryFn: () => apiFetch<Integration[]>(`/api/integrations?userId=${userId}`),
  });

  const groupedByPlatform = useMemo(() => {
    const map = new Map<string, Integration[]>();
    for (const i of integrations) {
      if (!map.has(i.platform)) map.set(i.platform, []);
      map.get(i.platform)!.push(i);
    }
    return PLATFORM_ORDER.filter((p) => map.has(p)).map((p) => ({
      platform: p,
      accounts: map.get(p)!,
    }));
  }, [integrations]);

  const selectedPlatforms = useMemo(() => {
    const platforms = new Set<string>();
    for (const i of integrations) {
      if (selectedAccountIds.has(i.id)) platforms.add(i.platform);
    }
    return Array.from(platforms);
  }, [integrations, selectedAccountIds]);

  const hasSocial   = selectedPlatforms.some(p => p !== 'YOUTUBE');
  const hasYoutube  = selectedPlatforms.includes('YOUTUBE');

  const SINGLE_VIDEO_PLATFORMS = ['INSTAGRAM', 'TIKTOK', 'YOUTUBE'];
  const videoCount = fileEntries.filter(e => e.originalFile.type.startsWith('video/')).length;
  const needsSplitWarning =
    videoCount > 1 &&
    selectedPlatforms.some(p => SINGLE_VIDEO_PLATFORMS.includes(p));

  const toggleAccount = (id: string) => {
    setSelectedAccountIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateEntry = useCallback((id: string, patch: Partial<FileEntry>) => {
    setFileEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const processFile = useCallback(async (file: File) => {
    if (fileEntries.length >= MAX_FILES) {
      toast.error(`Máximo ${MAX_FILES} archivos por post`);
      return;
    }
    const id = Math.random().toString(36).slice(2, 10);
    const isVideo = file.type.startsWith('video/');

    setFileEntries((prev) => [
      ...prev,
      {
        id,
        originalFile: file,
        thumbnail: '',
        originalSize: file.size,
        status: 'compressing',
        progress: 0,
        caption: '',
        ytDescription: '',
        ytTags: '',
      },
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
        compressed = await compressVideo(file, (pct) => updateEntry(id, { progress: pct }));
      } else {
        compressed = await compressImage(file);
      }
      updateEntry(id, { compressedSize: compressed.size, status: 'uploading', progress: 0 });
      const result = await uploadFileXHR(compressed, (pct) => updateEntry(id, { progress: pct }));
      updateEntry(id, {
        status: 'done',
        progress: 100,
        uploadedUrl: result.url,
        uploadedFileName: result.fileName,
        uploadedMediaType: result.mediaType,
      });
    } catch (err) {
      updateEntry(id, { status: 'error', error: (err as Error).message });
    }
  }, [fileEntries.length, updateEntry]);

  const handleFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).slice(0, MAX_FILES - fileEntries.length);
    arr.forEach(processFile);
  }, [processFile, fileEntries.length]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const removeFile = (id: string) => {
    setFileEntries((prev) => {
      const e = prev.find((x) => x.id === id);
      if (e?.thumbnail?.startsWith('blob:')) URL.revokeObjectURL(e.thumbnail);
      return prev.filter((x) => x.id !== id);
    });
  };

  const readyEntries  = fileEntries.filter((e) => e.status === 'done');
  const pendingCount  = fileEntries.filter((e) => e.status === 'compressing' || e.status === 'uploading').length;

  // Build payload using first file's captions (each file has its own caption stored)
  const buildBasePayload = () => {
    const first = fileEntries[0];
    const content = first?.caption || '(Borrador sin contenido)';
    const hasInstagram = selectedPlatforms.includes('INSTAGRAM');
    return {
      content,
      platforms: selectedPlatforms,
      mediaUrls: readyEntries.map((f) => f.uploadedUrl!),
      ...(hasInstagram && { instagramType }),
      ...(hasYoutube && first && {
        youtubeTitle: content.slice(0, 100),
        youtubeDescription: first.ytDescription || undefined,
        youtubeTags: first.ytTags || undefined,
      }),
    };
  };

  const createPost = useMutation({
    mutationFn: (data: object) =>
      apiFetch(`/api/posts?userId=${userId}`, { method: 'POST', body: JSON.stringify(data) }),
  });

  const assignToQueue = useMutation({
    mutationFn: (postId: string) =>
      apiFetch(`/api/queue/assign`, { method: 'POST', body: JSON.stringify({ postId }) }),
  });

  const commonGuards = (): boolean => {
    if (!selectedPlatforms.length) { toast.error('Selecciona al menos una cuenta'); return false; }
    if (pendingCount > 0) { toast.error('Espera a que terminen todas las subidas'); return false; }
    return true;
  };

  const handlePublishNow = async () => {
    if (!commonGuards()) return;
    try {
      await createPost.mutateAsync({ ...buildBasePayload(), scheduledAt: new Date().toISOString() });
      toast.success('Publicando ahora…');
      qc.invalidateQueries({ queryKey: ['posts'] });
      qc.invalidateQueries({ queryKey: ['posts-all'] });
      router.push('/calendar');
    } catch (e) { toast.error(`Error: ${(e as Error).message}`); }
  };

  const handleAddToQueue = async () => {
    if (!commonGuards()) return;
    try {
      const post = await createPost.mutateAsync({
        ...buildBasePayload(),
        scheduledAt: new Date().toISOString(),
        status: 'DRAFT',
      }) as { id: string };
      const result = await assignToQueue.mutateAsync(post.id) as { slot: { dayOfWeek: number; hour: number; minute: number } };
      const { slot } = result;
      toast.success(`Añadido a la cola (día ${slot.dayOfWeek} - ${String(slot.hour).padStart(2, '0')}:${String(slot.minute).padStart(2, '0')})`);
      qc.invalidateQueries({ queryKey: ['posts-all'] });
      router.push('/calendar');
    } catch (e) { toast.error(`Error: ${(e as Error).message}`); }
  };

  const handleSaveDraft = async () => {
    if (!selectedPlatforms.length) { toast.error('Selecciona al menos una cuenta'); return; }
    try {
      await createPost.mutateAsync({ ...buildBasePayload(), scheduledAt: new Date().toISOString(), status: 'DRAFT' });
      toast.success('Borrador guardado');
      qc.invalidateQueries({ queryKey: ['posts-all'] });
      router.push('/calendar');
    } catch (e) { toast.error(`Error: ${(e as Error).message}`); }
  };

  const handleSchedule = async () => {
    if (!commonGuards()) return;
    if (!scheduledAt) { toast.error('Elige fecha y hora'); return; }
    try {
      await createPost.mutateAsync({ ...buildBasePayload(), scheduledAt: new Date(scheduledAt).toISOString() });
      toast.success('Post programado');
      qc.invalidateQueries({ queryKey: ['posts-all'] });
      router.push('/calendar');
    } catch (e) { toast.error(`Error: ${(e as Error).message}`); }
  };

  const busy = createPost.isPending || assignToQueue.isPending || pendingCount > 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Nuevo Post</h1>
        <p className="text-sm text-gray-400">Redacta y programa tu contenido.</p>
      </header>

      {/* Card 1 — Media + per-file captions */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <Edit3 size={16} className="text-indigo-400" />
          <h2 className="font-semibold">Media y Captions</h2>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          {hasSocial && hasYoutube
            ? 'Cada archivo tiene su propio caption (= título YouTube), descripción y tags.'
            : hasYoutube
            ? 'Cada archivo tiene título (caption), descripción y tags para YouTube.'
            : hasSocial
            ? 'Cada archivo tiene su propio caption.'
            : 'Selecciona cuentas abajo para ver los campos de caption.'}
        </p>

        {/* Drop zone */}
        {fileEntries.length < MAX_FILES && (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors mb-4 ${
              isDragging ? 'border-indigo-400 bg-indigo-950/30' : 'border-gray-800 hover:border-gray-600 bg-gray-950'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm"
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
            <div className="flex flex-col items-center gap-1 text-gray-400">
              <Upload size={22} />
              <p className="text-sm">Arrastra o haz clic para subir</p>
              <p className="text-xs text-gray-600">Imágenes y videos · Los videos se comprimirán</p>
            </div>
          </div>
        )}

        {/* File cards */}
        {fileEntries.length > 0 && (
          <div className="space-y-3">
            {fileEntries.map((e) => (
              <FileCard
                key={e.id}
                entry={e}
                hasSocial={hasSocial}
                hasYoutube={hasYoutube}
                onRemove={() => removeFile(e.id)}
                onUpdate={(patch) => updateEntry(e.id, patch)}
              />
            ))}
          </div>
        )}

        {fileEntries.length === 0 && (
          <p className="text-sm text-gray-600 text-center py-2">
            Sube archivos para ver los campos de caption.
          </p>
        )}
      </section>

      {/* Multi-video split banner */}
      {needsSplitWarning && (
        <div className="flex items-start gap-3 bg-amber-950/40 border border-amber-700/50 rounded-xl px-4 py-3 text-sm text-amber-300">
          <Info size={16} className="shrink-0 mt-0.5 text-amber-400" />
          <p>
            Subiste <strong>{videoCount} videos</strong> y seleccionaste plataformas que solo admiten un video por post (Instagram, TikTok, YouTube).
            Se creará <strong>un post separado por cada video</strong> de forma automática.
          </p>
        </div>
      )}

      {/* Card 2 — Select Accounts */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <UsersIcon size={16} className="text-indigo-400" />
          <h2 className="font-semibold">Seleccionar Cuentas</h2>
        </div>
        <p className="text-xs text-gray-500 mb-3">Elige en qué cuentas publicar.</p>

        {groupedByPlatform.length === 0 && (
          <p className="text-sm text-gray-500 py-6 text-center">
            No hay cuentas conectadas.{' '}
            <a href="/integrations" className="text-indigo-400 hover:underline">Conecta una aquí.</a>
          </p>
        )}

        <div className="space-y-4">
          {groupedByPlatform.map(({ platform, accounts }) => (
            <div key={platform}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full" style={{ background: PLATFORM_COLORS[platform] }} />
                <span className="text-sm font-medium capitalize">{platform.toLowerCase()}</span>
              </div>
              <div className="space-y-2">
                {accounts.map((acc) => {
                  const selected = selectedAccountIds.has(acc.id);
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => toggleAccount(acc.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                        selected ? 'border-indigo-500 bg-indigo-950/40' : 'border-gray-800 bg-gray-950 hover:border-gray-700'
                      }`}
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
                        style={{ background: PLATFORM_COLORS[platform] }}
                      >
                        {(acc.accountName ?? acc.profileId ?? '?').slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-100 truncate">{acc.accountName ?? acc.profileId ?? 'Sin nombre'}</p>
                        <p className="text-xs text-gray-500 capitalize">{platform.toLowerCase()}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Instagram type selector — shown once Instagram account is selected */}
        {selectedPlatforms.includes('INSTAGRAM') && (
          <div className="mt-4 p-4 bg-gray-950 border border-pink-800/50 rounded-xl">
            <p className="text-sm font-semibold text-pink-400 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-pink-500 inline-block" />
              Formato en Instagram
            </p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { type: 'POST',  label: 'Post',    emoji: '📷', desc: 'Imagen o carrusel en el feed' },
                { type: 'REEL',  label: 'Reel',    emoji: '🎬', desc: 'Video corto en el feed' },
                { type: 'STORY', label: 'Historia', emoji: '⏱', desc: 'Desaparece en 24h' },
              ] as const).map(({ type, label, emoji, desc }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setInstagramType(type)}
                  className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border transition-all text-center ${
                    instagramType === type
                      ? 'bg-pink-600/20 border-pink-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                  }`}
                >
                  <span className="text-xl">{emoji}</span>
                  <span className="text-xs font-semibold">{label}</span>
                  <span className="text-[10px] text-gray-500 leading-tight">{desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Actions */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-2">
            <CalendarClock size={15} className="text-indigo-400" />
            Programar (opcional)
          </label>
          <input
            type="datetime-local"
            className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleAddToQueue}
            disabled={busy}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg font-medium text-sm transition-colors"
          >
            <ListOrdered size={16} />
            Añadir a la Cola
          </button>
          <button
            type="button"
            onClick={scheduledAt ? handleSchedule : handlePublishNow}
            disabled={busy}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 rounded-lg font-medium text-sm transition-colors text-white"
          >
            <Send size={16} />
            {scheduledAt ? 'Programar' : 'Publicar ahora'}
          </button>
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={busy}
            className="col-span-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg font-medium text-sm transition-colors text-gray-200 border border-gray-700"
          >
            <FileText size={16} />
            Guardar borrador
          </button>
        </div>
      </section>
    </div>
  );
}

/* ─── FileCard ──────────────────────────────────────────────────────── */
interface FileCardProps {
  entry: FileEntry;
  hasSocial: boolean;
  hasYoutube: boolean;
  onRemove: () => void;
  onUpdate: (patch: Partial<FileEntry>) => void;
}

function FileCard({ entry: e, hasSocial, hasYoutube, onRemove, onUpdate }: FileCardProps) {
  const isVideo = e.originalFile.type.startsWith('video/');
  const showFields = hasSocial || hasYoutube;

  return (
    <div className="bg-gray-950 border border-gray-800 rounded-xl p-3 space-y-3">
      {/* File info row */}
      <div className="flex gap-3">
        <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-gray-800 relative">
          {e.thumbnail ? (
            <img src={e.thumbnail} alt={e.originalFile.name} className="w-full h-full object-cover" />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              {isVideo ? <Film size={20} /> : <ImageIcon size={20} />}
            </div>
          )}
          {isVideo && e.duration != null && (
            <span className="absolute bottom-0.5 right-0.5 bg-black/70 text-white text-[9px] px-1 rounded">
              {Math.floor(e.duration / 60)}:{String(Math.round(e.duration % 60)).padStart(2, '0')}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm text-gray-100 truncate">{e.originalFile.name}</p>
              <p className="text-xs text-gray-500">
                {fmtSize(e.originalSize)}
                {e.compressedSize != null && e.compressedSize < e.originalSize && (
                  <span className="text-green-400 ml-1">→ {fmtSize(e.compressedSize)}</span>
                )}
              </p>
            </div>
            <button type="button" onClick={onRemove} className="text-gray-500 hover:text-red-400 shrink-0">
              <X size={14} />
            </button>
          </div>

          <div className="mt-1.5">
            {e.status === 'compressing' && <InlineProgress label={`Comprimiendo… ${e.progress}%`} pct={e.progress} />}
            {e.status === 'uploading'   && <InlineProgress label={`Subiendo… ${e.progress}%`}    pct={e.progress} />}
            {e.status === 'done'        && <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle2 size={11} />Subido</span>}
            {e.status === 'error'       && <span className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={11} />{e.error}</span>}
          </div>
        </div>
      </div>

      {/* Caption fields — always show so user can type while compressing */}
      {showFields && (
        <div className="space-y-2 pt-1 border-t border-gray-800">
          {/* Caption / Title */}
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5 block">
              {hasYoutube ? `Caption / Título YouTube${e.caption.length > 100 ? ` (${e.caption.length}/100 ⚠️ se recortará)` : ''}` : 'Caption'}
            </label>
            <textarea
              rows={2}
              placeholder={hasYoutube ? 'Escribe el caption o título del video…' : 'Escribe el caption…'}
              value={e.caption}
              onChange={(ev) => onUpdate({ caption: ev.target.value })}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          {/* YouTube extras */}
          {hasYoutube && (
            <>
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5 block">
                  Descripción{hasSocial ? ' (YouTube + redes sociales)' : ' YouTube'} <span className="normal-case text-gray-600">(opcional)</span>
                </label>
                <textarea
                  rows={2}
                  maxLength={5000}
                  placeholder="Descripción del video…"
                  value={e.ytDescription}
                  onChange={(ev) => onUpdate({ ytDescription: ev.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-red-500/60 resize-none"
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
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-red-500/60"
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function InlineProgress({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-gray-400 flex items-center gap-1">
        <Loader2 className="animate-spin" size={10} />{label}
      </p>
      <div className="w-full bg-gray-700 rounded-full h-1">
        <div className="bg-indigo-500 h-1 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function fmtSize(b: number) {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
