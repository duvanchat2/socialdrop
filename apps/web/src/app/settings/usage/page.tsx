'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

interface UsageRow {
  metric: string;
  period: string;
  count: number;
  limit: number;
}

const METRIC_LABELS: Record<string, string> = {
  competitor_analysis: 'Análisis de competidores',
  script_generation: 'Guiones generados',
  assistant_message: 'Mensajes al asistente',
};

export default function UsagePage() {
  const [usage, setUsage] = useState<UsageRow[] | null>(null);

  useEffect(() => {
    apiFetch<UsageRow[]>('/api/usage').then(setUsage).catch(() => setUsage([]));
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Consumo del mes</h1>

      {!usage ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : (
        <div className="space-y-3">
          {usage.map((row) => {
            const pct = Math.min(100, Math.round((row.count / row.limit) * 100));
            return (
              <div key={row.metric} className="space-y-1">
                <div className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-200">
                  <span>{METRIC_LABELS[row.metric] ?? row.metric}</span>
                  <span className="text-gray-400">{row.count} / {row.limit}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${pct >= 100 ? 'bg-red-500' : 'bg-indigo-600'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
          <p className="text-xs text-gray-400">Periodo: {usage[0]?.period ?? '—'}. Se reinicia el 1° de cada mes.</p>
        </div>
      )}
    </div>
  );
}
