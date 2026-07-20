'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronsUpDown, Check } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getActiveWorkspaceId, setActiveWorkspaceId } from '@/lib/workspace';

interface WorkspaceSummary {
  id: string;
  name: string;
  role: 'OWNER' | 'MEMBER';
}

export function WorkspaceSwitcher() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[] | null>(null);
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setActiveId(getActiveWorkspaceId());
    apiFetch<WorkspaceSummary[]>('/api/workspaces')
      .then(setWorkspaces)
      .catch(() => setWorkspaces([]));
  }, []);

  if (!workspaces || workspaces.length < 2) return null;

  const active = workspaces.find((w) => w.id === activeId) ?? workspaces[0];

  function select(id: string) {
    setActiveWorkspaceId(id);
    setActiveId(id);
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="relative px-3 pb-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      >
        <span className="truncate">{active.name}</span>
        <ChevronsUpDown size={14} className="shrink-0 opacity-60" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute left-3 right-3 mt-1 z-40 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg overflow-hidden"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {workspaces.map((w) => (
              <button
                key={w.id}
                onClick={() => select(w.id)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <span className="truncate">{w.name}</span>
                {w.id === active.id && <Check size={14} />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
