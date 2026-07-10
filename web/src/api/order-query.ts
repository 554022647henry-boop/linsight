import { fetchApi } from './config';
import type { Order, OrderItem, Payment, OrderStatus } from '../types';

export interface OrderDetail extends Order {
  items: OrderItem[];
  payments: Payment[];
}

export interface OrderQueryParams {
  status?: OrderStatus;
  date_from?: string;
  date_to?: string;
  table_no?: string;
}

export async function queryOrders(params: OrderQueryParams): Promise<Order[]> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.date_from) qs.set('date_from', params.date_from);
  if (params.date_to) qs.set('date_to', params.date_to);
  if (params.table_no) qs.set('table_no', params.table_no);
  return fetchApi<Order[]>(`/orders?${qs.toString()}`);
}

export async function queryOrderDetail(id: number): Promise<OrderDetail> {
  return fetchApi<OrderDetail>(`/orders/${id}`);
}
