import { Router, type Request, type Response } from 'express';
import { getDb } from '../db/index.js';
import type { InventoryCheck, InventoryCheckSource } from '../types/index.js';

export const inventoryChecksRouter = Router();

interface SubmitItem {
  ingredient_id: number;
  actual_remaining: number;
  source?: InventoryCheckSource;
}

interface SubmitRequest {
  check_date: string;
  items: SubmitItem[];
}

interface GenerateRequest {
  date: string;
}

inventoryChecksRouter.get('/', (req: Request, res: Response<InventoryCheck[]>) => {
  const db = getDb();
  const { date, ingredient_id } = req.query;

  let sql = 'SELECT * FROM inventory_checks WHERE 1=1';
  const params: (string | number)[] = [];

  if (date) {
    sql += ' AND check_date = ?';
    params.push(date as string);
  }
  if (ingredient_id) {
    sql += ' AND ingredient_id = ?';
    params.push(parseInt(ingredient_id as string, 10));
  }

  sql += ' ORDER BY check_date DESC, ingredient_id';

  const rows = db.prepare(sql).all(...params) as unknown as InventoryCheck[];
  res.json(rows);
});

inventoryChecksRouter.post('/', (req: Request, res: Response<InventoryCheck[]>) => {
  const db = getDb();
  const { check_date, items } = req.body as SubmitRequest;

  const results: InventoryCheck[] = [];

  for (const item of items) {
    const ingredient = db.prepare('SELECT * FROM ingredients WHERE id = ?').get(item.ingredient_id) as unknown as { id: number; name: string };
    if (!ingredient) continue;

    const beginningStmt = db.prepare(`
      SELECT COALESCE(SUM(quantity), 0) as qty
      FROM inventory
      WHERE ingredient_id = ? AND status = 'active' AND received_date < ?
    `);
    const beginning = (beginningStmt.get(item.ingredient_id, check_date) as unknown as { qty: number }).qty;

    const purchasesStmt = db.prepare(`
      SELECT COALESCE(SUM(pi.quantity), 0) as qty
      FROM purchase_items pi
      JOIN purchase_orders po ON pi.order_id = po.id
      WHERE pi.ingredient_id = ? AND po.status = 'confirmed' AND po.created_at >= ?
    `);
    const purchases = (purchasesStmt.get(item.ingredient_id, check_date) as unknown as { qty: number }).qty;

    const consumptionStmt = db.prepare(`
      SELECT COALESCE(SUM(oi.quantity * di.quantity), 0) as qty
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN dish_ingredients di ON oi.dish_id = di.dish_id
      WHERE di.ingredient_id = ? AND o.status = 'paid' AND DATE(o.created_at) = ?
    `);
    const consumption = (consumptionStmt.get(item.ingredient_id, check_date) as unknown as { qty: number }).qty;

    const theoretical_remaining = beginning + purchases - consumption;
    const actual_remaining = item.actual_remaining;
    const diff = actual_remaining - theoretical_remaining;

    const avgPriceStmt = db.prepare(`
      SELECT COALESCE(AVG(unit_price), 0) as price
      FROM purchase_items
      WHERE ingredient_id = ? AND unit_price > 0
      ORDER BY created_at DESC
      LIMIT 10
    `);
    const avgPrice = (avgPriceStmt.get(item.ingredient_id) as unknown as { price: number }).price;
    const diff_amount = diff * avgPrice;

    const ai_note = Math.abs(diff_amount) > 50 
      ? `差异金额 ${diff_amount.toFixed(2)} 元，超过预警阈值` 
      : null;

    const insertStmt = db.prepare(`
      INSERT INTO inventory_checks 
        (check_date, ingredient_id, ingredient_name, theoretical_remaining, 
         actual_remaining, diff, diff_amount, source, ai_note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = insertStmt.run(
      check_date,
      item.ingredient_id,
      ingredient.name,
      theoretical_remaining,
      actual_remaining,
      diff,
      diff_amount,
      item.source || 'manual',
      ai_note
    );

    const check = db.prepare('SELECT * FROM inventory_checks WHERE id = ?').get(info.lastInsertRowid) as unknown as InventoryCheck;
    results.push(check);

    if (Math.abs(diff_amount) > 50) {
      db.prepare(`
        INSERT INTO ai_insights (insight_type, related_date, content, suggestion, is_read)
        VALUES ('reconcile_alert', ?, ?, ?, 0)
      `).run(
        check_date,
        `${ingredient.name}实盘差异 ${diff_amount.toFixed(2)} 元`,
        '建议核对库存记录或检查是否有遗漏'
      );
    }
  }

  res.json(results);
});

inventoryChecksRouter.post('/generate', (req: Request, res: Response<InventoryCheck[]>) => {
  const db = getDb();
  const { date } = req.body as GenerateRequest;

  const ingredients = db.prepare('SELECT * FROM ingredients').all() as unknown as { id: number; name: string }[];

  const results: InventoryCheck[] = [];

  for (const ingredient of ingredients) {
    const beginningStmt = db.prepare(`
      SELECT COALESCE(SUM(quantity), 0) as qty
      FROM inventory
      WHERE ingredient_id = ? AND status = 'active' AND received_date < ?
    `);
    const beginning = (beginningStmt.get(ingredient.id, date) as unknown as { qty: number }).qty;

    const purchasesStmt = db.prepare(`
      SELECT COALESCE(SUM(pi.quantity), 0) as qty
      FROM purchase_items pi
      JOIN purchase_orders po ON pi.order_id = po.id
      WHERE pi.ingredient_id = ? AND po.status = 'confirmed' AND po.created_at >= ?
    `);
    const purchases = (purchasesStmt.get(ingredient.id, date) as unknown as { qty: number }).qty;

    const consumptionStmt = db.prepare(`
      SELECT COALESCE(SUM(oi.quantity * di.quantity), 0) as qty
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN dish_ingredients di ON oi.dish_id = di.dish_id
      WHERE di.ingredient_id = ? AND o.status = 'paid' AND DATE(o.created_at) = ?
    `);
    const consumption = (consumptionStmt.get(ingredient.id, date) as unknown as { qty: number }).qty;

    const theoretical_remaining = beginning + purchases - consumption;

    const existingCheck = db.prepare(`
      SELECT * FROM inventory_checks 
      WHERE check_date = ? AND ingredient_id = ?
    `).get(date, ingredient.id);

    if (existingCheck) {
      continue;
    }



    const insertStmt = db.prepare(`
      INSERT INTO inventory_checks 
        (check_date, ingredient_id, ingredient_name, theoretical_remaining, 
         actual_remaining, diff, diff_amount, source, ai_note)
      VALUES (?, ?, ?, ?, 0, ?, 0, 'manual', NULL)
    `);
    const info = insertStmt.run(
      date,
      ingredient.id,
      ingredient.name,
      theoretical_remaining,
      -theoretical_remaining
    );

    const check = db.prepare('SELECT * FROM inventory_checks WHERE id = ?').get(info.lastInsertRowid) as unknown as InventoryCheck;
    results.push(check);
  }

  res.json(results);
});