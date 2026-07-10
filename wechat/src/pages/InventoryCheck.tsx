/**
 * 关店实盘录入页 — 老板盘点实际剩余，对账理论应剩
 * 对应 DEV_PLAN 3.6 / CONTRACT.md 3.13
 */
import { useEffect, useState } from 'react';
import { getInventory, type InventoryItem } from '../api/inventory';
import {
  submitInventoryCheck,
  getInventoryChecks,
  type InventoryCheck,
  type InventoryCheckItem,
} from '../api/inventory-checks';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 预设语音/文本快捷输入 */
const PRESETS: Array<{ label: string; text: string }> = [
  { label: '预设1', text: '牛肉 8 青菜 3 鸡蛋 20 大米 15' },
  { label: '预设2', text: '牛肉 6 青菜 5 鸡蛋 25 大米 12 猪肉 4' },
  { label: '按系统', text: '__BY_SYSTEM__' },
];

/** 解析 "牛肉 8 青菜 3" 为 name->qty 映射 */
function parsePresetText(text: string): Map<string, number> {
  const map = new Map<string, number>();
  const re = /([^\d\s]+)\s+(\d+(?:\.\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    map.set(m[1], parseFloat(m[2]));
  }
  return map;
}

export default function InventoryCheck() {
  const [date, setDate] = useState<string>(today());
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [checks, setChecks] = useState<InventoryCheck[]>([]);
  const [actualValues, setActualValues] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setInfo(null);
      setChecks([]);
      setActualValues({});
      try {
        const [inv, chk] = await Promise.all([getInventory(), getInventoryChecks(date)]);
        if (cancelled) return;
        setInventory(inv);
        setChecks(chk);
        const prefilled: Record<number, string> = {};
        for (const c of chk) {
          prefilled[c.ingredient_id] = String(c.actual_remaining);
        }
        setActualValues(prefilled);
        if (chk.length > 0) setInfo(`${date} 已有 ${chk.length} 条实盘记录`);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date]);

  function applyPreset(text: string) {
    setError(null);
    setInfo(null);
    if (text === '__BY_SYSTEM__') {
      const next: Record<number, string> = {};
      for (const inv of inventory) {
        if (inv.total_quantity !== null) {
          next[inv.ingredient_id] = String(inv.total_quantity);
        }
      }
      setActualValues(next);
      setInfo('已按系统库存数量填入实盘');
      return;
    }
    const pairs = parsePresetText(text);
    const next: Record<number, string> = { ...actualValues };
    let hit = 0;
    for (const inv of inventory) {
      const q = pairs.get(inv.ingredient_name);
      if (q !== undefined) {
        next[inv.ingredient_id] = String(q);
        hit++;
      }
    }
    setActualValues(next);
    setInfo(hit > 0 ? `已填入 ${hit} 项` : '未匹配到食材，请检查名称');
  }

  async function handleSubmit() {
    setError(null);
    setInfo(null);
    const items: InventoryCheckItem[] = [];
    for (const inv of inventory) {
      const raw = actualValues[inv.ingredient_id];
      if (raw === undefined || raw === '') continue;
      const v = parseFloat(raw);
      if (isNaN(v)) continue;
      items.push({ ingredient_id: inv.ingredient_id, actual_remaining: v, source: 'text' });
    }
    if (items.length === 0) {
      setError('请先填写实盘数量（或点击快捷预设）');
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitInventoryCheck(date, items);
      setChecks(result);
      setInfo(`已提交 ${items.length} 项实盘，对账结果如下`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  /** 食材名/单位映射（用于结果展示） */
  const nameMap = new Map<number, { name: string; unit: string }>();
  for (const inv of inventory) {
    nameMap.set(inv.ingredient_id, { name: inv.ingredient_name, unit: inv.unit });
  }

  return (
    <div className="flex h-full flex-col bg-[#ededed]">
      <header className="flex items-center justify-center bg-[#07c160] px-4 py-3 text-white">
        <h1 className="text-base font-medium">关店实盘</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {/* 日期选择 */}
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-white p-3 shadow-sm">
          <label className="text-sm text-gray-600">盘点日期</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="flex-1 rounded border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-[#07c160]"
          />
        </div>

        {loading && <div className="py-4 text-center text-xs text-gray-400">加载中...</div>}
        {error && (
          <div className="my-2 rounded bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
        )}
        {info && (
          <div className="my-2 rounded bg-green-50 px-3 py-2 text-xs text-[#07c160]">{info}</div>
        )}

        {/* 快捷预设 */}
        {!loading && inventory.length > 0 && (
          <div className="mb-3 rounded-lg bg-white p-3 shadow-sm">
            <div className="mb-2 text-xs text-gray-500">快捷输入（Demo 预设）</div>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map(p => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p.text)}
                  className="rounded-full border border-[#07c160]/40 bg-[#07c160]/5 px-3 py-1.5 text-xs text-[#07c160]"
                >
                  {p.label === '按系统' ? '📋 ' : '🎙️ '}
                  {p.label}
                </button>
              ))}
            </div>
            <div className="mt-2 space-y-0.5 text-[11px] leading-relaxed text-gray-400">
              {PRESETS.filter(p => p.text !== '__BY_SYSTEM__').map(p => (
                <div key={p.label}>"{p.text}"</div>
              ))}
            </div>
          </div>
        )}

        {/* 实盘输入列表 */}
        {!loading && inventory.length > 0 && (
          <div className="mb-3 rounded-lg bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-800">实盘录入</h2>
              <span className="text-xs text-gray-400">系统库存作参考</span>
            </div>
            <ul className="divide-y divide-gray-100">
              {inventory.map(inv => (
                <li key={inv.ingredient_id} className="flex items-center gap-2 py-2.5">
                  <div className="flex-1">
                    <div className="text-sm text-gray-800">{inv.ingredient_name}</div>
                    <div className="text-[11px] text-gray-400">
                      系统应剩 {inv.total_quantity ?? '—'} {inv.unit}
                      {inv.is_low === 1 && <span className="ml-1 text-orange-500">·偏低</span>}
                    </div>
                  </div>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={actualValues[inv.ingredient_id] ?? ''}
                    onChange={e =>
                      setActualValues(prev => ({ ...prev, [inv.ingredient_id]: e.target.value }))
                    }
                    placeholder="实盘"
                    className="w-20 rounded border border-gray-200 px-2 py-1 text-right text-sm outline-none focus:border-[#07c160]"
                  />
                  <span className="w-8 text-xs text-gray-400">{inv.unit}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!loading && inventory.length === 0 && !error && (
          <div className="rounded-lg bg-white p-4 text-center text-sm text-gray-400 shadow-sm">
            暂无库存数据
          </div>
        )}

        {/* 提交按钮 */}
        {!loading && inventory.length > 0 && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full rounded-full bg-[#07c160] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {submitting ? '提交中...' : '提交实盘'}
          </button>
        )}

        {/* 对账结果 */}
        {checks.length > 0 && (
          <div className="mt-4 rounded-lg bg-white p-3 shadow-sm">
            <h2 className="mb-2 text-sm font-medium text-gray-800">⚖️ 对账结果</h2>
            <div className="grid grid-cols-12 gap-1 border-b border-gray-100 pb-1.5 text-[11px] text-gray-400">
              <div className="col-span-4">食材</div>
              <div className="col-span-3 text-right">理论</div>
              <div className="col-span-3 text-right">实盘</div>
              <div className="col-span-2 text-right">差异</div>
            </div>
            <ul className="divide-y divide-gray-50">
              {checks.map(c => {
                const meta = nameMap.get(c.ingredient_id);
                const name = c.ingredient_name ?? meta?.name ?? `#${c.ingredient_id}`;
                const unit = c.unit ?? meta?.unit ?? '';
                const diff = c.diff;
                const theo = c.theoretical_remaining;
                const big = Math.abs(diff) > Math.max(2, 0.2 * (theo || 1));
                const mid = Math.abs(diff) > 0;
                return (
                  <li
                    key={c.id}
                    className="grid grid-cols-12 gap-1 py-2 text-xs"
                  >
                    <div className="col-span-4 truncate text-gray-700">{name}</div>
                    <div className="col-span-3 text-right text-gray-500">
                      {theo}
                      <span className="ml-0.5 text-[10px] text-gray-400">{unit}</span>
                    </div>
                    <div className="col-span-3 text-right text-gray-700">
                      {c.actual_remaining}
                      <span className="ml-0.5 text-[10px] text-gray-400">{unit}</span>
                    </div>
                    <div
                      className={`col-span-2 text-right font-medium ${
                        big ? 'text-red-600' : mid ? 'text-orange-500' : 'text-[#07c160]'
                      }`}
                    >
                      {diff > 0 ? '+' : ''}
                      {diff}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
