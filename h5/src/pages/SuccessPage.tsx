import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import type { ConfirmSuccessState } from './ConfirmPage';

export default function SuccessPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const state = location.state as ConfirmSuccessState | null;
  const orderId = state?.orderId ?? Number(params.get('order_id') ?? '0');

  return (
    <div className="min-h-screen bg-orange-50">
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500 text-4xl text-white shadow-lg">
            ✓
          </div>
          <h1 className="mt-4 text-xl font-bold text-gray-800">下单成功</h1>
          <p className="mt-1 text-sm text-gray-500">已通知厨房，请稍候</p>
        </div>

        <div className="mt-8 rounded-xl bg-white p-5 shadow-sm">
          <div className="flex justify-between py-2">
            <span className="text-sm text-gray-500">订单号</span>
            <span className="text-sm font-semibold text-gray-800">
              {state?.orderNo ?? '—'}
            </span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-sm text-gray-500">桌号</span>
            <span className="text-sm font-semibold text-gray-800">
              {state?.tableNo ?? '—'}
            </span>
          </div>
          {state && state.people > 0 && (
            <div className="flex justify-between py-2">
              <span className="text-sm text-gray-500">就餐人数</span>
              <span className="text-sm font-semibold text-gray-800">
                {state.people} 人
              </span>
            </div>
          )}
          <div className="flex justify-between py-2">
            <span className="text-sm text-gray-500">金额</span>
            <span className="text-sm font-bold text-orange-600">
              ¥{(state?.totalAmount ?? 0).toFixed(2)}
            </span>
          </div>
          {state?.note && (
            <div className="mt-2 border-t border-dashed border-gray-100 pt-3">
              <p className="text-xs text-gray-400">备注</p>
              <p className="mt-1 text-sm text-gray-700">{state.note}</p>
            </div>
          )}
        </div>

        {orderId > 0 && (
          <button
            onClick={() => navigate(`/order/${orderId}`)}
            className="mt-8 w-full rounded-full border border-orange-600 bg-white py-3 text-base font-bold text-orange-600 active:scale-95"
          >
            查看订单状态
          </button>
        )}

        <button
          onClick={() => navigate('/')}
          className="mt-3 w-full rounded-full bg-orange-600 py-3 text-base font-bold text-white shadow active:scale-95"
        >
          返回菜单
        </button>
      </div>
    </div>
  );
}
