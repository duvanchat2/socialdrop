'use client';
import { useMemo, useState, useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { uploadFileXHR } from '@/lib/uploadMedia';
import { getVideoMeta } from '@/lib/videoThumbnail';
import { compressImage } from '@/lib/compressMedia';
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
  caption: string;
  ytDescription: string;
  ytTags: string;
  // Per-file Instagram format (auto-detected, user can override)
  instagramType: 'POST' | 'REEL' | 'STORY';
  // Cross-post: also publish this file as a Story (in addition to primary type)
  alsoAsStory: boolean;
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
        // Videos skip compression → start directly as 'uploading'
        status: isVideo ? 'uploading' : 'compressing',
        progress: 0,
        caption: '',
        ytDescription: '',
        ytTags: '',
        // Auto-detect: videos → Reel, images → Post
        instagramType: isVideo ? 'REEL' : 'POST',
        alsoAsStory: false,
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
      if (isVideo) {
        // Upload original — no re-encoding, preserves full quality
        const result = await uploadFileXHR(file, (pct) => updateEntry(id, { progress: pct }));
        updateEntry(id, {
          status: 'done',
          progress: 100,
          uploadedUrl: result.url,
          uploadedFileName: result.fileName,
          uploadedMediaType: result.mediaType,
        });
      } else {
        const compressed = await compressImage(file);
        updateEntry(id, { compressedSize: compressed.size, status: 'uploading', progress: 0 });
        const result = await uploadFileXHR(compressed, (pct) => updateEntry(id, { progress: pct }));
        updateEntry(id, {
          status: 'done',
          progress: 100,
          uploadedUrl: result.url,
          uploadedFileName: result.fileName,
          uploadedMediaType: result.mediaType,
        });
      }
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

  /**
   * Build one or more post payloads.
   *
   * When Instagram is selected, files are grouped by their per-file instagramType
   * so each format (Reel / Post / Story) becomes a separate API call.
   * Files with alsoAsStory=true generate an additional Story post.
   * Non-Instagram platforms are attached to the first (or only) payload.
   * filesMeta carries per-file caption / instagramType for the backend splitter.
   */
  const buildPayloads = (extraFields: object = {}) => {
    const hasInstagram = selectedPlatforms.includes('INSTAGRAM');
    const nonIgPlatforms = selectedPlatforms.filter(p => p !== 'INSTAGRAM');

    if (!hasInstagram || readyEntries.length === 0) {
      // No Instagram → single payload; backend will split videos per platform rules
      const first = readyEntries[0] ?? fileEntries[0];
      const content = first?.caption || '(Borrador sin contenido)';
      const filesMeta = readyEntries.map(e => ({
        caption: e.caption || undefined,
        instagramType: e.instagramType,
        ...(hasYoutube && {
          youtubeTitle: e.caption.slice(0, 100) || undefined,
          youtubeTags: e.ytTags || undefined,
        }),
      }));
      return [{
        content,
        platforms: selectedPlatforms,
        mediaUrls: readyEntries.map(f => f.uploadedUrl!),
        filesMeta,
        ...(hasYoutube && first && {
          youtubeTitle: content.slice(0, 100),
          youtubeDescription: first.ytDescription || undefined,
          youtubeTags: first.ytTags || undefined,
        }),
        ...extraFields,
      }];
    }

    const payloads: object[] = [];

    // Group ready entries by instagramType
    const byType = new Map<string, typeof readyEntries>();
    for (const entry of readyEntries) {
      const t = entry.instagramType;
      if (!byType.has(t)) byType.set(t, []);
      byType.get(t)!.push(entry);
    }

    let firstGroup = true;
    for (const [type, entries] of byType) {
      const first = entries[0];
      const content = first?.caption || '(Borrador sin contenido)';
      payloads.push({
        content,
        // Non-IG platforms only attached to first group to avoid duplicates
        platforms: ['INSTAGRAM', ...(firstGroup ? nonIgPlatforms : [])],
        mediaUrls: entries.map(f => f.uploadedUrl!),
        instagramType: type,
        filesMeta: entries.map(e => ({
          caption: e.caption || undefined,
          instagramType: e.instagramType,
        })),
        ...(hasYoutube && firstGroup && first && {
          youtubeTitle: content.slice(0, 100),
          youtubeDescription: first.ytDescription || undefined,
          youtubeTags: first.ytTags || undefined,
        }),
        ...extraFields,
      });
      firstGroup = false;
    }

    // "También como Historia" — extra Story post per file
    for (const entry of readyEntries) {
      if (entry.alsoAsStory && entry.instagramType !== 'STORY') {
        const content = entry.caption || '(Borrador sin contenido)';
        payloads.push({
          content,
          platforms: ['INSTAGRAM'],
          mediaUrls: [entry.uploadedUrl!],
          instagramType: 'STORY',
          filesMeta: [{ caption: entry.caption || undefined, instagramType: 'STORY' as const }],
          ...extraFields,
        });
      }
    }

    return payloads;
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
      const payloads = buildPayloads({ scheduledAt: new Date().toISOString() });
      for (const payload of payloads) await createPost.mutateAsync(payload);
      toast.success('Publicando ahora…');
      qc.invalidateQueries({ queryKey: ['posts'] });
      qc.invalidateQueries({ queryKey: ['posts-all'] });
      router.push('/calendar');
    } catch (e) { toast.error(`Error: ${(e as Error).message}`); }
  };

  const handleAddToQueue = async () => {
    if (!commonGuards()) return;
    try {
      const payloads = buildPayloads({ scheduledAt: new Date().toISOString(), status: 'DRAFT' });
      // Create all posts then assign each to the queue
      const created = await Promise.all(payloads.map(p => createPost.mutateAsync(p)));
      // Backend may return a single post or an array of posts (auto-split)
      const ids = (created as any[]).flat().map((p: any) => p.id).filter(Boolean) as string[];
      const results = await Promise.all(ids.map(id => assignToQueue.mutateAsync(id)));
      const firstSlot = (results[0] as any)?.slot;
      if (firstSlot) {
        toast.success(`Añadido a la cola (día ${firstSlot.dayOfWeek} - ${String(firstSlot.hour).padStart(2, '0')}:${String(firstSlot.minute).padStart(2, '0')})`);
      } else {
        toast.success('Posts añadidos a la cola');
      }
      qc.invalidateQueries({ queryKey: ['posts-all'] });
      router.push('/calendar');
    } catch (e) { toast.error(`Error: ${(e as Error).message}`); }
  };

  const handleSaveDraft = async () => {
    if (!selectedPlatforms.length) { toast.error('Selecciona al menos una cuenta'); return; }
    try {
      const payloads = buildPayloads({ scheduledAt: new Date().toISOString(), status: 'DRAFT' });
      for (const payload of payloads) await createPost.mutateAsync(payload);
      toast.success('Borrador guardado');
      qc.invalidateQueries({ queryKey: ['posts-all'] });
      router.push('/calendar');
    } catch (e) { toast.error(`Error: ${(e as Error).message}`); }
  };

  const handleSchedule = async () => {
    if (!commonGuards()) return;
    if (!scheduledAt) { toast.error('Elige fecha y hora'); return; }
    try {
      const payloads = buildPayloads({ scheduledAt: new Date(scheduledAt).toISOString() });
      for (const payload of payloads) await createPost.mutateAsync(payload);
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
              <p className="text-xs text-gray-600">Imágenes y videos · Calidad original</p>
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
                hasInstagram={selectedPlatforms.includes('INSTAGRAM')}
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

        {/* Instagram type is now set per-file in each FileCard */}
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
  hasInstagram: boolean;
  onRemove: () => void;
  onUpdate: (patch: Partial<FileEntry>) => void;
}

const IG_TYPES = [
  { value: 'REEL'  as const, label: 'Reel',     emoji: '🎬' },
  { value: 'POST'  as const, label: 'Post',      emoji: '📷' },
  { value: 'STORY' as const, label: 'Historia',  emoji: '⏱' },
];

function FileCard({ entry: e, hasSocial, hasYoutube, hasInstagram, onRemove, onUpdate }: FileCardProps) {
  const isVideo = e.originalFile.type.startsWith('video/');
  const showFields = hasSocial || hasYoutube || hasInstagram;

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

      {/* Per-file Instagram type selector */}
      {hasInstagram && (
        <div className="pt-2 border-t border-gray-800 space-y-2">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Tipo en Instagram</p>
          <div className="flex gap-1.5">
            {IG_TYPES.map(({ value, label, emoji }) => (
              <button
                key={value}
                type="button"
                onClick={() => onUpdate({ instagramType: value })}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  e.instagramType === value
                    ? 'bg-pink-500/20 border-pink-500 text-pink-300'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                {emoji} {label}
              </button>
            ))}
          </div>
          {/* "También como Historia" — only for Reel / Post content */}
          {e.instagramType !== 'STORY' && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={e.alsoAsStory}
                onChange={(ev) => onUpdate({ alsoAsStory: ev.target.checked })}
                className="rounded border-gray-600 bg-gray-800 text-pink-500 focus:ring-pink-500"
              />
              <span className="text-xs text-gray-400">También publicar como Historia</span>
            </label>
          )}
        </div>
      )}

      {/* Caption fields — always show so user can type while uploading */}
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
