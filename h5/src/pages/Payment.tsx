import { useEffect, useRef, useState } from 'react';
import {
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import { checkoutOrder, getOrderDetail } from '../api/orders';
import type { OrderWithItems } from '../types';
import type { ConfirmSuccessState } from './ConfirmPage';

type PayMethod = 'wechat' | 'alipay';

export default function Payment() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const orderId = Number(params.get('order_id') ?? '');
  const state = location.state as ConfirmSuccessState | null;

  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!orderId) {
      setError('缺少订单号');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getOrderDetail(orderId)
      .then((data) => {
        if (cancelled) return;
        setOrder(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : '加载订单失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handlePay = (method: PayMethod) => {
    if (!order || paying) return;
    setPaying(true);
    setPayError(null);
    timerRef.current = setTimeout(() => {
      checkoutOrder(order.id, {
        pay_method: method,
        paid_amount: order.total_amount,
      })
        .then(() => {
          navigate(`/success?order_id=${order.id}`, {
            state,
            replace: true,
          });
        })
        .catch((err: unknown) => {
          setPayError(err instanceof Error ? err.message : '支付失败，请重试');
          setPaying(false);
        });
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-orange-50 pb-40">
      <header className="sticky top-0 z-20 bg-orange-600 px-4 py-3 text-white shadow">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-xl"
            aria-label="返回"
          >
            ←
          </button>
          <h1 className="text-base font-bold">在线支付</h1>
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
              <div className="flex items-center justify-between pb-3">
                <span className="text-xs text-gray-400">订单号</span>
                <span className="text-sm font-semibold text-gray-800">
                  {order.order_no}
                </span>
              </div>
              {order.table_no && (
                <div className="flex items-center justify-between pb-3">
                  <span className="text-xs text-gray-400">桌号</span>
                  <span className="text-sm font-semibold text-gray-800">
                    {order.table_no}
                  </span>
                </div>
              )}
              <ul className="divide-y divide-gray-100">
                {order.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-800">
                        {item.dish_name}
                      </p>
                      <p className="text-xs text-gray-400">
                        ¥{item.unit_price.toFixed(2)} × {item.quantity}
                      </p>
                    </div>
                    <p className="ml-3 text-sm font-semibold text-orange-600">
                      ¥{item.amount.toFixed(2)}
                    </p>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-center justify-between border-t border-dashed border-gray-200 pt-3">
                <span className="text-sm text-gray-500">应付</span>
                <span className="text-lg font-bold text-orange-600">
                  ¥{order.total_amount.toFixed(2)}
                </span>
              </div>
            </section>

            {payError && (
              <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {payError}
              </div>
            )}

            {paying ? (
              <div className="rounded-xl bg-white p-6 text-center shadow-sm">
                <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-orange-100 border-t-orange-600" />
                <p className="text-sm font-medium text-gray-700">支付中…</p>
                <p className="mt-1 text-xs text-gray-400">
                  正在处理支付，请稍候
                </p>
              </div>
            ) : (
              <section className="rounded-xl bg-white p-4 shadow-sm">
                <h2 className="mb-3 text-sm font-bold text-gray-800">
                  选择支付方式
                </h2>
                <div className="space-y-3">
                  <button
                    onClick={() => handlePay('wechat')}
                    className="flex w-full items-center gap-3 rounded-xl bg-green-500 px-4 py-3 text-white shadow active:scale-[0.98]"
                  >
                    <span className="text-2xl">💚</span>
                    <span className="flex-1 text-left text-base font-bold">
                      微信支付
                    </span>
                    <span className="text-sm font-semibold">
                      ¥{order.total_amount.toFixed(2)}
                    </span>
                  </button>
                  <button
                    onClick={() => handlePay('alipay')}
                    className="flex w-full items-center gap-3 rounded-xl bg-blue-500 px-4 py-3 text-white shadow active:scale-[0.98]"
                  >
                    <span className="text-2xl">💙</span>
                    <span className="flex-1 text-left text-base font-bold">
                      支付宝
                    </span>
                    <span className="text-sm font-semibold">
                      ¥{order.total_amount.toFixed(2)}
                    </span>
                  </button>
                </div>
                <p className="mt-3 text-center text-xs text-gray-400">
                  Demo 模拟支付，不会产生真实交易
                </p>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
