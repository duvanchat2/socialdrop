'use client';
import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import {
  LayoutDashboard, Calendar, PlusSquare, HardDrive, Settings, Menu, LayoutGrid, Upload, Briefcase, BarChart2,
} from 'lucide-react';

const Toaster = dynamic(() => import('sonner').then((m) => m.Toaster), {
  ssr: false,
});

const NAV_MAIN = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/calendar', label: 'Calendario', icon: Calendar },
  { href: '/posts/new', label: 'Nuevo Post', icon: PlusSquare },
  { href: '/content', label: 'Contenido', icon: LayoutGrid },
  { href: '/content/bulk', label: 'Subida Masiva', icon: Upload },
  { href: '/drive', label: 'Google Drive', icon: HardDrive },
  { href: '/integrations', label: 'Integraciones', icon: Settings },
];

const NAV_SETTINGS = [
  { href: '/settings/brand', label: 'Perfil de marca', icon: Briefcase },
  { href: '/settings/strategy', label: 'Estrategia', icon: BarChart2 },
];

function NavLinks({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  return (
    <>
      {NAV_MAIN.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onClose}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
            pathname === href
              ? 'bg-indigo-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          <Icon size={16} />
          {label}
        </Link>
      ))}
      <div className="pt-4 pb-1">
        <p className="px-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Configuración</p>
      </div>
      {NAV_SETTINGS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onClose}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
            pathname === href
              ? 'bg-indigo-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          <Icon size={16} />
          {label}
        </Link>
      ))}
    </>
  );
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed top-0 left-0 h-full w-56 bg-gray-900 border-r border-gray-800 z-30 flex flex-col transform transition-transform ${
          open ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="p-4 border-b border-gray-800">
          <span className="text-xl font-bold text-white">SocialDrop</span>
          <span className="text-xs text-gray-500 ml-1">scheduler</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <NavLinks onClose={onClose} />
        </nav>
        <div className="p-4 border-t border-gray-800 text-xs text-gray-600">
          v1.0.0
        </div>
      </aside>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:ml-56 min-h-screen flex flex-col">
        <header className="h-14 border-b border-gray-800 flex items-center px-4 gap-3 bg-gray-900">
          <button
            className="lg:hidden text-gray-400"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
          <span className="text-sm text-gray-400 ml-auto">SocialDrop</span>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
      <Toaster theme="dark" position="bottom-right" />
    </QueryClientProvider>
  );
}
