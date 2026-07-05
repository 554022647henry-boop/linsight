/**
 * 微信聊天页 — 老板与 Linsight AI 助手对话
 */
import { useEffect, useRef, useState } from 'react';
import { getSessions, getSessionMessages, sendMessage } from '../api/chat';
import type { ChatLog, CardPayload } from '../types';

const DEFAULT_SESSION = 'default';

export default function ChatPage() {
  const [sessionId, setSessionId] = useState<string>('');
  const [messages, setMessages] = useState<ChatLog[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 进入页面：拉会话列表，默认选第一个；没有则 fallback 到 default
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const sessions = await getSessions();
        const sid = sessions[0]?.session_id || DEFAULT_SESSION;
        setSessionId(sid);
        const msgs = await getSessionMessages(sid);
        setMessages(msgs);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 消息更新后滚到底
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || !sessionId || sending) return;
    setSending(true);
    setError(null);
    try {
      const resp = await sendMessage(sessionId, 'text', text);
      setMessages(prev => [...prev, resp.received, ...resp.ai_replies]);
      setInput('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  async function handleImage() {
    const url = window.prompt('请输入图片 URL（Demo 占位，真实接入走文件上传）');
    if (!url || !sessionId) return;
    setSending(true);
    setError(null);
    try {
      const resp = await sendMessage(sessionId, 'image', url);
      setMessages(prev => [...prev, resp.received, ...resp.ai_replies]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  function handleVoice() {
    const text = window.prompt('请输入语音转写文本（Demo 占位）');
    if (!text || !sessionId) return;
    setSending(true);
    setError(null);
    (async () => {
      try {
        const resp = await sendMessage(sessionId, 'voice', text);
        setMessages(prev => [...prev, resp.received, ...resp.ai_replies]);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setSending(false);
      }
    })();
  }

  return (
    <div className="flex h-full flex-col bg-[#ededed]">
      {/* 顶部 header */}
      <header className="flex items-center justify-center bg-[#07c160] px-4 py-3 text-white">
        <h1 className="text-base font-medium">Linsight 经营助手</h1>
      </header>

      {/* 消息列表 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
        {loading && (
          <div className="py-4 text-center text-xs text-gray-400">加载中...</div>
        )}
        {error && (
          <div className="mx-auto my-2 max-w-[90%] rounded bg-red-50 px-3 py-2 text-center text-xs text-red-600">
            {error}
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="py-4 text-center text-xs text-gray-400">
            暂无消息，发条消息开始对话吧
          </div>
        )}
        <div className="space-y-3">
          {messages.map(m => (
            <MessageBubble key={m.id} log={m} />
          ))}
        </div>
      </div>

      {/* 底部输入栏 */}
      <footer className="flex items-center gap-2 border-t border-gray-200 bg-[#f7f7f7] px-3 py-2">
        <button
          type="button"
          onClick={handleVoice}
          disabled={sending || !sessionId}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-lg text-gray-600 shadow-sm disabled:opacity-40"
          aria-label="语音"
          title="语音"
        >
          🎤
        </button>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleSend();
          }}
          placeholder="发消息..."
          className="flex-1 rounded-full bg-white px-4 py-2 text-sm outline-none ring-1 ring-gray-200 focus:ring-[#07c160]"
          disabled={sending || !sessionId}
        />
        <button
          type="button"
          onClick={handleImage}
          disabled={sending || !sessionId}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-lg shadow-sm disabled:opacity-40"
          aria-label="图片"
          title="图片"
        >
          ＋
        </button>
        {input.trim() && (
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !sessionId}
            className="shrink-0 rounded-full bg-[#07c160] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            发送
          </button>
        )}
      </footer>
    </div>
  );
}

function MessageBubble({ log }: { log: ChatLog }) {
  const isOutgoing = log.direction === 'outgoing';

  if (log.message_type === 'card') {
    let card: CardPayload | null = null;
    try {
      card = JSON.parse(log.content) as CardPayload;
    } catch {
      card = null;
    }
    return (
      <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
        <div className="max-w-[80%] rounded-lg bg-white p-3 text-sm shadow-sm">
          <CardView card={card} raw={log.content} />
        </div>
      </div>
    );
  }

  if (log.message_type === 'image') {
    return (
      <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
        <div className="max-w-[80%] overflow-hidden rounded-lg bg-white p-2 shadow-sm">
          {log.content.startsWith('http') ? (
            <img src={log.content} alt="图片" className="max-h-48 rounded" />
          ) : (
            <p className="px-2 py-3 text-xs text-gray-500">[图片] {log.content}</p>
          )}
        </div>
      </div>
    );
  }

  if (log.message_type === 'voice') {
    return (
      <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm ${
            isOutgoing ? 'bg-[#95ec69]' : 'bg-white'
          }`}
        >
          <span className="mr-1">🎤</span>
          <span>{log.content}</span>
        </div>
      </div>
    );
  }

  // text
  return (
    <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm shadow-sm ${
          isOutgoing ? 'bg-[#95ec69]' : 'bg-white'
        }`}
      >
        {log.content}
      </div>
    </div>
  );
}

function CardView({ card, raw }: { card: CardPayload | null; raw: string }) {
  if (!card) {
    return <p className="text-xs text-gray-500">[卡片消息] {raw}</p>;
  }

  if (card.type === 'daily_report') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-base">📊</span>
          <span className="font-medium text-gray-800">
            {card.date ? `${card.date} 经营日报` : '经营日报'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Metric label="营收" value={card.revenue} unit="元" />
          <Metric label="毛利" value={card.gross_profit} unit="元" />
          <Metric label="毛利率" value={card.gross_margin} unit="%" />
          <Metric label="净利" value={card.net_profit} unit="元" />
          <Metric label="客流" value={card.customer_count} unit="人" />
          <Metric label="客单价" value={card.avg_transaction} unit="元" />
        </div>
        {card.summary && (
          <p className="border-t border-gray-100 pt-2 text-xs text-gray-700">{card.summary}</p>
        )}
        {card.suggestion && (
          <p className="text-xs text-[#07c160]">💡 {card.suggestion}</p>
        )}
      </div>
    );
  }

  if (card.type === 'purchase_order_preview') {
    const items = card.items || [];
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-base">🧾</span>
          <span className="font-medium text-gray-800">进货单识别</span>
        </div>
        {card.message && <p className="text-xs text-gray-600">{card.message}</p>}
        {items.length > 0 ? (
          <ul className="space-y-1 text-xs">
            {items.map((it, i) => (
              <li key={i} className="flex justify-between">
                <span>{it.name} × {it.quantity}{it.unit}</span>
                <span>{it.amount}元</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-gray-400">（暂无明细）</p>
        )}
      </div>
    );
  }

  return <p className="text-xs text-gray-600">[卡片] {raw}</p>;
}

function Metric({ label, value, unit }: { label: string; value: unknown; unit: string }) {
  const v = typeof value === 'number' ? value.toFixed(unit === '%' ? 1 : 0) : '—';
  return (
    <div className="rounded bg-gray-50 px-2 py-1">
      <div className="text-gray-400">{label}</div>
      <div className="font-medium text-gray-800">
        {v}
        <span className="ml-0.5 text-[10px] text-gray-400">{unit}</span>
      </div>
    </div>
  );
}
