import { Router, type Request, type Response } from 'express';
import { getDb } from '../db/index.js';
import type { LossRecord } from '../types/index.js';

export const lossRecordsRouter = Router();

interface GenerateRequest {
  date: string;
}

lossRecordsRouter.get('/', (req: Request, res: Response<LossRecord[]>) => {
  const db = getDb();
  const { date, date_from, date_to, ingredient_id } = req.query;

  let sql = 'SELECT * FROM loss_records WHERE 1=1';
  const params: (string | number)[] = [];

  if (date) {
    sql += ' AND record_date = ?';
    params.push(date as string);
  }
  if (date_from) {
    sql += ' AND record_date >= ?';
    params.push(date_from as string);
  }
  if (date_to) {
    sql += ' AND record_date <= ?';
    params.push(date_to as string);
  }
  if (ingredient_id) {
    sql += ' AND ingredient_id = ?';
    params.push(parseInt(ingredient_id as string, 10));
  }

  sql += ' ORDER BY record_date DESC, ingredient_id';

  const rows = db.prepare(sql).all(...params) as unknown as LossRecord[];
  res.json(rows);
});

lossRecordsRouter.post('/generate', (req: Request, res: Response<LossRecord[]>) => {
  const db = getDb();
  const { date } = req.body as GenerateRequest;

  const ingredients = db.prepare('SELECT * FROM ingredients').all() as unknown as { id: number; name: string }[];

  const results: LossRecord[] = [];

  for (const ingredient of ingredients) {
    const theoreticalStmt = db.prepare(`
      SELECT COALESCE(SUM(oi.quantity * di.quantity), 0) as consumption
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN dish_ingredients di ON oi.dish_id = di.dish_id
      WHERE di.ingredient_id = ? AND o.status = 'paid' AND DATE(o.created_at) = ?
    `);
    const theoretical_consumption = (theoreticalStmt.get(ingredient.id, date) as unknown as { consumption: number }).consumption;

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
      WHERE pi.ingredient_id = ? AND po.status = 'confirmed' AND DATE(po.created_at) = ?
    `);
    const purchases = (purchasesStmt.get(ingredient.id, date) as unknown as { qty: number }).qty;

    const endingStmt = db.prepare(`
      SELECT COALESCE(SUM(quantity), 0) as qty
      FROM inventory
      WHERE ingredient_id = ? AND status = 'active' AND received_date <= ?
    `);
    const ending = (endingStmt.get(ingredient.id, date) as unknown as { qty: number }).qty;

    const actual_consumption = beginning + purchases - ending;
    const diff = actual_consumption - theoretical_consumption;

    const avgPriceStmt = db.prepare(`
      SELECT COALESCE(AVG(unit_price), 0) as price
      FROM purchase_items
      WHERE ingredient_id = ? AND unit_price > 0
      ORDER BY created_at DESC
      LIMIT 10
    `);
    const avgPrice = (avgPriceStmt.get(ingredient.id) as unknown as { price: number }).price;
    const diff_amount = diff * avgPrice;

    let ai_analysis: string | null = null;
    if (Math.abs(diff_amount) > 100) {
      ai_analysis = diff > 0 
        ? `实际消耗比理论多 ${diff.toFixed(2)}，可能存在偷漏或浪费`
        : `实际消耗比理论少 ${Math.abs(diff).toFixed(2)}，可能存在未记录销售`;
    } else if (Math.abs(diff_amount) > 50) {
      ai_analysis = `差异金额 ${diff_amount.toFixed(2)} 元，建议关注`;
    }

    const insertStmt = db.prepare(`
      INSERT INTO loss_records 
        (record_date, ingredient_id, ingredient_name, theoretical_consumption, 
         actual_consumption, diff, diff_amount, ai_analysis)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = insertStmt.run(
      date,
      ingredient.id,
      ingredient.name,
      theoretical_consumption,
      actual_consumption,
      diff,
      diff_amount,
      ai_analysis
    );

    const record = db.prepare('SELECT * FROM loss_records WHERE id = ?').get(info.lastInsertRowid) as unknown as LossRecord;
    results.push(record);

    if (Math.abs(diff_amount) > 100) {
      db.prepare(`
        INSERT INTO ai_insights (insight_type, related_date, content, suggestion, is_read)
        VALUES ('loss_warning', ?, ?, ?, 0)
      `).run(
        date,
        `${ingredient.name}损耗差异 ${diff_amount.toFixed(2)} 元`,
        ai_analysis || '建议检查库存记录和销售数据'
      );
    }
  }

  res.json(results);
});