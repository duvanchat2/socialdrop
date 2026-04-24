'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Terminal, RefreshCw, Trash2 } from 'lucide-react';

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
    </div>
  );
}
