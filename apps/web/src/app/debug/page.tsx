'use client';
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, API_URL } from '@/lib/api';
import { Terminal, RefreshCw, Trash2, Zap } from 'lucide-react';

interface LogEntry {
  timestamp: string;
  level: 'log' | 'warn' | 'error' | 'debug';
  context: string;
  message: string;
  error?: string;
}

const LEVEL_STYLES: Record<LogEntry['level'], string> = {
  log:   'text-green-400  border-green-800  bg-green-950/30',
  warn:  'text-yellow-400 border-yellow-800 bg-yellow-950/30',
  error: 'text-red-400    border-red-800    bg-red-950/30',
  debug: 'text-blue-400   border-blue-800   bg-blue-950/30',
};

const LEVEL_BADGE: Record<LogEntry['level'], string> = {
  log:   '🟢 log',
  warn:  '🟡 warn',
  error: '🔴 error',
  debug: '🔵 debug',
};

export default function DebugPage() {
  const qc = useQueryClient();
  const userId = 'demo-user';
  const [filter, setFilter] = useState<'all' | 'error'>('all');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const { data: logs = [], isFetching, dataUpdatedAt } = useQuery<LogEntry[]>({
    queryKey: ['debug-logs', userId],
    queryFn: () => apiFetch<LogEntry[]>(`/api/debug/logs?userId=${userId}&limit=50`),
    refetchInterval: 5000,
  });

  const clearMutation = useMutation({
    mutationFn: () => apiFetch(`/api/debug/logs?userId=${userId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['debug-logs', userId] }),
  });

  const visible = filter === 'error' ? logs.filter(l => l.level === 'error') : logs;

  const toggleExpand = (i: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal size={20} className="text-indigo-400" />
          <h1 className="text-2xl font-bold">Debug Logs</h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {isFetching && <span className="text-indigo-400 animate-pulse">actualizando…</span>}
          {!isFetching && dataUpdatedAt > 0 && (
            <span>últ. actualización: {new Date(dataUpdatedAt).toLocaleTimeString()}</span>
          )}
        </div>
      </header>

      {/* Controls */}
      <div className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl p-3">
        <div className="flex rounded-lg overflow-hidden border border-gray-700 text-sm">
          {(['all', 'error'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 transition-colors ${
                filter === f
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {f === 'all' ? 'Todos' : '🔴 Solo errores'}
            </button>
          ))}
        </div>

        <button
          onClick={() => qc.invalidateQueries({ queryKey: ['debug-logs', userId] })}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors"
        >
          <RefreshCw size={13} /> Refrescar
        </button>

        <button
          onClick={() => clearMutation.mutate()}
          disabled={clearMutation.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-400 hover:text-white bg-gray-800 hover:bg-red-900/30 rounded-lg border border-red-800 transition-colors disabled:opacity-50 ml-auto"
        >
          <Trash2 size={13} /> Limpiar logs
        </button>

        <span className="text-xs text-gray-500">{visible.length} entradas</span>
      </div>

      {/* Log entries */}
      <div className="space-y-1.5">
        {visible.length === 0 && (
          <div className="py-16 text-center text-gray-500 text-sm bg-gray-900 border border-gray-800 rounded-xl">
            {isFetching ? 'Cargando...' : 'Sin logs todavía — los logs aparecen cuando se publican posts.'}
          </div>
        )}
        {visible.map((entry, i) => (
          <div
            key={i}
            className={`rounded-lg border px-4 py-2.5 font-mono text-xs cursor-pointer select-none ${LEVEL_STYLES[entry.level]}`}
            onClick={() => entry.error && toggleExpand(i)}
          >
            <div className="flex items-start gap-3">
              <span className="shrink-0 text-gray-500">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
              <span className="shrink-0 w-16 font-semibold">{LEVEL_BADGE[entry.level]}</span>
              <span className="shrink-0 text-gray-400 w-28 truncate">[{entry.context}]</span>
              <span className="flex-1 break-all">{entry.message}</span>
              {entry.error && (
                <span className="shrink-0 text-gray-500 text-[10px]">
                  {expanded.has(i) ? '▲' : '▼'} stack
                </span>
              )}
            </div>
            {entry.error && expanded.has(i) && (
              <pre className="mt-2 text-[10px] text-gray-500 overflow-auto max-h-40 whitespace-pre-wrap border-t border-gray-700 pt-2">
                {entry.error}
              </pre>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-600 text-center">
        Auto-refresh cada 5 s · últimas 50 entradas · clave Redis: debug:logs:{userId}
      </p>

      <SpeedTestPanel />
    </div>
  );
}

/* ─── Speed Test ──────────────────────────────────────────────────────────── */
interface SpeedResult {
  sizeMB: number;
  mbps: number;
  seconds: number;
}

function SpeedTestPanel() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<SpeedResult[]>([]);
  const [currentLabel, setCurrentLabel] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const runTest = async () => {
    setRunning(true);
    setResults([]);
    abortRef.current = new AbortController();

    const sizes = [1, 5, 10]; // MB
    const newResults: SpeedResult[] = [];

    for (const sizeMB of sizes) {
      if (abortRef.current.signal.aborted) break;
      setCurrentLabel(`Probando ${sizeMB} MB…`);

      try {
        const bytes = new Uint8Array(sizeMB * 1024 * 1024);
        // Fill with pseudo-random data (non-compressible for accurate test)
        for (let i = 0; i < bytes.length; i += 4) bytes[i] = i & 0xff;
        const blob = new Blob([bytes], { type: 'application/octet-stream' });
        const file = new File([blob], `speedtest-${sizeMB}mb.bin`);
        const form = new FormData();
        form.append('file', file);

        const t0 = performance.now();
        const res = await fetch(`${API_URL}/api/media/speed-test`, {
          method: 'POST',
          body: form,
          signal: abortRef.current.signal,
        });
        const elapsed = (performance.now() - t0) / 1000;

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const mbps = (sizeMB * 8) / elapsed; // Mbps
        newResults.push({ sizeMB, mbps, seconds: elapsed });
        setResults([...newResults]);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          newResults.push({ sizeMB, mbps: 0, seconds: 0 });
          setResults([...newResults]);
        }
      }
    }

    setCurrentLabel('');
    setRunning(false);
  };

  const stop = () => {
    abortRef.current?.abort();
    setRunning(false);
    setCurrentLabel('');
  };

  const avgMbps = results.length
    ? results.filter(r => r.mbps > 0).reduce((s, r) => s + r.mbps, 0) /
      Math.max(1, results.filter(r => r.mbps > 0).length)
    : 0;

  const estimateSeconds = (sizeMB: number) =>
    avgMbps > 0 ? Math.ceil((sizeMB * 8) / avgMbps) : null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={18} className="text-yellow-400" />
          <h2 className="font-semibold">Test de Velocidad de Subida</h2>
        </div>
        <div className="flex gap-2">
          {running ? (
            <button
              onClick={stop}
              className="px-3 py-1.5 text-sm rounded-lg bg-red-900/40 hover:bg-red-900/60 border border-red-800 text-red-300"
            >
              Detener
            </button>
          ) : (
            <button
              onClick={runTest}
              className="px-3 py-1.5 text-sm rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-600/40 text-yellow-300 font-medium"
            >
              Iniciar test
            </button>
          )}
        </div>
      </div>

      {/* Live status */}
      {running && currentLabel && (
        <p className="text-sm text-yellow-400 animate-pulse">{currentLabel}</p>
      )}

      {/* Results table */}
      {results.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 text-xs text-gray-500 px-1">
            <span>Tamaño</span>
            <span>Velocidad</span>
            <span>Tiempo</span>
          </div>
          {results.map((r) => (
            <div key={r.sizeMB} className="grid grid-cols-3 text-sm bg-gray-800 rounded-lg px-3 py-2">
              <span className="text-gray-300">{r.sizeMB} MB</span>
              <span className={r.mbps > 0 ? 'text-green-400 font-medium' : 'text-red-400'}>
                {r.mbps > 0 ? `${r.mbps.toFixed(1)} Mbps` : 'Error'}
              </span>
              <span className="text-gray-400">
                {r.seconds > 0 ? `${r.seconds.toFixed(1)}s` : '—'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Recommendations */}
      {!running && avgMbps > 0 && (
        <div className="bg-gray-800 rounded-lg p-3 space-y-1.5 text-sm">
          <p className="text-gray-300 font-medium">
            Velocidad promedio: <span className="text-green-400">{avgMbps.toFixed(1)} Mbps</span>
          </p>
          <div className="space-y-1 text-xs text-gray-400">
            {[
              { label: 'Video 50 MB', mb: 50 },
              { label: 'Video 100 MB', mb: 100 },
              { label: 'Video 200 MB', mb: 200 },
            ].map(({ label, mb }) => {
              const secs = estimateSeconds(mb);
              return (
                <p key={mb}>
                  {label}: <span className="text-gray-200">~{secs}s</span>
                  {secs != null && secs < 30 && <span className="text-green-400 ml-1">✓ rápido</span>}
                  {secs != null && secs >= 30 && secs < 90 && <span className="text-yellow-400 ml-1">aceptable</span>}
                  {secs != null && secs >= 90 && <span className="text-red-400 ml-1">lento</span>}
                </p>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 pt-1">
            Tu conexión soporta videos de hasta{' '}
            <span className="text-white font-medium">
              {Math.floor((avgMbps / 8) * 30)} MB
            </span>{' '}
            sin demoras mayores a 30 s.
          </p>
        </div>
      )}
    </div>
  );
}
