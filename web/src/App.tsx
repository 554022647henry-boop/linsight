import { useState, lazy, Suspense } from 'react';
import type { ComponentType } from 'react';
import { Route, Routes, Link, useLocation } from 'react-router-dom';
import Cashier from './pages/Cashier';
import DishManagement from './pages/DishManagement';
import KitchenBoard from './pages/KitchenBoard';
import Inventory from './pages/Inventory';
import PurchaseOrders from './pages/PurchaseOrders';

// W5/W9 并行开发中的页面，用 lazy 加载；文件暂缺时回退到占位组件，不阻断其他路由
const Placeholder: ComponentType = () => (
  <div className="p-12 text-center text-gray-400">页面开发中...</div>
);

function lazyPage<T extends ComponentType>(factory: () => Promise<{ default: T }>) {
  return lazy(() => factory().catch(() => ({ default: Placeholder as unknown as T })));
}

// W5 建
const LossRecords = lazyPage(() => import(/* @vite-ignore */ './pages/LossRecords'));
const DailySummary = lazyPage(() => import(/* @vite-ignore */ './pages/DailySummary'));
const OrderQuery = lazyPage(() => import(/* @vite-ignore */ './pages/OrderQuery'));
// W9 建
const Tables = lazyPage(() => import(/* @vite-ignore */ './pages/Tables'));
const Refund = lazyPage(() => import(/* @vite-ignore */ './pages/Refund'));
const DailyClose = lazyPage(() => import(/* @vite-ignore */ './pages/DailyClose'));

function Layout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navItems = [
    { path: '/', label: '收银点餐', icon: '💳' },
    { path: '/kitchen', label: '厨房看板', icon: '🍳' },
    { path: '/tables', label: '桌台管理', icon: '🪑' },
    { path: '/orders', label: '订单查询', icon: '📋' },
    { path: '/dishes', label: '菜品管理', icon: '🍽️' },
    { path: '/inventory', label: '库存查看', icon: '📦' },
    { path: '/purchases', label: '采购进货', icon: '🚚' },
    { path: '/daily-close', label: '日结', icon: '📊' },
    { path: '/loss', label: '损耗监控', icon: '⚠️' },
    { path: '/reports', label: '经营日报', icon: '📈' },
    { path: '/refund', label: '退款管理', icon: '↩️' },
  ];

  const isCashier = location.pathname === '/';

  if (isCashier) {
    return <Cashier />;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <aside className={`${sidebarOpen ? 'w-64' : 'w-0'} bg-gray-900 text-white transition-all duration-300 overflow-hidden flex flex-col`}>
        <div className="p-6 border-b border-gray-700">
          <h1 className="text-xl font-bold">Linsight</h1>
          <p className="text-sm text-gray-400">餐饮管理系统</p>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                location.pathname === item.path
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="bg-white shadow px-6 py-4 flex items-center">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-500 hover:text-gray-700 mr-4"
          >
            {sidebarOpen ? '←' : '→'}
          </button>
          <h2 className="text-lg font-semibold text-gray-900">
            {navItems.find(item => item.path === location.pathname)?.label}
          </h2>
        </header>
        <main className="flex-1 overflow-y-auto">
          <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
            <Routes>
              <Route path="/kitchen" element={<KitchenBoard />} />
              <Route path="/tables" element={<Tables />} />
              <Route path="/orders" element={<OrderQuery />} />
              <Route path="/dishes" element={<DishManagement />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/purchases" element={<PurchaseOrders />} />
              <Route path="/daily-close" element={<DailyClose />} />
              <Route path="/loss" element={<LossRecords />} />
              <Route path="/reports" element={<DailySummary />} />
              <Route path="/refund" element={<Refund />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return <Layout />;
}
