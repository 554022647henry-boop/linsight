/**
 * 日报列表页 — 日报回看 + 生成入口
 * 对应 CONTRACT.md 3.11
 * ReportPage 不读 URL query，故本页内嵌详情视图，不跳转。
 */
import { useEffect, useState } from 'react';
import { getReports, getReport, generateReport } from '../api/reports';
import type { DailyReport } from '../types';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export default function ReportList() {
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [detailReport, setDetailReport] = useState<DailyReport | null>(null);
  const [genDate, setGenDate] = useState<string>(yesterday());
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await getReports();
        if (cancelled) return;
        list.sort((a, b) => (a.report_date < b.report_date ? 1 : -1));
        setReports(list);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function openDetail(date: string) {
    setView('detail');
    setDetailReport(null);
    setDetailLoading(true);
    setError(null);
    try {
      const r = await getReport(date);
      setDetailReport(r);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/not_found|HTTP 404/i.test(msg)) {
        setError(msg);
      } else {
        setError(`${date} 暂无日报`);
      }
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setInfo(null);
    try {
      const r = await generateReport(genDate);
      setInfo(`已生成 ${genDate} 日报`);
      // 刷新列表
      try {
        const list = await getReports();
        list.sort((a, b) => (a.report_date < b.report_date ? 1 : -1));
        setReports(list);
      } catch {
        // ignore
      }
      // 直接进入详情
      setDetailReport(r);
      setView('detail');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }

  if (view === 'detail') {
    return (
      <ReportDetailView
        report={detailReport}
        loading={detailLoading}
        error={error}
        onBack={() => {
          setView('list');
          setDetailReport(null);
          setError(null);
        }}
      />
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#ededed]">
      <header className="flex items-center justify-center bg-[#07c160] px-4 py-3 text-white">
        <h1 className="text-base font-medium">经营日报</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {/* 生成入口 */}
        <div className="mb-3 rounded-lg bg-white p-3 shadow-sm">
          <div className="mb-2 text-xs text-gray-500">生成某日日报</div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={genDate}
              max={today()}
              onChange={e => setGenDate(e.target.value)}
              className="flex-1 rounded border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-[#07c160]"
            />
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="rounded-full bg-[#07c160] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
            >
              {generating ? '生成中...' : '生成'}
            </button>
          </div>
        </div>

        {loading && <div className="py-4 text-center text-xs text-gray-400">加载中...</div>}
        {error && (
          <div className="my-2 rounded bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
        )}
        {info && (
          <div className="my-2 rounded bg-green-50 px-3 py-2 text-xs text-[#07c160]">{info}</div>
        )}

        {!loading && reports.length === 0 && !error && (
          <div className="rounded-lg bg-white p-4 text-center text-sm text-gray-400 shadow-sm">
            暂无日报，点击上方「生成」创建
          </div>
        )}

        <ul className="space-y-2">
          {reports.map(r => (
            <li
              key={r.id}
              onClick={() => openDetail(r.report_date)}
              className="cursor-pointer rounded-lg bg-white p-3 shadow-sm active:bg-gray-50"
            >
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-800">{r.report_date}</span>
                <span className="text-xs text-gray-400">查看详情 ›</span>
              </div>
              <div className="mb-1.5 flex items-center gap-4 text-xs">
                <span className="text-gray-500">
                  营收 <span className="font-medium text-gray-800">{r.revenue.toFixed(0)}</span>元
                </span>
                <span className="text-gray-500">
                  净利{' '}
                  <span className="font-medium text-[#07c160]">{r.net_profit.toFixed(0)}</span>元
                </span>
                <span className="text-gray-500">
                  毛利率 <span className="font-medium text-gray-800">{r.gross_margin.toFixed(1)}%</span>
                </span>
              </div>
              {r.ai_summary && (
                <p className="truncate text-xs text-gray-400">
                  {r.ai_summary.slice(0, 50)}
                  {r.ai_summary.length > 50 ? '...' : ''}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** 内嵌详情视图（不跳转，不依赖 ReportPage） */
function ReportDetailView({
  report,
  loading,
  error,
  onBack,
}: {
  report: DailyReport | null;
  loading: boolean;
  error: string | null;
  onBack: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-[#ededed]">
      <header className="flex items-center bg-[#07c160] px-3 py-3 text-white">
        <button type="button" onClick={onBack} className="text-sm">
          ‹ 返回
        </button>
        <h1 className="flex-1 text-center text-base font-medium">日报详情</h1>
        <span className="w-10" />
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {loading && <div className="py-4 text-center text-xs text-gray-400">加载中...</div>}
        {error && (
          <div className="my-2 rounded bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
        )}

        {report && (
          <div className="space-y-3">
            {/* 指标卡 */}
            <div className="rounded-lg bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-medium text-gray-800">{report.report_date} 经营数据</h2>
                <span className="text-xs text-gray-400">Linsight</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="营收" value={report.revenue} unit="元" highlight />
                <Stat label="净利" value={report.net_profit} unit="元" highlight />
                <Stat label="毛利率" value={report.gross_margin} unit="%" />
                <Stat label="毛利" value={report.gross_profit} unit="元" />
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
                  {report.ai_suggestion
                    .split(/[；;]/)
                    .filter(Boolean)
                    .map((s, i) => (
                      <li key={i}>· {s}</li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
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
    <div className={`rounded-lg px-3 py-2 ${highlight ? 'bg-[#07c160]/10' : 'bg-gray-50'}`}>
      <div className="text-xs text-gray-400">{label}</div>
      <div className={`text-lg font-semibold ${highlight ? 'text-[#07c160]' : 'text-gray-800'}`}>
        {v}
        <span className="ml-0.5 text-xs font-normal text-gray-400">{unit}</span>
      </div>
    </div>
  );
}
