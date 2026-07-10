import { Router, type Request, type Response } from 'express';
import { getDb } from '../db/index.js';
import type { ChatLog, ChatMessageType } from '../types/index.js';
import { chatReply, recognizePurchaseOrder, type LlmMessage } from '../services/ai.js';

export const chatRouter = Router();

function generateOrderNo(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `PO${year}${month}${day}-${seq}`;
}

interface PendingItem {
  ingredient_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  amount: number;
  ai_confidence: number;
}

interface Anomaly {
  item_id: number;
  type: string;
  message: string;
}

/**
 * 调 AI 识别进货单（失败走 mock），落库一条 pending purchase_order + 明细，
 * 返回供卡片渲染的 JSON content。
 */
async function handlePurchaseRecognition(
  sourceType: 'image' | 'voice' | 'text',
  content: string
): Promise<string> {
  const aiResult = await recognizePurchaseOrder(content);

  let items: PendingItem[];
  let supplierName: string;
  let anomalies: Anomaly[];

  if (aiResult && aiResult.items.length > 0) {
    supplierName = aiResult.supplier_name ?? 'AI识别供应商';
    items = aiResult.items.map((item) => {
      const quantity = item.quantity ?? 0;
      const unitPrice = item.unit_price ?? 0;
      const hasNullField =
        item.quantity === null || item.unit_price === null || item.unit === null;
      return {
        ingredient_name: item.name,
        quantity,
        unit: item.unit ?? 'kg',
        unit_price: unitPrice,
        amount: quantity * unitPrice,
        ai_confidence: hasNullField ? 0.6 : 0.9
      };
    });

    anomalies = [];
    items.forEach((item, idx) => {
      if (item.ai_confidence < 0.7) {
        anomalies.push({
          item_id: idx + 1,
          type: 'confidence',
          message: `${item.ingredient_name} 字段识别不完整，置信度低，建议人工确认`
        });
      }
      if (item.amount > 500) {
        anomalies.push({
          item_id: idx + 1,
          type: 'price',
          message: `${item.ingredient_name} 金额 ${item.amount.toFixed(0)} 元，金额较高，建议核对`
        });
      }
    });
  } else {
    // fallback：固定 mock 数据
    supplierName = 'AI识别供应商';
    items = [
      { ingredient_name: '牛肉', quantity: 15, unit: 'kg', unit_price: 42, amount: 630, ai_confidence: 0.95 },
      { ingredient_name: '青菜', quantity: 30, unit: 'kg', unit_price: 4.5, amount: 135, ai_confidence: 0.92 },
      { ingredient_name: '鸡蛋', quantity: 100, unit: '个', unit_price: 0.8, amount: 80, ai_confidence: 0.88 },
    ];
    anomalies = [
      { item_id: 1, type: 'price', message: '牛肉单价 42 元/kg，比上周均价高 8%' },
      { item_id: 3, type: 'confidence', message: '鸡蛋置信度 0.88，建议确认数量' },
    ];
  }

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const orderNo = generateOrderNo();
  const now = new Date().toISOString();

  const db = getDb();
  let orderId: number;

  try {
    db.exec('BEGIN');

    const insertStmt = db.prepare(`
      INSERT INTO purchase_orders (order_no, supplier_id, supplier_name, total_amount, source_type, ai_raw_text, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
    `);
    const info = insertStmt.run(orderNo, null, supplierName, totalAmount, sourceType, content, now);
    orderId = info.lastInsertRowid as number;

    const insertItemStmt = db.prepare(`
      INSERT INTO purchase_items (order_id, ingredient_id, ingredient_name, quantity, unit, unit_price, amount, ai_confidence, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of items) {
      insertItemStmt.run(orderId, null, item.ingredient_name, item.quantity, item.unit, item.unit_price, item.amount, item.ai_confidence, now);
    }

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return JSON.stringify({
    type: 'purchase_order_preview',
    order_id: orderId,
    supplier_name: supplierName,
    total_amount: totalAmount,
    items: items.map((item) => ({
      name: item.ingredient_name,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price,
      amount: item.amount,
      ai_confidence: item.ai_confidence
    })),
    anomalies,
    message: '已识别进货单，请核对后确认入库'
  });
}

interface SessionPreview {
  session_id: string;
  last_message: string;
  last_time: string;
}

interface SendMessageRequest {
  session_id: string;
  message_type: ChatMessageType;
  content: string;
}

interface SendMessageResponse {
  received: ChatLog;
  ai_replies: ChatLog[];
}

interface PushRequest {
  session_id: string;
  message_type: ChatMessageType;
  content: string;
  ai_action?: string;
}

chatRouter.get('/sessions', (_req: Request, res: Response<SessionPreview[]>) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT 
      session_id,
      content as last_message,
      created_at as last_time
    FROM chat_logs
    WHERE id IN (
      SELECT MAX(id) FROM chat_logs GROUP BY session_id
    )
    ORDER BY created_at DESC
  `).all() as unknown as SessionPreview[];
  res.json(rows);
});

