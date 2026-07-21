'use client';

export interface BestTimesCell { dayOfWeek: number; hour: number; avgEngagement: number; count: number; }
export interface BestTimes { heatmap: BestTimesCell[]; topSlots: BestTimesCell[]; minPostsPerCell: number; }

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// Single-tone sequential scale (brand violet, light→dark) — never multicolor.
function intensityStyle(avg: number, max: number): React.CSSProperties {
  if (max <= 0 || avg <= 0) return { background: 'var(--color-surface-2)' };
  const pct = avg / max;
  const opacity = 0.25 + pct * 0.65; // 0.25 → 0.9
  return { background: `color-mix(in oklab, var(--color-accent) ${Math.round(opacity * 100)}%, var(--color-surface))` };
}

export function BestTimesHeatmap({ data }: { data: BestTimes | undefined }) {
  if (!data) return null;
  const { heatmap, topSlots, minPostsPerCell } = data;
  const maxEngagement = Math.max(0, ...heatmap.filter((c) => c.count >= minPostsPerCell).map((c) => c.avgEngagement));

  return (
    <div className="bg-surface rounded-card p-4">
      <h3 className="text-sm font-display font-semibold text-ink mb-1">Mejores horas para publicar</h3>
      <p className="text-xs text-ink-muted mb-3">
        Basado en engagement histórico (mínimo {minPostsPerCell} posts por franja)
      </p>

      {topSlots.length > 0 ? (
        <div className="flex flex-wrap gap-2 mb-4">
          {topSlots.map((slot, i) => (
            <span key={i} className="text-xs bg-accent/15 text-accent px-2.5 py-1 rounded-pill font-mono-nums">
              {DAY_LABELS[slot.dayOfWeek]} {slot.hour}:00 · {slot.avgEngagement}% eng.
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-ink-muted mb-4">Aún no hay suficientes datos para recomendar franjas.</p>
      )}

      <div className="overflow-x-auto">
        <div className="inline-grid gap-0.5" style={{ gridTemplateColumns: `2.5rem repeat(24, 1.25rem)` }}>
          <div />
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="text-[9px] text-ink-muted text-center font-mono-nums">{h}</div>
          ))}
          {DAY_LABELS.map((label, dayOfWeek) => (
            <>
              <div key={`${dayOfWeek}-label`} className="text-[10px] text-ink-muted flex items-center">{label}</div>
              {Array.from({ length: 24 }, (_, hour) => {
                const cell = heatmap.find((c) => c.dayOfWeek === dayOfWeek && c.hour === hour);
                const eligible = (cell?.count ?? 0) >= minPostsPerCell;
                return (
                  <div
                    key={`${dayOfWeek}-${hour}`}
                    title={cell ? `${label} ${hour}:00 — ${cell.avgEngagement}% eng. (${cell.count} posts)` : ''}
                    className="w-5 h-5 rounded-sm flex items-center justify-center text-[7px] text-ink font-mono-nums motion-safe:animate-[heatmap-fade-in_150ms_ease-out_backwards]"
                    style={{
                      ...(eligible ? intensityStyle(cell!.avgEngagement, maxEngagement) : { background: 'var(--color-surface-2)', opacity: 0.4 }),
                      animationDelay: `${hour * 8}ms`,
                    }}
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
