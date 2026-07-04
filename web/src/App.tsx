import { useState } from 'react';
import { Route, Routes, Link, useLocation } from 'react-router-dom';
import Cashier from './pages/Cashier';
import DishManagement from './pages/DishManagement';
import KitchenBoard from './pages/KitchenBoard';

function Layout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navItems = [
    { path: '/', label: '收银点餐', icon: '💳' },
    { path: '/kitchen', label: '厨房看板', icon: '🍳' },
    { path: '/dishes', label: '菜品管理', icon: '🍽️' },
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
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                location.pathname === item.path
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="bg-white shadow px-6 py-4 flex items-center justify-between">
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
          <Routes>
            <Route path="/kitchen" element={<KitchenBoard />} />
            <Route path="/dishes" element={<DishManagement />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return <Layout />;
}