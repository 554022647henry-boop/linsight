import { Router, type Request, type Response } from 'express';
import { getDb } from '../db/index.js';
import type { ChatLog, ChatMessageType } from '../types/index.js';

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

chatRouter.post('/messages', (req: Request, res: Response<SendMessageResponse>) => {
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
    if (content.includes('进货') || content.includes('采购') || content.includes('买')) {
      const replyInfo = db.prepare(`
        INSERT INTO chat_logs (session_id, direction, message_type, content, ai_action)
        VALUES (?, 'outgoing', 'text', ?, 'pending_purchase')
      `).run(session_id, '收到进货信息，正在识别中...');
      const reply = db.prepare('SELECT * FROM chat_logs WHERE id = ?').get(replyInfo.lastInsertRowid) as unknown as ChatLog;
      aiReplies.push(reply);
    } else if (content.includes('盘点') || content.includes('实盘') || content.includes('库存')) {
      const replyInfo = db.prepare(`
        INSERT INTO chat_logs (session_id, direction, message_type, content, ai_action)
        VALUES (?, 'outgoing', 'text', ?, 'inventory_check')
      `).run(session_id, '收到盘点信息，正在对账中...');
      const reply = db.prepare('SELECT * FROM chat_logs WHERE id = ?').get(replyInfo.lastInsertRowid) as unknown as ChatLog;
      aiReplies.push(reply);
    } else {
      const replyInfo = db.prepare(`
        INSERT INTO chat_logs (session_id, direction, message_type, content, ai_action)
        VALUES (?, 'outgoing', 'text', ?, NULL)
      `).run(session_id, '好的，收到您的消息！');
      const reply = db.prepare('SELECT * FROM chat_logs WHERE id = ?').get(replyInfo.lastInsertRowid) as unknown as ChatLog;
      aiReplies.push(reply);
    }
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