import { Router, type Request, type Response } from 'express';
import { getDb } from '../db/index.js';
import type { RestaurantTable } from '../types/index.js';

export const tablesRouter = Router();

tablesRouter.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM tables ORDER BY table_no ASC').all() as unknown as RestaurantTable[];
  res.json(rows);
});

tablesRouter.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: 'validation_error', message: 'Invalid table id' });
    return;
  }

  const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(id) as unknown as RestaurantTable | undefined;
  if (!table) {
    res.status(404).json({ error: 'not_found', message: 'Table not found' });
    return;
  }

  res.json(table);
});

tablesRouter.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { table_no, capacity, qrcode_path } = req.body;

  if (!table_no || typeof table_no !== 'string') {
    res.status(400).json({ error: 'validation_error', message: 'table_no is required' });
    return;
  }

  const stmt = db.prepare(`
    INSERT INTO tables (table_no, capacity, qrcode_path)
    VALUES (?, ?, ?)
  `);
  let info;
  try {
    info = stmt.run(table_no, capacity || 4, qrcode_path || null);
  } catch (err) {
    const error = err as Error;
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(409).json({ error: 'conflict', message: 'Table number already exists' });
      return;
    }
    res.status(500).json({ error: 'internal', message: error.message });
    return;
  }

  const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(info.lastInsertRowid) as unknown as RestaurantTable;
  res.status(201).json({ data: table, message: 'Table created successfully' });
});

tablesRouter.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: 'validation_error', message: 'Invalid table id' });
    return;
  }

  const { table_no, capacity, qrcode_path } = req.body;
  const updates: string[] = [];
  const params: any[] = [];

  if (table_no !== undefined) {
    updates.push('table_no = ?');
    params.push(table_no);
  }
  if (capacity !== undefined) {
    if (typeof capacity !== 'number' || capacity <= 0) {
      res.status(400).json({ error: 'validation_error', message: 'capacity must be a positive number' });
      return;
    }
    updates.push('capacity = ?');
    params.push(capacity);
  }
  if (qrcode_path !== undefined) {
    updates.push('qrcode_path = ?');
    params.push(qrcode_path);
  }

  if (updates.length === 0) {
    res.status(400).json({ error: 'validation_error', message: 'No fields to update' });
    return;
  }

  params.push(id);

  let info;
  try {
    const stmt = db.prepare(`UPDATE tables SET ${updates.join(', ')} WHERE id = ?`);
    info = stmt.run(...params);
  } catch (err) {
    const error = err as Error;
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(409).json({ error: 'conflict', message: 'Table number already exists' });
      return;
    }
    res.status(500).json({ error: 'internal', message: error.message });
    return;
  }

  if (info.changes === 0) {
    res.status(404).json({ error: 'not_found', message: 'Table not found' });
    return;
  }

  const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(id) as unknown as RestaurantTable;
  res.json(table);
});

tablesRouter.patch('/:id/status', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: 'validation_error', message: 'Invalid table id' });
    return;
  }

  const { status } = req.body;
  if (!['idle', 'occupied', 'reserved'].includes(status)) {
    res.status(400).json({ error: 'validation_error', message: 'status must be idle, occupied, or reserved' });
    return;
  }

  const stmt = db.prepare('UPDATE tables SET status = ? WHERE id = ?');
  const info = stmt.run(status, id);

  if (info.changes === 0) {
    res.status(404).json({ error: 'not_found', message: 'Table not found' });
    return;
  }

  const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(id) as unknown as RestaurantTable;
  res.json(table);
});

tablesRouter.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: 'validation_error', message: 'Invalid table id' });
    return;
  }

  const stmt = db.prepare('DELETE FROM tables WHERE id = ?');
  const info = stmt.run(id);

  if (info.changes === 0) {
    res.status(404).json({ error: 'not_found', message: 'Table not found' });
    return;
  }

  res.json({ message: 'Table deleted successfully' });
});