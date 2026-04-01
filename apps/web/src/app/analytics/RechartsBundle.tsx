'use client';
import {
  BarChart, Bar, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

type Tab = 'overview' | 'engagement' | 'community' | 'reach' | 'content';

interface OverviewStats { published: number; pending: number; failed: number; total: number; today: number; }
interface PlatformStat  { platform: string; accountName: string; published: number; pending: number; failed: number; }
interface Post          { id: string; content: string; status: string; scheduledAt: string; integrations: { integration: { platform: string } }[]; }

interface Props {
  tab: Tab;
  overview?: OverviewStats;
  byPlatform: PlatformStat[];
  posts: Post[];
  followerData: { date: string; value: number }[];
  engagementData: { date: string; value: number }[];
  reachData: { date: string; value: number }[];
  likesData: { date: string; value: number }[];
  commentsData: { date: string; value: number }[];
  savesData: { date: string; value: number }[];
  sharesData: { date: string; value: number }[];
  gainedLost: { day: string; gained: number; lost: number }[];
  postTypeData: { type: string; value: number }[];
  postsByDay: { day: string; posts: number }[];
  heatmap: { day: string; hours: number[] }[];
  published: number;
  total: number;
  KpiCard: React.ComponentType<{ icon: string; iconBg: string; label: string; value: string | number; sub?: string }>;
  SectionTitle: React.ComponentType<{ children: React.ReactNode }>;
  PostCard: React.ComponentType<{ post: Post }>;
  HeatCell: React.ComponentType<{ value: number }>;
}

const HOURS_LABELS = ['00', '03', '06', '09', '12', '15', '18', '21'];

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <h4 className="text-sm font-semibold text-gray-700 mb-4">{title}</h4>
      {children}
    </div>
  );
}

function MiniChart({ data, color, height = 200 }: { data: { date: string; value: number }[]; color: string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.15} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} width={35} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#grad-${color.replace('#', '')})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── TAB 1: Overview ────────────────────────────────────────────────────────────
function OverviewTab({ overview, byPlatform, posts, followerData, published, total, KpiCard, SectionTitle, PostCard }: Props) {
  return (
    <div className="space-y-6">
      <SectionTitle>Audiencia</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard icon="👥" iconBg="bg-purple-100" label="Seguidores" value="1,247" sub="+12 esta semana" />
        <KpiCard icon="📈" iconBg="bg-green-100" label="Seguidores nuevos" value="124" sub="+8.3% vs semana ant." />
        <KpiCard icon="🚀" iconBg="bg-teal-100" label="% Crecimiento" value="9.9%" sub="últimos 30 días" />
      </div>

      <ChartCard title="Crecimiento de seguidores — 30 días">
        <MiniChart data={followerData} color="#6366f1" height={220} />
      </ChartCard>

      <SectionTitle>Publicaciones</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard icon="📝" iconBg="bg-indigo-100" label="Posts publicados" value={published || '--'} />
        <KpiCard icon="👁️" iconBg="bg-purple-100" label="Vistas / Impresiones" value="18,420" />
        <KpiCard icon="📡" iconBg="bg-yellow-100" label="Alcance" value="9,840" />
      </div>

      <SectionTitle>Engagement</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard icon="💬" iconBg="bg-pink-100" label="Interacciones en posts" value="842" />
        <KpiCard icon="📊" iconBg="bg-green-100" label="Tasa de eng. promedio" value="3.8%" />
        <KpiCard icon="🎯" iconBg="bg-teal-100" label="Eng. promedio en alcance" value="8.6%" />
      </div>

      <SectionTitle>Stories</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard icon="📖" iconBg="bg-orange-100" label="Stories publicadas" value="24" />
        <KpiCard icon="👀" iconBg="bg-blue-100" label="Vistas de stories" value="3,120" />
        <KpiCard icon="📡" iconBg="bg-violet-100" label="Alcance de stories" value="2,480" />
      </div>

      <SectionTitle>Posts recientes</SectionTitle>
      {posts.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {posts.slice(0, 10).map(p => <PostCard key={p.id} post={p} />)}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400 text-sm shadow-sm">
          No hay posts publicados aún
        </div>
      )}

      {byPlatform.length > 0 && (
        <>
          <SectionTitle>Por plataforma</SectionTitle>
          <ChartCard title="Posts publicados por plataforma">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byPlatform}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="platform" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} width={30} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="published" fill="#6366f1" radius={[4, 4, 0, 0]} name="Publicados" />
                <Bar dataKey="pending"   fill="#f59e0b" radius={[4, 4, 0, 0]} name="Pendientes" />
                <Bar dataKey="failed"    fill="#ef4444" radius={[4, 4, 0, 0]} name="Fallidos" />
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </>
      )}
    </div>
  );
}

