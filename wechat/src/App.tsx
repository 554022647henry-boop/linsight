import { HashRouter, Routes, Route, NavLink } from 'react-router-dom';
import ChatPage from './pages/ChatPage';
import ReportList from './pages/ReportList';
import InventoryCheck from './pages/InventoryCheck';
import Insights from './pages/Insights';

export default function App() {
  return (
    <HashRouter>
      <div className="mx-auto flex h-screen max-w-md flex-col bg-[#ededed]">
        <div className="flex flex-1 flex-col overflow-hidden">
          <Routes>
            <Route path="/" element={<ChatPage />} />
            <Route path="/reports" element={<ReportList />} />
            <Route path="/check" element={<InventoryCheck />} />
            <Route path="/insights" element={<Insights />} />
          </Routes>
        </div>
        <nav className="flex shrink-0 border-t border-gray-200 bg-white">
          <TabItem to="/" label="聊天" icon="💬" />
          <TabItem to="/reports" label="日报" icon="📊" />
          <TabItem to="/check" label="盘点" icon="⚖️" />
          <TabItem to="/insights" label="洞察" icon="🔔" />
        </nav>
      </div>
    </HashRouter>
  );
}

function TabItem({ to, label, icon }: { to: string; label: string; icon: string }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
          isActive ? 'text-[#07c160]' : 'text-gray-500'
        }`
      }
    >
      <span className="text-lg leading-none">{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}
