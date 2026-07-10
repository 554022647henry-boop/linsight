import { useState, useEffect } from 'react';
import { Order, OrderStatus } from '../types';
import { getOrders, getDailySummary } from '../api/orders';
import { generateDailyReport } from '../api/reports';

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

interface DailySummaryData {
  revenue: number;
  orders_count: number;
  by_method: Record<string, number>;
}

const payMethodLabels: Record<string, string> = {
  cash: '现金',
  wechat: '微信支付',
  alipay: '支付宝',
  aggregated: '聚合码',
};

const payMethodColors: Record<string, string> = {
  cash: 'bg-green-500',
  wechat: 'bg-green-600',
  alipay: 'bg-blue-500',
  aggregated: 'bg-purple-500',
};

const orderStatusConfig: Record<OrderStatus, { label: string; className: string }> = {
  dining: { label: '就餐中', className: 'bg-orange-100 text-orange-700' },
  paid: { label: '已支付', className: 'bg-green-100 text-green-700' },
  cancelled: { label: '已取消', className: 'bg-gray-100 text-gray-600' },
  refunded: { label: '已退款', className: 'bg-red-100 text-red-700' },
};

export default function DailyClose() {
  const [date, setDate] = useState<string>(todayStr());
  const [summary, setSummary] = useState<DailySummaryData | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    void loadData(date);
  }, [date]);

  async function loadData(d: string): Promise<void> {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const [s, o] = await Promise.all([
        getDailySummary(d),
        getOrders(undefined, d),
      ]);
      setSummary(s);
      setOrders(o);
    } catch (err) {
      setError(errMsg(err, '加载日结数据失败'));
      setSummary(null);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate(): Promise<void> {
    setGenerating(true);
    setError('');
    setMessage('');
    try {
      await generateDailyReport(date);
      setMessage('经营日报已生成，可前往「经营日报」查看详情');
    } catch (err) {
      setError(errMsg(err, '生成日报失败'));
    } finally {
      setGenerating(false);
    }
  }

  const methodEntries = summary
    ? Object.entries(summary.by_method)
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
    : [];
  const methodTotal = methodEntries.reduce((sum, [, v]) => sum + v, 0);

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <header className="bg-white shadow px-6 py-4">
        <h1 className="text-xl font-semibold text-gray-900">日结</h1>
      </header>

      <div className="flex-1 p-6 overflow-y-auto">
        <div className="bg-white rounded-lg shadow p-4 mb-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">日期</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => void handleGenerate()}
            disabled={generating}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {generating ? '生成中...' : '生成经营日报'}
          </button>
          {message && <span className="text-sm text-green-600">{message}</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : !summary ? (
          <div className="bg-white rounded-lg shadow py-16 text-center">
            <div className="text-5xl mb-3">📊</div>
            <p className="text-gray-500">暂无日结数据</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-500">订单数</p>
                <p className="text-2xl font-bold text-gray-900">{summary.orders_count}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-500">营收总额</p>
                <p className="text-2xl font-bold text-green-600">¥{summary.revenue.toFixed(2)}</p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">支付方式占比</h3>
              {methodEntries.length === 0 ? (
                <p className="text-sm text-gray-400">暂无支付数据</p>
              ) : (
                <div className="space-y-3">
                  {methodEntries.map(([method, amount]) => {
                    const pct = methodTotal > 0 ? (amount / methodTotal) * 100 : 0;
                    const label = payMethodLabels[method] || method;
                    const color = payMethodColors[method] || 'bg-gray-500';
                    return (
                      <div key={method}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-700">{label}</span>
                          <span className="text-gray-500">
                            ¥{amount.toFixed(2)}（{pct.toFixed(1)}%）
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2.5">
                          <div
                            className={`${color} h-2.5 rounded-full transition-all`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b">
                <h3 className="text-sm font-medium text-gray-700">当日订单（{orders.length}）</h3>
              </div>
              {orders.length === 0 ? (
                <p className="p-4 text-sm text-gray-400">当日无订单</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">单号</th>
                        <th className="px-4 py-3 text-left font-medium">桌号</th>
                        <th className="px-4 py-3 text-right font-medium">金额</th>
                        <th className="px-4 py-3 text-left font-medium">支付方式</th>
                        <th className="px-4 py-3 text-left font-medium">状态</th>
                        <th className="px-4 py-3 text-left font-medium">时间</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {orders.map(o => {
                        const cfg = orderStatusConfig[o.status];
                        return (
                          <tr key={o.id}>
                            <td className="px-4 py-3 font-medium text-gray-900">{o.order_no}</td>
                            <td className="px-4 py-3 text-gray-700">{o.table_no || '外带'}</td>
                            <td className="px-4 py-3 text-right font-medium text-gray-900">
                              ¥{o.total_amount.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              {o.pay_method ? (payMethodLabels[o.pay_method] || o.pay_method) : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}
                              >
                                {cfg.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-500">
                              {new Date(o.created_at).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
