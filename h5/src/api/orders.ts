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

export interface CheckoutParams {
  pay_method: 'cash' | 'wechat' | 'alipay' | 'aggregated';
  paid_amount: number;
  discount_amount?: number;
  discount_type?: string;
  note?: string;
}

export function checkoutOrder(
  orderId: number,
  params: CheckoutParams,
): Promise<OrderWithItems> {
  return request<OrderWithItems>(`/api/orders/${orderId}/checkout`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function getOrderDetail(orderId: number): Promise<OrderWithItems> {
  return request<OrderWithItems>(`/api/orders/${orderId}`);
}