// ── TAB 2: Engagement ─────────────────────────────────────────────────────────
function EngagementTab({ engagementData, likesData, commentsData, savesData, sharesData, KpiCard, SectionTitle }: Props) {
  return (
    <div className="space-y-6">
      <SectionTitle>Tasas de engagement</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <KpiCard icon="📊" iconBg="bg-green-100"  label="Tasa eng. promedio"      value="3.8%" />
        <KpiCard icon="🎯" iconBg="bg-teal-100"   label="Eng. en alcance"         value="8.6%" />
        <KpiCard icon="💬" iconBg="bg-pink-100"   label="Interacciones totales"   value="842" />
        <KpiCard icon="⭐" iconBg="bg-yellow-100" label="Eng. promedio recibido"  value="28.4" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Historial de tasa de engagement">
          <MiniChart data={engagementData} color="#10b981" />
        </ChartCard>
        <ChartCard title="Eng. promedio en alcance">
          <MiniChart data={engagementData.map(d => ({ ...d, value: +(d.value * 2.2).toFixed(1) }))} color="#14b8a6" />
        </ChartCard>
      </div>

      <ChartCard title="Engagement promedio por tipo de post">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={[
            { type: 'Posts',    eng: 3.2 },
            { type: 'Carrusel', eng: 5.8 },
            { type: 'Reels',    eng: 7.1 },
          ]}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="type" tick={{ fontSize: 12, fill: '#9ca3af' }} />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} width={35} unit="%" />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
            <Bar dataKey="eng" radius={[6, 6, 0, 0]} name="Eng. rate %">
              {['#6366f1', '#ec4899', '#f59e0b'].map((c, i) => <Cell key={i} fill={c} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <SectionTitle>Me gusta</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <KpiCard icon="❤️" iconBg="bg-red-100"    label="Me gusta recibidos" value="612" />
        <KpiCard icon="💝" iconBg="bg-pink-100"   label="Promedio me gusta"  value="48" />
        <KpiCard icon="💬" iconBg="bg-blue-100"   label="Comentarios"        value="148" />
        <KpiCard icon="🗨️" iconBg="bg-indigo-100" label="Prom. comentarios"  value="12" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Historial de me gusta"><MiniChart data={likesData} color="#ef4444" /></ChartCard>
        <ChartCard title="Historial de comentarios"><MiniChart data={commentsData} color="#3b82f6" /></ChartCard>
      </div>

      <SectionTitle>Guardados y compartidos</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <KpiCard icon="🔖" iconBg="bg-pink-100"   label="Guardados"         value="284" />
        <KpiCard icon="💾" iconBg="bg-rose-100"   label="Prom. guardados"   value="22" />
        <KpiCard icon="🔁" iconBg="bg-teal-100"   label="Compartidos"       value="96" />
        <KpiCard icon="↗️" iconBg="bg-green-100"  label="Prom. compartidos" value="8" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Historial de guardados"><MiniChart data={savesData} color="#ec4899" /></ChartCard>
        <ChartCard title="Historial de compartidos"><MiniChart data={sharesData} color="#14b8a6" /></ChartCard>
      </div>
    </div>
  );
}

// ── TAB 3: Community ──────────────────────────────────────────────────────────
function CommunityTab({ followerData, gainedLost, heatmap, KpiCard, SectionTitle, HeatCell }: Props) {
  const ageGenderData = [
    { label: '13–17', women: 8,  men: 5 },
    { label: '18–24', women: 32, men: 22 },
    { label: '25–34', women: 28, men: 18 },
    { label: '35–44', women: 14, men: 10 },
    { label: '45+',   women: 6,  men: 4 },
  ];
  const countries = [
    { name: 'Colombia', pct: 42 }, { name: 'México', pct: 18 },
    { name: 'Argentina', pct: 14 }, { name: 'España', pct: 10 },
    { name: 'Venezuela', pct: 8 }, { name: 'Otros', pct: 8 },
  ];

  return (
    <div className="space-y-6">
      <SectionTitle>Seguidores</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard icon="👥" iconBg="bg-purple-100" label="Seguidores totales"  value="1,247" />
        <KpiCard icon="📈" iconBg="bg-green-100"  label="Evolución"           value="+124" sub="últimos 30 días" />
        <KpiCard icon="🚀" iconBg="bg-teal-100"   label="% Evolución"         value="+11.1%" />
      </div>

      <ChartCard title="Crecimiento de seguidores">
        <MiniChart data={followerData} color="#8b5cf6" height={200} />
      </ChartCard>

      <ChartCard title="Ganados y perdidos por día">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={gainedLost}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} width={35} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
            <Bar dataKey="gained" fill="#10b981" radius={[4, 4, 0, 0]} name="Ganados" />
            <Bar dataKey="lost"   fill="#d1d5db" radius={[4, 4, 0, 0]} name="Perdidos" />
            <Legend />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Age/gender */}
        <ChartCard title="Distribución por edad y género">
          <div className="space-y-2">
            {ageGenderData.map(row => (
              <div key={row.label} className="flex items-center gap-2 text-xs">
                <span className="w-10 text-gray-500 text-right">{row.label}</span>
                <div className="flex-1 flex gap-1 h-5 items-center">
                  <div className="h-4 rounded-sm bg-purple-400 opacity-80" style={{ width: `${row.women}%` }} title={`Mujeres ${row.women}%`} />
                  <div className="h-4 rounded-sm bg-red-400 opacity-80"    style={{ width: `${row.men}%` }}   title={`Hombres ${row.men}%`} />
                </div>
                <span className="text-gray-400">{row.women + row.men}%</span>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-purple-400 inline-block" />Mujeres</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-400 inline-block" />Hombres</span>
          </div>
        </ChartCard>

        {/* Top countries */}
        <ChartCard title="Principales países">
          <div className="space-y-2">
            {countries.map(c => (
              <div key={c.name} className="flex items-center gap-2 text-xs">
                <span className="w-20 text-gray-600 truncate">{c.name}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-3">
                  <div className="h-3 rounded-full bg-indigo-400" style={{ width: `${c.pct}%` }} />
                </div>
                <span className="text-gray-500 w-8 text-right">{c.pct}%</span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Heatmap */}
      <ChartCard title="Seguidores en línea — Mejor momento para publicar">
        <p className="text-xs text-indigo-600 font-semibold mb-3">
          📍 Tus seguidores están más activos los <strong>Miércoles a las 12:00</strong>
        </p>
        <div className="overflow-x-auto">
          <div className="inline-grid gap-1" style={{ gridTemplateColumns: `4rem repeat(${HOURS_LABELS.length}, 1.5rem)` }}>
            <div className="text-xs text-gray-400 text-right pr-1">Hora→</div>
            {HOURS_LABELS.map(h => <div key={h} className="text-xs text-gray-400 text-center">{h}</div>)}
            {heatmap.map(row => (
              <>
                <div key={row.day + '_label'} className="text-xs text-gray-500 text-right pr-1 flex items-center justify-end">{row.day}</div>
                {row.hours.map((v, i) => <HeatCell key={i} value={v} />)}
              </>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-400 inline-block" />Muy activo</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-yellow-300 inline-block" />Activo</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-200 inline-block" />Bajo</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gray-100 inline-block" />Inactivo</span>
        </div>
      </ChartCard>
    </div>
  );
}

// ── TAB 4: Reach ──────────────────────────────────────────────────────────────
function ReachTab({ reachData, posts, KpiCard, SectionTitle, PostCard }: Props) {
  const combined = reachData.map(d => ({ date: d.date, reach: d.value, views: Math.round(d.value * 1.9) }));
  return (
    <div className="space-y-6">
      <SectionTitle>Totales</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KpiCard icon="👁️" iconBg="bg-purple-100" label="Total vistas / impresiones" value="18,420" sub="últimos 30 días" />
        <KpiCard icon="📡" iconBg="bg-yellow-100" label="Alcance total"              value="9,840"  sub="únicos" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard icon="📷" iconBg="bg-indigo-100" label="Prom. vistas / post"   value="1,537" />
        <KpiCard icon="🎯" iconBg="bg-green-100"  label="Prom. alcance / post"  value="820" />
        <KpiCard icon="📊" iconBg="bg-teal-100"   label="Tasa alcance prom."    value="7.2%" />
      </div>

      <ChartCard title="Historial de alcance y vistas">
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={combined}>
            <defs>
              <linearGradient id="gradReach" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradViews" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} width={40} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
            <Area type="monotone" dataKey="views" stroke="#8b5cf6" strokeWidth={2} fill="url(#gradViews)" name="Vistas" dot={false} />
            <Area type="monotone" dataKey="reach" stroke="#f59e0b" strokeWidth={2} fill="url(#gradReach)" name="Alcance" dot={false} />
            <Legend />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Alcance promedio por tipo de post">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={[{ type: 'Posts', reach: 780 }, { type: 'Carrusel', reach: 1240 }, { type: 'Reels', reach: 2100 }]}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="type" tick={{ fontSize: 12, fill: '#9ca3af' }} />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} width={45} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
            <Bar dataKey="reach" radius={[6, 6, 0, 0]} name="Alcance promedio">
              {['#f59e0b', '#6366f1', '#ec4899'].map((c, i) => <Cell key={i} fill={c} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <SectionTitle>Posts con mayor alcance</SectionTitle>
      {posts.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {posts.slice(0, 10).map(p => <PostCard key={p.id} post={p} />)}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400 text-sm">No hay datos aún</div>
      )}
    </div>
  );
}

// ── TAB 5: Content ────────────────────────────────────────────────────────────
function ContentTab({ postTypeData, postsByDay, posts, followerData, KpiCard, SectionTitle, PostCard }: Props) {
  const total = postTypeData.reduce((a, b) => a + b.value, 0);
  const monthlyData = Array.from({ length: 12 }, (_, i) => ({
    month: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][i],
    '2025': Math.floor(Math.random() * 20 + 5),
    '2026': Math.floor(Math.random() * 25 + 8),
  }));

  return (
    <div className="space-y-6">
      <SectionTitle>Volumen de contenido</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <KpiCard icon="📝" iconBg="bg-indigo-100" label="Posts totales"   value={total || '--'} />
        <KpiCard icon="🖼️" iconBg="bg-pink-100"   label="Fotos"           value={postTypeData[0]?.value || '--'} />
        <KpiCard icon="🎠" iconBg="bg-teal-100"   label="Carruseles"      value={postTypeData[1]?.value || '--'} />
        <KpiCard icon="🎬" iconBg="bg-yellow-100" label="Reels publicados" value={postTypeData[2]?.value || '--'} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Distribución por tipo">
          {total > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={postTypeData.map(d => ({ name: d.type, value: d.value }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={3} label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                  {postTypeData.map((_, i) => <Cell key={i} fill={['#6366f1','#14b8a6','#f59e0b','#ec4899'][i % 4]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex items-center justify-center text-gray-400 text-sm">Sin datos de posts</div>
          )}
        </ChartCard>

        <ChartCard title="Posts por día de la semana">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={postsByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} width={25} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
              <Bar dataKey="posts" radius={[4, 4, 0, 0]} name="Posts" fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Historial de publicaciones">
        <MiniChart data={followerData.map((d, i) => ({ date: d.date, value: Math.floor(Math.random() * 4) }))} color="#6366f1" height={160} />
      </ChartCard>

      <ChartCard title="Distribución mensual — Comparación anual">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} />
            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} width={25} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
            <Bar dataKey="2025" fill="#d1d5db" radius={[3, 3, 0, 0]} name="2025" />
            <Bar dataKey="2026" fill="#6366f1" radius={[3, 3, 0, 0]} name="2026" />
            <Legend />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <SectionTitle>Posts recientes</SectionTitle>
      {posts.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {posts.slice(0, 10).map(p => <PostCard key={p.id} post={p} />)}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400 text-sm">No hay posts aún</div>
      )}
    </div>
  );
}

// ── Root export ───────────────────────────────────────────────────────────────
export default function RechartsBundle(props: Props) {
  const { tab } = props;
  if (tab === 'overview')   return <OverviewTab    {...props} />;
  if (tab === 'engagement') return <EngagementTab  {...props} />;
  if (tab === 'community')  return <CommunityTab   {...props} />;
  if (tab === 'reach')      return <ReachTab       {...props} />;
  if (tab === 'content')    return <ContentTab     {...props} />;
  return null;
}
