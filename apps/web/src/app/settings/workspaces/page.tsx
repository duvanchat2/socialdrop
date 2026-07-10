'use client';

import { useEffect, useState, FormEvent } from 'react';
import { apiFetch } from '@/lib/api';
import { getActiveWorkspaceId, setActiveWorkspaceId } from '@/lib/workspace';

interface WorkspaceSummary {
  id: string;
  name: string;
  role: 'OWNER' | 'MEMBER';
}

interface Member {
  id: string;
  userId: string;
  role: 'OWNER' | 'MEMBER';
  user: { id: string; email: string; name: string | null };
}

export default function WorkspacesSettingsPage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [newName, setNewName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function loadWorkspaces() {
    apiFetch<WorkspaceSummary[]>('/api/workspaces').then(setWorkspaces).catch(() => setWorkspaces([]));
  }

  function loadMembers(workspaceId: string) {
    apiFetch<Member[]>(`/api/workspaces/${workspaceId}/members`).then(setMembers).catch(() => setMembers([]));
  }

  useEffect(() => {
    setActiveId(getActiveWorkspaceId());
    loadWorkspaces();
  }, []);

  useEffect(() => {
    if (activeId) loadMembers(activeId);
  }, [activeId]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const workspace = await apiFetch<{ id: string }>('/api/workspaces', {
        method: 'POST',
        body: JSON.stringify({ name: newName }),
      });
      setNewName('');
      loadWorkspaces();
      setActiveWorkspaceId(workspace.id);
      setActiveId(workspace.id);
    } catch {
      setError('No se pudo crear el workspace');
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    if (!activeId) return;
    setError('');
    setLoading(true);
    try {
      await apiFetch(`/api/workspaces/${activeId}/members`, {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail, role: 'MEMBER' }),
      });
      setInviteEmail('');
      loadMembers(activeId);
    } catch {
      setError('No se pudo agregar el miembro (¿ya tiene cuenta?)');
    } finally {
      setLoading(false);
    }
  }

  const activeRole = workspaces.find((w) => w.id === activeId)?.role;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Workspaces</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Tus workspaces
        </h2>
        <ul className="space-y-1">
          {workspaces.map((w) => (
            <li
              key={w.id}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                w.id === activeId
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'
              }`}
            >
              <span>{w.name}</span>
              <span className="text-xs opacity-70">{w.role}</span>
            </li>
          ))}
        </ul>

        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre del nuevo workspace (modo agencia)"
            required
            className="flex-1 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            Crear
          </button>
        </form>
      </section>

      {activeId && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Miembros del workspace activo
          </h2>
          <ul className="space-y-1">
            {members.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between px-3 py-2 rounded-lg text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200"
              >
                <span>{m.user.name || m.user.email}</span>
                <span className="text-xs opacity-70">{m.role}</span>
              </li>
            ))}
          </ul>

          {activeRole === 'OWNER' && (
            <form onSubmit={handleInvite} className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Correo del miembro a invitar"
                required
                className="flex-1 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white"
              />
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                Invitar
              </button>
            </form>
          )}
          <p className="text-xs text-gray-400">
            Solo se puede invitar a correos que ya tienen cuenta. Las invitaciones pendientes
            para correos sin cuenta se implementarán en un PR posterior.
          </p>
        </section>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
