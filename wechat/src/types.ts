/**
 * Linsight 老板微信端类型
 * 字段与 server/src/types/index.ts 严格一致（蛇形），从 CONTRACT.md 抄录
 */

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

export interface ChatSession {
  session_id: string;
  last_message: string;
  last_time: string;
}

export interface SendMessageRequest {
  session_id: string;
  message_type: ChatMessageType;
  content: string;
}

export interface SendMessageResponse {
  received: ChatLog;
  ai_replies: ChatLog[];
}

/** 卡片消息体（content 字段为 card 时是 JSON 字符串） */
export interface CardPayload {
  type: 'purchase_order_preview' | 'daily_report' | string;
  message?: string;
  date?: string;
  revenue?: number;
  gross_profit?: number;
  gross_margin?: number;
  net_profit?: number;
  customer_count?: number;
  avg_transaction?: number;
  summary?: string;
  suggestion?: string;
  items?: Array<{ name: string; quantity: number; unit: string; amount: number }>;
  [key: string]: unknown;
}

export interface TopDish {
  dish_id: number;
  dish_name: string;
  sold_count: number;
  revenue: number;
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
  top_dishes: TopDish[] | null;
  dish_profit_detail: DishProfitDetail[] | null;
  reconcile_diff_amount: number;
  ai_summary: string | null;
  ai_suggestion: string | null;
  created_at: string;
}

export interface PushReportResponse {
  report: DailyReport;
  chat_log: ChatLog;
  insight: {
    id: number;
    insight_type: string;
    related_date: string | null;
    content: string;
    suggestion: string | null;
    is_read: 0 | 1;
    created_at: string;
  };
}

export interface ApiError {
  error: string;
  message: string;
  code?: string;
}
