import { useState, useEffect } from 'react';
import { Order, OrderItem } from '../types';
import { getOrders, getOrder, updateOrderItem } from '../api/orders';
export default function KitchenBoard() {
 const [orders, setOrders] = useState<Order[]>([]);
 const [orderDetails, setOrderDetails] = useState<Map<number, Order & {
 items: OrderItem[];
 payments: any[];
 }>>(new Map());
 const [loading, setLoading] = useState(true);
 useEffect(() => {
 loadOrders();
 }, []);
 async function loadOrders() {
 setLoading(true);
 try {
 const diningOrders = await getOrders('dining');
 setOrders(diningOrders);
 const detailsMap = new Map<number, Order & {
 items: OrderItem[];
 payments: any[];
 }>();
 for (const order of diningOrders) {
 const details = await getOrder(order.id);
 detailsMap.set(order.id, details);
 }
 setOrderDetails(detailsMap);
 }
 catch (error) {
 console.error('Failed to load orders:', error);
 }
 finally {
 setLoading(false);
 }
 }
 async function handleMarkServed(orderId: number, itemId: number) {
 try {
 await updateOrderItem(orderId, itemId, { status: 'served' });
 loadOrders();
 }
 catch (error) {
 console.error('Failed to mark as served:', error);
 }
 }
 function getStatusLabel(status: string) {
 switch (status) {
 case 'ordered': return { label: '待出餐', className: 'bg-yellow-100 text-yellow-700' };
 case 'served': return { label: '已出餐', className: 'bg-green-100 text-green-700' };
 case 'cancelled': return { label: '已取消', className: 'bg-gray-100 text-gray-500' };
 default: return { label: status, className: 'bg-gray-100 text-gray-600' };
 }
 }
 function getOrderTypeLabel(type: string) {
 switch (type) {
 case 'dine-in': return '堂食';
 case 'takeout': return '外带';
 case 'quick': return '快餐';
 default: return type;
 }
 }
 return (<div className="p-6">
 <div className="flex items-center justify-between mb-6">
 <h2 className="text-xl font-semibold text-gray-900">厨房看板</h2>
 <button onClick={loadOrders} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
 刷新
 </button>
 </div>

 {loading ? (<div className="flex items-center justify-center py-12">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
 </div>) : orders.length === 0 ? (<div className="bg-white rounded-lg shadow p-12 text-center">
 <div className="text-6xl mb-4">🍳</div>
 <p className="text-gray-500">暂无待处理订单</p>
 </div>) : (<div className="space-y-4">
 {orders.map(order => {
 const details = orderDetails.get(order.id);
 return (<div key={order.id} className="bg-white rounded-lg shadow overflow-hidden">
 <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3">
 <div className="flex justify-between items-center">
 <div className="flex items-center gap-4">
 <span className="text-white font-semibold">订单 {order.order_no}</span>
 <span className="text-white/80 text-sm">
 {getOrderTypeLabel(order.type)}
 </span>
 {order.table_no && (<span className="text-white/80 text-sm">桌台 {order.table_no}</span>)}
 </div>
 <span className="text-white/80 text-sm">
 {new Date(order.created_at).toLocaleTimeString()}
 </span>
 </div>
 </div>

 <div className="p-4">
 {details?.items && details.items.length > 0 ? (<div className="space-y-3">
 {details.items.map(item => {
 const statusInfo = getStatusLabel(item.status);
 return (<div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
 <div className="flex-1">
 <div className="flex items-center gap-2">
 <span className="font-medium text-gray-900">{item.dish_name}</span>
 <span className="text-sm text-gray-500">×{item.quantity}</span>
 <span className="text-sm text-blue-600">¥{item.amount.toFixed(2)}</span>
 </div>
 {item.note && (<p className="text-xs text-gray-500 mt-1">{item.note}</p>)}
 </div>
 <div className="flex items-center gap-3">
 <span className={`px-2 py-1 rounded-full text-xs ${statusInfo.className}`}>
 {statusInfo.label}
 </span>
 {item.status !== 'served' && item.status !== 'cancelled' && (<button onClick={() => handleMarkServed(order.id, item.id)} className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors">
 已出餐
 </button>)}
 </div>
 </div>);
 })}
 </div>) : (<p className="text-gray-500 text-center py-4">暂无菜品信息</p>)}

 <div className="mt-4 pt-4 border-t flex justify-between items-center">
 <span className="text-gray-600">菜品合计: {order.items_count} 份</span>
 <span className="text-xl font-bold text-blue-600">¥{order.total_amount.toFixed(2)}</span>
 </div>
 </div>
 </div>);
 })}
 </div>)}
 </div>);
}

