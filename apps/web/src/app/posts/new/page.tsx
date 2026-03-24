'use client';
import { useState, useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, API_URL } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Upload, X, Image as ImageIcon, Film, Loader2 } from 'lucide-react';

const PLATFORMS = [
  { id: 'FACEBOOK', label: 'Facebook', color: '#1877F2', maxChars: 63206 },
  { id: 'INSTAGRAM', label: 'Instagram', color: '#E1306C', maxChars: 2200 },
  { id: 'TWITTER', label: 'X / Twitter', color: '#1DA1F2', maxChars: 280 },
  { id: 'TIKTOK', label: 'TikTok', color: '#000', maxChars: 2200 },
  { id: 'YOUTUBE', label: 'YouTube', color: '#FF0000', maxChars: 5000 },
];

interface UploadedFile {
  url: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  mediaType: 'IMAGE' | 'VIDEO';
  preview?: string;
}

export default function NewPostPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [caption, setCaption] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [publishNow, setPublishNow] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);

  const userId = 'demo-user';

  const createPost = useMutation({
    mutationFn: (data: object) =>
      apiFetch(`/api/posts?userId=${userId}`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      toast.success('🎉 Post programado correctamente');
      qc.invalidateQueries({ queryKey: ['posts'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      router.push('/');
    },
    onError: (e: Error) => toast.error(`Error: ${e.message}`),
  });

  const togglePlatform = (id: string) =>
    setSelectedPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id],
    );

  const uploadFile = async (file: File): Promise<UploadedFile | null> => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_URL}/api/media/upload-standalone`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.text().catch(() => res.statusText);
        throw new Error(err);
      }
      const data = await res.json() as UploadedFile;
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
      return { ...data, preview };
    } catch (e: unknown) {
      toast.error(`Error subiendo ${file.name}: ${(e as Error).message}`);
      return null;
    }
  };

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (!arr.length) return;

    setUploadingCount(c => c + arr.length);
    const results = await Promise.all(arr.map(uploadFile));
    setUploadingCount(c => c - arr.length);

    const successful = results.filter((r): r is UploadedFile => r !== null);
    if (successful.length) {
      setUploadedFiles(prev => [...prev, ...successful]);
      toast.success(`${successful.length} archivo(s) subido(s)`);
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
    setUploadedFiles(prev => {
      const copy = [...prev];
      if (copy[idx]?.preview) URL.revokeObjectURL(copy[idx].preview!);
      copy.splice(idx, 1);
      return copy;
    });
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!caption) { toast.error('El caption es requerido'); return; }
    if (!selectedPlatforms.length) { toast.error('Selecciona al menos una plataforma'); return; }

    createPost.mutate({
      content: caption,
      scheduledAt: publishNow ? new Date().toISOString() : new Date(scheduledAt).toISOString(),
      platforms: selectedPlatforms,
      // f.url is already the full public URL returned by the API (includes APP_URL)
      mediaUrls: uploadedFiles.map(f => f.url),
    });
  };

  const twitterChars = 280 - caption.length;
  const isThread = caption.length > 280;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Nuevo Post</h1>

      {/* Ngrok / public URL warning */}
      <div className="bg-amber-950/60 border border-amber-700/60 rounded-xl px-4 py-3 text-sm space-y-1">
        <p className="font-medium text-amber-300">⚠️ Instagram y TikTok requieren una URL pública</p>
        <p className="text-amber-400/80 text-xs">
          Los servidores de Instagram no pueden acceder a <code className="bg-amber-900/40 px-1 rounded">localhost</code>.
          Para publicar en Instagram/TikTok desde local, necesitas exponer la API con <strong>ngrok</strong>:
        </p>
        <ol className="text-amber-400/80 text-xs list-decimal list-inside space-y-0.5 mt-1">
          <li>Instala ngrok: <code className="bg-amber-900/40 px-1 rounded">npm install -g ngrok</code></li>
          <li>Ejecuta: <code className="bg-amber-900/40 px-1 rounded">ngrok http 3333</code></li>
          <li>Copia la URL tipo <code className="bg-amber-900/40 px-1 rounded">https://xxxx.ngrok-free.app</code></li>
          <li>Actualiza <code className="bg-amber-900/40 px-1 rounded">APP_URL=https://xxxx.ngrok-free.app</code> en <code className="bg-amber-900/40 px-1 rounded">.env</code> y reinicia la API</li>
        </ol>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Caption */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Caption</label>
          <textarea
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
            rows={5}
            placeholder="Escribe tu caption aquí..."
            value={caption}
            onChange={e => setCaption(e.target.value)}
          />
          <div className="flex gap-4 mt-1 text-xs text-gray-500">
            {selectedPlatforms.includes('TWITTER') && (
              <span className={twitterChars < 0 ? 'text-red-400' : twitterChars < 50 ? 'text-yellow-400' : ''}>
                Twitter: {twitterChars} restantes {isThread && '(se publicará como hilo)'}
              </span>
            )}
            {selectedPlatforms.includes('INSTAGRAM') && (
              <span>Instagram: {2200 - caption.length} restantes</span>
            )}
          </div>
        </div>

        {/* Media Upload Zone */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Multimedia <span className="text-gray-500">(imágenes y videos)</span>
          </label>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              isDragging
                ? 'border-indigo-400 bg-indigo-950/30'
                : 'border-gray-700 hover:border-gray-500 bg-gray-900'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime"
              className="hidden"
              onChange={e => e.target.files && handleFiles(e.target.files)}
            />
            {uploadingCount > 0 ? (
              <div className="flex flex-col items-center gap-2 text-gray-400">
                <Loader2 className="animate-spin" size={28} />
                <p className="text-sm">Subiendo {uploadingCount} archivo(s)...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-gray-400">
                <Upload size={28} />
                <p className="text-sm">
                  <span className="text-indigo-400 font-medium">Haz clic</span> o arrastra archivos aquí
                </p>
                <p className="text-xs text-gray-600">JPG, PNG, GIF, WebP, MP4 · Máx. 500 MB</p>
              </div>
            )}
          </div>

          {/* Previews */}
          {uploadedFiles.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              {uploadedFiles.map((f, i) => (
                <div key={i} className="relative group rounded-lg overflow-hidden bg-gray-800 aspect-square">
                  {f.mediaType === 'IMAGE' && f.preview ? (
                    <img src={f.preview} alt={f.fileName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-1 text-gray-400">
                      {f.mediaType === 'VIDEO' ? <Film size={24} /> : <ImageIcon size={24} />}
                      <p className="text-xs truncate px-2 text-center w-full">{f.fileName}</p>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="absolute top-1 right-1 bg-black/70 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} className="text-white" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 text-xs text-gray-300 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                    {f.fileName}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Platforms */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Plataformas</label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map(p => (
              <button
                type="button"
                key={p.id}
                onClick={() => togglePlatform(p.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                  selectedPlatforms.includes(p.id)
                    ? 'border-indigo-500 bg-indigo-950 text-white'
                    : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Schedule */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <label className="text-sm font-medium text-gray-300">Publicación</label>
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                className="rounded"
                checked={publishNow}
                onChange={e => setPublishNow(e.target.checked)}
              />
              Publicar ahora
            </label>
          </div>
          {!publishNow && (
            <input
              type="datetime-local"
              className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-gray-100 focus:outline-none focus:border-indigo-500"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
            />
          )}
        </div>

        <button
          type="submit"
          disabled={createPost.isPending || uploadingCount > 0}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl font-medium text-sm transition-colors"
        >
          {createPost.isPending
            ? 'Procesando...'
            : uploadingCount > 0
            ? 'Esperando uploads...'
            : publishNow
            ? 'Publicar ahora'
            : 'Programar post'}
        </button>
      </form>
    </div>
  );
}
