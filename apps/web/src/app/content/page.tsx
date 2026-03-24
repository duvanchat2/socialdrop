'use client';
import { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, API_URL } from '@/lib/api';
import { toast } from 'sonner';
import {
  Sparkles, Calendar, Copy, Trash2, Loader2, Plus,
  Image as ImageIcon, Film, CheckCircle, X, FolderOpen,
  Upload, ChevronDown, ChevronUp,
} from 'lucide-react';

type ContentType = 'SOCIAL' | 'YT_SHORT' | 'YT_LONG';
type ContentStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ERROR';

interface ContentItem {
  id: string;
  type: ContentType;
  tema: string;
  caption?: string;
  hashtags: string[];
  title?: string;
  tags: string[];
  thumbnailUrl?: string;
  mediaDriveId?: string;
  mediaUrl?: string;
  platforms: string[];
  scheduledAt?: string;
  status: ContentStatus;
  copyGenerated: boolean;
  n8nJobId?: string;
  createdAt: string;
}

const TYPE_LABELS: Record<ContentType, string> = {
  SOCIAL: 'TikTok + IG',
  YT_SHORT: 'YT Short',
  YT_LONG: 'YT Largo',
};

const STATUS_COLORS: Record<ContentStatus, string> = {
  DRAFT: 'bg-gray-700 text-gray-300',
  SCHEDULED: 'bg-blue-900 text-blue-300',
  PUBLISHED: 'bg-green-900 text-green-300',
  ERROR: 'bg-red-900 text-red-300',
};

const PLATFORMS_BY_TYPE: Record<ContentType, { id: string; label: string }[]> = {
  SOCIAL: [
    { id: 'INSTAGRAM', label: 'Instagram' },
    { id: 'TIKTOK', label: 'TikTok' },
    { id: 'FACEBOOK', label: 'Facebook' },
  ],
  YT_SHORT: [
    { id: 'YOUTUBE', label: 'YouTube' },
    { id: 'INSTAGRAM', label: 'Instagram Reels' },
    { id: 'TIKTOK', label: 'TikTok' },
  ],
  YT_LONG: [
    { id: 'YOUTUBE', label: 'YouTube' },
  ],
};

interface UploadedFile {
  url: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  mediaType: 'IMAGE' | 'VIDEO';
  preview?: string;
}

interface DebugEntry {
  ts: string;
  method: string;
  url: string;
  body?: string;
  status?: number;
  response?: string;
}

