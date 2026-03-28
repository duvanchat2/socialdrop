'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Loader2, Plus, X, Save } from 'lucide-react';
import { toast } from 'sonner';

const USER_ID = 'demo-user';

const DAYS = [
  { key: 'MONDAY', label: 'Lunes' },
  { key: 'TUESDAY', label: 'Martes' },
  { key: 'WEDNESDAY', label: 'Miércoles' },
  { key: 'THURSDAY', label: 'Jueves' },
  { key: 'FRIDAY', label: 'Viernes' },
  { key: 'SATURDAY', label: 'Sábado' },
  { key: 'SUNDAY', label: 'Domingo' },
] as const;

const CONTENT_TYPES = [
  { value: 'VALUE', label: 'Valor' },
  { value: 'LEADS', label: 'Leads' },
  { value: 'SALES', label: 'Ventas' },
  { value: 'ANY', label: 'Cualquiera' },
] as const;

const PLATFORM_OPTIONS = [
  { id: 'INSTAGRAM', label: 'Instagram', color: '#E1306C' },
  { id: 'TIKTOK', label: 'TikTok', color: '#000' },
  { id: 'FACEBOOK', label: 'Facebook', color: '#1877F2' },
  { id: 'YOUTUBE', label: 'YouTube', color: '#FF0000' },
  { id: 'TWITTER', label: 'Twitter', color: '#1DA1F2' },
];

interface DayConfig {
  day: typeof DAYS[number]['key'];
  contentType: 'VALUE' | 'LEADS' | 'SALES' | 'ANY';
  platforms: string[];
  postsPerDay: number;
  times: string[];
}

const DEFAULT_CONFIGS: DayConfig[] = DAYS.map(({ key }) => ({
  day: key,
  contentType: 'ANY',
  platforms: ['INSTAGRAM'],
  postsPerDay: 1,
  times: ['09:00'],
}));

export default function StrategyPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ dayConfigs: DayConfig[] }>({
    queryKey: ['content-strategy'],
    queryFn: () => apiFetch(`/api/strategy?userId=${USER_ID}`),
  });

  const [configs, setConfigs] = useState<DayConfig[]>(DEFAULT_CONFIGS);

  useEffect(() => {
    if (data?.dayConfigs?.length) setConfigs(data.dayConfigs);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => apiFetch(`/api/strategy?userId=${USER_ID}`, {
      method: 'POST',
      body: JSON.stringify({ dayConfigs: configs }),
    }),
    onSuccess: () => {
      toast.success('Estrategia guardada ✓');
      qc.invalidateQueries({ queryKey: ['content-strategy'] });
    },
    onError: (e: Error) => toast.error(`Error: ${e.message}`),
  });

  const updateConfig = (day: string, patch: Partial<DayConfig>) => {
    setConfigs((prev) => prev.map((c) => (c.day === day ? { ...c, ...patch } : c)));
  };

  const togglePlatform = (day: string, platform: string) => {
    const cfg = configs.find((c) => c.day === day)!;
    const newPlatforms = cfg.platforms.includes(platform)
      ? cfg.platforms.filter((p) => p !== platform)
      : [...cfg.platforms, platform];
    if (newPlatforms.length > 0) updateConfig(day, { platforms: newPlatforms });
  };

  const addTime = (day: string) => {
    const cfg = configs.find((c) => c.day === day)!;
    updateConfig(day, { times: [...cfg.times, '09:00'] });
  };

  const updateTime = (day: string, idx: number, value: string) => {
    const cfg = configs.find((c) => c.day === day)!;
    updateConfig(day, { times: cfg.times.map((t, i) => (i === idx ? value : t)) });
  };

  const removeTime = (day: string, idx: number) => {
    const cfg = configs.find((c) => c.day === day)!;
    if (cfg.times.length > 1) updateConfig(day, { times: cfg.times.filter((_, i) => i !== idx) });
  };

  const totalPosts = configs.reduce(
    (sum, c) => sum + c.postsPerDay * c.platforms.length,
    0,
  );

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-gray-400" size={24} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Estrategia de Contenido</h1>
          <p className="text-sm text-gray-400 mt-1">
            Configura cuántos posts publicar por día, en qué plataformas y a qué hora.
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-2 text-center">
          <p className="text-2xl font-bold text-indigo-400">{totalPosts}</p>
          <p className="text-xs text-gray-400">posts/semana</p>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-left border-b border-gray-800">
              <th className="px-4 py-3 font-medium w-24">Día</th>
              <th className="px-4 py-3 font-medium w-32">Tipo</th>
              <th className="px-4 py-3 font-medium">Plataformas</th>
              <th className="px-4 py-3 font-medium w-24">Posts/día</th>
              <th className="px-4 py-3 font-medium">Horarios</th>
            </tr>
          </thead>
          <tbody>
            {configs.map((cfg, i) => {
              const day = DAYS.find((d) => d.key === cfg.day)!;
              return (
                <tr key={cfg.day} className={`border-t border-gray-800 ${i % 2 === 0 ? '' : 'bg-gray-900/50'}`}>
                  {/* Day */}
                  <td className="px-4 py-3 font-medium text-gray-200">{day.label}</td>

                  {/* Content type */}
                  <td className="px-4 py-3">
                    <select
                      value={cfg.contentType}
                      onChange={(e) => updateConfig(cfg.day, { contentType: e.target.value as DayConfig['contentType'] })}
                      className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
                    >
                      {CONTENT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </td>

                  {/* Platforms */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {PLATFORM_OPTIONS.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => togglePlatform(cfg.day, p.id)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all ${
                            cfg.platforms.includes(p.id)
                              ? 'border-indigo-500 bg-indigo-950/60 text-white'
                              : 'border-gray-700 text-gray-500 hover:border-gray-500'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </td>

                  {/* Posts per day */}
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={cfg.postsPerDay}
                      onChange={(e) => updateConfig(cfg.day, { postsPerDay: Math.max(1, Math.min(5, Number(e.target.value))) })}
                      className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-sm text-center text-gray-200 focus:outline-none focus:border-indigo-500"
                    />
                  </td>

                  {/* Time slots */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {cfg.times.map((time, idx) => (
                        <div key={idx} className="flex items-center gap-0.5">
                          <input
                            type="time"
                            value={time}
                            onChange={(e) => updateTime(cfg.day, idx, e.target.value)}
                            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
                          />
                          {cfg.times.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeTime(cfg.day, idx)}
                              className="text-gray-600 hover:text-red-400 p-0.5"
                            >
                              <X size={10} />
                            </button>
                          )}
                        </div>
                      ))}
                      {cfg.times.length < cfg.postsPerDay && (
                        <button
                          type="button"
                          onClick={() => addTime(cfg.day)}
                          className="text-gray-500 hover:text-gray-300 p-1"
                        >
                          <Plus size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl font-medium text-sm transition-colors"
        >
          {saveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Guardar estrategia
        </button>
        <p className="text-sm text-gray-500">
          Total: <span className="text-gray-300 font-medium">{totalPosts} posts por semana</span>
        </p>
      </div>
    </div>
  );
}
