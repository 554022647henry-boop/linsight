import { USE_MOCK, fetchApi } from './config';
import { mockTables, delay } from './mock';
import { RestaurantTable, CreatedResponse, TableStatus } from '../types';

export async function getTables(): Promise<RestaurantTable[]> {
  if (USE_MOCK) {
    await delay(200);
    return [...mockTables];
  }
  return fetchApi<RestaurantTable[]>('/tables');
}

export async function getTable(id: number): Promise<RestaurantTable> {
  if (USE_MOCK) {
    await delay(100);
    return mockTables.find(t => t.id === id) || {} as RestaurantTable;
  }
  return fetchApi<RestaurantTable>(`/tables/${id}`);
}

export async function createTable(data: { table_no: string; capacity?: number; qrcode_path?: string }): Promise<CreatedResponse<RestaurantTable>> {
  if (USE_MOCK) {
    await delay(200);
    const newId = Math.max(...mockTables.map(t => t.id)) + 1;
    const newTable: RestaurantTable = {
      ...data,
      id: newId,
      capacity: data.capacity || 4,
      status: 'idle',
      qrcode_path: data.qrcode_path || null,
      created_at: new Date().toISOString(),
    };
    return { id: newId, data: newTable };
  }
  return fetchApi<CreatedResponse<RestaurantTable>>('/tables', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateTable(id: number, data: Partial<Omit<RestaurantTable, 'id' | 'created_at'>>): Promise<RestaurantTable> {
  if (USE_MOCK) {
    await delay(200);
    const table = mockTables.find(t => t.id === id);
    if (!table) throw { error: 'not_found', message: 'Table not found' };
    return { ...table, ...data };
  }
  return fetchApi<RestaurantTable>(`/tables/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function updateTableStatus(id: number, status: TableStatus): Promise<RestaurantTable> {
  if (USE_MOCK) {
    await delay(200);
    const table = mockTables.find(t => t.id === id);
    if (!table) throw { error: 'not_found', message: 'Table not found' };
    return { ...table, status };
  }
  return fetchApi<RestaurantTable>(`/tables/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function deleteTable(id: number): Promise<{ message: string }> {
  if (USE_MOCK) {
    await delay(200);
    return { message: 'Table deleted' };
  }
  return fetchApi<{ message: string }>(`/tables/${id}`, {
    method: 'DELETE',
  });
}