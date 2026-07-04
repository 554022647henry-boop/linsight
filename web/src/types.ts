export interface Dish {
  id: number;
  name: string;
  category: string;
  price: number;
  image_url: string | null;
  cost_estimate: number | null;
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

export interface RestaurantTable {
  id: number;
  table_no: string;
  capacity: number;
  status: TableStatus;
  qrcode_path: string | null;
  created_at: string;
}

export type TableStatus = 'idle' | 'occupied' | 'reserved';

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

export type OrderType = 'dine-in' | 'takeout' | 'quick';

export type OrderStatus = 'dining' | 'paid' | 'cancelled' | 'refunded';

export interface OrderItem {
  id: number;
  order_id: number;
  dish_id: number;
  dish_name: string;
  unit_price: number;
  quantity: number;
  discount: number;
  amount: number;
  status: OrderItemStatus;
  note: string | null;
  created_at: string;
}

export type OrderItemStatus = 'ordered' | 'served' | 'cancelled';

export interface Payment {
  id: number;
  order_id: number;
  amount: number;
  method: PayMethod;
  transaction_id: string | null;
  status: PaymentStatus;
  paid_at: string | null;
  created_at: string;
}

export type PayMethod = 'cash' | 'wechat' | 'alipay' | 'aggregated' | 'mixed';

export type PaymentStatus = 'success' | 'pending' | 'failed';

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface CreatedResponse<T> {
  id: number;
  data: T;
}

export interface ApiError {
  error: string;
  message: string;
  code?: string;
}

export interface OrderDraftItem {
  dish: Dish;
  quantity: number;
  note: string;
}

export interface CheckoutRequest {
  discount_amount?: number;
  discount_type?: string;
  pay_method: PayMethod;
  paid_amount: number;
  note?: string;
}