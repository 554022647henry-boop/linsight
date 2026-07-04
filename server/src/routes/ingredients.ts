import { Router, type Request, type Response } from 'express';
import { getDb } from '../db/index.js';
import type { Ingredient } from '../types/index.js';

export const ingredientsRouter = Router();

ingredientsRouter.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM ingredients ORDER BY name ASC').all() as unknown as Ingredient[];
  res.json(rows);
});

ingredientsRouter.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: 'validation_error', message: 'Invalid ingredient id' });
    return;
  }

  const ingredient = db.prepare('SELECT * FROM ingredients WHERE id = ?').get(id) as unknown as Ingredient | undefined;
  if (!ingredient) {
    res.status(404).json({ error: 'not_found', message: 'Ingredient not found' });
    return;
  }

  res.json(ingredient);
});

ingredientsRouter.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { name, unit, stock_qty, min_stock, cost_per_unit, supplier_id, note } = req.body;

  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'validation_error', message: 'name is required' });
    return;
  }

  const stmt = db.prepare(`
    INSERT INTO ingredients (name, unit, stock_qty, min_stock, cost_per_unit, supplier_id, note)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  let info;
  try {
    info = stmt.run(name, unit || 'g', stock_qty || 0, min_stock || 0, cost_per_unit || 0, supplier_id || null, note || null);
  } catch (err) {
    const error = err as Error;
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(409).json({ error: 'conflict', message: 'Ingredient name already exists' });
      return;
    }
    if (error.message.includes('foreign key constraint failed')) {
      res.status(404).json({ error: 'not_found', message: 'Supplier not found' });
      return;
    }
    res.status(500).json({ error: 'internal', message: error.message });
    return;
  }

  const ingredient = db.prepare('SELECT * FROM ingredients WHERE id = ?').get(info.lastInsertRowid) as unknown as Ingredient;
  res.status(201).json({ data: ingredient, message: 'Ingredient created successfully' });
});

ingredientsRouter.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: 'validation_error', message: 'Invalid ingredient id' });
    return;
  }

  const { name, unit, stock_qty, min_stock, cost_per_unit, supplier_id, note } = req.body;
  const updates: string[] = [];
  const params: any[] = [];

  if (name !== undefined) {
    updates.push('name = ?');
    params.push(name);
  }
  if (unit !== undefined) {
    updates.push('unit = ?');
    params.push(unit);
  }
  if (stock_qty !== undefined) {
    if (typeof stock_qty !== 'number' || stock_qty < 0) {
      res.status(400).json({ error: 'validation_error', message: 'stock_qty must be a non-negative number' });
      return;
    }
    updates.push('stock_qty = ?');
    params.push(stock_qty);
  }
  if (min_stock !== undefined) {
    updates.push('min_stock = ?');
    params.push(min_stock);
  }
  if (cost_per_unit !== undefined) {
    updates.push('cost_per_unit = ?');
    params.push(cost_per_unit);
  }
  if (supplier_id !== undefined) {
    updates.push('supplier_id = ?');
    params.push(supplier_id);
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

  let info;
  try {
    const stmt = db.prepare(`UPDATE ingredients SET ${updates.join(', ')} WHERE id = ?`);
    info = stmt.run(...params);
  } catch (err) {
    const error = err as Error;
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(409).json({ error: 'conflict', message: 'Ingredient name already exists' });
      return;
    }
    if (error.message.includes('foreign key constraint failed')) {
      res.status(404).json({ error: 'not_found', message: 'Supplier not found' });
      return;
    }
    res.status(500).json({ error: 'internal', message: error.message });
    return;
  }

  if (info.changes === 0) {
    res.status(404).json({ error: 'not_found', message: 'Ingredient not found' });
    return;
  }

  const ingredient = db.prepare('SELECT * FROM ingredients WHERE id = ?').get(id) as unknown as Ingredient;
  res.json(ingredient);
});

ingredientsRouter.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: 'validation_error', message: 'Invalid ingredient id' });
    return;
  }

  const stmt = db.prepare('DELETE FROM ingredients WHERE id = ?');
  const info = stmt.run(id);

  if (info.changes === 0) {
    res.status(404).json({ error: 'not_found', message: 'Ingredient not found' });
    return;
  }

  res.json({ message: 'Ingredient deleted successfully' });
});