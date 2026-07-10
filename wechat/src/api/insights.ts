/**
 * AI 洞察 API 封装
 * 对应 CONTRACT.md 3.14 节
 */
import type { ApiError } from '../types';

const BASE = '/api/ai-insights';

export type InsightType =
  | 'daily_report'
  | 'loss_warning'
  | 'price_alert'
  | 'expiry_alert'
  | 'reconcile_alert';

/** AI 洞察推送记录（ai_insights 表） */
export interface AiInsight {
  id: number;
  insight_type: InsightType;
  related_date: string | null;
  content: string;
  suggestion: string | null;
  is_read: 0 | 1;
  created_at: string;
}

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

/** 洞察列表 — GET /api/ai-insights?type=&is_read= */
export function getInsights(type?: InsightType, isRead?: boolean): Promise<AiInsight[]> {
  const q = buildQuery({
    type,
    is_read: isRead === undefined ? undefined : isRead ? '1' : '0',
  });
  return request<AiInsight[]>(`${BASE}${q}`);
}

/** 未读洞察 — GET /api/ai-insights/unread */
export function getUnreadInsights(): Promise<AiInsight[]> {
  return request<AiInsight[]>(`${BASE}/unread`);
}

/** 标记已读 — PATCH /api/ai-insights/:id/read */
export function markInsightRead(id: number): Promise<AiInsight> {
  return request<AiInsight>(`${BASE}/${id}/read`, { method: 'PATCH' });
}
