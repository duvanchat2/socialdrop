'use client';

export interface BestTimesCell { dayOfWeek: number; hour: number; avgEngagement: number; count: number; }
export interface BestTimes { heatmap: BestTimesCell[]; topSlots: BestTimesCell[]; minPostsPerCell: number; }

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function intensityClass(avg: number, max: number) {
  if (max <= 0 || avg <= 0) return 'bg-gray-800';
  const pct = avg / max;
  if (pct > 0.75) return 'bg-indigo-500';
  if (pct > 0.5) return 'bg-indigo-600/70';
  if (pct > 0.25) return 'bg-indigo-700/50';
  return 'bg-indigo-900/40';
}

export function BestTimesHeatmap({ data }: { data: BestTimes | undefined }) {
  if (!data) return null;
  const { heatmap, topSlots, minPostsPerCell } = data;
  const maxEngagement = Math.max(0, ...heatmap.filter((c) => c.count >= minPostsPerCell).map((c) => c.avgEngagement));

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-1">Mejores horas para publicar</h3>
      <p className="text-xs text-gray-500 mb-3">
        Basado en engagement histórico (mínimo {minPostsPerCell} posts por franja)
      </p>

      {topSlots.length > 0 ? (
        <div className="flex flex-wrap gap-2 mb-4">
          {topSlots.map((slot, i) => (
            <span key={i} className="text-xs bg-indigo-900/50 text-indigo-300 px-2.5 py-1 rounded-full">
              {DAY_LABELS[slot.dayOfWeek]} {slot.hour}:00 · {slot.avgEngagement}% eng.
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-500 mb-4">Aún no hay suficientes datos para recomendar franjas.</p>
      )}

      <div className="overflow-x-auto">
        <div className="inline-grid gap-0.5" style={{ gridTemplateColumns: `2.5rem repeat(24, 1.25rem)` }}>
          <div />
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="text-[9px] text-gray-500 text-center">{h}</div>
          ))}
          {DAY_LABELS.map((label, dayOfWeek) => (
            <>
              <div key={`${dayOfWeek}-label`} className="text-[10px] text-gray-400 flex items-center">{label}</div>
              {Array.from({ length: 24 }, (_, hour) => {
                const cell = heatmap.find((c) => c.dayOfWeek === dayOfWeek && c.hour === hour);
                const eligible = (cell?.count ?? 0) >= minPostsPerCell;
                return (
                  <div
                    key={`${dayOfWeek}-${hour}`}
                    title={cell ? `${label} ${hour}:00 — ${cell.avgEngagement}% eng. (${cell.count} posts)` : ''}
                    className={`w-5 h-5 rounded-sm flex items-center justify-center text-[7px] text-gray-300 ${
                      eligible ? intensityClass(cell!.avgEngagement, maxEngagement) : 'bg-gray-800/40'
                    }`}
                  >
                    {eligible ? Math.round(cell!.avgEngagement) : ''}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </div>
    </div>
  );
}
