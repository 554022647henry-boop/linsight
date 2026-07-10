import { useState, useEffect, useMemo } from 'react';
import {
  getInventory,
  getBatches,
  getExpiring,
  getLow,
  type InventorySummary,
  type InventoryBatch,
  type ExpiringBatch,
  type LowStockItem,
} from '../api/inventory';

type TabKey = 'current' | 'batches' | 'expiring' | 'low';

const tabs: { key: TabKey; label: string; icon: string }[] = [
  { key: 'current', label: '当前库存', icon: '📦' },
  { key: 'batches', label: '批次明细', icon: '🏷️' },
  { key: 'expiring', label: '临期预警', icon: '⏰' },
  { key: 'low', label: '低库存', icon: '⚠️' },
];

const batchStatusMap: Record<string, { label: string; cls: string }> = {
  active: { label: '在库', cls: 'bg-green-100 text-green-700' },
  consumed: { label: '已耗', cls: 'bg-gray-100 text-gray-500' },
  expired: { label: '已过期', cls: 'bg-red-100 text-red-700' },
};

export default function Inventory() {
  const [activeTab, setActiveTab] = useState<TabKey>('current');
  const [inventory, setInventory] = useState<InventorySummary[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [expiring, setExpiring] = useState<ExpiringBatch[]>([]);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);

  const ingredientNameMap = useMemo(() => {
    const map = new Map<number, string>();
    inventory.forEach(item => {
      map.set(item.ingredient_id, item.ingredient_name);
    });
    return map;
  }, [inventory]);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  async function loadData() {
    setLoading(true);
    try {
      if (activeTab === 'current') {
        const data = await getInventory();
        setInventory(data);
      } else if (activeTab === 'batches') {
        const [invData, batchData] = await Promise.all([getInventory(), getBatches()]);
        setInventory(invData);
        setBatches(batchData);
      } else if (activeTab === 'expiring') {
        const data = await getExpiring(3);
        setExpiring(data);
      } else if (activeTab === 'low') {
        const data = await getLow();
        setLowStock(data);
      }
    } catch (error) {
      console.error('Failed to load inventory:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-gray-900 mb-3">库存查看</h1>
        <div className="flex gap-2 border-b border-gray-200">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="mr-1">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {activeTab === 'current' && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">食材</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">当前总量</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">单位</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">预警阈值</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-500">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {inventory.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-gray-400">暂无库存数据</td>
                    </tr>
                  ) : (
                    inventory.map(item => (
                      <tr key={item.ingredient_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.ingredient_name}</td>
                        <td className={`px-4 py-3 text-sm text-right font-medium ${item.is_low ? 'text-red-600' : 'text-gray-900'}`}>
                          {(item.total_quantity ?? 0).toFixed(item.unit === '个' ? 0 : 1)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{item.unit}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 text-right">{item.warning_threshold}</td>
                        <td className="px-4 py-3 text-center">
                          {item.is_low ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                              低库存
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              正常
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'batches' && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">食材</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">数量</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">批次号</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">入库日期</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">保质期</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-500">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {batches.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-gray-400">暂无批次数据</td>
                    </tr>
                  ) : (
                    batches.map(batch => {
                      const statusInfo = batchStatusMap[batch.status] || batchStatusMap.active;
                      return (
                        <tr key={batch.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {ingredientNameMap.get(batch.ingredient_id) || `食材#${batch.ingredient_id}`}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">
                            {batch.quantity} {batch.unit}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 font-mono">{batch.batch_no || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{batch.received_date}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{batch.expiry_date || '无'}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.cls}`}>
                              {statusInfo.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'expiring' && (
            <div>
              <div className="mb-3 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                ⏰ 以下批次将在 3 天内过期，请尽快使用
              </div>
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">食材</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">数量</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">批次号</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">到期日</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-500">剩余天数</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {expiring.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-gray-400">暂无临期食材</td>
                      </tr>
                    ) : (
                      expiring.map(item => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.ingredient_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">
                            {item.quantity} {item.unit}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 font-mono">{item.batch_no || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{item.expiry_date}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              item.days_until_expiry <= 0
                                ? 'bg-red-100 text-red-700'
                                : item.days_until_expiry <= 1
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {item.days_until_expiry <= 0 ? '今天到期' : `${item.days_until_expiry} 天`}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'low' && (
            <div>
              <div className="mb-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                ⚠️ 以下食材库存低于预警阈值，建议尽快采购
              </div>
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">食材</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">当前库存</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">预警阈值</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">单位</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">缺口</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lowStock.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-gray-400">所有食材库存充足</td>
                      </tr>
                    ) : (
                      lowStock.map(item => (
                        <tr key={item.ingredient_id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.ingredient_name}</td>
                          <td className="px-4 py-3 text-sm text-red-600 text-right font-medium">
                            {item.current_quantity}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 text-right">{item.warning_threshold}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{item.unit}</td>
                          <td className="px-4 py-3 text-sm text-red-600 text-right font-medium">
                            -{item.deficit}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
