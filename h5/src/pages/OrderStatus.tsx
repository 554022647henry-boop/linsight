import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getOrderDetail } from '../api/orders';
import type { OrderWithItems, OrderItem } from '../types';

const REFRESH_INTERVAL = 5000;

function formatTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function OrderStatusBadge({ status }: { status: string }) {
  let label = status;
  let cls = 'bg-gray-100 text-gray-600';
  if (status === 'dining') {
    label = '就餐中';
    cls = 'bg-orange-100 text-orange-700';
  } else if (status === 'paid') {
    label = '已结账';
    cls = 'bg-green-100 text-green-700';
  } else if (status === 'cancelled') {
    label = '已取消';
    cls = 'bg-gray-100 text-gray-500';
  } else if (status === 'refunded') {
    label = '已退款';
    cls = 'bg-red-100 text-red-600';
  }
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function ItemStatusBadge({ status }: { status: string }) {
  if (status === 'served') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600">
        ✅ 已出餐
      </span>
    );
  }
  if (status === 'ordered') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600">
        🍳 制作中
      </span>
    );
  }
  if (status === 'cancelled') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-400">
        已取消
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500">
      {status}
    </span>
  );
}

export default function OrderStatus() {
  const { id } = useParams();
  const navigate = useNavigate();
  const orderId = Number(id ?? '');

  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setError('缺少订单号');
      setLoading(false);
      return;
    }
    let cancelled = false;
    const fetchOrder = () => {
      getOrderDetail(orderId)
        .then((data) => {
          if (cancelled) return;
          setOrder(data);
          setError(null);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : '加载订单失败');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    fetchOrder();
    const timer = setInterval(fetchOrder, REFRESH_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [orderId]);

  return (
    <div className="min-h-screen bg-orange-50 pb-10">
      <header className="sticky top-0 z-20 bg-orange-600 px-4 py-3 text-white shadow">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="text-xl"
            aria-label="返回菜单"
          >
            ←
          </button>
          <h1 className="text-base font-bold">订单状态</h1>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 py-4">
        {loading && (
          <p className="py-10 text-center text-sm text-gray-400">
            加载订单中…
          </p>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {!loading && !error && order && (
          <>
            <section className="mb-3 rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">订单号</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {order.order_no}
                  </p>
                </div>
                <OrderStatusBadge status={order.status} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-dashed border-gray-100 pt-3">
                <div>
                  <p className="text-xs text-gray-400">桌号</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {order.table_no ?? '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">下单时间</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {formatTime(order.created_at)}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-dashed border-gray-100 pt-3">
                <span className="text-sm text-gray-500">合计</span>
                <span className="text-base font-bold text-orange-600">
                  ¥{order.total_amount.toFixed(2)}
                </span>
              </div>
            </section>

            <section className="rounded-xl bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-800">菜品状态</h2>
                <span className="text-xs text-gray-400">
                  每 {REFRESH_INTERVAL / 1000} 秒自动刷新
                </span>
              </div>
              <ul className="divide-y divide-gray-100">
                {order.items.map((item: OrderItem) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-800">
                        {item.dish_name}
                        <span className="ml-2 text-xs text-gray-400">
                          × {item.quantity}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        ¥{item.unit_price.toFixed(2)}
                      </p>
                    </div>
                    <ItemStatusBadge status={item.status} />
                  </li>
                ))}
              </ul>
            </section>

            <button
              onClick={() => navigate('/')}
              className="mt-6 w-full rounded-full bg-orange-600 py-3 text-base font-bold text-white shadow active:scale-95"
            >
              返回菜单
            </button>
          </>
        )}
      </div>
    </div>
  );
}
