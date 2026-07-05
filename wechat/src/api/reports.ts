/**
 * 日报 API 封装
 * 对应 CONTRACT.md 3.11 节
 */
import type { DailyReport, PushReportResponse, ApiError } from '../types';

const BASE = '/api/daily-reports';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let err: ApiError;
    try {
      err = (await res.json()) as ApiError;
    } catch {
      err = { error: 'http_error', message: `HTTP ${res.status}` };
    }
    throw new Error(err.message || err.error);
  }
  return (await res.json()) as T;
}

function buildQuery(params: Record<string, string | undefined>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

/** 列表（按日期范围） */
export function getReports(dateFrom?: string, dateTo?: string): Promise<DailyReport[]> {
  const q = buildQuery({ date_from: dateFrom, date_to: dateTo });
  return request<DailyReport[]>(`${BASE}${q}`);
}

/** 按日期取日报 */
export function getReport(date: string): Promise<DailyReport> {
  return request<DailyReport>(`${BASE}/${encodeURIComponent(date)}`);
}

/** 生成某日日报 */
export function generateReport(date: string): Promise<DailyReport> {
  return request<DailyReport>(`${BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date }),
  });
}

/** 推送日报到微信端聊天 */
export function pushReport(date: string): Promise<PushReportResponse> {
  return request<PushReportResponse>(`${BASE}/${encodeURIComponent(date)}/push`, {
    method: 'POST',
  });
}
