import { useState, useEffect } from 'react';
import {
  getPurchaseOrders,
  getPurchaseOrder,
  confirmPurchaseOrder,
  cancelPurchaseOrder,
  recognizePurchaseOrder,
  type PurchaseOrder,
  type PurchaseOrderDetail,
  type PurchaseStatus,
  type PurchaseSourceType,
  type RecognizeResult,
} from '../api/purchase-orders';

const statusFilters: { value: PurchaseStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待确认' },
  { value: 'confirmed', label: '已确认' },
  { value: 'cancelled', label: '已取消' },
];

const statusMap: Record<PurchaseStatus, { label: string; cls: string }> = {
  pending: { label: '待确认', cls: 'bg-yellow-100 text-yellow-700' },
  confirmed: { label: '已确认', cls: 'bg-green-100 text-green-700' },
  cancelled: { label: '已取消', cls: 'bg-gray-100 text-gray-500' },
};

const sourceTypeMap: Record<PurchaseSourceType, string> = {
  image: '图片识别',
  voice: '语音识别',
  text: '文本识别',
  manual: '手动录入',
};

function confidenceColor(confidence: number): string {
  if (confidence >= 0.9) return 'text-green-600';
  if (confidence >= 0.7) return 'text-yellow-600';
  return 'text-red-600';
}

