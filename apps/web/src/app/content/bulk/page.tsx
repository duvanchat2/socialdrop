'use client';
import { useState, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Upload, X, Film, Image as ImageIcon, Loader2, ChevronRight,
  Zap, Target, Plus, Minus, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { uploadFileXHR } from '@/lib/uploadMedia';
import { getVideoMeta } from '@/lib/videoThumbnail';
import { compressVideo, compressImage } from '@/lib/compressMedia';

const USER_ID = 'demo-user';

const PLATFORMS = [
  { id: 'INSTAGRAM', label: 'Instagram', color: '#E1306C' },
  { id: 'TIKTOK', label: 'TikTok', color: '#010101' },
  { id: 'FACEBOOK', label: 'Facebook', color: '#1877F2' },
  { id: 'YOUTUBE', label: 'YouTube', color: '#FF0000' },
  { id: 'TWITTER', label: 'Twitter/X', color: '#1DA1F2' },
];

const QUICK_RANGES = [
  { label: 'Próx. semana', days: 7 },
  { label: 'Próx. 2 semanas', days: 14 },
  { label: 'Próx. mes', days: 30 },
];

interface FileEntry {
  id: string;
  originalFile: File;
  thumbnail: string;
  duration?: number;
  originalSize: number;
  compressedSize?: number;
  status: 'compressing' | 'uploading' | 'done' | 'error';
  phase: 'compress' | 'upload';
  progress: number;
  uploadedUrl?: string;
  uploadedFileName?: string;
  uploadedMimeType?: string;
  uploadedMediaType?: 'IMAGE' | 'VIDEO';
  error?: string;
  // YouTube metadata (editable after upload)
  ytTitle: string;
  ytDescription: string;
  ytTags: string;
}

export default function BulkUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [entries, setEntries] = useState<FileEntry[]>([]);

  // Mode selection
  const [mode, setMode] = useState<'AUTO' | 'STRATEGY' | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(nextWeek);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['INSTAGRAM']);
  const [postsPerDay, setPostsPerDay] = useState<Record<string, number>>({ INSTAGRAM: 1 });
  const [useOptimalTimes, setUseOptimalTimes] = useState(true);
  const [customTimes, setCustomTimes] = useState<Record<string, string[]>>({ INSTAGRAM: ['09:00'] });
  const [strategyStartDate, setStrategyStartDate] = useState(today);

  const { data: brandProfile } = useQuery({
    queryKey: ['brand-profile'],
    queryFn: () => apiFetch<{ optimalTimes: Record<string, string[]> }>(`/api/brand?userId=${USER_ID}`),
  });
  const { data: strategyData } = useQuery({
    queryKey: ['content-strategy'],
    queryFn: () => apiFetch<{ dayConfigs: { day: string; platforms: string[]; postsPerDay: number; times: string[]; contentType: string }[] }>(`/api/strategy?userId=${USER_ID}`),
  });

  const updateEntry = useCallback((id: string, patch: Partial<FileEntry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const processFile = useCallback(async (file: File) => {
    const id = Math.random().toString(36).slice(2, 10);
    const isVideo = file.type.startsWith('video/');
    const baseName = file.name.replace(/\.[^.]+$/, '');

    // Add skeleton entry immediately
    const entry: FileEntry = {
      id,
      originalFile: file,
      thumbnail: '',
      originalSize: file.size,
      status: 'compressing',
      phase: 'compress',
      progress: 0,
      ytTitle: baseName,
      ytDescription: '',
      ytTags: '',
    };
    setEntries((prev) => [...prev, entry]);

    // Extract thumbnail & duration client-side
    try {
      if (isVideo) {
        const meta = await getVideoMeta(file);
        updateEntry(id, { thumbnail: meta.thumbnail, duration: meta.duration });
      } else {
        updateEntry(id, { thumbnail: URL.createObjectURL(file) });
      }
    } catch {
      // Non-critical — proceed without thumbnail
    }

    // Compress
    try {
      let compressed: File;
      if (isVideo) {
        compressed = await compressVideo(
          file,
          (pct) => updateEntry(id, { progress: pct }),
          () => updateEntry(id, { status: 'compressing', phase: 'compress', progress: 0 }),
        );
      } else {
        compressed = await compressImage(file);
      }

      updateEntry(id, {
        compressedSize: compressed.size,
        status: 'uploading',
        phase: 'upload',
        progress: 0,
      });

      // Upload with progress
      const result = await uploadFileXHR(compressed, (pct) =>
        updateEntry(id, { progress: pct }),
      );

      updateEntry(id, {
        status: 'done',
        progress: 100,
        uploadedUrl: result.url,
        uploadedFileName: result.fileName,
        uploadedMimeType: result.mimeType,
        uploadedMediaType: result.mediaType,
      });
      toast.success(`${file.name} subido`);
    } catch (err) {
      updateEntry(id, { status: 'error', error: (err as Error).message });
      toast.error(`Error con ${file.name}: ${(err as Error).message}`);
    }
  }, [updateEntry]);

  const handleFiles = useCallback((fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    if (!arr.length) return;
    arr.forEach(processFile);
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const removeEntry = (id: string) => {
    setEntries((prev) => {
      const e = prev.find((x) => x.id === id);
      if (e?.thumbnail && e.thumbnail.startsWith('blob:')) URL.revokeObjectURL(e.thumbnail);
      return prev.filter((x) => x.id !== id);
    });
  };

  const togglePlatform = (id: string) => {
    setSelectedPlatforms((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
      if (!prev.includes(id)) {
        setPostsPerDay((ppd) => ({ ...ppd, [id]: 1 }));
        setCustomTimes((ct) => ({ ...ct, [id]: ['09:00'] }));
      }
      return next;
    });
  };

  const applyQuickRange = (days: number) => {
    setStartDate(new Date().toISOString().slice(0, 10));
    setEndDate(new Date(Date.now() + days * 86400000).toISOString().slice(0, 10));
  };

  const totalSlotsAuto = () => {
    if (!startDate || !endDate) return 0;
    const days = Math.max(0, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1);
    return days * selectedPlatforms.reduce((s, p) => s + (postsPerDay[p] ?? 1), 0);
  };

  const strategyWeeklyPosts = strategyData?.dayConfigs.reduce(
    (s, c) => s + c.postsPerDay * c.platforms.length, 0,
  ) ?? 0;

  const readyEntries = entries.filter((e) => e.status === 'done');
  const pendingCount = entries.filter((e) => e.status === 'compressing' || e.status === 'uploading').length;
  const youtubeSelected = selectedPlatforms.includes('YOUTUBE');

  const handleContinue = () => {
    if (!readyEntries.length) { toast.error('Sube al menos un archivo'); return; }
    if (pendingCount > 0) { toast.error('Espera a que terminen todas las subidas'); return; }
    if (!mode) { toast.error('Selecciona un modo de distribución'); return; }

    if (mode === 'AUTO') {
      if (!selectedPlatforms.length) { toast.error('Selecciona al menos una plataforma'); return; }
      if (!startDate || !endDate) { toast.error('Selecciona el rango de fechas'); return; }

      const times = useOptimalTimes
        ? Object.fromEntries(selectedPlatforms.map((p) => [
          p, (brandProfile?.optimalTimes?.[p.toLowerCase()] ?? ['09:00']),
        ]))
        : customTimes;

      sessionStorage.setItem('bulk_config', JSON.stringify({
        mode: 'AUTO',
        media: readyEntries.map((e) => ({
          url: e.uploadedUrl!,
          fileName: e.uploadedFileName!,
          mimeType: e.uploadedMimeType!,
          mediaType: e.uploadedMediaType!,
          youtubeTitle: e.ytTitle || undefined,
          youtubeDescription: e.ytDescription || undefined,
          youtubeTags: e.ytTags || undefined,
        })),
        startDate,
        endDate,
        platforms: selectedPlatforms,
        postsPerDay,
        times,
      }));
    } else {
      sessionStorage.setItem('bulk_config', JSON.stringify({
        mode: 'STRATEGY',
        media: readyEntries.map((e) => ({
          url: e.uploadedUrl!,
          fileName: e.uploadedFileName!,
          mimeType: e.uploadedMimeType!,
          mediaType: e.uploadedMediaType!,
          youtubeTitle: e.ytTitle || undefined,
          youtubeDescription: e.ytDescription || undefined,
          youtubeTags: e.ytTags || undefined,
        })),
        startDate: strategyStartDate,
      }));
    }

    router.push('/content/bulk/preview');
  };

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Subida Masiva</h1>
        <p className="text-sm text-gray-400 mt-1">Sube tus archivos y elige cómo distribuirlos.</p>
      </div>

      {/* ── Section A: Upload zone ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">1. Sube tus archivos</h2>

        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            isDragging ? 'border-indigo-400 bg-indigo-950/30' : 'border-gray-700 hover:border-gray-500 bg-gray-900'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="video/mp4,video/quicktime,image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          <div className="flex flex-col items-center gap-2 text-gray-400">
            <Upload size={32} />
            <p className="text-sm"><span className="text-indigo-400 font-medium">Haz clic</span> o arrastra archivos</p>
            <p className="text-xs text-gray-600">MP4, MOV, JPG, PNG, GIF · Los videos se comprimirán automáticamente</p>
          </div>
        </div>

        {/* File grid */}
        {entries.length > 0 && (
          <div className="space-y-2">
            {entries.map((e) => (
              <FileCard
                key={e.id}
                entry={e}
                showYouTubeFields={youtubeSelected && e.status === 'done'}
                onRemove={() => removeEntry(e.id)}
                onMetaChange={(patch) => updateEntry(e.id, patch)}
              />
            ))}
          </div>
        )}

        {entries.length > 0 && (
          <p className="text-sm text-gray-400">
            {readyEntries.length} / {entries.length} archivo(s) listos
            {pendingCount > 0 && <span className="text-yellow-400 ml-2">· {pendingCount} procesando…</span>}
          </p>
        )}
      </div>

      {/* ── Section B: Mode selector ── */}
      <div className="space-y-4">
        <h2 className="font-semibold">2. Elige el modo de distribución</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Auto mode card */}
          <div
            onClick={() => setMode('AUTO')}
            className={`rounded-xl border-2 p-5 cursor-pointer transition-all ${
              mode === 'AUTO' ? 'border-indigo-500 bg-indigo-950/20' : 'border-gray-700 bg-gray-900 hover:border-gray-500'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-indigo-900/50 rounded-lg"><Zap size={20} className="text-indigo-400" /></div>
              <div>
                <h3 className="font-semibold">Distribución Automática</h3>
                <p className="text-xs text-gray-400">Define fechas, plataformas y frecuencia</p>
              </div>
            </div>

            {mode === 'AUTO' && (
              <div className="space-y-4 mt-4 border-t border-gray-700 pt-4" onClick={(e) => e.stopPropagation()}>
                <div>
                  <label className="text-xs text-gray-400 mb-2 block">Rango de fechas</label>
                  <div className="flex gap-2 flex-wrap mb-2">
                    {QUICK_RANGES.map((r) => (
                      <button key={r.days} type="button" onClick={() => applyQuickRange(r.days)}
                        className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-gray-300">
                        {r.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 items-center">
                    <input type="date" value={startDate} min={today} onChange={(e) => setStartDate(e.target.value)}
                      className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-indigo-500" />
                    <span className="text-gray-500 text-xs">→</span>
                    <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)}
                      className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-indigo-500" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-2 block">Plataformas y frecuencia</label>
                  <div className="space-y-2">
                    {PLATFORMS.map((p) => (
                      <div key={p.id} className="flex items-center gap-2">
                        <button type="button" onClick={() => togglePlatform(p.id)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition-all flex-1 ${
                            selectedPlatforms.includes(p.id)
                              ? 'border-indigo-500 bg-indigo-950/50 text-white'
                              : 'border-gray-700 text-gray-500 hover:border-gray-500'
                          }`}>
                          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                          {p.label}
                        </button>
                        {selectedPlatforms.includes(p.id) && (
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => setPostsPerDay((ppd) => ({ ...ppd, [p.id]: Math.max(1, (ppd[p.id] ?? 1) - 1) }))} className="p-1 hover:bg-gray-700 rounded"><Minus size={10} /></button>
                            <span className="w-6 text-center text-xs font-medium">{postsPerDay[p.id] ?? 1}</span>
                            <button type="button" onClick={() => setPostsPerDay((ppd) => ({ ...ppd, [p.id]: Math.min(5, (ppd[p.id] ?? 1) + 1) }))} className="p-1 hover:bg-gray-700 rounded"><Plus size={10} /></button>
                            <span className="text-xs text-gray-500">/día</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-2 text-xs text-gray-400 mb-2 cursor-pointer">
                    <input type="checkbox" checked={useOptimalTimes} onChange={(e) => setUseOptimalTimes(e.target.checked)} className="rounded" />
                    Usar horarios óptimos del perfil de marca
                  </label>
                  {!useOptimalTimes && selectedPlatforms.map((pid) => (
                    <div key={pid} className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-400 w-20 capitalize">{pid.toLowerCase()}</span>
                      {(customTimes[pid] ?? ['09:00']).map((t, idx) => (
                        <input key={idx} type="time" value={t}
                          onChange={(e) => setCustomTimes((ct) => ({ ...ct, [pid]: ct[pid].map((v, i) => i === idx ? e.target.value : v) }))}
                          className="bg-gray-800 border border-gray-700 rounded px-1.5 py-1 text-xs text-gray-200 focus:outline-none" />
                      ))}
                    </div>
                  ))}
                </div>
                {totalSlotsAuto() > 0 && (
                  <p className="text-xs text-indigo-400 bg-indigo-950/30 rounded-lg px-3 py-2">
                    → Se generarán <strong>{totalSlotsAuto()}</strong> slots. {readyEntries.length < totalSlotsAuto() ? `Los ${readyEntries.length} archivos se ciclarán para cubrir todos los slots.` : `Se usarán ${Math.min(readyEntries.length, totalSlotsAuto())} de tus ${readyEntries.length} archivos.`}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Strategy mode card */}
          <div
            onClick={() => setMode('STRATEGY')}
            className={`rounded-xl border-2 p-5 cursor-pointer transition-all ${
              mode === 'STRATEGY' ? 'border-indigo-500 bg-indigo-950/20' : 'border-gray-700 bg-gray-900 hover:border-gray-500'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-purple-900/50 rounded-lg"><Target size={20} className="text-purple-400" /></div>
              <div>
                <h3 className="font-semibold">Modo Estrategia</h3>
                <p className="text-xs text-gray-400">Usa tu estrategia configurada</p>
              </div>
            </div>
            {strategyData?.dayConfigs && (
              <div className="space-y-1 mb-3">
                {strategyData.dayConfigs.slice(0, 5).map((c) => (
                  <p key={c.day} className="text-xs text-gray-400">
                    <span className="text-gray-300 font-medium capitalize">{c.day.slice(0, 3).toLowerCase()}</span>
                    {' '}: {c.postsPerDay} post{c.postsPerDay > 1 ? 's' : ''} en {c.platforms.join(', ')} · {c.contentType}
                  </p>
                ))}
                {strategyData.dayConfigs.length > 5 && <p className="text-xs text-gray-500">…y {strategyData.dayConfigs.length - 5} más</p>}
                <p className="text-xs text-indigo-400 mt-2">{strategyWeeklyPosts} posts/semana</p>
              </div>
            )}
            {mode === 'STRATEGY' && (
              <div className="border-t border-gray-700 pt-4 space-y-3" onClick={(e) => e.stopPropagation()}>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Fecha de inicio</label>
                  <input type="date" value={strategyStartDate} min={today}
                    onChange={(e) => setStrategyStartDate(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-indigo-500" />
                </div>
                <p className="text-xs text-gray-500">Se programará 1 semana completa según tu estrategia.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Continue button */}
      <div className="flex justify-end">
        <button
          onClick={handleContinue}
          disabled={!readyEntries.length || !mode || pendingCount > 0}
          className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl font-medium transition-colors"
        >
          Continuar <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

/* ─── FileCard ──────────────────────────────────────────────────────────────── */
interface FileCardProps {
  entry: FileEntry;
  showYouTubeFields: boolean;
  onRemove: () => void;
  onMetaChange: (patch: Partial<FileEntry>) => void;
}

function FileCard({ entry: e, showYouTubeFields, onRemove, onMetaChange }: FileCardProps) {
  const isVideo = e.originalFile.type.startsWith('video/');

  return (
    <div className="flex gap-3 bg-gray-800 rounded-xl p-3 border border-gray-700">
      {/* Thumbnail */}
      <div className="w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-gray-700 relative">
        {e.thumbnail ? (
          <img src={e.thumbnail} alt={e.originalFile.name} className="w-full h-full object-cover" />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            {isVideo ? <Film size={24} /> : <ImageIcon size={24} />}
          </div>
        )}
        {isVideo && e.duration != null && (
          <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1 rounded">
            {Math.floor(e.duration / 60)}:{String(Math.round(e.duration % 60)).padStart(2, '0')}
          </span>
        )}
      </div>

      {/* Info + progress + metadata */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-100 truncate">{e.originalFile.name}</p>
            <p className="text-xs text-gray-500">
              {formatSize(e.originalSize)}
              {e.compressedSize != null && e.compressedSize < e.originalSize && (
                <span className="text-green-400 ml-1">
                  → {formatSize(e.compressedSize)} ({Math.round((1 - e.compressedSize / e.originalSize) * 100)}% menos)
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 text-gray-500 hover:text-red-400 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Status */}
        {e.status === 'compressing' && (
          <ProgressBar
            label={`Comprimiendo video… ${e.progress}%`}
            pct={e.progress}
            color="indigo"
          />
        )}
        {e.status === 'uploading' && (
          <ProgressBar
            label={`Subiendo… ${e.progress}%`}
            pct={e.progress}
            color="blue"
          />
        )}
        {e.status === 'done' && (
          <span className="inline-flex items-center gap-1 text-xs text-green-400">
            <CheckCircle2 size={12} /> Subido
          </span>
        )}
        {e.status === 'error' && (
          <span className="inline-flex items-center gap-1 text-xs text-red-400">
            <AlertCircle size={12} /> {e.error}
          </span>
        )}

        {/* YouTube metadata (shown once done and YouTube is selected) */}
        {showYouTubeFields && (
          <div className="space-y-1.5 pt-1 border-t border-gray-700 mt-2">
            <p className="text-xs font-medium text-red-400">YouTube</p>
            <input
              type="text"
              maxLength={100}
              placeholder="Título (requerido para YouTube)"
              value={e.ytTitle}
              onChange={(ev) => onMetaChange({ ytTitle: ev.target.value })}
              className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-red-500"
            />
            <textarea
              maxLength={5000}
              rows={2}
              placeholder="Descripción (hasta 5000 chars)"
              value={e.ytDescription}
              onChange={(ev) => onMetaChange({ ytDescription: ev.target.value })}
              className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-red-500 resize-none"
            />
            <input
              type="text"
              placeholder="Tags separados por coma: shorts, vlog, tips"
              value={e.ytTags}
              onChange={(ev) => onMetaChange({ ytTags: ev.target.value })}
              className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-red-500"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ProgressBar({ label, pct, color }: { label: string; pct: number; color: 'indigo' | 'blue' }) {
  const bg = color === 'indigo' ? 'bg-indigo-500' : 'bg-blue-500';
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1 text-xs text-gray-400">
        <Loader2 className="animate-spin" size={10} />
        {label}
      </div>
      <div className="w-full bg-gray-700 rounded-full h-1">
        <div className={`${bg} h-1 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
