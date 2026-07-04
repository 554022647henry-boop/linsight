import { Router, type Request, type Response } from 'express';
import { getDb } from '../db/index.js';
import type { Supplier, ApiError, CreatedResponse } from '../types/index.js';

export const suppliersRouter = Router();

suppliersRouter.get('/', (_req: Request, res: Response<Supplier[] | ApiError>) => {
  const db = getDb();
  const raw = db.prepare('SELECT * FROM suppliers ORDER BY name ASC').all();
  const rows = raw as unknown as Supplier[];
  res.json(rows);
});

suppliersRouter.get('/:id', (req: Request, res: Response<Supplier | ApiError>) => {
  const db = getDb();
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: 'validation_error', message: 'Invalid supplier id' });
    return;
  }

  const raw = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
  const supplier = raw as unknown as Supplier | undefined;
  if (!supplier) {
    res.status(404).json({ error: 'not_found', message: 'Supplier not found' });
    return;
  }

  res.json(supplier);
});

suppliersRouter.post('/', (req: Request, res: Response<CreatedResponse<Supplier> | ApiError>) => {
  const db = getDb();
  const { name, contact, phone, note } = req.body;

  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'validation_error', message: 'name is required' });
    return;
  }

  const stmt = db.prepare(`
    INSERT INTO suppliers (name, contact, phone, note)
    VALUES (?, ?, ?, ?)
  `);
  const info = stmt.run(name, contact || null, phone || null, note || null);

  const raw = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(info.lastInsertRowid);
  const supplier = raw as unknown as Supplier;
  res.status(201).json({ data: supplier, message: 'Supplier created successfully' });
});

suppliersRouter.put('/:id', (req: Request, res: Response<Supplier | ApiError>) => {
  const db = getDb();
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: 'validation_error', message: 'Invalid supplier id' });
    return;
  }

  const { name, contact, phone, note } = req.body;
  const updates: string[] = [];
  const params: any[] = [];

  if (name !== undefined) {
    updates.push('name = ?');
    params.push(name);
  }
  if (contact !== undefined) {
    updates.push('contact = ?');
    params.push(contact);
  }
  if (phone !== undefined) {
    updates.push('phone = ?');
    params.push(phone);
  }
  if (note !== undefined) {
    updates.push('note = ?');
    params.push(note);
  }

  if (updates.length === 0) {
    res.status(400).json({ error: 'validation_error', message: 'No fields to update' });
    return;
  }

  params.push(id);

  const stmt = db.prepare(`UPDATE suppliers SET ${updates.join(', ')} WHERE id = ?`);
  const info = stmt.run(...params);

  if (info.changes === 0) {
    res.status(404).json({ error: 'not_found', message: 'Supplier not found' });
    return;
  }

  const raw = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
  const supplier = raw as unknown as Supplier;
  res.json(supplier);
});

suppliersRouter.delete('/:id', (req: Request, res: Response<{ message: string } | ApiError>) => {
  const db = getDb();
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: 'validation_error', message: 'Invalid supplier id' });
    return;
  }

  const stmt = db.prepare('DELETE FROM suppliers WHERE id = ?');
  const info = stmt.run(id);

  if (info.changes === 0) {
    res.status(404).json({ error: 'not_found', message: 'Supplier not found' });
    return;
  }

  res.json({ message: 'Supplier deleted successfully' });
});