import { request } from './client';
import type {
  CreateOrderPayload,
  CreatedOrderResponse,
  OrderWithItems,
} from '../types';

export function createOrder(
  payload: CreateOrderPayload,
): Promise<CreatedOrderResponse> {
  return request<CreatedOrderResponse>('/api/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getOrder(id: number): Promise<OrderWithItems> {
  return request<OrderWithItems>(`/api/orders/${id}`);
}
