'use client';
import { useMemo, useState, useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { uploadFile } from '@/lib/uploadMedia';
import { getVideoMeta } from '@/lib/videoThumbnail';
import { UploadProgress } from '@/components/UploadProgress';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Upload, X, Film, Image as ImageIcon, Edit3, Users as UsersIcon,
  CalendarClock, Send, FileText, ListOrdered, AlertCircle,
} from 'lucide-react';

const PLATFORM_LIMITS: Record<string, number> = {
  FACEBOOK: 63206,
  INSTAGRAM: 2200,
  TWITTER: 280,
  TIKTOK: 2200,
  LINKEDIN: 3000,
  YOUTUBE: 5000,
};

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
  status: 'uploading' | 'done' | 'error';
  progress: number;
  speed?: string;
  remaining?: string;
  uploadedUrl?: string;
  uploadedFileName?: string;
  uploadedMediaType?: 'IMAGE' | 'VIDEO';
  error?: string;
}

const PLATFORM_ORDER = ['INSTAGRAM', 'TIKTOK', 'FACEBOOK', 'TWITTER', 'LINKEDIN', 'YOUTUBE'];
const MAX_FILES = 10;

export default function NewPostPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [caption, setCaption] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [fileEntries, setFileEntries] = useState<FileEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // YouTube-specific fields
  const [ytTitle, setYtTitle] = useState('');
  const [ytDescription, setYtDescription] = useState('');
  const [ytTags, setYtTags] = useState('');

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

  const youtubeSelected = selectedPlatforms.includes('YOUTUBE');

  const maxChars = useMemo(() => {
    if (selectedPlatforms.length === 0) return 280;
    return Math.min(...selectedPlatforms.map((p) => PLATFORM_LIMITS[p] ?? 2200));
  }, [selectedPlatforms]);

  const overLimit = caption.length > maxChars;

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
        status: 'uploading',
        progress: 0,
      },
    ]);

    // Extract thumbnail immediately so user sees preview right away
    try {
      if (isVideo) {
        const meta = await getVideoMeta(file);
        updateEntry(id, { thumbnail: meta.thumbnail, duration: meta.duration });
      } else {
        updateEntry(id, { thumbnail: URL.createObjectURL(file) });
      }
    } catch { /* non-critical */ }

    // Upload with real-time speed feedback
    try {
      const result = await uploadFile(
        file,
        (pct, speed, remaining) =>
          updateEntry(id, { status: 'uploading', progress: pct, speed, remaining }),
      );

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

  const readyEntries = fileEntries.filter((e) => e.status === 'done');
  const pendingCount = fileEntries.filter((e) => e.status === 'uploading').length;

  // --- Mutations ---
  const createPost = useMutation({
    mutationFn: (data: object) =>
      apiFetch(`/api/posts?userId=${userId}`, { method: 'POST', body: JSON.stringify(data) }),
  });

  const assignToQueue = useMutation({
    mutationFn: (postId: string) =>
      apiFetch(`/api/queue/assign`, { method: 'POST', body: JSON.stringify({ postId }) }),
  });

  const buildBasePayload = () => ({
    content: caption,
    platforms: selectedPlatforms,
    mediaUrls: readyEntries.map((f) => f.uploadedUrl!),
    ...(youtubeSelected && ytTitle && {
      youtubeTitle: ytTitle,
      youtubeDescription: ytDescription || undefined,
      youtubeTags: ytTags || undefined,
    }),
  });

  const commonGuards = (): boolean => {
    if (!caption) { toast.error('Escribe el contenido del post'); return false; }
    if (!selectedPlatforms.length) { toast.error('Selecciona al menos una cuenta'); return false; }
    if (overLimit) { toast.error(`El contenido excede ${maxChars} caracteres`); return false; }
    if (pendingCount > 0) { toast.error('Espera a que terminen todas las subidas'); return false; }
    if (youtubeSelected && !ytTitle) { toast.error('El título es requerido para YouTube'); return false; }
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
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
    }
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
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
    }
  };

  const handleSaveDraft = async () => {
    if (!caption) { toast.error('Escribe el contenido del post'); return; }
    if (!selectedPlatforms.length) { toast.error('Selecciona al menos una cuenta'); return; }
    try {
      await createPost.mutateAsync({ ...buildBasePayload(), scheduledAt: new Date().toISOString(), status: 'DRAFT' });
      toast.success('Borrador guardado');
      qc.invalidateQueries({ queryKey: ['posts-all'] });
      router.push('/calendar');
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
    }
  };

  const handleSchedule = async () => {
    if (!commonGuards()) return;
    if (!scheduledAt) { toast.error('Elige fecha y hora'); return; }
    try {
      await createPost.mutateAsync({ ...buildBasePayload(), scheduledAt: new Date(scheduledAt).toISOString() });
      toast.success('Post programado');
      qc.invalidateQueries({ queryKey: ['posts-all'] });
      router.push('/calendar');
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
    }
  };

  const busy = createPost.isPending || assignToQueue.isPending || pendingCount > 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Nuevo Post</h1>
        <p className="text-sm text-gray-400">Redacta y programa tu contenido.</p>
      </header>

      {/* Card 1 — Content */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <Edit3 size={16} className="text-indigo-400" />
          <h2 className="font-semibold">Contenido</h2>
        </div>
        <p className="text-xs text-gray-500 mb-3">Escribe el caption y adjunta medios.</p>

        <div className="relative">
          <textarea
            data-testid="caption-input"
            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
            rows={4}
            placeholder="¿Qué quieres publicar?"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
          <span className={`absolute bottom-2 right-3 text-xs ${overLimit ? 'text-red-400' : 'text-gray-500'}`}>
            {caption.length} / {maxChars}
          </span>
        </div>

        {/* Media section */}
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <ImageIcon size={15} className="text-indigo-400" />
            <span className="text-sm font-medium">Media</span>
            <span className="text-xs text-gray-500">({fileEntries.length}/{MAX_FILES})</span>
          </div>

          {fileEntries.length < MAX_FILES && (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${
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

          {fileEntries.length > 0 && (
            <div className="grid grid-cols-1 gap-2 mt-3">
              {fileEntries.map((e) => (
                <FileCard key={e.id} entry={e} onRemove={() => removeFile(e.id)} />
              ))}
            </div>
          )}
        </div>

        {/* YouTube metadata */}
        {youtubeSelected && (
          <div className="mt-4 p-4 bg-red-950/20 border border-red-900/40 rounded-xl space-y-3">
            <p className="text-sm font-semibold text-red-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
              Datos de YouTube
            </p>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Título <span className="text-red-400">*</span> <span className="text-gray-600">(máx 100)</span></label>
              <input
                type="text"
                maxLength={100}
                placeholder="Título del video en YouTube"
                value={ytTitle}
                onChange={(e) => setYtTitle(e.target.value)}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-red-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Descripción <span className="text-gray-600">(máx 5000)</span></label>
              <textarea
                rows={3}
                maxLength={5000}
                placeholder="Descripción del video (opcional, usa el caption si se deja vacío)"
                value={ytDescription}
                onChange={(e) => setYtDescription(e.target.value)}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-red-500 resize-none"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Tags <span className="text-gray-600">(separados por coma)</span></label>
              <input
                type="text"
                placeholder="shorts, tutorial, vlog"
                value={ytTags}
                onChange={(e) => setYtTags(e.target.value)}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-red-500"
              />
            </div>
          </div>
        )}
      </section>

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
                      data-testid={`account-${acc.id}`}
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
            data-testid="add-to-queue-btn"
            onClick={handleAddToQueue}
            disabled={busy || overLimit}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg font-medium text-sm transition-colors"
          >
            <ListOrdered size={16} />
            Añadir a la Cola
          </button>
          <button
            type="button"
            data-testid="submit-post-btn"
            onClick={scheduledAt ? handleSchedule : handlePublishNow}
            disabled={busy || overLimit}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 rounded-lg font-medium text-sm transition-colors text-white"
          >
            <Send size={16} />
            {scheduledAt ? 'Programar' : 'Publicar ahora'}
          </button>
          <button
            type="button"
            data-testid="save-draft-btn"
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

/* ─── FileCard ──────────────────────────────────────────────────────────────── */
function FileCard({ entry: e, onRemove }: { entry: FileEntry; onRemove: () => void }) {
  const isVideo = e.originalFile.type.startsWith('video/');

  return (
    <div className="flex gap-3 bg-gray-950 border border-gray-800 rounded-xl p-3">
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
            <p className="text-xs text-gray-500">{fmtSize(e.originalSize)}</p>
          </div>
          <button type="button" onClick={onRemove} className="text-gray-500 hover:text-red-400 shrink-0">
            <X size={14} />
          </button>
        </div>

        <div className="mt-1.5">
          {e.status !== 'error' ? (
            <UploadProgress
              stage={e.status === 'uploading' ? 'uploading' : 'done'}
              percent={e.progress}
              speed={e.speed}
              remaining={e.remaining}
              originalSize={e.originalSize}
            />
          ) : (
            <span className="text-xs text-red-400 flex items-center gap-1">
              <AlertCircle size={11} />{e.error}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function fmtSize(b: number) {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
