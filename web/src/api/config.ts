export const USE_MOCK = true;

export const API_BASE = '/api';

export async function fetchApi<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: 'network_error',
      message: '请求失败',
    }));
    throw error;
  }

  return response.json();
}