function InlineEdit({
  value, onSave, placeholder, multiline,
}: {
  value: string; onSave: (v: string) => void; placeholder?: string; multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  const commit = () => {
    setEditing(false);
    if (draft !== value) onSave(draft);
  };

  if (editing) {
    const cls = 'w-full bg-gray-800 border border-indigo-500 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none';
    return multiline ? (
      <textarea autoFocus className={cls} rows={3} value={draft}
        onChange={e => setDraft(e.target.value)} onBlur={commit} />
    ) : (
      <input autoFocus className={cls} value={draft}
        onChange={e => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={e => e.key === 'Enter' && commit()} />
    );
  }

  return (
    <div
      onClick={() => { setDraft(value ?? ''); setEditing(true); }}
      className="cursor-text text-sm text-gray-200 hover:bg-gray-800 rounded px-1 py-0.5 min-h-[24px] truncate max-w-xs"
      title={value || placeholder}
    >
      {value || <span className="text-gray-500 italic">{placeholder ?? 'Click para editar'}</span>}
    </div>
  );
}

export default function ContentPage() {
  const qc = useQueryClient();
  const userId = 'demo-user';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeType, setActiveType] = useState<ContentType | 'ALL'>('ALL');
  const [activeStatus, setActiveStatus] = useState<ContentStatus | 'ALL'>('ALL');
  const [showNewModal, setShowNewModal] = useState(false);
  const [pollingIds, setPollingIds] = useState<Set<string>>(new Set());
  const [debugLog, setDebugLog] = useState<DebugEntry[]>([]);
  const [showDebug, setShowDebug] = useState(false);

  // New modal state
  const [newType, setNewType] = useState<ContentType>('SOCIAL');
  const [newTema, setNewTema] = useState('');
  const [newCaption, setNewCaption] = useState('');
  const [newHashtags, setNewHashtags] = useState('');
  const [newScheduledAt, setNewScheduledAt] = useState('');
  const [newPlatforms, setNewPlatforms] = useState<string[]>([]);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  const logDebug = useCallback((entry: DebugEntry) => {
    setDebugLog(prev => [entry, ...prev].slice(0, 20));
  }, []);

  const trackedFetch = useCallback(async (url: string, opts: RequestInit = {}) => {
    const method = (opts.method ?? 'GET').toUpperCase();
    const entry: DebugEntry = { ts: new Date().toLocaleTimeString(), method, url, body: opts.body as string };
    try {
      const res = await fetch(url, opts);
      const text = await res.text();
      entry.status = res.status;
      entry.response = text.slice(0, 500);
      logDebug(entry);
      if (!res.ok) throw new Error(text || res.statusText);
      return JSON.parse(text);
    } catch (err: any) {
      if (!entry.status) { entry.status = 0; entry.response = err.message; }
      logDebug(entry);
      throw err;
    }
  }, [logDebug]);

  const contentQuery = useQuery({
    queryKey: ['content', activeType, activeStatus],
    queryFn: () => apiFetch<ContentItem[]>(
      `/api/content?userId=${userId}${activeType !== 'ALL' ? `&type=${activeType}` : ''}${activeStatus !== 'ALL' ? `&status=${activeStatus}` : ''}`
    ),
    refetchInterval: pollingIds.size > 0 ? 3000 : false,
  });

  const createMutation = useMutation({
    mutationFn: (dto: object) => trackedFetch(`${API_URL}/api/content?userId=${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    }),
    onSuccess: () => {
      toast.success('Fila creada');
      qc.invalidateQueries({ queryKey: ['content'] });
      closeModal();
    },
    onError: (e: Error) => toast.error(`Error: ${e.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) =>
      apiFetch(`/api/content/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => {
      toast.success('Guardado ✓', { duration: 1500 });
      qc.invalidateQueries({ queryKey: ['content'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => trackedFetch(`${API_URL}/api/content/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Eliminado');
      qc.invalidateQueries({ queryKey: ['content'] });
    },
    onError: (e: Error) => toast.error(`Error: ${e.message}`),
  });

  const duplicateMutation = useMutation({
    mutationFn: (item: ContentItem) => apiFetch(`/api/content?userId=${userId}`, {
      method: 'POST',
      body: JSON.stringify({
        type: item.type, tema: `${item.tema} (copia)`,
        caption: item.caption, hashtags: item.hashtags,
        title: item.title, tags: item.tags,
        platforms: item.platforms,
      }),
    }),
    onSuccess: () => { toast.success('Duplicado'); qc.invalidateQueries({ queryKey: ['content'] }); },
  });

  const scheduleAllMutation = useMutation({
    mutationFn: () => apiFetch(`/api/content/schedule-all?userId=${userId}`, { method: 'POST' }),
    onSuccess: (data: any) => {
      toast.success(`${data.scheduled} item(s) programados`);
      qc.invalidateQueries({ queryKey: ['content'] });
    },
  });

  const generateMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/content/${id}/generate`, { method: 'POST' }),
    onSuccess: (_, id) => {
      toast.success('Generando copy con IA...');
      setPollingIds(prev => new Set([...prev, id]));
    },
  });

  // Schedule single item
  const scheduleMutation = useMutation({
    mutationFn: ({ id, scheduledAt }: { id: string; scheduledAt?: string }) =>
      trackedFetch(`${API_URL}/api/content/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'SCHEDULED', ...(scheduledAt && { scheduledAt }) }),
      }),
    onSuccess: () => { toast.success('Programado ✓'); qc.invalidateQueries({ queryKey: ['content'] }); },
    onError: (e: Error) => toast.error(`Error: ${e.message}`),
  });

  const items = contentQuery.data ?? [];
  items.forEach(item => {
    if (item.copyGenerated && pollingIds.has(item.id)) {
      setPollingIds(prev => { const next = new Set(prev); next.delete(item.id); return next; });
      toast.success(`Copy generado para: ${item.tema}`);
    }
  });

  const save = useCallback((id: string, data: object) => {
    updateMutation.mutate({ id, data });
  }, [updateMutation]);

  // File upload helpers
  const uploadFile = async (file: File): Promise<UploadedFile | null> => {
    const formData = new FormData();
    formData.append('file', file);
    setUploadingFile(true);
    try {
      const res = await fetch(`${API_URL}/api/media/upload-standalone`, { method: 'POST', body: formData });
      const text = await res.text();
      logDebug({ ts: new Date().toLocaleTimeString(), method: 'POST', url: '/api/media/upload-standalone', status: res.status, response: text.slice(0, 500) });
      if (!res.ok) throw new Error(text || res.statusText);
      const data = JSON.parse(text) as UploadedFile;
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
      return { ...data, preview };
    } catch (e: unknown) {
      toast.error(`Error subiendo ${file.name}: ${(e as Error).message}`);
      return null;
    } finally {
      setUploadingFile(false);
    }
  };

  const handleFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) { const result = await uploadFile(file); if (result) setUploadedFile(result); }
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { const result = await uploadFile(file); if (result) setUploadedFile(result); }
  }, []);

  const toggleNewPlatform = (id: string) => {
    setNewPlatforms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  // When type changes, reset platforms selection
  const handleTypeChange = (t: ContentType) => {
    setNewType(t);
    setNewPlatforms([]);
  };

  const closeModal = () => {
    setShowNewModal(false);
    setNewTema('');
    setNewCaption('');
    setNewHashtags('');
    setNewScheduledAt('');
    setNewPlatforms([]);
    setUploadedFile(null);
  };

  const handleCreate = () => {
    if (!newTema.trim()) { toast.error('El tema es requerido'); return; }
    const dto: Record<string, unknown> = {
      type: newType,
      tema: newTema,
      ...(newCaption && { caption: newCaption }),
      ...(newHashtags && { hashtags: newHashtags.split(',').map(h => h.trim()).filter(Boolean) }),
      ...(newPlatforms.length && { platforms: newPlatforms }),
      ...(newScheduledAt && { scheduledAt: new Date(newScheduledAt).toISOString() }),
      // uploadedFile.url is already full public URL returned by the API (includes APP_URL)
      ...(uploadedFile && { mediaUrl: uploadedFile.url, thumbnailUrl: uploadedFile.url }),
    };
    createMutation.mutate(dto);
  };

  const TABS: Array<ContentType | 'ALL'> = ['ALL', 'SOCIAL', 'YT_SHORT', 'YT_LONG'];
  const STATUSES: Array<ContentStatus | 'ALL'> = ['ALL', 'DRAFT', 'SCHEDULED', 'PUBLISHED'];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Contenido</h1>
        <div className="flex gap-2">
          <button
            onClick={() => scheduleAllMutation.mutate()}
            disabled={scheduleAllMutation.isPending}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm"
          >
            {scheduleAllMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />}
            Programar todo
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium"
          >
            <Plus size={14} /> Nueva fila
          </button>
        </div>
      </div>

      {/* Type Tabs */}
      <div className="flex gap-1 bg-gray-900 p-1 rounded-lg w-fit">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveType(tab)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeType === tab ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab === 'ALL' ? 'Todos' : TYPE_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Status Filter */}
      <div className="flex gap-2">
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setActiveStatus(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              activeStatus === s
                ? 'border-indigo-500 bg-indigo-950 text-indigo-300'
                : 'border-gray-700 text-gray-400 hover:border-gray-500'
            }`}
          >
            {s === 'ALL' ? 'Todos' : s === 'DRAFT' ? 'Borradores' : s === 'SCHEDULED' ? 'Programados' : 'Publicados'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
        {contentQuery.isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="animate-spin text-gray-400" size={24} /></div>
        ) : contentQuery.isError ? (
          <div className="text-center p-12 text-red-400">
            <p className="mb-1">Error al cargar contenido</p>
            <p className="text-xs text-gray-500">{(contentQuery.error as Error)?.message}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center p-12 text-gray-500">
            <p className="mb-3">No hay contenido todavía</p>
            <button onClick={() => setShowNewModal(true)} className="text-indigo-400 hover:text-indigo-300 text-sm">
              + Crear primera fila
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-left border-b border-gray-800">
                <th className="px-3 py-3 font-medium w-14">Media</th>
                <th className="px-3 py-3 font-medium">Tipo</th>
                <th className="px-3 py-3 font-medium">Tema</th>
                <th className="px-3 py-3 font-medium hidden lg:table-cell">Caption</th>
                <th className="px-3 py-3 font-medium hidden md:table-cell">Plataformas</th>
                <th className="px-3 py-3 font-medium hidden md:table-cell">Fecha</th>
                <th className="px-3 py-3 font-medium">Estado</th>
                <th className="px-3 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className="border-t border-gray-800 hover:bg-gray-800/30">
                  {/* Thumbnail */}
                  <td className="px-3 py-2">
                    <div className="w-12 h-12 rounded-lg bg-gray-800 flex items-center justify-center overflow-hidden">
                      {item.mediaUrl ? (
                        item.mediaUrl.match(/\.(mp4|mov|webm|avi)$/i)
                          ? <Film size={20} className="text-blue-400" />
                          : <img src={item.mediaUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <FolderOpen size={16} className="text-gray-600" />
                      )}
                    </div>
                  </td>

                  {/* Type */}
                  <td className="px-3 py-2">
                    <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full whitespace-nowrap">
                      {TYPE_LABELS[item.type]}
                    </span>
                  </td>

                  {/* Tema */}
                  <td className="px-3 py-2 max-w-[160px]">
                    <InlineEdit value={item.tema} onSave={v => save(item.id, { tema: v })} placeholder="Tema" />
                  </td>

                  {/* Caption */}
                  <td className="px-3 py-2 max-w-[200px] hidden lg:table-cell">
                    <InlineEdit value={item.caption ?? ''} onSave={v => save(item.id, { caption: v })} placeholder="Caption..." multiline />
                  </td>

                  {/* Platforms */}
                  <td className="px-3 py-2 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {(item.platforms ?? []).map(p => (
                        <span key={p} className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">{p}</span>
                      ))}
                    </div>
                  </td>

                  {/* Date */}
                  <td className="px-3 py-2 hidden md:table-cell text-gray-400 text-xs whitespace-nowrap">
                    <input
                      type="datetime-local"
                      defaultValue={item.scheduledAt ? new Date(item.scheduledAt).toISOString().slice(0, 16) : ''}
                      className="bg-transparent text-xs text-gray-400 border-none focus:outline-none focus:text-gray-200 w-36"
                      onChange={e => save(item.id, { scheduledAt: new Date(e.target.value).toISOString() })}
                    />
                  </td>

                  {/* Status */}
                  <td className="px-3 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[item.status]}`}>
                      {item.status}
                      {item.copyGenerated && <CheckCircle size={10} className="inline ml-1" />}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1 justify-end">
                      {/* Generate copy */}
                      <button
                        onClick={() => generateMutation.mutate(item.id)}
                        disabled={pollingIds.has(item.id)}
                        title="Generar copy con IA"
                        className="p-1.5 rounded-lg hover:bg-indigo-900 text-indigo-400 transition-colors disabled:opacity-50"
                      >
                        {pollingIds.has(item.id) ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      </button>

                      {/* Schedule */}
                      <button
                        onClick={() => scheduleMutation.mutate({ id: item.id, scheduledAt: item.scheduledAt })}
                        title="Programar"
                        className="p-1.5 rounded-lg hover:bg-blue-900 text-blue-400 transition-colors"
                      >
                        <Calendar size={14} />
                      </button>

                      {/* Duplicate */}
                      <button
                        onClick={() => duplicateMutation.mutate(item)}
                        title="Duplicar"
                        className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 transition-colors"
                      >
                        <Copy size={14} />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => deleteMutation.mutate(item.id)}
                        title="Eliminar"
                        className="p-1.5 rounded-lg hover:bg-red-900 text-red-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Debug Panel ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowDebug(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          <span className="font-medium">🐛 Debug Panel — últimas llamadas API</span>
          {showDebug ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {showDebug && (
          <div className="px-4 pb-4 space-y-2 max-h-80 overflow-y-auto">
            {debugLog.length === 0 ? (
              <p className="text-xs text-gray-600 italic">Sin llamadas aún. Crea o elimina contenido para ver los logs.</p>
            ) : (
              debugLog.map((entry, i) => (
                <div key={i} className="bg-gray-800 rounded-lg p-3 text-xs font-mono space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">{entry.ts}</span>
                    <span className={`font-bold ${entry.method === 'GET' ? 'text-green-400' : entry.method === 'DELETE' ? 'text-red-400' : 'text-blue-400'}`}>
                      {entry.method}
                    </span>
                    <span className="text-gray-300 truncate">{entry.url}</span>
                    {entry.status != null && (
                      <span className={`ml-auto px-1.5 py-0.5 rounded font-bold ${entry.status >= 200 && entry.status < 300 ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                        {entry.status}
                      </span>
                    )}
                  </div>
                  {entry.body && (
                    <div className="text-gray-500 truncate">→ {entry.body.slice(0, 200)}</div>
                  )}
                  {entry.response && (
                    <div className="text-gray-400 truncate">← {entry.response.slice(0, 300)}</div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── New Content Modal ── */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Nueva fila de contenido</h2>
              <button onClick={closeModal}><X size={20} className="text-gray-400 hover:text-gray-200" /></button>
            </div>

            <div className="p-6 space-y-5">
              {/* Type selector */}
              <div>
                <label className="text-sm text-gray-300 mb-2 block font-medium">Tipo de contenido</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['SOCIAL', 'YT_SHORT', 'YT_LONG'] as ContentType[]).map(t => (
                    <button
                      key={t}
                      onClick={() => handleTypeChange(t)}
                      className={`py-2 rounded-lg text-sm font-medium border transition-all ${
                        newType === t ? 'border-indigo-500 bg-indigo-950 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      {TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tema */}
              <div>
                <label className="text-sm text-gray-300 mb-1 block font-medium">Tema / Título *</label>
                <input
                  type="text"
                  placeholder="ej. beneficios del café colombiano"
                  value={newTema}
                  onChange={e => setNewTema(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                />
              </div>

              {/* Caption */}
              <div>
                <label className="text-sm text-gray-300 mb-1 block font-medium">Caption</label>
                <textarea
                  rows={3}
                  placeholder="Descripción del contenido..."
                  value={newCaption}
                  onChange={e => setNewCaption(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Hashtags */}
              <div>
                <label className="text-sm text-gray-300 mb-1 block font-medium">Hashtags <span className="text-gray-500">(separados por coma)</span></label>
                <input
                  type="text"
                  placeholder="#cafe, #colombia, #lifestyle"
                  value={newHashtags}
                  onChange={e => setNewHashtags(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* File upload */}
              <div>
                <label className="text-sm text-gray-300 mb-2 block font-medium">Archivo de media</label>
                {uploadedFile ? (
                  <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg border border-gray-700">
                    <div className="w-10 h-10 rounded bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {uploadedFile.mediaType === 'VIDEO'
                        ? <Film size={18} className="text-blue-400" />
                        : uploadedFile.preview
                          ? <img src={uploadedFile.preview} alt="" className="w-full h-full object-cover" />
                          : <ImageIcon size={18} className="text-gray-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200 truncate">{uploadedFile.fileName}</p>
                      <p className="text-xs text-gray-500">{uploadedFile.mediaType} · {(uploadedFile.fileSize / 1024 / 1024).toFixed(1)} MB</p>
                    </div>
                    <button onClick={() => setUploadedFile(null)} className="p-1 hover:bg-gray-700 rounded">
                      <X size={14} className="text-gray-400" />
                    </button>
                  </div>
                ) : (
                  <div
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
                      isDragging ? 'border-indigo-400 bg-indigo-950/30' : 'border-gray-700 hover:border-gray-500 bg-gray-800/50'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/avi,video/x-msvideo"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    {uploadingFile ? (
                      <div className="flex flex-col items-center gap-2 text-gray-400">
                        <Loader2 className="animate-spin" size={22} />
                        <p className="text-xs">Subiendo archivo...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-gray-400">
                        <Upload size={22} />
                        <p className="text-xs"><span className="text-indigo-400">Haz clic</span> o arrastra aquí</p>
                        <p className="text-xs text-gray-600">JPG, PNG, WebP, MP4, MOV, AVI · Máx. 500 MB</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Platforms */}
              <div>
                <label className="text-sm text-gray-300 mb-2 block font-medium">Plataformas</label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS_BY_TYPE[newType].map(p => (
                    <button
                      key={p.id}
                      onClick={() => toggleNewPlatform(p.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                        newPlatforms.includes(p.id)
                          ? 'border-indigo-500 bg-indigo-950 text-white'
                          : 'border-gray-700 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date/time */}
              <div>
                <label className="text-sm text-gray-300 mb-1 block font-medium">Fecha / Hora programada</label>
                <input
                  type="datetime-local"
                  value={newScheduledAt}
                  onChange={e => setNewScheduledAt(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-gray-900 border-t border-gray-800 px-6 py-4 flex gap-2 justify-end">
              <button onClick={closeModal} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200">
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={newTema.trim() === '' || createMutation.isPending || uploadingFile}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-sm font-medium"
              >
                {createMutation.isPending ? 'Creando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
