/**
 * 微信聊天页 — 老板与 Linsight AI 助手对话
 */
import { useEffect, useRef, useState } from 'react';
import { getSessions, getSessionMessages, sendMessage } from '../api/chat';
import { confirmPurchaseOrder, cancelPurchaseOrder } from '../api/purchase-orders';
import type { ChatLog, CardPayload } from '../types';

const DEFAULT_SESSION = 'default';

/** 预设进货单文本（Demo 一键体验，以 image 类型发给后端识别） */
const PRESET_PURCHASE_TEXTS = [
  '张记生鲜：牛肉 15斤 42元/斤，青菜 30斤 4.5元/斤，鸡蛋 100个 0.85元/个',
  '李氏粮油：大米 20kg 8元/kg，食用油 5L 20元/L',
  '王氏水产：鸡肉 12kg 18元/kg，西红柿 30kg 5元/kg',
];

/** 进货单预览卡片完整契约（W1 后端返回） */
interface PurchasePreviewItem {
  item_id?: number;
  name: string;
  quantity: number;
  unit: string;
  unit_price?: number;
  amount: number;
  ai_confidence?: number;
}
interface PurchaseAnomaly {
  item_id?: number;
  type?: string;
  message: string;
}
interface PurchasePreviewCard {
  type: 'purchase_order_preview';
  order_id?: number;
  supplier_name?: string;
  total_amount?: number;
  items?: PurchasePreviewItem[];
  anomalies?: PurchaseAnomaly[];
  message?: string;
}

