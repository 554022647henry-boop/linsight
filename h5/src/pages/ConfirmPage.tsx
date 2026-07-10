import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createOrder } from '../api/orders';
import { useCart } from '../cart/CartContext';

export interface ConfirmSuccessState {
  orderNo: string;
  orderId: number;
  totalAmount: number;
  tableNo: string | null;
  note: string;
  people: number;
}

export default function ConfirmPage() {
  const navigate = useNavigate();
  const cart = useCart();

  const [note, setNote] = useState('');
  const [people, setPeople] = useState('2');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tableNo = cart.tableNo;

  if (cart.totalCount === 0 && !submitting) {
    return (
      <div className="min-h-screen bg-orange-50">
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <p className="text-sm text-gray-500">购物车是空的</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 rounded-full bg-orange-600 px-6 py-2 text-sm font-bold text-white"
          >
            去点菜
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await createOrder({
        type: 'dine-in',
        table_no: tableNo ?? undefined,
        items: cart.lines.map((l) => ({
          dish_id: l.dish.id,
          quantity: l.quantity,
        })),
      });
      const state: ConfirmSuccessState = {
        orderNo: res.data.order_no,
        orderId: res.data.id,
        totalAmount: res.data.total_amount,
        tableNo: tableNo,
        note,
        people: Number(people) || 0,
      };
      cart.clear();
      navigate(`/payment?order_id=${res.data.id}`, { state, replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '下单失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-orange-50 pb-32">
      <header className="sticky top-0 z-20 bg-orange-600 px-4 py-3 text-white shadow">
        <div className="mx-auto max-w-md flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-xl"
            aria-label="返回"
          >
            ←
          </button>
          <h1 className="text-base font-bold">确认订单</h1>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 py-4">
        <div className="mb-3 rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">
            桌号：
            <span className="font-semibold text-gray-800">
              {tableNo || '—'}
            </span>
          </p>
        </div>

        <section className="mb-3 rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-gray-800">订单明细</h2>
          <ul className="divide-y divide-gray-100">
            {cart.lines.map((line) => (
              <li
                key={line.dish.id}
                className="flex items-center justify-between py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800">
                    {line.dish.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    ¥{line.dish.price.toFixed(2)} × {line.quantity}
                  </p>
                </div>
                <p className="ml-3 text-sm font-semibold text-orange-600">
                  ¥{(line.dish.price * line.quantity).toFixed(2)}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t border-dashed border-gray-200 pt-3">
            <span className="text-sm text-gray-500">合计</span>
            <span className="text-lg font-bold text-orange-600">
              ¥{cart.totalAmount.toFixed(2)}
            </span>
          </div>
        </section>

        <section className="mb-3 space-y-3 rounded-xl bg-white p-4 shadow-sm">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              就餐人数
            </label>
            <input
              type="number"
              min={1}
              value={people}
              onChange={(e) => setPeople(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-base outline-none focus:border-orange-500"
              placeholder="如 2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              备注（口味、忌口等）
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-base outline-none focus:border-orange-500"
              placeholder="如：少辣、不要香菜"
            />
          </div>
        </section>

        {error && (
          <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-gray-100 bg-white p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="text-xs text-gray-400">应付</p>
            <p className="text-lg font-bold text-orange-600">
              ¥{cart.totalAmount.toFixed(2)}
            </p>
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-full bg-orange-600 px-8 py-3 text-base font-bold text-white shadow active:scale-95 disabled:opacity-60"
          >
            {submitting ? '提交中…' : '确认下单'}
          </button>
        </div>
      </div>
    </div>
  );
}
