import { useState, useEffect } from 'react';
import { getLossRecords, generateLossRecords, type LossRecord } from '../api/loss-records';

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

export default function LossRecords() {
  const [date, setDate] = useState<string>(todayStr());
  const [records, setRecords] = useState<LossRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    void loadRecords();
  }, [date]);

  async function loadRecords(): Promise<void> {
    setLoading(true);
    setError('');
    try {
      const data = await getLossRecords(date);
      setRecords(data);
    } catch (err) {
      setError(errMsg(err, '加载损耗记录失败'));
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate(): Promise<void> {
    setGenerating(true);
    setError('');
    try {
      const data = await generateLossRecords(date);
      setRecords(data);
    } catch (err) {
      setError(errMsg(err, '生成损耗记录失败'));
    } finally {
      setGenerating(false);
    }
  }

  const totalLoss: number = records.reduce((s, r) => s + r.diff_amount, 0);
  const abnormalCount: number = records.filter(r => Math.abs(r.diff_amount) > 100).length;

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <header className="bg-white shadow px-6 py-4">
        <h1 className="text-xl font-semibold text-gray-900">损耗监控</h1>
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
            {generating ? '生成中...' : '生成当日损耗'}
          </button>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">当日损耗总额</p>
            <p className={`text-2xl font-bold ${totalLoss > 0 ? 'text-red-600' : 'text-green-600'}`}>
              ¥{totalLoss.toFixed(2)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">异常食材数</p>
            <p className="text-2xl font-bold text-gray-900">{abnormalCount}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : records.length === 0 ? (
            <div className="py-12 text-center text-gray-400">当日无损耗记录，点击"生成当日损耗"</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">食材</th>
                  <th className="px-4 py-3 text-right font-medium">理论消耗</th>
                  <th className="px-4 py-3 text-right font-medium">实际消耗</th>
                  <th className="px-4 py-3 text-right font-medium">差值</th>
                  <th className="px-4 py-3 text-right font-medium">差异金额</th>
                  <th className="px-4 py-3 text-left font-medium">AI分析</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map(r => {
                  const abnormal = Math.abs(r.diff_amount) > 100;
                  return (
                    <tr key={r.id} className={abnormal ? 'bg-red-50' : ''}>
                      <td className="px-4 py-3 font-medium text-gray-900">{r.ingredient_name}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{r.theoretical_consumption.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{r.actual_consumption.toFixed(2)}</td>
                      <td className={`px-4 py-3 text-right font-medium ${r.diff > 0 ? 'text-red-600' : r.diff < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                        {r.diff > 0 ? '+' : ''}{r.diff.toFixed(2)}
                      </td>
                      <td className={`px-4 py-3 text-right font-medium ${abnormal ? 'text-red-600' : 'text-gray-700'}`}>
                        ¥{r.diff_amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{r.ai_analysis || '—'}</td>
                    </tr>
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
