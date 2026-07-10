const STORAGE_KEY = 'sd_workspace_id';

export function getActiveWorkspaceId(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setActiveWorkspaceId(workspaceId: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, workspaceId);
  window.dispatchEvent(new Event('sd:workspace-changed'));
}
