import { useState, useEffect } from 'react';
import { Order, PayMethod } from '../types';
import { getOrders } from '../api/orders';
import { refundOrder } from '../api/refund';

function errMsg(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message: unknown }).message;
    if (typeof msg === 'string' && msg) return msg;
  }
  return fallback;
}

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const payMethodLabels: Record<PayMethod, string> = {
  cash: '现金',
  wechat: '微信支付',
  alipay: '支付宝',
  aggregated: '聚合码',
  mixed: '混合支付',
};

interface RefundForm {
  amount: string;
  reason: string;
}

export default function Refund() {
  const [paidOrders, setPaidOrders] = useState<Order[]>([]);
  const [refundedOrders, setRefundedOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refundTarget, setRefundTarget] = useState<Order | null>(null);
  const [form, setForm] = useState<RefundForm>({ amount: '', reason: '' });
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [formError, setFormError] = useState<string>('');

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData(): Promise<void> {
    setLoading(true);
    setError('');
    try {
      const [paid, refunded] = await Promise.all([
        getOrders('paid'),
        getOrders('refunded'),
      ]);
      setPaidOrders(paid);
      setRefundedOrders(refunded);
    } catch (err) {
      setError(errMsg(err, '加载订单失败'));
    } finally {
      setLoading(false);
    }
  }

  const today = todayStr();
  const todayRefunds = refundedOrders.filter(o => o.updated_at.slice(0, 10) === today);
  const todayRefundTotal = todayRefunds.reduce((sum, o) => sum + o.paid_amount, 0);

  function openRefund(order: Order): void {
    setRefundTarget(order);
    setForm({ amount: String(order.paid_amount), reason: '' });
    setFormError('');
  }

  async function handleRefund(): Promise<void> {
    if (!refundTarget) return;
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) {
      setFormError('请输入有效的退款金额');
      return;
    }
    if (amount > refundTarget.paid_amount) {
      setFormError(`退款金额不能超过已付 ¥${refundTarget.paid_amount.toFixed(2)}`);
      return;
    }
    if (!form.reason.trim()) {
      setFormError('请输入退款原因');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      await refundOrder(refundTarget.id, amount, form.reason.trim());
      const refunded: Order = {
        ...refundTarget,
        status: 'refunded',
        updated_at: new Date().toISOString(),
      };
      setPaidOrders(prev => prev.filter(o => o.id !== refundTarget.id));
      setRefundedOrders(prev => [refunded, ...prev]);
      setRefundTarget(null);
    } catch (err) {
      setFormError(errMsg(err, '退款失败'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <header className="bg-white shadow px-6 py-4">
        <h1 className="text-xl font-semibold text-gray-900">退款管理</h1>
      </header>

      <div className="flex-1 p-6 overflow-y-auto">
        {error && (
          <div className="bg-red-50 text-red-600 rounded-lg px-4 py-2 mb-4 text-sm">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">当日退款总额</p>
            <p className="text-2xl font-bold text-red-600">¥{todayRefundTotal.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">当日退款笔数</p>
            <p className="text-2xl font-bold text-gray-900">{todayRefunds.length}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-4 border-b">
            <h3 className="text-sm font-medium text-gray-700">可退款订单（已支付）</h3>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : paidOrders.length === 0 ? (
            <div className="py-12 text-center text-gray-400">暂无可退款订单</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {paidOrders.map(order => (
                <div key={order.id} className="p-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{order.order_no}</span>
                      <span className="text-sm text-gray-500">{order.table_no || '外带'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span className="font-medium text-gray-700">¥{order.total_amount.toFixed(2)}</span>
                      <span>·</span>
                      <span>{order.pay_method ? payMethodLabels[order.pay_method] : '—'}</span>
                      <span>·</span>
                      <span>{new Date(order.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => openRefund(order)}
                    className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 font-medium shrink-0 ml-4"
                  >
                    退款
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {refundedOrders.length > 0 && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h3 className="text-sm font-medium text-gray-700">退款记录</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {refundedOrders.map(order => (
                <div key={order.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-700">{order.order_no}</span>
                    <span className="text-sm text-gray-400">{order.table_no || '外带'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500">¥{order.paid_amount.toFixed(2)}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                      已退款
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {refundTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold">订单退款</h3>
              <button onClick={() => setRefundTarget(null)} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">单号</span>
                  <span className="font-medium">{refundTarget.order_no}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">桌号</span>
                  <span className="font-medium">{refundTarget.table_no || '外带'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">已付金额</span>
                  <span className="font-medium">¥{refundTarget.paid_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">支付方式</span>
                  <span className="font-medium">
                    {refundTarget.pay_method ? payMethodLabels[refundTarget.pay_method] : '—'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">退款金额</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">默认全额退款，可修改为部分退款</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">退款原因</label>
                <textarea
                  value={form.reason}
                  onChange={e => setForm({ ...form, reason: e.target.value })}
                  placeholder="请输入退款原因"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {formError && <p className="text-sm text-red-600">{formError}</p>}

              <div className="flex gap-3">
                <button
                  onClick={() => setRefundTarget(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={() => void handleRefund()}
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {submitting ? '处理中...' : '确认退款'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
