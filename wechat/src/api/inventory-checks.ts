/**
 * 实盘对账 API 封装
 * 对应 CONTRACT.md 3.13 节
 */
import type { ApiError } from '../types';

const BASE = '/api/inventory-checks';

export type InventoryCheckSource = 'voice' | 'text' | 'manual';

/** 关店实盘对账记录（inventory_checks 表） */
export interface InventoryCheck {
  id: number;
  check_date: string;
  ingredient_id: number;
  theoretical_remaining: number;
  actual_remaining: number;
  diff: number;
  source: InventoryCheckSource;
  created_at: string;
  /** 后端可能 join 出食材名/单位，便于展示 */
  ingredient_name?: string;
  unit?: string;
}

/** 提交实盘的单项 */
export interface InventoryCheckItem {
  ingredient_id: number;
  actual_remaining: number;
  source?: InventoryCheckSource;
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

/** 老板报实盘 — POST /api/inventory-checks */
export function submitInventoryCheck(
  checkDate: string,
  items: InventoryCheckItem[],
): Promise<InventoryCheck[]> {
  return request<InventoryCheck[]>(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ check_date: checkDate, items }),
  });
}

/** 拉取某日已提交的对账记录 — GET /api/inventory-checks?date= */
export function getInventoryChecks(date?: string): Promise<InventoryCheck[]> {
  const q = date ? `?date=${encodeURIComponent(date)}` : '';
  return request<InventoryCheck[]>(`${BASE}${q}`);
}
