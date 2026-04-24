export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(err || `HTTP ${res.status}`);
  }
  // 204 No Content or empty body — return undefined cast to T
  if (res.status === 204) return undefined as unknown as T;
  const text = await res.text();
  if (!text) return undefined as unknown as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Unexpected non-JSON response: ${text.slice(0, 100)}`);
  }
}
