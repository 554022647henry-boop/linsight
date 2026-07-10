/**
 * 采购进货 API 封装
 * 对应 CONTRACT.md 3.6 节
 */
import type { ApiError } from '../types';

const BASE = '/api/purchase-orders';

/** 进货单主表（与 server/src/types/index.ts PurchaseOrder 对齐） */
export interface PurchaseOrder {
  id: number;
  order_no: string;
  supplier_id: number | null;
  total_amount: number;
  source_type: string;
  source_file_path: string | null;
  ai_raw_text: string | null;
  status: 'pending' | 'confirmed' | 'cancelled';
  note: string | null;
  operator: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
  items?: unknown[];
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

/** 确认入库（副作用：创建 inventory 批次） */
export function confirmPurchaseOrder(orderId: number): Promise<PurchaseOrder> {
  return request<PurchaseOrder>(`${BASE}/${orderId}/confirm`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
}

/** 取消进货单 */
export function cancelPurchaseOrder(orderId: number): Promise<PurchaseOrder> {
  return request<PurchaseOrder>(`${BASE}/${orderId}/cancel`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
  });
}
