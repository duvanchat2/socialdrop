export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth-token');
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
    ...options,
  });
  if (!res.ok) {
    // 401 means token expired / invalid — clear it and redirect to login
    if (res.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('auth-token');
      document.cookie = 'auth-token=; max-age=0; path=/';
      window.location.href = '/login';
    }
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
