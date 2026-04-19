'use client';
import { useMemo, useState, useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { uploadFile, UploadedFile } from '@/lib/uploadMedia';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Upload, X, Film, Image as ImageIcon, Loader2, Edit3, Users as UsersIcon,
  CalendarClock, Send, FileText, ListOrdered,
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

const PLATFORM_ORDER = ['INSTAGRAM', 'TIKTOK', 'FACEBOOK', 'TWITTER', 'LINKEDIN', 'YOUTUBE'];

export default function NewPostPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [caption, setCaption] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);

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

  // --- Upload handling ---
  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (!arr.length) return;
    setUploadingCount((c) => c + arr.length);
    try {
      const results = await Promise.allSettled(arr.map(uploadFile));
      const ok: UploadedFile[] = [];
      for (const r of results) {
        if (r.status === 'fulfilled') ok.push(r.value);
        else toast.error(`Error subiendo archivo: ${(r.reason as Error).message}`);
      }
      if (ok.length) {
        setUploadedFiles((prev) => [...prev, ...ok]);
        toast.success(`${ok.length} archivo(s) subido(s)`);
      }
    } finally {
      setUploadingCount((c) => c - arr.length);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const removeFile = (idx: number) => {
    setUploadedFiles((prev) => {
      const copy = [...prev];
      if (copy[idx]?.preview) URL.revokeObjectURL(copy[idx].preview!);
      copy.splice(idx, 1);
      return copy;
    });
  };

  // --- Mutations ---
  const createPost = useMutation({
    mutationFn: (data: object) =>
      apiFetch(`/api/posts?userId=${userId}`, { method: 'POST', body: JSON.stringify(data) }),
  });

  const assignToQueue = useMutation({
    mutationFn: (postId: string) =>
      apiFetch(`/api/queue/assign`, {
        method: 'POST',
        body: JSON.stringify({ postId }),
      }),
  });

  const buildBasePayload = () => ({
    content: caption,
    platforms: selectedPlatforms,
    mediaUrls: uploadedFiles.map((f) => f.url),
  });

  const commonGuards = (): boolean => {
    if (!caption) { toast.error('Escribe el contenido del post'); return false; }
    if (!selectedPlatforms.length) { toast.error('Selecciona al menos una cuenta'); return false; }
    if (overLimit) { toast.error(`El contenido excede ${maxChars} caracteres`); return false; }
    return true;
  };

  const handlePublishNow = async () => {
    if (!commonGuards()) return;
    try {
      await createPost.mutateAsync({
        ...buildBasePayload(),
        scheduledAt: new Date().toISOString(),
      });
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
      toast.success(
        `Añadido a la cola (día ${slot.dayOfWeek} - ${String(slot.hour).padStart(2, '0')}:${String(slot.minute).padStart(2, '0')})`,
      );
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
      await createPost.mutateAsync({
        ...buildBasePayload(),
        scheduledAt: new Date().toISOString(),
        status: 'DRAFT',
      });
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
      await createPost.mutateAsync({
        ...buildBasePayload(),
        scheduledAt: new Date(scheduledAt).toISOString(),
      });
      toast.success('Post programado');
      qc.invalidateQueries({ queryKey: ['posts-all'] });
      router.push('/calendar');
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
    }
  };

  const busy = createPost.isPending || assignToQueue.isPending || uploadingCount > 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Create Post</h1>
        <p className="text-sm text-gray-400">Compose and schedule your content.</p>
      </header>

      {/* Card 1 — Content */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <Edit3 size={16} className="text-indigo-400" />
          <h2 className="font-semibold">Content</h2>
        </div>
        <p className="text-xs text-gray-500 mb-3">Write your post content and add media.</p>

        <div className="relative">
          <textarea
            data-testid="caption-input"
            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
            rows={4}
            placeholder="What's on your mind?"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
          <span
            className={`absolute bottom-2 right-3 text-xs ${overLimit ? 'text-red-400' : 'text-gray-500'}`}
          >
            {caption.length} / {maxChars}
          </span>
        </div>

        {/* Media section */}
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <ImageIcon size={15} className="text-indigo-400" />
            <span className="text-sm font-medium">Media</span>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${
              isDragging
                ? 'border-indigo-400 bg-indigo-950/30'
                : 'border-gray-800 hover:border-gray-600 bg-gray-950'
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
            {uploadingCount > 0 ? (
              <div className="flex flex-col items-center gap-2 text-gray-400">
                <Loader2 className="animate-spin" size={24} />
                <p className="text-sm">Subiendo {uploadingCount} archivo(s)…</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1 text-gray-400">
                <Upload size={22} />
                <p className="text-sm">Drop files here or click to upload</p>
                <p className="text-xs text-gray-600">
                  Images (JPG, PNG, GIF, WebP) or Videos (MP4, MOV, WebM)
                </p>
              </div>
            )}
          </div>

          {uploadedFiles.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mt-3">
              {uploadedFiles.map((f, i) => (
                <div
                  key={`${f.url}-${i}`}
                  className="relative group rounded-lg overflow-hidden bg-gray-800 aspect-square"
                >
                  {f.mediaType === 'IMAGE' && f.preview ? (
                    <img src={f.preview} alt={f.fileName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-1 text-gray-400 p-1">
                      {f.mediaType === 'VIDEO' ? <Film size={22} /> : <ImageIcon size={22} />}
                      <p className="text-[10px] truncate w-full text-center">{f.fileName}</p>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="absolute top-1 right-1 bg-black/70 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} className="text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Card 2 — Select Accounts */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <UsersIcon size={16} className="text-indigo-400" />
          <h2 className="font-semibold">Select Accounts</h2>
        </div>
        <p className="text-xs text-gray-500 mb-3">Choose which accounts to publish to.</p>

        {groupedByPlatform.length === 0 && (
          <p className="text-sm text-gray-500 py-6 text-center">
            No hay cuentas conectadas.{' '}
            <a href="/integrations" className="text-indigo-400 hover:underline">
              Conecta una aquí.
            </a>
          </p>
        )}

        <div className="space-y-4">
          {groupedByPlatform.map(({ platform, accounts }) => (
            <div key={platform}>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: PLATFORM_COLORS[platform] }}
                />
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
                        selected
                          ? 'border-indigo-500 bg-indigo-950/40'
                          : 'border-gray-800 bg-gray-950 hover:border-gray-700'
                      }`}
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
                        style={{ background: PLATFORM_COLORS[platform] }}
                      >
                        {(acc.accountName ?? acc.profileId ?? '?').slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-100 truncate">
                          {acc.accountName ?? acc.profileId ?? 'Sin nombre'}
                        </p>
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
