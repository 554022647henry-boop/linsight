import { Router, type Request, type Response } from 'express';
import { getDb } from '../db/index.js';
import type { DishIngredient, ApiError, CreatedResponse } from '../types/index.js';

export const dishIngredientsRouter = Router();

dishIngredientsRouter.get('/dishes/:dishId/ingredients', (req: Request, res: Response<DishIngredient[] | ApiError>) => {
  const db = getDb();
  const dishId = Number(req.params.dishId);
  if (isNaN(dishId)) {
    res.status(400).json({ error: 'validation_error', message: 'Invalid dish id' });
    return;
  }

  const raw = db.prepare('SELECT * FROM dish_ingredients WHERE dish_id = ? ORDER BY id ASC').all(dishId);
  const rows = raw as unknown as DishIngredient[];
  res.json(rows);
});

dishIngredientsRouter.post('/dishes/:dishId/ingredients', (req: Request, res: Response<CreatedResponse<DishIngredient> | ApiError>) => {
  const db = getDb();
  const dishId = Number(req.params.dishId);
  if (isNaN(dishId)) {
    res.status(400).json({ error: 'validation_error', message: 'Invalid dish id' });
    return;
  }

  const { ingredient_id, quantity, unit } = req.body;
  if (typeof ingredient_id !== 'number' || ingredient_id <= 0) {
    res.status(400).json({ error: 'validation_error', message: 'ingredient_id must be a positive number' });
    return;
  }
  if (typeof quantity !== 'number' || quantity <= 0) {
    res.status(400).json({ error: 'validation_error', message: 'quantity must be a positive number' });
    return;
  }
  if (!unit || typeof unit !== 'string') {
    res.status(400).json({ error: 'validation_error', message: 'unit is required' });
    return;
  }

  const dishExists = db.prepare('SELECT id FROM dishes WHERE id = ?').get(dishId);
  if (!dishExists) {
    res.status(404).json({ error: 'not_found', message: 'Dish not found' });
    return;
  }

  const ingredientExists = db.prepare('SELECT id FROM ingredients WHERE id = ?').get(ingredient_id);
  if (!ingredientExists) {
    res.status(404).json({ error: 'not_found', message: 'Ingredient not found' });
    return;
  }

  const stmt = db.prepare(`
    INSERT INTO dish_ingredients (dish_id, ingredient_id, quantity, unit)
    VALUES (?, ?, ?, ?)
  `);
  let info;
  try {
    info = stmt.run(dishId, ingredient_id, quantity, unit);
  } catch (err) {
    const error = err as Error;
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(409).json({ error: 'conflict', message: 'BOM item already exists for this dish and ingredient' });
      return;
    }
    if (error.message.includes('foreign key constraint failed')) {
      res.status(404).json({ error: 'not_found', message: 'Dish or ingredient not found' });
      return;
    }
    res.status(500).json({ error: 'internal', message: error.message });
    return;
  }

  const raw = db.prepare('SELECT * FROM dish_ingredients WHERE id = ?').get(info.lastInsertRowid);
  const bom = raw as unknown as DishIngredient;
  res.status(201).json({ data: bom, message: 'BOM item created successfully' });
});

dishIngredientsRouter.put('/dish-ingredients/:id', (req: Request, res: Response<DishIngredient | ApiError>) => {
  const db = getDb();
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: 'validation_error', message: 'Invalid BOM id' });
    return;
  }

  const { quantity, unit } = req.body;
  const updates: string[] = [];
  const params: any[] = [];

  if (quantity !== undefined) {
    if (typeof quantity !== 'number' || quantity <= 0) {
      res.status(400).json({ error: 'validation_error', message: 'quantity must be a positive number' });
      return;
    }
    updates.push('quantity = ?');
    params.push(quantity);
  }
  if (unit !== undefined) {
    if (!unit || typeof unit !== 'string') {
      res.status(400).json({ error: 'validation_error', message: 'unit must be a non-empty string' });
      return;
    }
    updates.push('unit = ?');
    params.push(unit);
  }

  if (updates.length === 0) {
    res.status(400).json({ error: 'validation_error', message: 'No fields to update' });
    return;
  }

  updates.push('updated_at = datetime(\'now\')');
  params.push(id);

  const stmt = db.prepare(`UPDATE dish_ingredients SET ${updates.join(', ')} WHERE id = ?`);
  const info = stmt.run(...params);

  if (info.changes === 0) {
    res.status(404).json({ error: 'not_found', message: 'BOM item not found' });
    return;
  }

  const raw = db.prepare('SELECT * FROM dish_ingredients WHERE id = ?').get(id);
  const bom = raw as unknown as DishIngredient;
  res.json(bom);
});

dishIngredientsRouter.delete('/dish-ingredients/:id', (req: Request, res: Response<{ message: string } | ApiError>) => {
  const db = getDb();
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: 'validation_error', message: 'Invalid BOM id' });
    return;
  }

  const stmt = db.prepare('DELETE FROM dish_ingredients WHERE id = ?');
  const info = stmt.run(id);

  if (info.changes === 0) {
    res.status(404).json({ error: 'not_found', message: 'BOM item not found' });
    return;
  }

  res.json({ message: 'BOM item deleted successfully' });
});

dishIngredientsRouter.post('/dish-ingredients/parse', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'not_implemented' });
});