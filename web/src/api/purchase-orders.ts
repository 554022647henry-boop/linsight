import { USE_MOCK, fetchApi } from './config';
import { delay } from './mock';

// ============================================================
// 类型定义（内联，不碰共享 types.ts）
// ============================================================

export type PurchaseSourceType = 'image' | 'voice' | 'text' | 'manual';
export type PurchaseStatus = 'pending' | 'confirmed' | 'cancelled';

/** 采购单主表 */
export interface PurchaseOrder {
  id: number;
  order_no: string;
  supplier_id: number | null;
  supplier_name: string | null;
  total_amount: number;
  source_type: PurchaseSourceType;
  source_file_path: string | null;
  ai_raw_text: string | null;
  status: PurchaseStatus;
  note: string | null;
  operator: string | null;
  created_at: string;
  confirmed_at: string | null;
}

/** 采购明细项 */
export interface PurchaseItem {
  id: number;
  order_id: number;
  ingredient_id: number | null;
  ingredient_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  amount: number;
  ai_confidence: number;
  created_at: string;
}

/** 采购单详情（含明细） */
export interface PurchaseOrderDetail extends PurchaseOrder {
  items: PurchaseItem[];
}

/** AI 识别异常项 */
export interface PurchaseAnomaly {
  item_id: number;
  type: string;
  message: string;
}

/** POST /purchase-orders/recognize 返回 */
export interface RecognizeResult {
  pending_order: PurchaseOrderDetail;
  anomalies: PurchaseAnomaly[];
}

// ============================================================
// Mock 数据
// ============================================================

const now = new Date().toISOString();
const today = now.split('T')[0];

const mockPurchaseOrders: PurchaseOrder[] = [
  { id: 1, order_no: 'PO20260708-001', supplier_id: 1, supplier_name: '张老板肉铺', total_amount: 945, source_type: 'image', source_file_path: null, ai_raw_text: null, status: 'confirmed', note: null, operator: '老板', created_at: '2026-07-08T09:30:00Z', confirmed_at: '2026-07-08T09:35:00Z' },
  { id: 2, order_no: 'PO20260708-002', supplier_id: 2, supplier_name: '李姐菜行', total_amount: 215, source_type: 'voice', source_file_path: null, ai_raw_text: '今天从李姐那进了30斤青菜4块5，10斤葱6块', status: 'pending', note: null, operator: null, created_at: '2026-07-08T14:00:00Z', confirmed_at: null },
  { id: 3, order_no: 'PO20260707-001', supplier_id: null, supplier_name: 'AI识别供应商', total_amount: 845, source_type: 'text', source_file_path: null, ai_raw_text: '进货单：牛肉15kg×42，猪肉10kg×28，鸡蛋100个×0.8', status: 'pending', note: 'AI识别待确认', operator: null, created_at: '2026-07-07T16:00:00Z', confirmed_at: null },
  { id: 4, order_no: 'PO20260706-001', supplier_id: 3, supplier_name: '王记粮油', total_amount: 600, source_type: 'manual', source_file_path: null, ai_raw_text: null, status: 'cancelled', note: '重复下单', operator: '老板', created_at: '2026-07-06T10:00:00Z', confirmed_at: null },
];

const mockPurchaseItems: PurchaseItem[] = [
  { id: 1, order_id: 1, ingredient_id: 1, ingredient_name: '牛肉', quantity: 15, unit: 'kg', unit_price: 42, amount: 630, ai_confidence: 0.95, created_at: '2026-07-08T09:30:00Z' },
  { id: 2, order_id: 1, ingredient_id: 2, ingredient_name: '猪肉', quantity: 10, unit: 'kg', unit_price: 28, amount: 280, ai_confidence: 0.92, created_at: '2026-07-08T09:30:00Z' },
  { id: 3, order_id: 1, ingredient_id: 3, ingredient_name: '鸡蛋', quantity: 35, unit: '个', unit_price: 1, amount: 35, ai_confidence: 0.88, created_at: '2026-07-08T09:30:00Z' },
  { id: 4, order_id: 2, ingredient_id: 4, ingredient_name: '青菜', quantity: 30, unit: 'kg', unit_price: 4.5, amount: 135, ai_confidence: 0.93, created_at: '2026-07-08T14:00:00Z' },
  { id: 5, order_id: 2, ingredient_id: 6, ingredient_name: '葱', quantity: 10, unit: 'kg', unit_price: 8, amount: 80, ai_confidence: 0.85, created_at: '2026-07-08T14:00:00Z' },
  { id: 6, order_id: 3, ingredient_id: 1, ingredient_name: '牛肉', quantity: 15, unit: 'kg', unit_price: 42, amount: 630, ai_confidence: 0.9, created_at: '2026-07-07T16:00:00Z' },
  { id: 7, order_id: 3, ingredient_id: 2, ingredient_name: '猪肉', quantity: 10, unit: 'kg', unit_price: 28, amount: 280, ai_confidence: 0.88, created_at: '2026-07-07T16:00:00Z' },
  { id: 8, order_id: 3, ingredient_id: 3, ingredient_name: '鸡蛋', quantity: 100, unit: '个', unit_price: 0.8, amount: 80, ai_confidence: 0.82, created_at: '2026-07-07T16:00:00Z' },
];

