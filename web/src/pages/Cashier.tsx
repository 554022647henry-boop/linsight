import { useState, useEffect } from 'react';
import { RestaurantTable, Dish, Order, OrderDraftItem, PayMethod } from '../types';
import { getTables, updateTableStatus } from '../api/tables';
import { getDishes } from '../api/dishes';
import { getOrders, createOrder, addOrderItems, checkoutOrder } from '../api/orders';

interface CheckoutForm {
  discountAmount: string;
  payMethod: PayMethod;
  paidAmount: string;
}

const payMethods: { value: PayMethod; label: string }[] = [
  { value: 'cash', label: '现金' },
  { value: 'wechat', label: '微信支付' },
  { value: 'alipay', label: '支付宝' },
  { value: 'aggregated', label: '聚合码' },
];

export default function Cashier() {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [orderDraft, setOrderDraft] = useState<OrderDraftItem[]>([]);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutForm, setCheckoutForm] = useState<CheckoutForm>({
    discountAmount: '',
    payMethod: 'wechat',
    paidAmount: '',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [tablesData, dishesData, ordersData] = await Promise.all([
        getTables(),
        getDishes(undefined, 1),
        getOrders('dining'),
      ]);
      setTables(tablesData);
      setDishes(dishesData);
      setOrders(ordersData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleTableSelect(table: RestaurantTable) {
    setSelectedTable(table);
    if (table.status === 'occupied') {
      const order = orders.find(o => o.table_no === table.table_no);
      setCurrentOrder(order || null);
      setOrderDraft([]);
    } else {
      setCurrentOrder(null);
      setOrderDraft([]);
    }
  }

  function addToDraft(dish: Dish) {
    const existing = orderDraft.find(item => item.dish.id === dish.id);
    if (existing) {
      setOrderDraft(orderDraft.map(item =>
        item.dish.id === dish.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setOrderDraft([...orderDraft, { dish, quantity: 1, note: '' }]);
    }
  }

  function removeFromDraft(dishId: number) {
    setOrderDraft(orderDraft.filter(item => item.dish.id !== dishId));
  }

  function updateQuantity(dishId: number, quantity: number) {
    if (quantity <= 0) {
      removeFromDraft(dishId);
    } else {
      setOrderDraft(orderDraft.map(item =>
        item.dish.id === dishId ? { ...item, quantity } : item
      ));
    }
  }



  async function submitOrder() {
    if (!selectedTable || orderDraft.length === 0) return;
    try {
      const items = orderDraft.map(item => ({
        dish_id: item.dish.id,
        quantity: item.quantity,
        note: item.note || undefined,
      }));

      await createOrder({
        type: 'dine-in',
        table_no: selectedTable.table_no,
        items,
      });

      await updateTableStatus(selectedTable.id, 'occupied');
      loadData();
      setOrderDraft([]);
    } catch (error) {
      console.error('Failed to create order:', error);
    }
  }

  async function handleAddMore() {
    if (!currentOrder || orderDraft.length === 0) return;
    try {
      const items = orderDraft.map(item => ({
        dish_id: item.dish.id,
        quantity: item.quantity,
        note: item.note || undefined,
      }));

      await addOrderItems(currentOrder.id, items);
      loadData();
      setOrderDraft([]);
    } catch (error) {
      console.error('Failed to add items:', error);
    }
  }

  async function handleCheckout() {
    if (!currentOrder) return;
    const discountAmount = parseFloat(checkoutForm.discountAmount) || 0;
    const paidAmount = parseFloat(checkoutForm.paidAmount) || (currentOrder.total_amount - discountAmount);

    try {
      await checkoutOrder(currentOrder.id, {
        discount_amount: discountAmount,
        pay_method: checkoutForm.payMethod,
        paid_amount: paidAmount,
      });

      if (selectedTable) {
        await updateTableStatus(selectedTable.id, 'idle');
      }

      loadData();
      setShowCheckout(false);
      setCurrentOrder(null);
      setOrderDraft([]);
    } catch (error) {
      console.error('Failed to checkout:', error);
    }
  }

  const draftTotal = orderDraft.reduce((sum, item) => sum + item.dish.price * item.quantity, 0);
  const categories = [...new Set(dishes.map(d => d.category))];

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <header className="bg-white shadow px-6 py-4">
        <h1 className="text-xl font-semibold text-gray-900">收银点餐</h1>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 bg-white border-r flex flex-col">
          <div className="p-4 border-b">
            <h3 className="text-sm font-medium text-gray-700 mb-3">桌台</h3>
            <div className="grid grid-cols-3 gap-2">
              {tables.map(table => (
                <button
                  key={table.id}
                  onClick={() => handleTableSelect(table)}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm font-medium transition-all ${
                    selectedTable?.id === table.id
                      ? 'ring-2 ring-blue-500 ring-offset-2'
                      : ''
                  } ${
                    table.status === 'occupied'
                      ? 'bg-orange-100 text-orange-700'
                      : table.status === 'reserved'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {table.table_no}
                  <span className="text-xs opacity-70">{table.capacity}人</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">菜品菜单</h3>
            {categories.map(category => (
              <div key={category} className="mb-4">
                <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">{category}</h4>
                <div className="space-y-2">
                  {dishes.filter(d => d.category === category).map(dish => (
                    <div
                      key={dish.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                      onClick={() => addToDraft(dish)}
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{dish.name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-blue-600">¥{dish.price}</span>
                        <button className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs hover:bg-blue-700">
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : !selectedTable ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <div className="text-6xl mb-4">🪑</div>
              <p>请选择桌台开始点餐</p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">桌台 {selectedTable.table_no}</h2>
                <span className={`px-3 py-1 rounded-full text-sm ${
                  selectedTable.status === 'occupied'
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-green-100 text-green-700'
                }`}>
                  {selectedTable.status === 'occupied' ? '就餐中' : '空闲'}
                </span>
              </div>

              {currentOrder ? (
                <div className="bg-white rounded-lg shadow mb-4">
                  <div className="p-4 border-b flex justify-between items-center">
                    <span className="text-sm text-gray-500">订单号: {currentOrder.order_no}</span>
                    <span className="text-sm text-gray-500">{new Date(currentOrder.created_at).toLocaleTimeString()}</span>
                  </div>
                  <div className="p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">已点菜品</h4>
                    <div className="space-y-2">
                      {orders.find(o => o.id === currentOrder.id) && (
                        <div className="text-right text-lg font-bold text-blue-600">
                          ¥{currentOrder.total_amount.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="p-4 border-t flex gap-2">
                    <button
                      onClick={() => setShowCheckout(true)}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      结账
                    </button>
                  </div>
                </div>
              ) : null}

              {orderDraft.length > 0 && (
                <div className="bg-white rounded-lg shadow">
                  <div className="p-4 border-b">
                    <h4 className="text-sm font-medium text-gray-700">点餐清单</h4>
                  </div>
                  <div className="p-4 space-y-3">
                    {orderDraft.map(item => (
                      <div key={item.dish.id} className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{item.dish.name}</span>
                            <span className="text-sm text-gray-500">¥{item.dish.price}</span>
                          </div>
                          {item.note && (
                            <p className="text-xs text-gray-500">{item.note}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.dish.id, item.quantity - 1)}
                            className="w-6 h-6 border rounded flex items-center justify-center hover:bg-gray-100"
                          >
                            -
                          </button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.dish.id, item.quantity + 1)}
                            className="w-6 h-6 bg-blue-600 text-white rounded flex items-center justify-center hover:bg-blue-700"
                          >
                            +
                          </button>
                          <button
                            onClick={() => removeFromDraft(item.dish.id)}
                            className="w-6 h-6 text-red-500 hover:bg-red-50 rounded flex items-center justify-center"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 border-t">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-gray-600">合计</span>
                      <span className="text-xl font-bold text-blue-600">¥{draftTotal.toFixed(2)}</span>
                    </div>
                    <button
                      onClick={currentOrder ? handleAddMore : submitOrder}
                      className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                    >
                      {currentOrder ? '加菜' : '提交订单'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showCheckout && currentOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold">结账</h3>
              <button onClick={() => setShowCheckout(false)} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">订单金额</span>
                  <span className="font-medium">¥{currentOrder.total_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">应付金额</span>
                  <span className="text-xl font-bold text-blue-600">
                    ¥{(currentOrder.total_amount - (parseFloat(checkoutForm.discountAmount) || 0)).toFixed(2)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">折扣金额</label>
                <input
                  type="number"
                  step="0.01"
                  value={checkoutForm.discountAmount}
                  onChange={e => setCheckoutForm({ ...checkoutForm, discountAmount: e.target.value })}
                  placeholder="输入折扣金额"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">支付方式</label>
                <div className="grid grid-cols-2 gap-2">
                  {payMethods.map(method => (
                    <button
                      key={method.value}
                      onClick={() => setCheckoutForm({ ...checkoutForm, payMethod: method.value })}
                      className={`px-3 py-2 rounded-lg border transition-colors ${
                        checkoutForm.payMethod === method.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {method.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">实收金额</label>
                <input
                  type="number"
                  step="0.01"
                  value={checkoutForm.paidAmount}
                  onChange={e => setCheckoutForm({ ...checkoutForm, paidAmount: e.target.value })}
                  placeholder="自动填充"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCheckout(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={handleCheckout}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  确认收款
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}