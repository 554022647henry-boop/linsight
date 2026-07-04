import { Router, type Request, type Response } from 'express';
import { getDb } from '../db/index.js';
import type { Payment, PaymentStatus } from '../types/index.js';

export const paymentsRouter = Router();

paymentsRouter.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { order_id, method, date } = req.query;
  
  let sql = `SELECT * FROM payments WHERE 1=1`;
  const params: (string | number)[] = [];
  
  if (order_id) {
    sql += ` AND order_id = ?`;
    params.push(Number(order_id));
  }
  if (method) {
    sql += ` AND method = ?`;
    params.push(method as string);
  }
  if (date) {
    sql += ` AND DATE(paid_at) = ?`;
    params.push(date as string);
  }
  
  sql += ` ORDER BY paid_at DESC`;
  
  const payments = db.prepare(sql).all(...params) as unknown as Payment[];
  res.json(payments);
  return;
});

paymentsRouter.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);
  
  const payment = db.prepare(`SELECT * FROM payments WHERE id = ?`).get(id) as unknown as Payment | undefined;
  if (!payment) {
    res.status(404).json({ error: 'not_found', message: 'Payment not found' });
    return;
  }
  
  res.json(payment);
  return;
});

paymentsRouter.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { order_id, amount, method, transaction_id, status } = req.body;
  
  if (!order_id || !amount || !method) {
    res.status(400).json({ error: 'validation_error', message: 'order_id, amount, and method are required' });
    return;
  }
  
  if (!['cash', 'wechat', 'alipay', 'aggregated'].includes(method)) {
    res.status(400).json({ error: 'validation_error', message: 'Invalid payment method' });
    return;
  }
  
  if (amount <= 0) {
    res.status(400).json({ error: 'validation_error', message: 'amount must be positive' });
    return;
  }
  
  const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(order_id) as unknown as { id: number; paid_amount: number; total_amount: number } | undefined;
  if (!order) {
    res.status(404).json({ error: 'not_found', message: 'Order not found' });
    return;
  }
  
  const now = new Date().toISOString();
  const finalStatus = (status as PaymentStatus) || 'success';
  
  const insertStmt = db.prepare(`
    INSERT INTO payments (order_id, amount, method, transaction_id, status, paid_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  try {
    db.exec('BEGIN');
    
    const info = insertStmt.run(order_id, amount, method, transaction_id ?? null, finalStatus, now, now);
    const paymentId = info.lastInsertRowid as number;
    
    const newPaidAmount = order.paid_amount + amount;
    const newStatus = newPaidAmount >= order.total_amount ? 'paid' : 'dining';
    
    db.prepare(`
      UPDATE orders 
      SET paid_amount = ?, 
          pay_method = ?, 
          status = ?, 
          updated_at = ?
      WHERE id = ?
    `).run(newPaidAmount, method, newStatus, now, order_id);
    
    db.exec('COMMIT');
    
    const payment = db.prepare(`SELECT * FROM payments WHERE id = ?`).get(paymentId) as unknown as Payment;
    
    res.status(201).json({ data: payment, message: 'Payment recorded' });
    return;
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: 'internal', message: (err as Error).message });
    return;
  }
});