import { Router, type Request, type Response } from 'express';
import { getDb } from '../db/index.js';
import type { Dish, DishIngredient, ApiError, CreatedResponse } from '../types/index.js';

export const dishesRouter = Router();

dishesRouter.get('/', (req: Request, res: Response<Dish[] | ApiError>) => {
  const db = getDb();
  const { category, is_active } = req.query;
  let sql = 'SELECT * FROM dishes';
  const params: any[] = [];

  if (category || is_active !== undefined) {
    sql += ' WHERE';
    const conditions: string[] = [];
    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }
    if (is_active !== undefined) {
      conditions.push('is_active = ?');
      params.push(Number(is_active));
    }
    sql += ' ' + conditions.join(' AND');
  }
  sql += ' ORDER BY sort_order ASC, id ASC';

  const raw = db.prepare(sql).all(...params);
  const rows = raw as unknown as Dish[];
  res.json(rows);
});

dishesRouter.get('/:id', (req: Request, res: Response<(Dish & { bom: DishIngredient[] }) | ApiError>) => {
  const db = getDb();
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: 'validation_error', message: 'Invalid dish id' });
    return;
  }

  const raw = db.prepare('SELECT * FROM dishes WHERE id = ?').get(id);
  const dish = raw as unknown as Dish | undefined;
  if (!dish) {
    res.status(404).json({ error: 'not_found', message: 'Dish not found' });
    return;
  }

  const bomRaw = db.prepare('SELECT * FROM dish_ingredients WHERE dish_id = ? ORDER BY id ASC').all(id);
  const bom = bomRaw as unknown as DishIngredient[];
  res.json({ ...dish, bom });
});

dishesRouter.post('/', (req: Request, res: Response<CreatedResponse<Dish> | ApiError>) => {
  const db = getDb();
  const { name, category, price, image_url, cost_estimate, is_active, sort_order } = req.body;

  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'validation_error', message: 'name is required' });
    return;
  }
  if (price === undefined || typeof price !== 'number' || price < 0) {
    res.status(400).json({ error: 'validation_error', message: 'price must be a non-negative number' });
    return;
  }

  const stmt = db.prepare(`
    INSERT INTO dishes (name, category, price, image_url, cost_estimate, is_active, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(name, category || 'other', price, image_url || null, cost_estimate || 0, is_active !== undefined ? is_active : 1, sort_order || 0);

  const raw = db.prepare('SELECT * FROM dishes WHERE id = ?').get(info.lastInsertRowid);
  const dish = raw as unknown as Dish;
  res.status(201).json({ data: dish, message: 'Dish created successfully' });
});

dishesRouter.put('/:id', (req: Request, res: Response<Dish | ApiError>) => {
  const db = getDb();
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: 'validation_error', message: 'Invalid dish id' });
    return;
  }

  const { name, category, price, image_url, cost_estimate, is_active, sort_order } = req.body;
  const updates: string[] = [];
  const params: any[] = [];

  if (name !== undefined) {
    updates.push('name = ?');
    params.push(name);
  }
  if (category !== undefined) {
    updates.push('category = ?');
    params.push(category);
  }
  if (price !== undefined) {
    if (typeof price !== 'number' || price < 0) {
      res.status(400).json({ error: 'validation_error', message: 'price must be a non-negative number' });
      return;
    }
    updates.push('price = ?');
    params.push(price);
  }
  if (image_url !== undefined) {
    updates.push('image_url = ?');
    params.push(image_url);
  }
  if (cost_estimate !== undefined) {
    updates.push('cost_estimate = ?');
    params.push(cost_estimate);
  }
  if (is_active !== undefined) {
    updates.push('is_active = ?');
    params.push(is_active);
  }
  if (sort_order !== undefined) {
    updates.push('sort_order = ?');
    params.push(sort_order);
  }

  if (updates.length === 0) {
    res.status(400).json({ error: 'validation_error', message: 'No fields to update' });
    return;
  }

  updates.push('updated_at = datetime(\'now\')');
  params.push(id);

  const stmt = db.prepare(`UPDATE dishes SET ${updates.join(', ')} WHERE id = ?`);
  const info = stmt.run(...params);

  if (info.changes === 0) {
    res.status(404).json({ error: 'not_found', message: 'Dish not found' });
    return;
  }

  const raw = db.prepare('SELECT * FROM dishes WHERE id = ?').get(id);
  const dish = raw as unknown as Dish;
  res.json(dish);
});

dishesRouter.patch('/:id/status', (req: Request, res: Response<Dish | ApiError>) => {
  const db = getDb();
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: 'validation_error', message: 'Invalid dish id' });
    return;
  }

  const { is_active } = req.body;
  if (is_active !== 0 && is_active !== 1) {
    res.status(400).json({ error: 'validation_error', message: 'is_active must be 0 or 1' });
    return;
  }

  const stmt = db.prepare('UPDATE dishes SET is_active = ?, updated_at = datetime(\'now\') WHERE id = ?');
  const info = stmt.run(is_active, id);

  if (info.changes === 0) {
    res.status(404).json({ error: 'not_found', message: 'Dish not found' });
    return;
  }

  const raw = db.prepare('SELECT * FROM dishes WHERE id = ?').get(id);
  const dish = raw as unknown as Dish;
  res.json(dish);
});

dishesRouter.delete('/:id', (req: Request, res: Response<{ message: string } | ApiError>) => {
  const db = getDb();
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: 'validation_error', message: 'Invalid dish id' });
    return;
  }

  const stmt = db.prepare('DELETE FROM dishes WHERE id = ?');
  const info = stmt.run(id);

  if (info.changes === 0) {
    res.status(404).json({ error: 'not_found', message: 'Dish not found' });
    return;
  }

  res.json({ message: 'Dish deleted successfully' });
});