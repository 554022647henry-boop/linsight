/**
 * 库存 API 封装
 * 对应 CONTRACT.md 3.7 节 — 当前库存（按食材聚合）
 */
import type { ApiError } from '../types';

const BASE = '/api/inventory';

/** 当前库存项（GET /api/inventory 返回元素） */
export interface InventoryItem {
  ingredient_id: number;
  ingredient_name: string;
  total_quantity: number | null;
  unit: string;
  warning_threshold: number;
  is_low: number; // 0 | 1
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

/** 当前库存（按食材聚合），用于实盘参考 */
export function getInventory(): Promise<InventoryItem[]> {
  return request<InventoryItem[]>(BASE);
}
