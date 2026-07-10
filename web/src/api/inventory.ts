import { USE_MOCK, fetchApi } from './config';
import { delay } from './mock';

// ============================================================
// 类型定义（内联，不碰共享 types.ts）
// ============================================================

/** GET /inventory 返回的聚合库存项 */
export interface InventorySummary {
  ingredient_id: number;
  ingredient_name: string;
  total_quantity: number;
  unit: string;
  warning_threshold: number;
  is_low: 0 | 1;
}

/** GET /inventory/batches 返回的库存批次 */
export interface InventoryBatch {
  id: number;
  ingredient_id: number;
  quantity: number;
  unit: string;
  batch_no: string | null;
  purchase_order_id: number | null;
  expiry_date: string | null;
  received_date: string;
  status: 'active' | 'consumed' | 'expired';
  created_at: string;
  updated_at: string;
}

/** GET /inventory/expiring 返回的临期批次 */
export interface ExpiringBatch {
  id: number;
  ingredient_id: number;
  ingredient_name: string;
  quantity: number;
  unit: string;
  expiry_date: string;
  received_date: string;
  batch_no: string | null;
  days_until_expiry: number;
}

/** GET /inventory/low 返回的低库存项 */
export interface LowStockItem {
  ingredient_id: number;
  ingredient_name: string;
  current_quantity: number;
  unit: string;
  warning_threshold: number;
  deficit: number;
}

// ============================================================
// Mock 数据（USE_MOCK=true 时使用，保证页面始终可渲染）
// ============================================================

const mockInventory: InventorySummary[] = [
  { ingredient_id: 1, ingredient_name: '牛肉', total_quantity: 15, unit: 'kg', warning_threshold: 10, is_low: 0 },
  { ingredient_id: 2, ingredient_name: '猪肉', total_quantity: 8, unit: 'kg', warning_threshold: 10, is_low: 1 },
  { ingredient_id: 3, ingredient_name: '鸡蛋', total_quantity: 120, unit: '个', warning_threshold: 60, is_low: 0 },
  { ingredient_id: 4, ingredient_name: '青菜', total_quantity: 5, unit: 'kg', warning_threshold: 8, is_low: 1 },
  { ingredient_id: 5, ingredient_name: '大米', total_quantity: 50, unit: 'kg', warning_threshold: 20, is_low: 0 },
  { ingredient_id: 6, ingredient_name: '葱', total_quantity: 2, unit: 'kg', warning_threshold: 5, is_low: 1 },
];

const mockBatches: InventoryBatch[] = [
  { id: 1, ingredient_id: 1, quantity: 15, unit: 'kg', batch_no: 'B20260708-001', purchase_order_id: 1, expiry_date: '2026-07-15', received_date: '2026-07-08', status: 'active', created_at: '2026-07-08T10:00:00Z', updated_at: '2026-07-08T10:00:00Z' },
  { id: 2, ingredient_id: 2, quantity: 8, unit: 'kg', batch_no: 'B20260708-002', purchase_order_id: 1, expiry_date: '2026-07-12', received_date: '2026-07-08', status: 'active', created_at: '2026-07-08T10:00:00Z', updated_at: '2026-07-08T10:00:00Z' },
  { id: 3, ingredient_id: 3, quantity: 120, unit: '个', batch_no: 'B20260705-003', purchase_order_id: 2, expiry_date: '2026-07-12', received_date: '2026-07-05', status: 'active', created_at: '2026-07-05T10:00:00Z', updated_at: '2026-07-05T10:00:00Z' },
  { id: 4, ingredient_id: 4, quantity: 5, unit: 'kg', batch_no: 'B20260708-004', purchase_order_id: 3, expiry_date: '2026-07-10', received_date: '2026-07-08', status: 'active', created_at: '2026-07-08T10:00:00Z', updated_at: '2026-07-08T10:00:00Z' },
  { id: 5, ingredient_id: 5, quantity: 50, unit: 'kg', batch_no: 'B20260701-005', purchase_order_id: 4, expiry_date: null, received_date: '2026-07-01', status: 'active', created_at: '2026-07-01T10:00:00Z', updated_at: '2026-07-01T10:00:00Z' },
  { id: 6, ingredient_id: 6, quantity: 2, unit: 'kg', batch_no: 'B20260708-006', purchase_order_id: 3, expiry_date: '2026-07-09', received_date: '2026-07-08', status: 'active', created_at: '2026-07-08T10:00:00Z', updated_at: '2026-07-08T10:00:00Z' },
];

const mockExpiring: ExpiringBatch[] = [
  { id: 6, ingredient_id: 6, ingredient_name: '葱', quantity: 2, unit: 'kg', expiry_date: '2026-07-10', received_date: '2026-07-08', batch_no: 'B20260708-006', days_until_expiry: 0 },
  { id: 4, ingredient_id: 4, ingredient_name: '青菜', quantity: 5, unit: 'kg', expiry_date: '2026-07-10', received_date: '2026-07-08', batch_no: 'B20260708-004', days_until_expiry: 0 },
  { id: 3, ingredient_id: 3, ingredient_name: '鸡蛋', quantity: 120, unit: '个', expiry_date: '2026-07-12', received_date: '2026-07-05', batch_no: 'B20260705-003', days_until_expiry: 2 },
  { id: 2, ingredient_id: 2, ingredient_name: '猪肉', quantity: 8, unit: 'kg', expiry_date: '2026-07-12', received_date: '2026-07-08', batch_no: 'B20260708-002', days_until_expiry: 2 },
];

const mockLow: LowStockItem[] = [
  { ingredient_id: 6, ingredient_name: '葱', current_quantity: 2, unit: 'kg', warning_threshold: 5, deficit: 3 },
  { ingredient_id: 4, ingredient_name: '青菜', current_quantity: 5, unit: 'kg', warning_threshold: 8, deficit: 3 },
  { ingredient_id: 2, ingredient_name: '猪肉', current_quantity: 8, unit: 'kg', warning_threshold: 10, deficit: 2 },
];

// ============================================================
// API 函数
// ============================================================

export async function getInventory(): Promise<InventorySummary[]> {
  if (USE_MOCK) {
    await delay(300);
    return [...mockInventory];
  }
  return fetchApi<InventorySummary[]>('/inventory');
}

export async function getBatches(ingredient_id?: number, status?: string): Promise<InventoryBatch[]> {
  if (USE_MOCK) {
    await delay(300);
    let result = [...mockBatches];
    if (ingredient_id) result = result.filter(b => b.ingredient_id === ingredient_id);
    if (status) result = result.filter(b => b.status === status);
    return result;
  }
  const params = new URLSearchParams();
  if (ingredient_id) params.set('ingredient_id', String(ingredient_id));
  if (status) params.set('status', status);
  return fetchApi<InventoryBatch[]>(`/inventory/batches?${params.toString()}`);
}

export async function getExpiring(days: number = 3): Promise<ExpiringBatch[]> {
  if (USE_MOCK) {
    await delay(300);
    return [...mockExpiring];
  }
  return fetchApi<ExpiringBatch[]>(`/inventory/expiring?days=${days}`);
}

export async function getLow(): Promise<LowStockItem[]> {
  if (USE_MOCK) {
    await delay(300);
    return [...mockLow];
  }
  return fetchApi<LowStockItem[]>('/inventory/low');
}
