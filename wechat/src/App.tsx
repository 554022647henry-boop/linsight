export default function App() {
  return (
    <div className="min-h-screen bg-[#ededed] p-4">
      <div className="mx-auto max-w-md">
        <header className="mb-3 rounded-lg bg-[#07c160] px-4 py-3 text-center text-white">
          <h1 className="text-base font-medium">Linsight 经营助手</h1>
        </header>
        <div className="space-y-3">
          <div className="rounded-lg bg-white p-3 shadow-sm">
            <p className="text-xs text-gray-400">AI 助手</p>
            <p className="mt-1 text-sm text-gray-800">
              早上好，老王。昨日经营日报已生成，点击查看。
            </p>
          </div>
          <div className="rounded-lg bg-[#95ec69] p-3 shadow-sm">
            <p className="text-xs text-gray-500">老王</p>
            <p className="mt-1 text-sm text-gray-800">（微信聊天 UI，Day 2 实现）</p>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-gray-400">
          骨架就绪。端口 5174，API 代理到 3001。
        </p>
      </div>
    </div>
  );
}