export default function PurchaseOrders() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState<PurchaseStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<PurchaseOrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const [showRecognize, setShowRecognize] = useState(false);
  const [recognizeText, setRecognizeText] = useState('');
  const [recognizeResult, setRecognizeResult] = useState<RecognizeResult | null>(null);
  const [recognizing, setRecognizing] = useState(false);

  useEffect(() => {
    loadOrders();
  }, [statusFilter]);

  async function loadOrders() {
    setLoading(true);
    try {
      const data = await getPurchaseOrders(statusFilter === 'all' ? undefined : statusFilter);
      setOrders(data);
    } catch (error) {
      console.error('Failed to load purchase orders:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRowClick(order: PurchaseOrder) {
    if (expandedId === order.id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(order.id);
    setDetailLoading(true);
    setDetail(null);
    try {
      const d = await getPurchaseOrder(order.id);
      setDetail(d);
    } catch (error) {
      console.error('Failed to load detail:', error);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleConfirm(id: number) {
    setActionLoading(id);
    try {
      await confirmPurchaseOrder(id);
      await loadOrders();
      setExpandedId(null);
      setDetail(null);
    } catch (error) {
      console.error('Failed to confirm:', error);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancel(id: number) {
    setActionLoading(id);
    try {
      await cancelPurchaseOrder(id);
      await loadOrders();
      setExpandedId(null);
      setDetail(null);
    } catch (error) {
      console.error('Failed to cancel:', error);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRecognize() {
    if (!recognizeText.trim()) return;
    setRecognizing(true);
    setRecognizeResult(null);
    try {
      const result = await recognizePurchaseOrder('text', recognizeText);
      setRecognizeResult(result);
    } catch (error) {
      console.error('Failed to recognize:', error);
    } finally {
      setRecognizing(false);
    }
  }

  async function handleConfirmRecognized() {
    if (!recognizeResult) return;
    setActionLoading(recognizeResult.pending_order.id);
    try {
      await confirmPurchaseOrder(recognizeResult.pending_order.id);
      setShowRecognize(false);
      setRecognizeResult(null);
      setRecognizeText('');
      await loadOrders();
    } catch (error) {
      console.error('Failed to confirm recognized order:', error);
    } finally {
      setActionLoading(null);
    }
  }

  function closeRecognizeModal() {
    setShowRecognize(false);
    setRecognizeResult(null);
    setRecognizeText('');
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-900">采购进货</h1>
        <button
          onClick={() => setShowRecognize(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2"
        >
          <span>🤖</span>
          AI 识别进货单
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        {statusFilters.map(f => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === f.value
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400">
          暂无采购单
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map(order => {
            const statusInfo = statusMap[order.status];
            const isExpanded = expandedId === order.id;
            return (
              <div key={order.id} className="bg-white rounded-lg shadow overflow-hidden">
                <div
                  onClick={() => handleRowClick(order)}
                  className="px-4 py-3 flex items-center gap-4 cursor-pointer hover:bg-gray-50"
                >
                  <span className="text-sm text-gray-400 w-4">{isExpanded ? '▼' : '▶'}</span>
                  <div className="flex-1 grid grid-cols-6 gap-2 items-center">
                    <span className="text-sm font-medium text-blue-600 hover:underline">{order.order_no}</span>
                    <span className="text-sm text-gray-700">{order.supplier_name || '-'}</span>
                    <span className="text-sm text-gray-900 font-medium">¥{order.total_amount.toFixed(2)}</span>
                    <span className="text-xs text-gray-500">{sourceTypeMap[order.source_type]}</span>
                    <span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.cls}`}>
                        {statusInfo.label}
                      </span>
                    </span>
                    <span className="text-xs text-gray-400">{new Date(order.created_at).toLocaleString('zh-CN')}</span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t bg-gray-50 px-4 py-3">
                    {detailLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      </div>
                    ) : detail ? (
                      <div>
                        {order.ai_raw_text && (
                          <div className="mb-3 px-3 py-2 bg-blue-50 border border-blue-100 rounded text-sm text-gray-600">
                            <span className="text-blue-600 font-medium">AI 原文：</span>{order.ai_raw_text}
                          </div>
                        )}
                        <table className="w-full mb-3">
                          <thead>
                            <tr className="border-b">
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">食材</th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">数量</th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">单价</th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">金额</th>
                              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">AI置信度</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.items.map(item => (
                              <tr key={item.id} className="border-b border-gray-100">
                                <td className="px-3 py-2 text-sm font-medium text-gray-900">{item.ingredient_name}</td>
                                <td className="px-3 py-2 text-sm text-gray-700 text-right">{item.quantity} {item.unit}</td>
                                <td className="px-3 py-2 text-sm text-gray-700 text-right">¥{item.unit_price.toFixed(2)}</td>
                                <td className="px-3 py-2 text-sm text-gray-900 text-right font-medium">¥{item.amount.toFixed(2)}</td>
                                <td className={`px-3 py-2 text-sm text-center font-medium ${confidenceColor(item.ai_confidence)}`}>
                                  {(item.ai_confidence * 100).toFixed(0)}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr>
                              <td colSpan={3} className="px-3 py-2 text-right text-sm font-medium text-gray-500">合计</td>
                              <td className="px-3 py-2 text-right text-base font-bold text-blue-600">¥{order.total_amount.toFixed(2)}</td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>

                        {order.status === 'pending' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleConfirm(order.id)}
                              disabled={actionLoading === order.id}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50"
                            >
                              {actionLoading === order.id ? '处理中...' : '确认入库'}
                            </button>
                            <button
                              onClick={() => handleCancel(order.id)}
                              disabled={actionLoading === order.id}
                              className="px-4 py-2 bg-white text-red-600 border border-red-300 rounded-lg hover:bg-red-50 text-sm font-medium disabled:opacity-50"
                            >
                              取消
                            </button>
                          </div>
                        )}
                        {order.note && (
                          <p className="mt-2 text-xs text-gray-400">备注：{order.note}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 py-4 text-center">加载失败</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showRecognize && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white">
              <h3 className="text-lg font-semibold">AI 识别进货单</h3>
              <button onClick={closeRecognizeModal} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="p-4 space-y-4">
              {!recognizeResult ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      输入进货单文本
                    </label>
                    <textarea
                      value={recognizeText}
                      onChange={e => setRecognizeText(e.target.value)}
                      placeholder="例如：今天从张老板那进了15斤牛肉42元/kg，30斤青菜4.5元/kg，100个鸡蛋0.8元/个"
                      rows={5}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                    <p className="mt-1 text-xs text-gray-400">AI 会自动解析食材、数量、单价，生成待确认的采购单</p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={closeRecognizeModal}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleRecognize}
                      disabled={!recognizeText.trim() || recognizing}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
                    >
                      {recognizing ? 'AI 识别中...' : '开始识别'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-blue-700">识别结果</span>
                      <span className="text-xs text-gray-500">{recognizeResult.pending_order.order_no}</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      供应商：{recognizeResult.pending_order.supplier_name || '未识别'}
                    </p>
                    <p className="text-sm text-gray-600">
                      总金额：<span className="font-bold text-blue-600">¥{recognizeResult.pending_order.total_amount.toFixed(2)}</span>
                    </p>
                  </div>

                  {recognizeResult.anomalies.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="text-sm font-medium text-yellow-700 mb-2">⚠️ AI 发现以下异常，请留意：</p>
                      <ul className="space-y-1">
                        {recognizeResult.anomalies.map((a, idx) => (
                          <li key={idx} className="text-sm text-yellow-700 flex items-start gap-2">
                            <span className="text-yellow-500">•</span>
                            <span>{a.message}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">食材</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">数量</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">单价</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">金额</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">置信度</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recognizeResult.pending_order.items.map(item => (
                        <tr key={item.id} className="border-b border-gray-100">
                          <td className="px-3 py-2 text-sm font-medium text-gray-900">{item.ingredient_name}</td>
                          <td className="px-3 py-2 text-sm text-gray-700 text-right">{item.quantity} {item.unit}</td>
                          <td className="px-3 py-2 text-sm text-gray-700 text-right">¥{item.unit_price.toFixed(2)}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 text-right font-medium">¥{item.amount.toFixed(2)}</td>
                          <td className={`px-3 py-2 text-sm text-center font-medium ${confidenceColor(item.ai_confidence)}`}>
                            {(item.ai_confidence * 100).toFixed(0)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => { setRecognizeResult(null); setRecognizeText(''); }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                    >
                      重新识别
                    </button>
                    <button
                      onClick={closeRecognizeModal}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                    >
                      稍后处理
                    </button>
                    <button
                      onClick={handleConfirmRecognized}
                      disabled={actionLoading === recognizeResult.pending_order.id}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50"
                    >
                      {actionLoading === recognizeResult.pending_order.id ? '入库中...' : '确认入库'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
