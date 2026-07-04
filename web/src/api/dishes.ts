import { USE_MOCK, fetchApi } from './config';
import { mockDishes, delay } from './mock';
import { Dish, CreatedResponse } from '../types';

export async function getDishes(category?: string, is_active?: number): Promise<Dish[]> {
  if (USE_MOCK) {
    await delay(300);
    let result = [...mockDishes];
    if (category) {
      result = result.filter(d => d.category === category);
    }
    if (is_active !== undefined) {
      result = result.filter(d => d.is_active === is_active);
    }
    return result;
  }
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (is_active !== undefined) params.set('is_active', String(is_active));
  return fetchApi<Dish[]>(`/dishes?${params.toString()}`);
}

export async function getDish(id: number): Promise<Dish & { bom: any[] }> {
  if (USE_MOCK) {
    await delay(200);
    const dish = mockDishes.find(d => d.id === id);
    if (!dish) throw { error: 'not_found', message: 'Dish not found' };
    return { ...dish, bom: [] };
  }
  return fetchApi<Dish & { bom: any[] }>(`/dishes/${id}`);
}

export async function createDish(data: Omit<Dish, 'id' | 'created_at' | 'updated_at'>): Promise<CreatedResponse<Dish>> {
  if (USE_MOCK) {
    await delay(200);
    const newId = Math.max(...mockDishes.map(d => d.id)) + 1;
    const newDish: Dish = {
      ...data,
      id: newId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return { id: newId, data: newDish };
  }
  return fetchApi<CreatedResponse<Dish>>('/dishes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateDish(id: number, data: Partial<Omit<Dish, 'id' | 'created_at' | 'updated_at'>>): Promise<Dish> {
  if (USE_MOCK) {
    await delay(200);
    const dish = mockDishes.find(d => d.id === id);
    if (!dish) throw { error: 'not_found', message: 'Dish not found' };
    return { ...dish, ...data, updated_at: new Date().toISOString() };
  }
  return fetchApi<Dish>(`/dishes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function updateDishStatus(id: number, is_active: 0 | 1): Promise<Dish> {
  if (USE_MOCK) {
    await delay(200);
    const dish = mockDishes.find(d => d.id === id);
    if (!dish) throw { error: 'not_found', message: 'Dish not found' };
    return { ...dish, is_active, updated_at: new Date().toISOString() };
  }
  return fetchApi<Dish>(`/dishes/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active }),
  });
}

export async function deleteDish(id: number): Promise<{ message: string }> {
  if (USE_MOCK) {
    await delay(200);
    return { message: 'Dish deleted' };
  }
  return fetchApi<{ message: string }>(`/dishes/${id}`, {
    method: 'DELETE',
  });
}