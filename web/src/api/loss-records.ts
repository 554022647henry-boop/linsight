import { fetchApi } from './config';

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

export async function getLossRecords(date: string): Promise<LossRecord[]> {
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  return fetchApi<LossRecord[]>(`/loss-records?${params.toString()}`);
}

export async function generateLossRecords(date: string): Promise<LossRecord[]> {
  return fetchApi<LossRecord[]>('/loss-records/generate', {
    method: 'POST',
    body: JSON.stringify({ date }),
  });
}
