import { useState, useEffect } from 'react';
import { RestaurantTable, TableStatus } from '../types';
import { getTables, createTable, updateTable, updateTableStatus, deleteTable } from '../api/tables';

function errMsg(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message: unknown }).message;
    if (typeof msg === 'string' && msg) return msg;
  }
  return fallback;
}

const statusConfig: Record<TableStatus, { label: string; badge: string }> = {
  idle: { label: '空闲', badge: 'bg-green-100 text-green-700' },
  occupied: { label: '就餐中', badge: 'bg-orange-100 text-orange-700' },
  reserved: { label: '已预订', badge: 'bg-yellow-100 text-yellow-700' },
};

const statusOptions: { value: TableStatus; label: string }[] = [
  { value: 'idle', label: '空闲' },
  { value: 'occupied', label: '就餐' },
  { value: 'reserved', label: '预订' },
];

interface FormState {
  table_no: string;
  capacity: string;
}

export default function Tables() {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);
  const [form, setForm] = useState<FormState>({ table_no: '', capacity: '4' });
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [formError, setFormError] = useState<string>('');

  useEffect(() => {
    void loadTables();
  }, []);

  async function loadTables(): Promise<void> {
    setLoading(true);
    setError('');
    try {
      const data = await getTables();
      setTables(data);
    } catch (err) {
      setError(errMsg(err, '加载桌台失败'));
    } finally {
      setLoading(false);
    }
  }

  function openAdd(): void {
    setEditingTable(null);
    setForm({ table_no: '', capacity: '4' });
    setFormError('');
    setShowForm(true);
  }

  function openEdit(table: RestaurantTable): void {
    setEditingTable(table);
    setForm({ table_no: table.table_no, capacity: String(table.capacity) });
    setFormError('');
    setShowForm(true);
  }

  async function handleSave(): Promise<void> {
    const tableNo = form.table_no.trim();
    if (!tableNo) {
      setFormError('请输入桌号');
      return;
    }
    const capacity = parseInt(form.capacity, 10) || 4;
    setSubmitting(true);
    setFormError('');
    try {
      if (editingTable) {
        const updated = await updateTable(editingTable.id, { table_no: tableNo, capacity });
        setTables(prev => prev.map(t => (t.id === editingTable.id ? updated : t)));
      } else {
        const result = await createTable({ table_no: tableNo, capacity });
        setTables(prev => [...prev, result.data]);
      }
      setShowForm(false);
    } catch (err) {
      setFormError(errMsg(err, '保存失败'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(table: RestaurantTable, status: TableStatus): Promise<void> {
    try {
      await updateTableStatus(table.id, status);
      setTables(prev => prev.map(t => (t.id === table.id ? { ...t, status } : t)));
    } catch (err) {
      setError(errMsg(err, '切换状态失败'));
    }
  }

  async function handleDelete(table: RestaurantTable): Promise<void> {
    if (!window.confirm(`确认删除桌台 ${table.table_no}？`)) return;
    try {
      await deleteTable(table.id);
      setTables(prev => prev.filter(t => t.id !== table.id));
    } catch (err) {
      setError(errMsg(err, '删除失败'));
    }
  }

  const counts = {
    total: tables.length,
    idle: tables.filter(t => t.status === 'idle').length,
    occupied: tables.filter(t => t.status === 'occupied').length,
    reserved: tables.filter(t => t.status === 'reserved').length,
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <header className="bg-white shadow px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">桌台管理</h1>
        <button
          onClick={openAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          + 新增桌台
        </button>
      </header>

      <div className="flex-1 p-6 overflow-y-auto">
        {error && (
          <div className="bg-red-50 text-red-600 rounded-lg px-4 py-2 mb-4 text-sm">{error}</div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">总桌台</p>
            <p className="text-2xl font-bold text-gray-900">{counts.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">空闲</p>
            <p className="text-2xl font-bold text-green-600">{counts.idle}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">就餐中</p>
            <p className="text-2xl font-bold text-orange-600">{counts.occupied}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">已预订</p>
            <p className="text-2xl font-bold text-yellow-600">{counts.reserved}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : tables.length === 0 ? (
          <div className="bg-white rounded-lg shadow py-16 text-center">
            <div className="text-5xl mb-3">🪑</div>
            <p className="text-gray-500 mb-4">暂无桌台，点击新增</p>
            <button
              onClick={openAdd}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              新增桌台
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {tables.map(table => {
              const cfg = statusConfig[table.status];
              return (
                <div key={table.id} className="bg-white rounded-lg shadow p-4 flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-gray-900">{table.table_no}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">容量 {table.capacity} 人</p>
                    </div>
                    <QrPlaceholder text={table.table_no} />
                  </div>

                  <div className="flex gap-1 mb-3">
                    {statusOptions.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => void handleStatusChange(table, opt.value)}
                        className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                          table.status === opt.value
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2 mt-auto">
                    <button
                      onClick={() => openEdit(table)}
                      className="flex-1 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => void handleDelete(table)}
                      className="px-3 py-1.5 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 text-sm"
                    >
                      删除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold">{editingTable ? '编辑桌台' : '新增桌台'}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">桌号</label>
                <input
                  type="text"
                  value={form.table_no}
                  onChange={e => setForm({ ...form, table_no: e.target.value })}
                  placeholder="如 A1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">容量（人）</label>
                <input
                  type="number"
                  min="1"
                  value={form.capacity}
                  onChange={e => setForm({ ...form, capacity: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={() => void handleSave()}
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QrPlaceholder({ text }: { text: string }) {
  const cells = Array.from({ length: 25 }, (_, i) => {
    const code = text.length > 0 ? text.charCodeAt(i % text.length) : 0;
    return (code * 31 + i * 7) % 3 === 0;
  });
  return (
    <div className="bg-white border border-gray-200 rounded p-1 w-12 h-12 shrink-0" title="扫码点餐二维码">
      <div className="grid grid-cols-5 grid-rows-5 gap-px w-full h-full">
        {cells.map((on, i) => (
          <div key={i} className={on ? 'bg-gray-900' : 'bg-white'} />
        ))}
      </div>
    </div>
  );
}
