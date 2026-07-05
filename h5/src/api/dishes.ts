import { request } from './client';
import type { Dish } from '../types';

export function getDishes(category?: string): Promise<Dish[]> {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  params.set('is_active', '1');
  const qs = params.toString();
  return request<Dish[]>(`/api/dishes${qs ? `?${qs}` : ''}`);
}

export function getDish(id: number): Promise<Dish> {
  return request<Dish>(`/api/dishes/${id}`);
}
