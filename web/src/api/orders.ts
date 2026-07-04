import { USE_MOCK, fetchApi } from './config';
import { mockOrders, mockOrderItems, delay } from './mock';
import { Order, OrderItem, CreatedResponse, OrderType, OrderStatus, OrderItemStatus, CheckoutRequest } from '../types';

export async function getOrders(status?: OrderStatus, date?: string, date_from?: string, date_to?: string, table_no?: string): Promise<Order[]> {
  if (USE_MOCK) {
    await delay(300);
    let result = [...mockOrders];
    if (status) result = result.filter(o => o.status === status);
    if (table_no) result = result.filter(o => o.table_no === table_no);
    return result;
  }
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (date) params.set('date', date);
  if (date_from) params.set('date_from', date_from);
  if (date_to) params.set('date_to', date_to);
  if (table_no) params.set('table_no', table_no);
  return fetchApi<Order[]>(`/orders?${params.toString()}`);
}

export async function getOrder(id: number): Promise<Order & { items: OrderItem[]; payments: any[] }> {
  if (USE_MOCK) {
    await delay(200);
    const order = mockOrders.find(o => o.id === id);
    if (!order) throw { error: 'not_found', message: 'Order not found' };
    const items = mockOrderItems.filter(i => i.order_id === id);
    return { ...order, items, payments: [] };
  }
  return fetchApi<Order & { items: OrderItem[]; payments: any[] }>(`/orders/${id}`);
}

export async function createOrder(data: { type: OrderType; table_no?: string; items: Array<{ dish_id: number; quantity: number; note?: string }> }): Promise<CreatedResponse<Order>> {
  if (USE_MOCK) {
    await delay(300);
    const newId = Math.max(...mockOrders.map(o => o.id)) + 1;
    const now = new Date();
    const orderNo = `OD${now.toISOString().slice(0, 10).replace(/-/g, '')}-${String(newId).padStart(3, '0')}`;
    
    const subtotal = data.items.reduce((sum, item) => sum + 20 * item.quantity, 0);
    
    const newOrder: Order = {
      id: newId,
      order_no: orderNo,
      type: data.type,
      table_no: data.table_no || null,
      status: 'dining',
      items_count: data.items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal,
      discount_amount: 0,
      total_amount: subtotal,
      paid_amount: 0,
      pay_method: null,
      pay_time: null,
      note: null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    return { id: newId, data: newOrder };
  }
  return fetchApi<CreatedResponse<Order>>('/orders', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function addOrderItems(id: number, items: Array<{ dish_id: number; quantity: number; note?: string }>): Promise<Order> {
  if (USE_MOCK) {
    await delay(200);
    const order = mockOrders.find(o => o.id === id);
    if (!order) throw { error: 'not_found', message: 'Order not found' };
    return { ...order, items_count: order.items_count + items.reduce((sum, i) => sum + i.quantity, 0) };
  }
  return fetchApi<Order>(`/orders/${id}/items`, {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
}

export async function updateOrderItem(orderId: number, itemId: number, data: { status?: OrderItemStatus; note?: string }): Promise<OrderItem> {
  if (USE_MOCK) {
    await delay(200);
    const item = mockOrderItems.find(i => i.id === itemId && i.order_id === orderId);
    if (!item) throw { error: 'not_found', message: 'Order item not found' };
    return { ...item, ...data } as OrderItem;
  }
  return fetchApi<OrderItem>(`/orders/${orderId}/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function checkoutOrder(id: number, data: CheckoutRequest): Promise<Order> {
  if (USE_MOCK) {
    await delay(300);
    const order = mockOrders.find(o => o.id === id);
    if (!order) throw { error: 'not_found', message: 'Order not found' };
    return {
      ...order,
      discount_amount: data.discount_amount || 0,
      total_amount: order.subtotal - (data.discount_amount || 0),
      paid_amount: data.paid_amount,
      pay_method: data.pay_method,
      pay_time: new Date().toISOString(),
      status: 'paid',
      updated_at: new Date().toISOString(),
    };
  }
  return fetchApi<Order>(`/orders/${id}/checkout`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function refundOrder(id: number, data: { amount?: number; reason: string }): Promise<Order> {
  if (USE_MOCK) {
    await delay(200);
    const order = mockOrders.find(o => o.id === id);
    if (!order) throw { error: 'not_found', message: 'Order not found' };
    return { ...order, status: 'refunded', updated_at: new Date().toISOString() };
  }
  return fetchApi<Order>(`/orders/${id}/refund`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getDailySummary(date?: string): Promise<{ revenue: number; orders_count: number; by_method: Record<string, number> }> {
  if (USE_MOCK) {
    await delay(200);
    return {
      revenue: 5200,
      orders_count: 45,
      by_method: {
        wechat: 3200,
        alipay: 1500,
        cash: 500,
      },
    };
  }
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  return fetchApi<{ revenue: number; orders_count: number; by_method: Record<string, number> }>(`/orders/daily-summary?${params.toString()}`);
}