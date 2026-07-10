import { USE_MOCK, fetchApi } from './config';
import { mockOrders, delay } from './mock';
import { Order } from '../types';

export async function refundOrder(orderId: number, amount: number, reason: string): Promise<Order> {
  if (USE_MOCK) {
    await delay(200);
    const order = mockOrders.find(o => o.id === orderId);
    if (!order) throw { error: 'not_found', message: 'Order not found' };
    return {
      ...order,
      status: 'refunded',
      note: `退款 ¥${amount.toFixed(2)}：${reason}`,
      updated_at: new Date().toISOString(),
    };
  }
  return fetchApi<Order>(`/orders/${orderId}/refund`, {
    method: 'POST',
    body: JSON.stringify({ amount, reason }),
  });
}
