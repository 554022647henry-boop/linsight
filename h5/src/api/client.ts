import type { ApiError } from '../types';

export class ApiRequestError extends Error {
  status: number;
  body: ApiError | unknown;
  constructor(message: string, status: number, body: ApiError | unknown) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.body = body;
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message =
      (body as ApiError)?.message ?? `请求失败 (${res.status})`;
    throw new ApiRequestError(message, res.status, body);
  }

  return body as T;
}