// ============================================================
// API 函数
// ============================================================

export async function getPurchaseOrders(
  status?: PurchaseStatus,
  supplier_id?: number,
  date_from?: string,
  date_to?: string,
): Promise<PurchaseOrder[]> {
  if (USE_MOCK) {
    await delay(300);
    let result = [...mockPurchaseOrders];
    if (status) result = result.filter(o => o.status === status);
    if (supplier_id) result = result.filter(o => o.supplier_id === supplier_id);
    if (date_from) result = result.filter(o => o.created_at >= date_from);
    if (date_to) result = result.filter(o => o.created_at <= date_to + 'T23:59:59Z');
    return result;
  }
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (supplier_id) params.set('supplier_id', String(supplier_id));
  if (date_from) params.set('date_from', date_from);
  if (date_to) params.set('date_to', date_to);
  return fetchApi<PurchaseOrder[]>(`/purchase-orders?${params.toString()}`);
}

export async function getPurchaseOrder(id: number): Promise<PurchaseOrderDetail> {
  if (USE_MOCK) {
    await delay(200);
    const order = mockPurchaseOrders.find(o => o.id === id);
    if (!order) throw { error: 'not_found', message: 'Purchase order not found' };
    const items = mockPurchaseItems.filter(i => i.order_id === id);
    return { ...order, items };
  }
  return fetchApi<PurchaseOrderDetail>(`/purchase-orders/${id}`);
}

export async function confirmPurchaseOrder(
  id: number,
  modifications?: Array<{ item_id: number; quantity?: number; unit_price?: number }>,
): Promise<PurchaseOrderDetail> {
  if (USE_MOCK) {
    await delay(300);
    const order = mockPurchaseOrders.find(o => o.id === id);
    if (!order) throw { error: 'not_found', message: 'Purchase order not found' };
    const updated = { ...order, status: 'confirmed' as PurchaseStatus, confirmed_at: new Date().toISOString() };
    const idx = mockPurchaseOrders.findIndex(o => o.id === id);
    mockPurchaseOrders[idx] = updated;
    const items = mockPurchaseItems.filter(i => i.order_id === id);
    return { ...updated, items };
  }
  return fetchApi<PurchaseOrderDetail>(`/purchase-orders/${id}/confirm`, {
    method: 'PATCH',
    body: JSON.stringify({ modifications }),
  });
}

export async function cancelPurchaseOrder(id: number): Promise<PurchaseOrder> {
  if (USE_MOCK) {
    await delay(200);
    const order = mockPurchaseOrders.find(o => o.id === id);
    if (!order) throw { error: 'not_found', message: 'Purchase order not found' };
    const updated = { ...order, status: 'cancelled' as PurchaseStatus };
    const idx = mockPurchaseOrders.findIndex(o => o.id === id);
    mockPurchaseOrders[idx] = updated;
    return updated;
  }
  return fetchApi<PurchaseOrder>(`/purchase-orders/${id}/cancel`, {
    method: 'PATCH',
    body: JSON.stringify({}),
  });
}

export async function recognizePurchaseOrder(
  source_type: PurchaseSourceType,
  content: string,
): Promise<RecognizeResult> {
  if (USE_MOCK) {
    await delay(500);
    const newId = Math.max(...mockPurchaseOrders.map(o => o.id)) + 1;
    const orderNo = `PO${today.replace(/-/g, '')}-${String(newId).padStart(3, '0')}`;
    const items: PurchaseItem[] = [
      { id: 1, order_id: newId, ingredient_id: null, ingredient_name: '牛肉', quantity: 15, unit: 'kg', unit_price: 42, amount: 630, ai_confidence: 0.95, created_at: now },
      { id: 2, order_id: newId, ingredient_id: null, ingredient_name: '青菜', quantity: 30, unit: 'kg', unit_price: 4.5, amount: 135, ai_confidence: 0.92, created_at: now },
      { id: 3, order_id: newId, ingredient_id: null, ingredient_name: '鸡蛋', quantity: 100, unit: '个', unit_price: 0.8, amount: 80, ai_confidence: 0.68, created_at: now },
    ];
    const totalAmount = items.reduce((sum, i) => sum + i.amount, 0);
    const pendingOrder: PurchaseOrderDetail = {
      id: newId,
      order_no: orderNo,
      supplier_id: null,
      supplier_name: 'AI识别供应商',
      total_amount: totalAmount,
      source_type,
      source_file_path: null,
      ai_raw_text: content,
      status: 'pending',
      note: null,
      operator: null,
      created_at: now,
      confirmed_at: null,
      items,
    };
    return {
      pending_order: pendingOrder,
      anomalies: [
        { item_id: 1, type: 'price', message: '牛肉单价 42 元/kg，比上周均价高 8%' },
        { item_id: 3, type: 'confidence', message: '鸡蛋置信度 0.68，建议确认数量' },
      ],
    };
  }
  return fetchApi<RecognizeResult>('/purchase-orders/recognize', {
    method: 'POST',
    body: JSON.stringify({ source_type, content }),
  });
}
