export default function App() {
  return (
    <div className="min-h-screen bg-orange-50 p-4">
      <div className="mx-auto max-w-md">
        <header className="mb-3">
          <h1 className="text-lg font-bold text-orange-700">老王的快餐店</h1>
          <p className="text-xs text-gray-500">扫码点餐（Demo 模拟）</p>
        </header>
        <div className="space-y-2">
          <div className="rounded-lg bg-white p-3 shadow-sm">
            <p className="text-sm font-medium text-gray-800">青椒肉丝饭</p>
            <p className="text-xs text-gray-500">¥28</p>
          </div>
          <div className="rounded-lg bg-white p-3 shadow-sm">
            <p className="text-sm font-medium text-gray-800">牛腩饭</p>
            <p className="text-xs text-gray-500">¥32</p>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-gray-400">
          骨架就绪。端口 5175，API 代理到 3001。
        </p>
      </div>
    </div>
  );
}
