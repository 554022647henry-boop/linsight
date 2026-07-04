import { Router, type Request, type Response } from 'express';
import { getDb } from '../db/index.js';
import type { AiInsight } from '../types/index.js';

export const aiInsightsRouter = Router();

aiInsightsRouter.get('/', (req: Request, res: Response<AiInsight[]>) => {
  const db = getDb();
  const { type, is_read, date } = req.query;

  let sql = 'SELECT * FROM ai_insights WHERE 1=1';
  const params: (string | number)[] = [];

  if (type) {
    sql += ' AND insight_type = ?';
    params.push(type as string);
  }
  if (is_read !== undefined) {
    sql += ' AND is_read = ?';
    params.push(parseInt(is_read as string, 10));
  }
  if (date) {
    sql += ' AND related_date = ?';
    params.push(date as string);
  }

  sql += ' ORDER BY created_at DESC';

  const rows = db.prepare(sql).all(...params) as unknown as AiInsight[];
  res.json(rows);
});

aiInsightsRouter.get('/unread', (_req: Request, res: Response<AiInsight[]>) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM ai_insights 
    WHERE is_read = 0 
    ORDER BY created_at DESC
  `).all() as unknown as AiInsight[];
  res.json(rows);
});

aiInsightsRouter.patch('/:id/read', (req: Request, res: Response<AiInsight | { error: string; message: string }>) => {
  const db = getDb();
  const id = parseInt(req.params.id, 10);

  const updateStmt = db.prepare(`
    UPDATE ai_insights SET is_read = 1
    WHERE id = ?
  `);
  const info = updateStmt.run(id);

  if (info.changes === 0) {
    res.status(404).json({ error: 'not_found', message: 'Insight not found' });
    return;
  }

  const insight = db.prepare('SELECT * FROM ai_insights WHERE id = ?').get(id) as unknown as AiInsight;
  res.json(insight);
});