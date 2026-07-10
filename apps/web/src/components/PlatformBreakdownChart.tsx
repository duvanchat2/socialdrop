'use client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList } from 'recharts';
import { useTheme } from '@/components/ThemeProvider';

export interface PlatformStat {
  platform: string;
  published: number;
  pending: number;
  failed: number;
  avgEngagementRate: number;
}

export function PlatformBreakdownChart({ data }: { data: PlatformStat[] }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const gridStroke = isDark ? '#374151' : '#f3f4f6';
  const tickStyle = { fontSize: 11, fill: isDark ? '#9ca3af' : '#6b7280' };
  const tooltipStyle = isDark
    ? { fontSize: 12, borderRadius: 8, backgroundColor: '#1f2937', color: '#f9fafb', border: '1px solid #374151' }
    : { fontSize: 12, borderRadius: 8, backgroundColor: '#ffffff', color: '#374151', border: 'none' };

  if (data.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500 text-sm">
        No hay datos por plataforma todavía
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Posts por plataforma</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis dataKey="platform" tick={tickStyle} />
            <YAxis tick={tickStyle} width={30} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="published" fill="#6366f1" radius={[4, 4, 0, 0]} name="Publicados" />
            <Bar dataKey="pending" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Pendientes" />
            <Bar dataKey="failed" fill="#ef4444" radius={[4, 4, 0, 0]} name="Fallidos" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Engagement promedio por plataforma</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis dataKey="platform" tick={tickStyle} />
            <YAxis tick={tickStyle} width={40} unit="%" />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${Number(v).toFixed(2)}%`} />
            <Bar dataKey="avgEngagementRate" fill="#14b8a6" radius={[4, 4, 0, 0]} name="Engagement %">
              <LabelList dataKey="avgEngagementRate" position="top" formatter={(v) => `${Number(v).toFixed(1)}%`} style={{ fontSize: 11, fill: isDark ? '#d1d5db' : '#374151' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
