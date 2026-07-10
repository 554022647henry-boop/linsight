import { fetchApi } from './config';

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

export interface PushChatLog {
  id: number;
  session_id: string;
  direction: string;
  message_type: string;
  content: string;
  ai_action: string | null;
  created_at: string;
}

export interface PushInsight {
  id: number;
  insight_type: string;
  related_date: string | null;
  content: string;
  suggestion: string | null;
  is_read: number;
  created_at: string;
}

export interface PushResult {
  report: DailyReport;
  chat_log: PushChatLog;
  insight: PushInsight;
}

export async function getDailyReport(date: string): Promise<DailyReport | null> {
  try {
    return await fetchApi<DailyReport>(`/daily-reports/${date}`);
  } catch (err) {
    if ((err as { error?: string })?.error === 'not_found') return null;
    throw err;
  }
}

export async function generateDailyReport(date: string): Promise<DailyReport> {
  return fetchApi<DailyReport>('/daily-reports/generate', {
    method: 'POST',
    body: JSON.stringify({ date }),
  });
}

export async function pushDailyReport(date: string): Promise<PushResult> {
  return fetchApi<PushResult>(`/daily-reports/${date}/push`, {
    method: 'POST',
  });
}
