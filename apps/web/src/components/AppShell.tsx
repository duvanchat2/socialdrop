'use client';
import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import dynamic from 'next/dynamic';
import {
  LayoutDashboard, Calendar, PlusSquare, HardDrive, Settings, Menu,
  Upload, Briefcase, BarChart2, BotMessageSquare, TrendingUp, Sun, Moon, Users,
  ListOrdered, GitBranch, Inbox, Zap, Terminal, Youtube, Brain, ChevronLeft, ChevronRight, X,
} from 'lucide-react';
import { useTheme, isLightThemeEnabled } from './ThemeProvider';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

const Toaster = dynamic(() => import('sonner').then((m) => m.Toaster), {
  ssr: false,
});

const NAV_GROUPS = [
  {
    label: null,
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/calendar', label: 'Calendario', icon: Calendar },
      { href: '/queue', label: 'Cola', icon: ListOrdered },
      { href: '/posts/new', label: 'Nuevo Post', icon: PlusSquare },
      { href: '/content/bulk', label: 'Subida Masiva', icon: Upload },
      { href: '/drive', label: 'Google Drive', icon: HardDrive },
      { href: '/integrations', label: 'Integraciones', icon: Settings },
    ],
  },
  {
    label: 'Insights',
    items: [
      { href: '/analytics', label: 'Analytics', icon: TrendingUp },
      { href: '/competitors', label: 'Competencia', icon: Users },
      { href: '/brain', label: 'Mi Voz', icon: Brain },
      { href: '/assistant', label: 'Asistente IA', icon: BotMessageSquare },
    ],
  },
  {
    label: 'Automatización',
    items: [
      { href: '/flows', label: 'Flujos', icon: GitBranch },
      { href: '/inbox', label: 'Bandeja', icon: Inbox },
      { href: '/sequences', label: 'Secuencias', icon: Zap },
      { href: '/youtube', label: 'YT Comentarios', icon: Youtube },
    ],
  },
  {
    label: 'Configuración',
    items: [
      { href: '/settings/brand', label: 'Perfil de marca', icon: Briefcase },
      { href: '/settings/strategy', label: 'Estrategia', icon: BarChart2 },
      { href: '/settings/workspaces', label: 'Workspaces', icon: Users },
      { href: '/settings/usage', label: 'Consumo', icon: BarChart2 },
    ],
  },
] as const;

function NavLinks({ collapsed, onNavigate }: { collapsed: boolean; onNavigate: () => void }) {
  const pathname = usePathname();
  return (
    <>
      {NAV_GROUPS.map((group, i) => (
        <div key={group.label ?? `group-${i}`} className={i > 0 ? 'pt-4' : undefined}>
          {group.label && !collapsed && (
            <p className="px-3 pb-1 text-[11px] font-medium text-ink-muted uppercase tracking-wider">
              {group.label}
            </p>
          )}
          {group.label && collapsed && (
            <div className="mx-3 mb-2 h-px bg-surface-2" />
          )}
          <div className="space-y-1">
            {group.items.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                title={collapsed ? label : undefined}
                className={`flex items-center gap-3 px-3 py-2 rounded-pill text-sm transition-colors ${
                  collapsed ? 'justify-center' : ''
                } ${
                  pathname === href
                    ? 'bg-accent text-ink'
                    : 'text-ink-muted hover:text-ink hover:bg-surface-2'
                }`}
              >
                <Icon size={16} className="shrink-0" />
                {!collapsed && label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

function Sidebar({
  mobileOpen,
  onCloseMobile,
  collapsed,
  onToggleCollapsed,
}: {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={onCloseMobile}
        />
      )}
      <aside
        className={`fixed top-0 left-0 h-full ${collapsed ? 'lg:w-16' : 'lg:w-56'} w-56 bg-base z-30 flex flex-col transform transition-[transform,width] duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="p-4 flex items-center justify-between">
          {!collapsed && (
            <div className="min-w-0">
              <span className="text-xl font-display font-bold text-ink">SocialDrop</span>
              <span className="text-xs text-ink-muted ml-1">scheduler</span>
            </div>
          )}
          <button
            className="lg:hidden text-ink-muted hover:text-ink"
            onClick={onCloseMobile}
          >
            <X size={18} />
          </button>
          <button
            className="hidden lg:flex text-ink-muted hover:text-ink"
            onClick={onToggleCollapsed}
            title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
        {!collapsed && (
          <div className="pt-3">
            <WorkspaceSwitcher />
          </div>
        )}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto overflow-x-hidden">
          <NavLinks collapsed={collapsed} onNavigate={onCloseMobile} />
        </nav>
        {!collapsed && (
          <div className="p-4 text-xs text-ink-muted space-y-2">
            <Link href="/debug" className="flex items-center gap-1.5 hover:text-ink transition-colors">
              <Terminal size={12} /> Debug Logs
            </Link>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <Link href="/privacy" className="hover:text-ink transition-colors">Privacidad</Link>
              <Link href="/terms" className="hover:text-ink transition-colors">Términos</Link>
              <Link href="/support" className="hover:text-ink transition-colors">Soporte</Link>
            </div>
            <p>v1.0.0</p>
          </div>
        )}
      </aside>
    </>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  if (!isLightThemeEnabled) return null;
  return (
    <button
      onClick={toggle}
      className="p-2 rounded-lg text-ink-muted hover:bg-surface-2 transition-colors"
      title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [queryClient] = useState(() => new QueryClient());
  const { theme } = useTheme();

  useEffect(() => {
    setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true');
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  }

  return (
    <MotionConfig reducedMotion="user">
      <QueryClientProvider client={queryClient}>
        <Sidebar
          mobileOpen={sidebarOpen}
          onCloseMobile={() => setSidebarOpen(false)}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
        <div className={`${collapsed ? 'lg:ml-16' : 'lg:ml-56'} min-h-screen flex flex-col transition-[margin] duration-200`}>
          <header className="h-14 flex items-center px-4 gap-3 bg-base">
            <button
              className="lg:hidden text-ink-muted"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <span className="text-sm text-ink-muted ml-auto mr-1">SocialDrop</span>
            <ThemeToggle />
          </header>
          <main className="flex-1 p-6">{children}</main>
        </div>
        <Toaster theme={theme} position="bottom-right" />
      </QueryClientProvider>
    </MotionConfig>
  );
}
