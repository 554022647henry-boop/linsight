import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getDishes } from '../api/dishes';
import { useCart } from '../cart/CartContext';
import type { Dish } from '../types';

const CATEGORIES = ['主食', '小菜', '饮品'] as const;

export default function MenuPage() {
  const [params] = useSearchParams();
  const tableNo = params.get('table_no') ?? '';
  const navigate = useNavigate();
  const cart = useCart();

  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState<string>('主食');
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    cart.setTableNo(tableNo || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableNo]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getDishes()
      .then((data) => {
        if (cancelled) return;
        setDishes(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : '加载菜品失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleDishes = useMemo(() => {
    return dishes
      .filter((d) => d.category === activeCat)
      .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  }, [dishes, activeCat]);

  const availableCats = useMemo(() => {
    const set = new Set(dishes.map((d) => d.category));
    const merged = [...CATEGORIES, ...Array.from(set)];
    return Array.from(new Set(merged));
  }, [dishes]);

  return (
    <div className="min-h-screen bg-orange-50 pb-28">
      <header className="sticky top-0 z-20 bg-orange-600 px-4 py-3 text-white shadow">
        <div className="mx-auto max-w-md">
          <h1 className="text-lg font-bold">老王的快餐店</h1>
          <p className="text-xs text-orange-100">
            {tableNo ? `桌号：${tableNo}` : '扫码点餐（未识别桌号）'}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-md">
        <nav className="sticky top-[52px] z-10 flex gap-1 bg-orange-50/95 px-4 py-2 backdrop-blur">
          {availableCats.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCat(cat)}
              className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition ${
                activeCat === cat
                  ? 'bg-orange-600 text-white shadow'
                  : 'bg-white text-gray-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </nav>

        <main className="px-4 py-3">
          {loading && (
            <p className="py-10 text-center text-sm text-gray-400">
              加载菜品中…
            </p>
          )}
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}
          {!loading && !error && visibleDishes.length === 0 && (
            <p className="py-10 text-center text-sm text-gray-400">
              该分类暂无菜品
            </p>
          )}

          <ul className="space-y-2">
            {visibleDishes.map((dish) => {
              const qty = cart.quantityOf(dish.id);
              return (
                <li
                  key={dish.id}
                  className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm"
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-base font-medium text-gray-800">
                      {dish.name}
                    </p>
                    <p className="text-sm font-semibold text-orange-600">
                      ¥{dish.price.toFixed(2)}
                    </p>
                  </div>
                  {qty > 0 ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => cart.dec(dish.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-lg font-bold text-orange-700 active:scale-95"
                        aria-label="减少"
                      >
                        −
                      </button>
                      <span className="min-w-[1.5rem] text-center text-base font-semibold text-gray-800">
                        {qty}
                      </span>
                      <button
                        onClick={() => cart.inc(dish.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-600 text-lg font-bold text-white active:scale-95"
                        aria-label="增加"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => cart.add(dish)}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-600 text-2xl font-bold text-white shadow active:scale-95"
                      aria-label={`加菜 ${dish.name}`}
                    >
                      +
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </main>
      </div>

      {cart.totalCount > 0 && (
        <CartBar
          totalCount={cart.totalCount}
          totalAmount={cart.totalAmount}
          onToggle={() => setCartOpen((v) => !v)}
          onCheckout={() => navigate('/confirm')}
        />
      )}

      {cartOpen && cart.totalCount > 0 && (
        <CartSheet
          lines={cart.lines}
          onInc={cart.inc}
          onDec={cart.dec}
          onClose={() => setCartOpen(false)}
          onCheckout={() => navigate('/confirm')}
        />
      )}
    </div>
  );
}

function CartBar({
  totalCount,
  totalAmount,
  onToggle,
  onCheckout,
}: {
  totalCount: number;
  totalAmount: number;
  onToggle: () => void;
  onCheckout: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md">
      <div className="m-3 flex items-center gap-3 rounded-full bg-gray-900 px-4 py-3 text-white shadow-lg">
        <button
          onClick={onToggle}
          className="relative flex h-10 w-10 items-center justify-center rounded-full bg-orange-600 text-xl"
          aria-label="查看购物车"
        >
          🛒
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold">
            {totalCount}
          </span>
        </button>
        <button onClick={onToggle} className="flex-1 text-left">
          <span className="text-base font-bold">
            ¥{totalAmount.toFixed(2)}
          </span>
          <span className="ml-2 text-xs text-gray-300">查看购物车</span>
        </button>
        <button
          onClick={onCheckout}
          className="rounded-full bg-orange-600 px-6 py-2 text-base font-bold active:scale-95"
        >
          去下单
        </button>
      </div>
    </div>
  );
}

function CartSheet({
  lines,
  onInc,
  onDec,
  onClose,
  onCheckout,
}: {
  lines: { dish: Dish; quantity: number }[];
  onInc: (id: number) => void;
  onDec: (id: number) => void;
  onClose: () => void;
  onCheckout: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="max-h-[60vh] w-full max-w-md overflow-auto rounded-t-2xl bg-white p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-800">已选菜品</h2>
          <button
            onClick={onClose}
            className="text-sm text-gray-400"
            aria-label="关闭"
          >
            收起
          </button>
        </div>
        <ul className="divide-y divide-gray-100">
          {lines.map((line) => (
            <li
              key={line.dish.id}
              className="flex items-center gap-3 py-3"
            >
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-gray-800">
                  {line.dish.name}
                </p>
                <p className="text-xs text-orange-600">
                  ¥{line.dish.price.toFixed(2)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onDec(line.dish.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 font-bold text-orange-700"
                >
                  −
                </button>
                <span className="min-w-[1.5rem] text-center text-sm font-semibold">
                  {line.quantity}
                </span>
                <button
                  onClick={() => onInc(line.dish.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-600 font-bold text-white"
                >
                  +
                </button>
              </div>
            </li>
          ))}
        </ul>
        <button
          onClick={onCheckout}
          className="mt-4 w-full rounded-full bg-orange-600 py-3 text-base font-bold text-white active:scale-95"
        >
          去下单
        </button>
      </div>
    </div>
  );
}
