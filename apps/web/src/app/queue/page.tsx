'use client';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { ListOrdered } from 'lucide-react';

const PLATFORMS = [
  { id: 'INSTAGRAM', label: 'Instagram', color: '#E1306C' },
  { id: 'TIKTOK', label: 'TikTok', color: '#000000' },
  { id: 'FACEBOOK', label: 'Facebook', color: '#4F46E5' },
  { id: 'TWITTER', label: 'Twitter / X', color: '#1DA1F2' },
  { id: 'LINKEDIN', label: 'LinkedIn', color: '#0EA5E9' },
  { id: 'YOUTUBE', label: 'YouTube', color: '#FF0000' },
];

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface QueueSlot {
  id: string;
  userId: string;
  platform: string;
  dayOfWeek: number;
  hour: number;
  minute: number;
  isActive: boolean;
}

export default function QueuePage() {
  const qc = useQueryClient();
  const userId = 'demo-user';
  const [activePlatform, setActivePlatform] = useState(PLATFORMS[0].id);

  const activeMeta = PLATFORMS.find((p) => p.id === activePlatform)!;

  const { data: slots = [], isLoading } = useQuery({
    queryKey: ['queue-slots', userId, activePlatform],
    queryFn: () =>
      apiFetch<QueueSlot[]>(`/api/queue?userId=${userId}&platform=${activePlatform}`),
  });

  const createSlot = useMutation({
    mutationFn: (slot: Omit<QueueSlot, 'id' | 'isActive'> & { isActive?: boolean }) =>
      apiFetch('/api/queue', { method: 'POST', body: JSON.stringify(slot) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queue-slots'] });
    },
    onError: (e: Error) => toast.error(`Error: ${e.message}`),
  });

  const deleteSlot = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/queue/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queue-slots'] });
    },
    onError: (e: Error) => toast.error(`Error: ${e.message}`),
  });

  // Fast lookup: `${dayOfWeek}-${hour}` -> slot.id (only counts :00 slots in the grid)
  const slotMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of slots) {
      if (s.minute === 0) map.set(`${s.dayOfWeek}-${s.hour}`, s.id);
    }
    return map;
  }, [slots]);

  const toggleCell = (dayOfWeek: number, hour: number) => {
    const existingId = slotMap.get(`${dayOfWeek}-${hour}`);
    if (existingId) {
      deleteSlot.mutate(existingId);
    } else {
      createSlot.mutate({
        userId,
        platform: activePlatform,
        dayOfWeek,
        hour,
        minute: 0,
      });
    }
  };

  const totalActive = slots.filter((s) => s.isActive).length;

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <header>
        <div className="flex items-center gap-2">
          <ListOrdered size={20} className="text-indigo-400" />
          <h1 className="text-2xl font-bold">Cola de publicación</h1>
        </div>
        <p className="text-sm text-gray-400">
          Define horarios recurrentes por plataforma. Los posts añadidos desde <em>Nuevo Post</em>
          se programan automáticamente en el próximo hueco libre.
        </p>
      </header>

      {/* Platform tabs */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex flex-wrap items-center gap-2">
        {PLATFORMS.map((p) => (
          <button
            key={p.id}
            onClick={() => setActivePlatform(p.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors border ${
              activePlatform === p.id
                ? 'border-indigo-500 bg-indigo-950/40 text-white'
                : 'border-gray-800 bg-gray-950 text-gray-400 hover:border-gray-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            {p.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-500">
          {totalActive} horario(s) activos en <strong>{activeMeta.label}</strong>
        </span>
      </div>

      {/* Grid */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 overflow-auto">
        <p className="text-xs text-gray-500 mb-2">
          Haz clic en una celda para <span className="text-indigo-400">añadir</span> o{' '}
          <span className="text-red-400">quitar</span> un horario.
        </p>

        {isLoading ? (
          <div className="py-10 text-center text-gray-500 text-sm">Cargando…</div>
        ) : (
          <div className="inline-block min-w-full">
            {/* Header row — hours 0..23 */}
            <div
              className="grid text-[10px] text-gray-500 mb-1"
              style={{ gridTemplateColumns: `48px repeat(24, minmax(28px, 1fr))` }}
            >
              <div />
              {HOURS.map((h) => (
                <div key={h} className="text-center">
                  {String(h).padStart(2, '0')}
                </div>
              ))}
            </div>

            {DAY_LABELS.map((dayLabel, dayIdx) => (
              <div
                key={dayLabel}
                className="grid gap-px mb-px"
                style={{ gridTemplateColumns: `48px repeat(24, minmax(28px, 1fr))` }}
              >
                <div className="flex items-center justify-center text-xs text-gray-400">
                  {dayLabel}
                </div>
                {HOURS.map((h) => {
                  const active = slotMap.has(`${dayIdx}-${h}`);
                  return (
                    <button
                      key={h}
                      onClick={() => toggleCell(dayIdx, h)}
                      disabled={createSlot.isPending || deleteSlot.isPending}
                      className={`h-8 rounded-sm transition-colors ${
                        active
                          ? 'bg-indigo-600 hover:bg-indigo-500'
                          : 'bg-gray-800 hover:bg-gray-700'
                      } disabled:opacity-50`}
                      title={`${dayLabel} ${String(h).padStart(2, '0')}:00`}
                    >
                      {active && (
                        <span className="block mx-auto w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary of active slots */}
      {slots.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-2">
            Horarios de {activeMeta.label}
          </h3>
          <div className="flex flex-wrap gap-2">
            {slots
              .slice()
              .sort((a, b) =>
                a.dayOfWeek !== b.dayOfWeek
                  ? a.dayOfWeek - b.dayOfWeek
                  : a.hour !== b.hour
                  ? a.hour - b.hour
                  : a.minute - b.minute,
              )
              .map((s) => (
                <span
                  key={s.id}
                  className="text-xs px-2.5 py-1 rounded-full border border-gray-800 bg-gray-950 text-gray-300"
                >
                  {DAY_LABELS[s.dayOfWeek]} · {String(s.hour).padStart(2, '0')}:
                  {String(s.minute).padStart(2, '0')}
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
