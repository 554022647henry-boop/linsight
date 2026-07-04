/**
 * Linsight 共享类型层
 * 单一事实源：与 schema.sql / CONTRACT.md 严格 1:1
 * 命名：TS 类型大驼峰（Dish, PurchaseOrder），字段与 SQL 列名一致（蛇形）
 * 任何改动必须同步三处
 */

// ============================================================
// 1. 主数据表
// ============================================================

export interface Dish {
  id: number;
  name: string;
  category: string;
  price: number;
  image_url: string | null;
  cost_estimate: number;
  is_active: 0 | 1;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Ingredient {
  id: number;
  name: string;
  category: string;
  unit: string;
  warning_threshold: number;
  created_at: string;
  updated_at: string;
}

export interface DishIngredient {
  id: number;
  dish_id: number;
  ingredient_id: number;
  quantity: number;
  unit: string;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: number;
  name: string;
  contact: string | null;
  phone: string | null;
  note: string | null;
  created_at: string;
}

export type TableStatus = 'idle' | 'occupied' | 'reserved';

export interface RestaurantTable {
  id: number;
  table_no: string;
  capacity: number;
  status: TableStatus;
  qrcode_path: string | null;
  created_at: string;
}

// ============================================================
// 2. 采购入库表
// ============================================================

export type PurchaseSourceType = 'image' | 'voice' | 'text' | 'manual';
export type PurchaseStatus = 'pending' | 'confirmed' | 'cancelled';

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

// ============================================================
// 3. 库存表
// ============================================================

export type InventoryStatus = 'active' | 'consumed' | 'expired';

export interface InventoryBatch {
  id: number;
  ingredient_id: number;
  quantity: number;
  unit: string;
  batch_no: string | null;
  purchase_order_id: number | null;
  expiry_date: string | null;
  received_date: string;
  status: InventoryStatus;
  created_at: string;
  updated_at: string;
}

// ============================================================
// 4. 收银点餐表
// ============================================================

export type OrderType = 'dine-in' | 'takeout' | 'quick';
export type OrderStatus = 'dining' | 'paid' | 'cancelled' | 'refunded';
export type PayMethod = 'cash' | 'wechat' | 'alipay' | 'aggregated';

export interface Order {
  id: number;
  order_no: string;
  type: OrderType;
  table_no: string | null;
  status: OrderStatus;
  items_count: number;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  pay_method: PayMethod | null;
  pay_time: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export type OrderItemStatus = 'ordered' | 'served' | 'cancelled';

export interface OrderItem {
  id: number;
  order_id: number;
  dish_id: number | null;
  dish_name: string;
  unit_price: number;
  quantity: number;
  discount: number;
  amount: number;
  status: OrderItemStatus;
  note: string | null;
  created_at: string;
}

export type PaymentStatus = 'success' | 'pending' | 'failed';

export interface Payment {
  id: number;
  order_id: number;
  amount: number;
  method: PayMethod;
  transaction_id: string | null;
  status: PaymentStatus;
  paid_at: string;
  created_at: string;
}

// ============================================================
// 5. AI 与洞察表
// ============================================================

export type ChatDirection = 'incoming' | 'outgoing';
export type ChatMessageType = 'text' | 'image' | 'voice' | 'card';

export interface ChatLog {
  id: number;
  session_id: string;
  direction: ChatDirection;
  message_type: ChatMessageType;
  content: string;
  ai_action: string | null;
  created_at: string;
}

export interface DishProfitDetail {
  dish_id: number;
  dish_name: string;
  sold_count: number;
  revenue: number;
  food_cost: number;
  allocated_cost: number;
  net_profit: number;
  margin: number;
}

export interface TopDish {
  dish_id: number;
  dish_name: string;
  sold_count: number;
  revenue: number;
}

export interface DailyReport {
  id: number;
  report_date: string;
  revenue: number;
  food_cost: number;
  labor_cost: number;
  loss_amount: number;
  total_cost: number;
  gross_profit: number;
  gross_margin: number;
  net_profit: number;
  customer_count: number;
  avg_transaction: number;
  top_dishes: TopDish[] | null; // JSON
  dish_profit_detail: DishProfitDetail[] | null; // JSON
  reconcile_diff_amount: number;
  ai_summary: string | null;
  ai_suggestion: string | null;
  created_at: string;
}

export interface LossRecord {
  id: number;
  record_date: string;
  ingredient_id: number | null;
  ingredient_name: string;
  theoretical_consumption: number;
  actual_consumption: number;
  diff: number;
  diff_amount: number;
  ai_analysis: string | null;
  created_at: string;
}

export type InsightType =
  | 'daily_report'
  | 'loss_warning'
  | 'price_alert'
  | 'expiry_alert'
  | 'reconcile_alert';

export interface AiInsight {
  id: number;
  insight_type: InsightType;
  related_date: string | null;
  content: string;
  suggestion: string | null;
  is_read: 0 | 1;
  created_at: string;
}

export type InventoryCheckSource = 'voice' | 'text' | 'manual';

export interface InventoryCheck {
  id: number;
  check_date: string;
  ingredient_id: number | null;
  ingredient_name: string;
  theoretical_remaining: number;
  actual_remaining: number;
  diff: number;
  diff_amount: number;
  source: InventoryCheckSource;
  ai_note: string | null;
  created_at: string;
}

// ============================================================
// 6. API 通用类型
// ============================================================

export interface ApiError {
  error: string;
  message: string;
  code?: string;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface CreatedResponse<T> {
  data: T;
  message: string;
}
