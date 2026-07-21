'use client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList } from 'recharts';
import { useReducedMotion } from 'motion/react';

export interface PlatformStat {
  platform: string;
  published: number;
  pending: number;
  failed: number;
  avgEngagementRate: number;
}

export function PlatformBreakdownChart({ data }: { data: PlatformStat[] }) {
  const reducedMotion = useReducedMotion();
  const gridStroke = 'rgba(255,255,255,0.04)';
  const tickStyle = { fontSize: 11, fill: 'var(--color-ink-muted)' };
  const tooltipStyle = { fontSize: 12, borderRadius: 8, backgroundColor: 'var(--color-surface-2)', color: 'var(--color-ink)', border: 'none' };
  const animProps = { isAnimationActive: !reducedMotion, animationDuration: 400, animationEasing: 'ease-out' as const };

  if (data.length === 0) {
    return (
      <div className="bg-surface rounded-card p-8 text-center text-ink-muted text-sm">
        No hay datos por plataforma todavía
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-surface rounded-card p-4">
        <h3 className="text-sm font-display font-semibold text-ink mb-3">Posts por plataforma</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis dataKey="platform" tick={tickStyle} />
            <YAxis tick={tickStyle} width={30} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12, color: 'var(--color-ink-muted)' }} />
            <Bar dataKey="published" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} name="Publicados" {...animProps} animationBegin={0} />
            <Bar dataKey="pending" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} name="Pendientes" {...animProps} animationBegin={40} />
            <Bar dataKey="failed" fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} name="Fallidos" {...animProps} animationBegin={80} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-surface rounded-card p-4">
        <h3 className="text-sm font-display font-semibold text-ink mb-3">Engagement promedio por plataforma</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis dataKey="platform" tick={tickStyle} />
            <YAxis tick={tickStyle} width={40} unit="%" />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${Number(v).toFixed(2)}%`} />
            <Bar dataKey="avgEngagementRate" fill="var(--color-chart-4)" radius={[4, 4, 0, 0]} name="Engagement %" {...animProps}>
              <LabelList dataKey="avgEngagementRate" position="top" formatter={(v) => `${Number(v).toFixed(1)}%`} style={{ fontSize: 11, fill: 'var(--color-ink-muted)' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
