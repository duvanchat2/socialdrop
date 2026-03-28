'use client';
import { useState, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, API_URL } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Upload, X, Film, Image as ImageIcon, Loader2, ChevronRight,
  Zap, Target, Plus, Minus,
} from 'lucide-react';

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

export interface UploadedFile {
  url: string;
  fileName: string;
  mimeType: string;
  mediaType: 'IMAGE' | 'VIDEO';
  fileSize: number;
  preview?: string;
}

function fmt(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function BulkUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [files, setFiles] = useState<UploadedFile[]>([]);

  // Mode selection
  const [mode, setMode] = useState<'AUTO' | 'STRATEGY' | null>(null);

  // Auto mode config
  const today = new Date().toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(nextWeek);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['INSTAGRAM']);
  const [postsPerDay, setPostsPerDay] = useState<Record<string, number>>({ INSTAGRAM: 1 });
  const [useOptimalTimes, setUseOptimalTimes] = useState(true);
  const [customTimes, setCustomTimes] = useState<Record<string, string[]>>({ INSTAGRAM: ['09:00'] });

  // Strategy mode config
  const [strategyStartDate, setStrategyStartDate] = useState(today);

  const { data: brandProfile } = useQuery({
    queryKey: ['brand-profile'],
    queryFn: () => apiFetch<{ optimalTimes: Record<string, string[]> }>(`/api/brand?userId=${USER_ID}`),
  });

  const { data: strategyData } = useQuery({
    queryKey: ['content-strategy'],
    queryFn: () => apiFetch<{ dayConfigs: { day: string; platforms: string[]; postsPerDay: number; times: string[]; contentType: string }[] }>(`/api/strategy?userId=${USER_ID}`),
  });

  // Upload helpers
  const uploadFile = async (file: File): Promise<UploadedFile | null> => {
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch(`${API_URL}/api/media/upload-standalone`, { method: 'POST', body: form });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as UploadedFile;
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
      return { ...data, preview };
    } catch (e) {
      toast.error(`Error subiendo ${file.name}: ${(e as Error).message}`);
      return null;
    }
  };

  const handleFiles = useCallback(async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    if (!arr.length) return;
    setUploadingCount((c) => c + arr.length);
    const results = await Promise.all(arr.map(uploadFile));
    setUploadingCount((c) => c - arr.length);
    const ok = results.filter((r): r is UploadedFile => r !== null);
    if (ok.length) {
      setFiles((prev) => [...prev, ...ok]);
      toast.success(`${ok.length} archivo(s) subido(s)`);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const removeFile = (idx: number) => {
    setFiles((prev) => {
      const copy = [...prev];
      if (copy[idx]?.preview) URL.revokeObjectURL(copy[idx].preview!);
      copy.splice(idx, 1);
      return copy;
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
    const start = new Date();
    const end = new Date(Date.now() + days * 86400000);
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(end.toISOString().slice(0, 10));
  };

  const totalSlotsAuto = () => {
    if (!startDate || !endDate) return 0;
    const days = Math.max(0, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1);
    return days * selectedPlatforms.reduce((s, p) => s + (postsPerDay[p] ?? 1), 0);
  };

  const strategyWeeklyPosts = strategyData?.dayConfigs.reduce(
    (s, c) => s + c.postsPerDay * c.platforms.length, 0,
  ) ?? 0;

  const handleContinue = () => {
    if (!files.length) { toast.error('Sube al menos un archivo'); return; }
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
        media: files.map(({ url, fileName, mimeType, mediaType }) => ({ url, fileName, mimeType, mediaType })),
        startDate,
        endDate,
        platforms: selectedPlatforms,
        postsPerDay,
        times,
      }));
    } else {
      sessionStorage.setItem('bulk_config', JSON.stringify({
        mode: 'STRATEGY',
        media: files.map(({ url, fileName, mimeType, mediaType }) => ({ url, fileName, mimeType, mediaType })),
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
          {uploadingCount > 0 ? (
            <div className="flex flex-col items-center gap-2 text-gray-400">
              <Loader2 className="animate-spin" size={32} />
              <p>Subiendo {uploadingCount} archivo(s)…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-gray-400">
              <Upload size={32} />
              <p className="text-sm"><span className="text-indigo-400 font-medium">Haz clic</span> o arrastra archivos</p>
              <p className="text-xs text-gray-600">MP4, MOV, JPG, PNG, GIF · Máx 500 MB</p>
            </div>
          )}
        </div>

        {files.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {files.map((f, i) => (
              <div key={i} className="relative group rounded-lg overflow-hidden bg-gray-800 aspect-square">
                {f.mediaType === 'IMAGE' && f.preview
                  ? <img src={f.preview} alt={f.fileName} className="w-full h-full object-cover" />
                  : (
                    <div className="flex flex-col items-center justify-center h-full gap-1 text-gray-400">
                      {f.mediaType === 'VIDEO' ? <Film size={20} /> : <ImageIcon size={20} />}
                      <p className="text-xs text-center px-1 truncate w-full">{f.fileName}</p>
                    </div>
                  )}
                <div className="absolute bottom-0 inset-x-0 bg-black/70 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-xs text-gray-300 truncate">{fmt(f.fileSize)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="absolute top-1 right-1 bg-black/70 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={10} className="text-white" />
                </button>
              </div>
            ))}
          </div>
        )}

        {files.length > 0 && (
          <p className="text-sm text-gray-400">
            {files.length} archivo(s) listo(s) · {files.filter((f) => f.mediaType === 'VIDEO').length} videos, {files.filter((f) => f.mediaType === 'IMAGE').length} imágenes
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
                {/* Date range */}
                <div>
                  <label className="text-xs text-gray-400 mb-2 block">Rango de fechas</label>
                  <div className="flex gap-2 flex-wrap mb-2">
                    {QUICK_RANGES.map((r) => (
                      <button
                        key={r.days}
                        type="button"
                        onClick={() => applyQuickRange(r.days)}
                        className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-gray-300"
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 items-center">
                    <input type="date" value={startDate} min={today}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-indigo-500" />
                    <span className="text-gray-500 text-xs">→</span>
                    <input type="date" value={endDate} min={startDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-indigo-500" />
                  </div>
                </div>

                {/* Platforms + posts per day */}
                <div>
                  <label className="text-xs text-gray-400 mb-2 block">Plataformas y frecuencia</label>
                  <div className="space-y-2">
                    {PLATFORMS.map((p) => (
                      <div key={p.id} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => togglePlatform(p.id)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition-all flex-1 ${
                            selectedPlatforms.includes(p.id)
                              ? 'border-indigo-500 bg-indigo-950/50 text-white'
                              : 'border-gray-700 text-gray-500 hover:border-gray-500'
                          }`}
                        >
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

                {/* Times */}
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
                    → Se generarán <strong>{totalSlotsAuto()}</strong> slots. {files.length < totalSlotsAuto() ? `Los ${files.length} archivos se ciclarán para cubrir todos los slots.` : `Se usarán ${Math.min(files.length, totalSlotsAuto())} de tus ${files.length} archivos.`}
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
          disabled={!files.length || !mode || uploadingCount > 0}
          className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl font-medium transition-colors"
        >
          Continuar <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
