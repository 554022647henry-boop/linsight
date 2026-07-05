import { Router, type Request, type Response } from 'express';
import { getDb } from '../db/index.js';
import type { ChatLog, ChatMessageType } from '../types/index.js';
import { chatReply, type LlmMessage } from '../services/ai.js';

export const chatRouter = Router();

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

  if (message_type === 'image') {
    const replyInfo = db.prepare(`
      INSERT INTO chat_logs (session_id, direction, message_type, content, ai_action)
      VALUES (?, 'outgoing', 'card', ?, 'analyzed_image')
    `).run(session_id, JSON.stringify({
      type: 'purchase_order_preview',
      message: '已识别进货单，正在分析...',
      items: []
    }));
    const reply = db.prepare('SELECT * FROM chat_logs WHERE id = ?').get(replyInfo.lastInsertRowid) as unknown as ChatLog;
    aiReplies.push(reply);
  } else if (message_type === 'voice' || message_type === 'text') {
    // 意图识别（用于 ai_action 路由信号，与 LLM 回复解耦）
    let aiAction: string | null = null;
    if (content.includes('进货') || content.includes('采购') || content.includes('买')) {
      aiAction = 'pending_purchase';
    } else if (content.includes('盘点') || content.includes('实盘') || content.includes('库存')) {
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
    } else if (aiAction === 'pending_purchase') {
      replyText = '收到进货信息，正在识别中...';
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