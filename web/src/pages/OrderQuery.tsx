import { useState, useEffect, Fragment } from 'react';
import { queryOrders, queryOrderDetail, type OrderDetail } from '../api/order-query';
import type { Order, OrderStatus } from '../types';

function errMsg(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message: unknown }).message;
    if (typeof msg === 'string' && msg) return msg;
  }
  return fallback;
}

const statusConfig: Record<OrderStatus, { label: string; className: string }> = {
  dining: { label: '就餐中', className: 'bg-orange-100 text-orange-700' },
  paid: { label: '已支付', className: 'bg-green-100 text-green-700' },
  cancelled: { label: '已取消', className: 'bg-gray-100 text-gray-600' },
  refunded: { label: '已退款', className: 'bg-red-100 text-red-700' },
};

const typeLabels: Record<string, string> = {
  'dine-in': '堂食',
  takeout: '外带',
  quick: '快餐',
};

const payLabels: Record<string, string> = {
  cash: '现金',
  wechat: '微信',
  alipay: '支付宝',
  aggregated: '聚合码',
};

export default function OrderQuery() {
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [status, setStatus] = useState<'' | OrderStatus>('');
  const [tableNo, setTableNo] = useState<string>('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    void loadOrders();
  }, []);

  async function loadOrders(): Promise<void> {
    setLoading(true);
    setError('');
    try {
      const data = await queryOrders({
        status: status === '' ? undefined : status,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        table_no: tableNo || undefined,
      });
      setOrders(data);
    } catch (err) {
      setError(errMsg(err, '查询订单失败'));
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleRowClick(orderId: number): Promise<void> {
    if (expandedId === orderId) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(orderId);
    setDetail(null);
    setDetailLoading(true);
    try {
      const d = await queryOrderDetail(orderId);
      setDetail(d);
    } catch (err) {
      setError(errMsg(err, '加载订单详情失败'));
    } finally {
      setDetailLoading(false);
    }
  }

  function handleSearch(): void {
    setExpandedId(null);
    setDetail(null);
    void loadOrders();
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <header className="bg-white shadow px-6 py-4">
        <h1 className="text-xl font-semibold text-gray-900">订单查询</h1>
      </header>

      <div className="flex-1 p-6 overflow-y-auto">
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">开始日期</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">结束日期</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">状态</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as '' | OrderStatus)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">全部</option>
                <option value="dining">就餐中</option>
                <option value="paid">已支付</option>
                <option value="cancelled">已取消</option>
                <option value="refunded">已退款</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">桌号</label>
              <input
                type="text"
                value={tableNo}
                onChange={e => setTableNo(e.target.value)}
                placeholder="如 A1"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 w-24"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              查询
            </button>
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : orders.length === 0 ? (
            <div className="py-12 text-center text-gray-400">无匹配订单</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">单号</th>
                  <th className="px-4 py-3 text-left font-medium">类型</th>
                  <th className="px-4 py-3 text-left font-medium">桌号</th>
                  <th className="px-4 py-3 text-left font-medium">状态</th>
                  <th className="px-4 py-3 text-right font-medium">菜品数</th>
                  <th className="px-4 py-3 text-right font-medium">金额</th>
                  <th className="px-4 py-3 text-left font-medium">支付方式</th>
                  <th className="px-4 py-3 text-left font-medium">时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map(o => {
                  const cfg = statusConfig[o.status];
                  const expanded = expandedId === o.id;
                  return (
                    <Fragment key={o.id}>
                      <tr
                        onClick={() => void handleRowClick(o.id)}
                        className={`cursor-pointer hover:bg-gray-50 ${expanded ? 'bg-blue-50' : ''}`}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">{o.order_no}</td>
                        <td className="px-4 py-3 text-gray-700">{typeLabels[o.type] || o.type}</td>
                        <td className="px-4 py-3 text-gray-700">{o.table_no || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>{cfg.label}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">{o.items_count}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">¥{o.total_amount.toFixed(2)}</td>
                        <td className="px-4 py-3 text-gray-700">{o.pay_method ? payLabels[o.pay_method] || o.pay_method : '—'}</td>
                        <td className="px-4 py-3 text-gray-500">{new Date(o.created_at).toLocaleString()}</td>
                      </tr>
                      {expanded && (
                        <tr key={`${o.id}-detail`} className="bg-gray-50">
                          <td colSpan={8} className="px-6 py-4">
                            {detailLoading ? (
                              <div className="flex items-center justify-center py-4">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                              </div>
                            ) : detail ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                  <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">菜品明细</h4>
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="text-gray-500">
                                        <th className="px-2 py-1 text-left font-medium">菜品</th>
                                        <th className="px-2 py-1 text-right font-medium">单价</th>
                                        <th className="px-2 py-1 text-right font-medium">数量</th>
                                        <th className="px-2 py-1 text-right font-medium">金额</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {detail.items.map(it => (
                                        <tr key={it.id} className={it.status === 'cancelled' ? 'text-gray-400 line-through' : ''}>
                                          <td className="px-2 py-1 text-gray-800">{it.dish_name}</td>
                                          <td className="px-2 py-1 text-right text-gray-600">¥{it.unit_price.toFixed(2)}</td>
                                          <td className="px-2 py-1 text-right text-gray-600">{it.quantity}</td>
                                          <td className="px-2 py-1 text-right text-gray-800">¥{it.amount.toFixed(2)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                  <div className="mt-2 text-right text-sm text-gray-700">
                                    小计 ¥{detail.subtotal.toFixed(2)}
                                    {detail.discount_amount > 0 && <span className="ml-2 text-red-500">优惠 -¥{detail.discount_amount.toFixed(2)}</span>}
                                    <span className="ml-2 font-bold text-blue-600">应收 ¥{detail.total_amount.toFixed(2)}</span>
                                  </div>
                                </div>
                                <div>
                                  <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">支付记录</h4>
                                  {detail.payments.length > 0 ? (
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="text-gray-500">
                                          <th className="px-2 py-1 text-left font-medium">方式</th>
                                          <th className="px-2 py-1 text-right font-medium">金额</th>
                                          <th className="px-2 py-1 text-left font-medium">交易号</th>
                                          <th className="px-2 py-1 text-left font-medium">状态</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {detail.payments.map(p => (
                                          <tr key={p.id}>
                                            <td className="px-2 py-1 text-gray-800">{payLabels[p.method] || p.method}</td>
                                            <td className="px-2 py-1 text-right text-gray-800">¥{p.amount.toFixed(2)}</td>
                                            <td className="px-2 py-1 text-gray-500">{p.transaction_id || '—'}</td>
                                            <td className="px-2 py-1 text-gray-600">{p.status}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  ) : (
                                    <p className="text-sm text-gray-400">无支付记录</p>
                                  )}
                                  {detail.note && (
                                    <p className="mt-3 text-sm text-gray-600">备注：{detail.note}</p>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-400">加载详情失败</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