chatRouter.get('/sessions/:sessionId/messages', (req: Request, res: Response<ChatLog[]>) => {
  const db = getDb();
  const sessionId = req.params.sessionId;
  const rows = db.prepare(`
    SELECT * FROM chat_logs 
    WHERE session_id = ? 
    ORDER BY created_at ASC
  `).all(sessionId) as unknown as ChatLog[];
  res.json(rows);
});

chatRouter.post('/messages', async (req: Request, res: Response<SendMessageResponse>) => {
  const db = getDb();
  const { session_id, message_type, content } = req.body as SendMessageRequest;

  const insertStmt = db.prepare(`
    INSERT INTO chat_logs (session_id, direction, message_type, content, ai_action)
    VALUES (?, 'incoming', ?, ?, NULL)
  `);
  const info = insertStmt.run(session_id, message_type, content);

  const received = db.prepare('SELECT * FROM chat_logs WHERE id = ?').get(info.lastInsertRowid) as unknown as ChatLog;

  const aiReplies: ChatLog[] = [];

  const isPurchaseIntent =
    message_type === 'image' ||
    ((message_type === 'voice' || message_type === 'text') &&
      (content.includes('进货') || content.includes('采购') || content.includes('买')));

  if (isPurchaseIntent) {
    // 调 AI 识别进货单 → 落库 pending order → 返回预览卡片
    try {
      const cardContent = await handlePurchaseRecognition(
        message_type as 'image' | 'voice' | 'text',
        content
      );
      const replyInfo = db.prepare(`
        INSERT INTO chat_logs (session_id, direction, message_type, content, ai_action)
        VALUES (?, 'outgoing', 'card', ?, 'analyzed_image')
      `).run(session_id, cardContent);
      const reply = db.prepare('SELECT * FROM chat_logs WHERE id = ?').get(replyInfo.lastInsertRowid) as unknown as ChatLog;
      aiReplies.push(reply);
    } catch (err) {
      const replyInfo = db.prepare(`
        INSERT INTO chat_logs (session_id, direction, message_type, content, ai_action)
        VALUES (?, 'outgoing', 'text', ?, 'pending_purchase')
      `).run(session_id, `进货单识别失败：${(err as Error).message}，请重试或手动录入`);
      const reply = db.prepare('SELECT * FROM chat_logs WHERE id = ?').get(replyInfo.lastInsertRowid) as unknown as ChatLog;
      aiReplies.push(reply);
    }
  } else if (message_type === 'voice' || message_type === 'text') {
    // 意图识别（用于 ai_action 路由信号，与 LLM 回复解耦）
    let aiAction: string | null = null;
    if (content.includes('盘点') || content.includes('实盘') || content.includes('库存')) {
      aiAction = 'inventory_check';
    }

    // 取最近 10 条历史，构造对话上下文
    const historyRows = db.prepare(`
      SELECT direction, content FROM chat_logs
      WHERE session_id = ? AND id != ?
      ORDER BY created_at DESC LIMIT 10
    `).all(session_id, info.lastInsertRowid) as unknown as Array<{ direction: string; content: string }>;

    const history: LlmMessage[] = historyRows
      .reverse()
      .map((r) => ({
        role: (r.direction === 'incoming' ? 'user' : 'assistant') as
          | 'user'
          | 'assistant',
        content: r.content
      }));

    const aiText = await chatReply(content, history);

    let replyText: string;
    if (aiText) {
      replyText = aiText;
    } else if (aiAction === 'inventory_check') {
      replyText = '收到盘点信息，正在对账中...';
    } else {
      // 无 LLM 时的友好 fallback：引导到日报或提示配置
      if (content.includes('生意') || content.includes('怎么样') || content.includes('日报') || content.includes('营收') || content.includes('利润')) {
        replyText = '我需要 AI 能力才能回答经营类问题。请在日报页查看经营数据，或配置 TRAE_API_KEY 启用智能对话。';
      } else {
        replyText = '收到您的消息。当前为 Demo 模式（未配置 TRAE_API_KEY），AI 对话能力未启用。';
      }
    }

    const replyInfo = db.prepare(`
      INSERT INTO chat_logs (session_id, direction, message_type, content, ai_action)
      VALUES (?, 'outgoing', 'text', ?, ?)
    `).run(session_id, replyText, aiAction);
    const reply = db.prepare('SELECT * FROM chat_logs WHERE id = ?').get(replyInfo.lastInsertRowid) as unknown as ChatLog;
    aiReplies.push(reply);
  }

  res.json({ received, ai_replies: aiReplies });
});

chatRouter.post('/push', (req: Request, res: Response<ChatLog>) => {
  const db = getDb();
  const { session_id, message_type, content, ai_action } = req.body as PushRequest;

  const insertStmt = db.prepare(`
    INSERT INTO chat_logs (session_id, direction, message_type, content, ai_action)
    VALUES (?, 'outgoing', ?, ?, ?)
  `);
  const info = insertStmt.run(session_id, message_type, content, ai_action || null);

  const chatLog = db.prepare('SELECT * FROM chat_logs WHERE id = ?').get(info.lastInsertRowid) as unknown as ChatLog;
  res.json(chatLog);
});