export default function ChatPage() {
  const [sessionId, setSessionId] = useState<string>('');
  const [messages, setMessages] = useState<ChatLog[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showImagePicker, setShowImagePicker] = useState(false);
  /** 已处理的进货单：order_id -> 'confirmed' | 'cancelled' */
  const [finishedOrders, setFinishedOrders] = useState<Record<number, 'confirmed' | 'cancelled'>>({});
  /** 正在调用 confirm/cancel 的 order_id */
  const [cardActionLoading, setCardActionLoading] = useState<number | null>(null);
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

  /** 以 image 类型发送内容（预设进货单文本或自定义 URL） */
  async function sendImageContent(content: string) {
    if (!content || !sessionId || sending) return;
    setShowImagePicker(false);
    setSending(true);
    setError(null);
    try {
      const resp = await sendMessage(sessionId, 'image', content);
      setMessages(prev => [...prev, resp.received, ...resp.ai_replies]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  function handleImage() {
    setShowImagePicker(true);
  }

  function handleCustomImageUrl() {
    const url = window.prompt('请输入图片 URL（Demo 占位，真实接入走文件上传）');
    if (url) void sendImageContent(url);
  }

  /** 追加一条本地 AI 文本回复 */
  function appendAiText(text: string) {
    const aiReply: ChatLog = {
      id: Date.now(),
      session_id: sessionId,
      direction: 'outgoing',
      message_type: 'text',
      content: text,
      ai_action: 'purchase_card_action',
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, aiReply]);
  }

  async function handleConfirmOrder(orderId: number) {
    setCardActionLoading(orderId);
    setError(null);
    try {
      await confirmPurchaseOrder(orderId);
      setFinishedOrders(prev => ({ ...prev, [orderId]: 'confirmed' }));
      appendAiText('✅ 进货单已确认入库，库存已更新');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCardActionLoading(null);
    }
  }

  async function handleCancelOrder(orderId: number) {
    setCardActionLoading(orderId);
    setError(null);
    try {
      await cancelPurchaseOrder(orderId);
      setFinishedOrders(prev => ({ ...prev, [orderId]: 'cancelled' }));
      appendAiText('已取消该进货单');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCardActionLoading(null);
    }
  }

  function handleVoice() {
    const text = window.prompt('请输入语音转写文本（Demo 占位，例如：今天牛肉还剩8斤青菜3斤）');
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
          {messages.map(m => {
            let orderState: 'confirmed' | 'cancelled' | undefined;
            if (m.message_type === 'card') {
              try {
                const c = JSON.parse(m.content) as CardPayload;
                if (
                  c.type === 'purchase_order_preview' &&
                  typeof c.order_id === 'number'
                ) {
                  orderState = finishedOrders[c.order_id];
                }
              } catch {
                /* ignore */
              }
            }
            return (
              <MessageBubble
                key={m.id}
                log={m}
                orderState={orderState}
                onConfirm={handleConfirmOrder}
                onCancel={handleCancelOrder}
                actionLoading={cardActionLoading}
              />
            );
          })}
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

      {/* 进货单选择底部 sheet */}
      {showImagePicker && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowImagePicker(false)}
          />
          <div className="relative rounded-t-2xl bg-white p-4">
            <div className="mb-3 text-center text-xs text-gray-400">
              选择预设进货单（Demo 演示）
            </div>
            <div className="space-y-2">
              {PRESET_PURCHASE_TEXTS.map((t, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => sendImageContent(t)}
                  disabled={sending}
                  className="block w-full rounded-lg bg-gray-50 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-40"
                >
                  {t}
                </button>
              ))}
              <button
                type="button"
                onClick={handleCustomImageUrl}
                disabled={sending}
                className="block w-full rounded-lg bg-gray-50 px-3 py-2 text-left text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-40"
              >
                📷 自定义图片 URL（占位）…
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowImagePicker(false)}
              className="mt-3 block w-full rounded-lg bg-gray-100 px-3 py-2 text-center text-xs text-gray-500"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface MessageBubbleProps {
  log: ChatLog;
  orderState?: 'confirmed' | 'cancelled';
  onConfirm?: (orderId: number) => void;
  onCancel?: (orderId: number) => void;
  actionLoading?: number | null;
}

function MessageBubble({ log, orderState, onConfirm, onCancel, actionLoading }: MessageBubbleProps) {
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
          <CardView
            card={card}
            raw={log.content}
            orderState={orderState}
            onConfirm={onConfirm}
            onCancel={onCancel}
            actionLoading={actionLoading}
          />
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
            <div className="px-2 py-2 text-xs text-gray-700">
              <div className="mb-1 text-[10px] text-gray-400">📷 拍照进货单</div>
              <div className="whitespace-pre-wrap">{log.content}</div>
            </div>
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

interface CardViewProps {
  card: CardPayload | null;
  raw: string;
  orderState?: 'confirmed' | 'cancelled';
  onConfirm?: (orderId: number) => void;
  onCancel?: (orderId: number) => void;
  actionLoading?: number | null;
}

function CardView({ card, raw, orderState, onConfirm, onCancel, actionLoading }: CardViewProps) {
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
    const pc = card as unknown as PurchasePreviewCard;
    const items = pc.items || [];
    const anomalies = pc.anomalies || [];
    const orderId = pc.order_id;
    const isFinished = orderState === 'confirmed' || orderState === 'cancelled';
    const isLoading = actionLoading != null && actionLoading === orderId;
    const canAct =
      typeof orderId === 'number' && !!onConfirm && !!onCancel && !isFinished;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-base">🧾</span>
          <span className="font-medium text-gray-800">进货单识别</span>
          {pc.supplier_name && (
            <span className="text-xs text-gray-500">· {pc.supplier_name}</span>
          )}
        </div>
        {pc.message && <p className="text-xs text-gray-600">{pc.message}</p>}
        {items.length > 0 ? (
          <ul className="space-y-1 text-xs">
            {items.map((it, i) => (
              <li key={i} className="border-b border-gray-50 pb-1">
                <div className="flex justify-between">
                  <span>
                    {it.name} × {it.quantity}
                    {it.unit}
                  </span>
                  <span>{it.amount}元</span>
                </div>
                <div className="text-[10px] text-gray-400">
                  单价 {it.unit_price ?? '—'} 元
                  {typeof it.ai_confidence === 'number'
                    ? ` · 置信度 ${(it.ai_confidence * 100).toFixed(0)}%`
                    : ''}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-gray-400">（暂无明细）</p>
        )}
        {anomalies.length > 0 && (
          <div className="space-y-1 rounded bg-red-50 p-2">
            {anomalies.map((a, i) => (
              <p key={i} className="text-xs text-red-600">
                ⚠ {a.message}
              </p>
            ))}
          </div>
        )}
        {typeof pc.total_amount === 'number' && (
          <div className="flex justify-between border-t border-gray-100 pt-1 text-xs">
            <span className="text-gray-500">合计</span>
            <span className="font-medium text-gray-800">{pc.total_amount} 元</span>
          </div>
        )}
        {isFinished ? (
          <div className="border-t border-gray-100 pt-2 text-center text-xs text-gray-500">
            {orderState === 'confirmed' ? '✅ 已确认入库' : '已取消该进货单'}
          </div>
        ) : canAct ? (
          <div className="flex gap-2 border-t border-gray-100 pt-2">
            <button
              type="button"
              onClick={() => onConfirm!(orderId!)}
              disabled={isLoading}
              className="flex-1 rounded bg-[#07c160] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
            >
              {isLoading ? '处理中...' : '确认入库'}
            </button>
            <button
              type="button"
              onClick={() => onCancel!(orderId!)}
              disabled={isLoading}
              className="flex-1 rounded bg-gray-200 px-3 py-1.5 text-xs text-gray-600 disabled:opacity-40"
            >
              取消
            </button>
          </div>
        ) : null}
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
