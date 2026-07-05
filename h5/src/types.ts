// h5 端最小类型定义，与 server/src/types/index.ts 保持字段一致（蛇形）

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

export type OrderType = 'dine-in' | 'takeout' | 'quick';

export interface Order {
  id: number;
  order_no: string;
  type: OrderType;
  table_no: string | null;
  status: string;
  items_count: number;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  dish_id: number | null;
  dish_name: string;
  unit_price: number;
  quantity: number;
  amount: number;
  status: string;
  note: string | null;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

export interface CreatedOrderResponse {
  data: OrderWithItems;
  message: string;
}

export interface CreateOrderPayload {
  type: OrderType;
  table_no?: string;
  items: Array<{
    dish_id: number;
    quantity: number;
    note?: string;
  }>;
}

export interface ApiError {
  error: string;
  message: string;
  code?: string;
}
