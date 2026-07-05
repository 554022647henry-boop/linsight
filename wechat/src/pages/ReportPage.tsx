/**
 * 日报页 — 老板查看经营日报、生成日报、推送到聊天
 */
import { useEffect, useState } from 'react';
import { getReport, generateReport, pushReport } from '../api/reports';
import type { DailyReport } from '../types';

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export default function ReportPage() {
  const [date, setDate] = useState<string>(yesterday());
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // 日期变化时尝试拉取已有日报（404 静默处理）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setInfo(null);
      setReport(null);
      try {
        const r = await getReport(date);
        if (!cancelled) setReport(r);
      } catch (e) {
        // 404 表示当天还没生成，静默
        const msg = e instanceof Error ? e.message : String(e);
        if (!cancelled && !/not_found|HTTP 404/i.test(msg)) {
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setInfo(null);
    try {
      const r = await generateReport(date);
      setReport(r);
      setInfo(`已生成 ${date} 日报`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }

  async function handlePush() {
    setPushing(true);
    setError(null);
    setInfo(null);
    try {
      await pushReport(date);
      setInfo(`已将 ${date} 日报推送到聊天`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPushing(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-[#ededed]">
      <header className="flex items-center justify-center bg-[#07c160] px-4 py-3 text-white">
        <h1 className="text-base font-medium">经营日报</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {/* 日期选择 */}
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-white p-3 shadow-sm">
          <label className="text-sm text-gray-600">日期</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="flex-1 rounded border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-[#07c160]"
          />
        </div>

        {loading && (
          <div className="py-4 text-center text-xs text-gray-400">加载中...</div>
        )}
        {error && (
          <div className="my-2 rounded bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
        )}
        {info && (
          <div className="my-2 rounded bg-green-50 px-3 py-2 text-xs text-[#07c160]">{info}</div>
        )}

        {!loading && !report && (
          <div className="rounded-lg bg-white p-4 text-center text-sm text-gray-400 shadow-sm">
            {date} 暂无日报，点击下方「生成日报」
          </div>
        )}

        {report && <ReportCard report={report} />}

        {/* 操作按钮 */}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || pushing}
            className="flex-1 rounded-full bg-[#07c160] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {generating ? '生成中...' : report ? '重新生成' : '生成日报'}
          </button>
          <button
            type="button"
            onClick={handlePush}
            disabled={!report || generating || pushing}
            className="flex-1 rounded-full border border-[#07c160] bg-white px-4 py-2.5 text-sm font-medium text-[#07c160] disabled:opacity-40"
          >
            {pushing ? '推送中...' : '推送到聊天'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReportCard({ report }: { report: DailyReport }) {
  return (
    <div className="space-y-3">
      {/* 指标卡 */}
      <div className="rounded-lg bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-800">{report.report_date} 经营数据</h2>
          <span className="text-xs text-gray-400">Linsight</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="营收" value={report.revenue} unit="元" highlight />
          <Stat label="毛利" value={report.gross_profit} unit="元" />
          <Stat label="毛利率" value={report.gross_margin} unit="%" />
          <Stat label="净利" value={report.net_profit} unit="元" highlight />
          <Stat label="客流" value={report.customer_count} unit="人" />
          <Stat label="客单价" value={report.avg_transaction} unit="元" />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3 text-center text-xs text-gray-500">
          <div>
            <div className="text-gray-400">食材成本</div>
            <div className="font-medium text-gray-700">{report.food_cost.toFixed(0)}元</div>
          </div>
          <div>
            <div className="text-gray-400">人工成本</div>
            <div className="font-medium text-gray-700">{report.labor_cost.toFixed(0)}元</div>
          </div>
          <div>
            <div className="text-gray-400">损耗</div>
            <div className="font-medium text-gray-700">{report.loss_amount.toFixed(0)}元</div>
          </div>
        </div>
      </div>

      {/* 热销菜品 */}
      {report.top_dishes && report.top_dishes.length > 0 && (
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-medium text-gray-800">🔥 热销菜品 TOP</h3>
          <ul className="space-y-1.5 text-xs">
            {report.top_dishes.map((d, i) => (
              <li key={d.dish_id} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#07c160] text-[10px] text-white">
                    {i + 1}
                  </span>
                  {d.dish_name}
                </span>
                <span className="text-gray-500">
                  售 {d.sold_count} 份 / {d.revenue.toFixed(0)}元
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* AI 摘要 */}
      {report.ai_summary && (
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-medium text-gray-800">📊 AI 人话摘要</h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
            {report.ai_summary}
          </p>
        </div>
      )}

      {/* AI 建议 */}
      {report.ai_suggestion && (
        <div className="rounded-lg border border-[#07c160]/30 bg-[#07c160]/5 p-4">
          <h3 className="mb-2 text-sm font-medium text-[#07c160]">💡 AI 建议</h3>
          <ul className="space-y-1 text-sm leading-relaxed text-gray-700">
            {report.ai_suggestion.split(/[；;]/).filter(Boolean).map((s, i) => (
              <li key={i}>· {s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  highlight,
}: {
  label: string;
  value: number;
  unit: string;
  highlight?: boolean;
}) {
  const v = unit === '%' ? value.toFixed(1) : value.toFixed(0);
  return (
    <div
      className={`rounded-lg px-3 py-2 ${
        highlight ? 'bg-[#07c160]/10' : 'bg-gray-50'
      }`}
    >
      <div className="text-xs text-gray-400">{label}</div>
      <div className={`text-lg font-semibold ${highlight ? 'text-[#07c160]' : 'text-gray-800'}`}>
        {v}
        <span className="ml-0.5 text-xs font-normal text-gray-400">{unit}</span>
      </div>
    </div>
  );
}
