import { useState, useEffect } from 'react';
import { getDailyReport, generateDailyReport, pushDailyReport, type DailyReport } from '../api/reports';

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function errMsg(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message: unknown }).message;
    if (typeof msg === 'string' && msg) return msg;
  }
  return fallback;
}

interface Metric {
  label: string;
  value: string;
  tone?: 'green' | 'red' | 'gray';
}

export default function DailySummary() {
  const [date, setDate] = useState<string>(todayStr());
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [pushing, setPushing] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    void loadReport();
  }, [date]);

  async function loadReport(): Promise<void> {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const data = await getDailyReport(date);
      setReport(data);
    } catch (err) {
      setError(errMsg(err, '加载日报失败'));
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate(): Promise<void> {
    setGenerating(true);
    setError('');
    setMessage('');
    try {
      const data = await generateDailyReport(date);
      setReport(data);
      setMessage('日报已生成');
    } catch (err) {
      setError(errMsg(err, '生成日报失败'));
    } finally {
      setGenerating(false);
    }
  }

  async function handlePush(): Promise<void> {
    setPushing(true);
    setError('');
    setMessage('');
    try {
      await pushDailyReport(date);
      setMessage('已推送到微信端');
    } catch (err) {
      setError(errMsg(err, '推送失败，请先生成日报'));
    } finally {
      setPushing(false);
    }
  }

  const metrics: Metric[] = report
    ? [
        { label: '营收', value: `¥${report.revenue.toFixed(2)}` },
        { label: '食材成本', value: `¥${report.food_cost.toFixed(2)}` },
        { label: '人工成本', value: `¥${report.labor_cost.toFixed(2)}` },
        { label: '损耗', value: `¥${report.loss_amount.toFixed(2)}`, tone: report.loss_amount > 0 ? 'red' : 'gray' },
        { label: '总成本', value: `¥${report.total_cost.toFixed(2)}` },
        { label: '毛利', value: `¥${report.gross_profit.toFixed(2)}`, tone: 'green' },
        { label: '毛利率', value: `${report.gross_margin.toFixed(1)}%` },
        { label: '净利', value: `¥${report.net_profit.toFixed(2)}`, tone: report.net_profit >= 0 ? 'green' : 'red' },
        { label: '客流', value: `${report.customer_count} 人` },
        { label: '客单价', value: `¥${report.avg_transaction.toFixed(2)}` },
      ]
    : [];

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <header className="bg-white shadow px-6 py-4">
        <h1 className="text-xl font-semibold text-gray-900">经营日报</h1>
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
            {generating ? '生成中...' : '生成日报'}
          </button>
          <button
            onClick={() => void handlePush()}
            disabled={pushing || !report}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
          >
            {pushing ? '推送中...' : '推送到微信'}
          </button>
          {message && <span className="text-sm text-green-600">{message}</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : !report ? (
          <div className="bg-white rounded-lg shadow py-16 text-center">
            <div className="text-5xl mb-3">📄</div>
            <p className="text-gray-500 mb-4">当日无日报，点击生成</p>
            <button
              onClick={() => void handleGenerate()}
              disabled={generating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {generating ? '生成中...' : '生成日报'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {metrics.map(m => (
                <div key={m.label} className="bg-white rounded-lg shadow p-4">
                  <p className="text-sm text-gray-500">{m.label}</p>
                  <p className={`text-xl font-bold ${m.tone === 'red' ? 'text-red-600' : m.tone === 'green' ? 'text-green-600' : 'text-gray-900'}`}>
                    {m.value}
                  </p>
                </div>
              ))}
            </div>

            {Math.abs(report.reconcile_diff_amount) > 0 && (
              <div className={`rounded-lg shadow p-4 ${Math.abs(report.reconcile_diff_amount) > 100 ? 'bg-red-50' : 'bg-yellow-50'}`}>
                <p className="text-sm font-medium text-gray-700">
                  对账差异：<span className={report.reconcile_diff_amount > 0 ? 'text-red-600' : 'text-green-600'}>¥{report.reconcile_diff_amount.toFixed(2)}</span>
                  {Math.abs(report.reconcile_diff_amount) > 100 && <span className="ml-2 text-red-600">差异较大，建议核查实盘记录</span>}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">AI 摘要</h3>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{report.ai_summary || '暂无摘要'}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">AI 建议</h3>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{report.ai_suggestion || '暂无建议'}</p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">热销菜品 TOP5</h3>
              {report.top_dishes && report.top_dishes.length > 0 ? (
                <div className="space-y-2">
                  {report.top_dishes.map((d, idx) => (
                    <div key={d.dish_id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : idx === 1 ? 'bg-gray-200 text-gray-700' : idx === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                          {idx + 1}
                        </span>
                        <span className="font-medium text-gray-900">{d.dish_name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-500">销量 {d.sold_count}</span>
                        <span className="font-medium text-blue-600">¥{d.revenue.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">当日无销售数据</p>
              )}
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b">
                <h3 className="text-sm font-medium text-gray-700">单品利润明细</h3>
              </div>
              {report.dish_profit_detail && report.dish_profit_detail.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">菜名</th>
                        <th className="px-4 py-3 text-right font-medium">销量</th>
                        <th className="px-4 py-3 text-right font-medium">营收</th>
                        <th className="px-4 py-3 text-right font-medium">食材成本</th>
                        <th className="px-4 py-3 text-right font-medium">分摊成本</th>
                        <th className="px-4 py-3 text-right font-medium">净利</th>
                        <th className="px-4 py-3 text-right font-medium">毛利率</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {report.dish_profit_detail.map(r => (
                        <tr key={r.dish_id}>
                          <td className="px-4 py-3 font-medium text-gray-900">{r.dish_name}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{r.sold_count}</td>
                          <td className="px-4 py-3 text-right text-gray-700">¥{r.revenue.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-gray-700">¥{r.food_cost.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-gray-700">¥{r.allocated_cost.toFixed(2)}</td>
                          <td className={`px-4 py-3 text-right font-medium ${r.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>¥{r.net_profit.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{r.margin.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="p-4 text-sm text-gray-400">当日无单品利润数据</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
