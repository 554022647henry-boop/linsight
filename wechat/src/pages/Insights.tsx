/**
 * AI 洞察列表页 — 展示 AI 推送的洞察，支持未读/类型筛选
 * 对应 CONTRACT.md 3.14
 */
import { useEffect, useState, type ReactNode } from 'react';
import {
  getInsights,
  markInsightRead,
  type AiInsight,
  type InsightType,
} from '../api/insights';

type Tab = 'all' | 'unread';
type TypeFilter = InsightType | 'all';

const TYPE_META: Record<InsightType, { icon: string; label: string }> = {
  daily_report: { icon: '📊', label: '日报' },
  loss_warning: { icon: '⚠️', label: '损耗预警' },
  price_alert: { icon: '💰', label: '价格异动' },
  expiry_alert: { icon: '⏰', label: '临期预警' },
  reconcile_alert: { icon: '⚖️', label: '对账异常' },
};

const TYPE_FILTERS: Array<{ key: TypeFilter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'daily_report', label: '📊 日报' },
  { key: 'loss_warning', label: '⚠️ 损耗' },
  { key: 'price_alert', label: '💰 价格' },
  { key: 'expiry_alert', label: '⏰ 临期' },
  { key: 'reconcile_alert', label: '⚖️ 对账' },
];

function formatTime(iso: string): string {
  // 2026-07-04T08:00:00Z -> 07-04 08:00
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}-${dd} ${hh}:${mi}`;
}

export default function Insights() {
  const [tab, setTab] = useState<Tab>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const typeArg = typeFilter === 'all' ? undefined : typeFilter;
        const isReadArg = tab === 'unread' ? false : undefined;
        const list = await getInsights(typeArg, isReadArg);
        if (cancelled) return;
        list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        setInsights(list);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, typeFilter]);

  async function handleClickRead(insight: AiInsight) {
    if (insight.is_read === 1) return;
    // 乐观更新
    setInsights(prev => prev.map(it => (it.id === insight.id ? { ...it, is_read: 1 } : it)));
    try {
      await markInsightRead(insight.id);
    } catch (e) {
      // 回滚
      setInsights(prev => prev.map(it => (it.id === insight.id ? { ...it, is_read: 0 } : it)));
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const unreadCount = insights.filter(it => it.is_read === 0).length;

  return (
    <div className="flex h-full flex-col bg-[#ededed]">
      <header className="flex items-center justify-center bg-[#07c160] px-4 py-3 text-white">
        <h1 className="text-base font-medium">AI 洞察</h1>
      </header>

      {/* 顶部 Tab：全部 / 未读 */}
      <div className="flex shrink-0 border-b border-gray-200 bg-white">
        <TabButton active={tab === 'all'} onClick={() => setTab('all')}>
          全部
        </TabButton>
        <TabButton active={tab === 'unread'} onClick={() => setTab('unread')}>
          未读{unreadCount > 0 && tab === 'all' ? ` (${unreadCount})` : ''}
        </TabButton>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {/* 类型筛选 */}
        <div className="mb-3 flex flex-wrap gap-2">
          {TYPE_FILTERS.map(tf => (
            <button
              key={tf.key}
              type="button"
              onClick={() => setTypeFilter(tf.key)}
              className={`rounded-full px-3 py-1 text-xs ${
                typeFilter === tf.key
                  ? 'bg-[#07c160] text-white'
                  : 'bg-white text-gray-500 shadow-sm'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {loading && <div className="py-4 text-center text-xs text-gray-400">加载中...</div>}
        {error && (
          <div className="my-2 rounded bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
        )}

        {!loading && !error && insights.length === 0 && (
          <div className="rounded-lg bg-white p-4 text-center text-sm text-gray-400 shadow-sm">
            暂无洞察
          </div>
        )}

        <ul className="space-y-2">
          {insights.map(it => {
            const meta = TYPE_META[it.insight_type] ?? { icon: '📌', label: it.insight_type };
            return (
              <li
                key={it.id}
                onClick={() => handleClickRead(it)}
                className="relative cursor-pointer rounded-lg bg-white p-3 shadow-sm active:bg-gray-50"
              >
                {it.is_read === 0 && (
                  <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-red-500" />
                )}
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="text-base leading-none">{meta.icon}</span>
                  <span className="text-xs font-medium text-gray-700">{meta.label}</span>
                  <span className="text-[11px] text-gray-400">
                    {it.related_date ?? formatTime(it.created_at)}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-gray-800">{it.content}</p>
                {it.suggestion && (
                  <div className="mt-2 rounded bg-[#07c160]/5 px-2.5 py-1.5 text-xs leading-relaxed text-[#07c160]">
                    💡 {it.suggestion}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-2.5 text-sm ${
        active ? 'border-b-2 border-[#07c160] font-medium text-[#07c160]' : 'text-gray-500'
      }`}
    >
      {children}
    </button>
  );
}
