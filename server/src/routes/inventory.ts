import { Router, type Request, type Response } from 'express';
import { getDb } from '../db/index.js';
import type { InventoryBatch } from '../types/index.js';

export const inventoryRouter = Router();

inventoryRouter.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  
  const result = db.prepare(`
    SELECT 
      i.id as ingredient_id,
      i.name as ingredient_name,
      SUM(iv.quantity) as total_quantity,
      i.unit,
      i.warning_threshold,
      CASE WHEN SUM(iv.quantity) <= i.warning_threshold THEN 1 ELSE 0 END as is_low
    FROM ingredients i
    LEFT JOIN inventory iv ON i.id = iv.ingredient_id AND iv.status = 'active'
    GROUP BY i.id, i.name, i.unit, i.warning_threshold
    ORDER BY i.category, i.name
  `).all() as unknown as Array<{
    ingredient_id: number;
    ingredient_name: string;
    total_quantity: number;
    unit: string;
    warning_threshold: number;
    is_low: 0 | 1;
  }>;
  
  res.json(result);
  return;
});

inventoryRouter.get('/batches', (req: Request, res: Response) => {
  const db = getDb();
  const { ingredient_id, status } = req.query;
  
  let sql = `SELECT * FROM inventory WHERE 1=1`;
  const params: (string | number)[] = [];
  
  if (ingredient_id) {
    sql += ` AND ingredient_id = ?`;
    params.push(Number(ingredient_id));
  }
  if (status) {
    sql += ` AND status = ?`;
    params.push(status as string);
  }
  
  sql += ` ORDER BY received_date DESC`;
  
  const batches = db.prepare(sql).all(...params) as unknown as InventoryBatch[];
  res.json(batches);
  return;
});

inventoryRouter.get('/expiring', (req: Request, res: Response) => {
  const db = getDb();
  const days = Number(req.query.days) || 3;
  
  const result = db.prepare(`
    SELECT 
      iv.id,
      iv.ingredient_id,
      i.name as ingredient_name,
      iv.quantity,
      iv.unit,
      iv.expiry_date,
      iv.received_date,
      iv.batch_no,
      DATE(iv.expiry_date) - DATE('now') as days_until_expiry
    FROM inventory iv
    JOIN ingredients i ON iv.ingredient_id = i.id
    WHERE iv.status = 'active'
      AND iv.expiry_date IS NOT NULL
      AND DATE(iv.expiry_date) <= DATE('now', ? || ' days')
      AND DATE(iv.expiry_date) >= DATE('now')
    ORDER BY days_until_expiry ASC
  `).all(`${days}`) as unknown as Array<{
    id: number;
    ingredient_id: number;
    ingredient_name: string;
    quantity: number;
    unit: string;
    expiry_date: string;
    received_date: string;
    batch_no: string | null;
    days_until_expiry: number;
  }>;
  
  res.json(result);
  return;
});

inventoryRouter.get('/low', (_req: Request, res: Response) => {
  const db = getDb();
  
  const result = db.prepare(`
    SELECT 
      i.id as ingredient_id,
      i.name as ingredient_name,
      COALESCE(SUM(iv.quantity), 0) as current_quantity,
      i.unit,
      i.warning_threshold,
      i.warning_threshold - COALESCE(SUM(iv.quantity), 0) as deficit
    FROM ingredients i
    LEFT JOIN inventory iv ON i.id = iv.ingredient_id AND iv.status = 'active'
    GROUP BY i.id, i.name, i.unit, i.warning_threshold
    HAVING COALESCE(SUM(iv.quantity), 0) <= i.warning_threshold
    ORDER BY deficit DESC
  `).all() as unknown as Array<{
    ingredient_id: number;
    ingredient_name: string;
    current_quantity: number;
    unit: string;
    warning_threshold: number;
    deficit: number;
  }>;
  
  res.json(result);
  return;
});