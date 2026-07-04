import { Router, type Request, type Response } from 'express';
import { getDb } from '../db/index.js';
import type { Order, OrderItem, Payment } from '../types/index.js';

export const ordersRouter = Router();

function generateOrderNo(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `OD${year}${month}${day}-${seq}`;
}

function deductInventory(db: ReturnType<typeof getDb>, ingredientId: number, quantity: number, unit: string): boolean {
  const batches = db.prepare(`
    SELECT * FROM inventory 
    WHERE ingredient_id = ? AND status = 'active' AND unit = ?
    ORDER BY received_date ASC
  `).all(ingredientId, unit) as unknown as Array<{ id: number; quantity: number }>;
  
  let remaining = quantity;
  
  for (const batch of batches) {
    if (remaining <= 0) break;
    
    if (batch.quantity >= remaining) {
      db.prepare(`UPDATE inventory SET quantity = quantity - ?, updated_at = ? WHERE id = ?`).run(
        remaining,
        new Date().toISOString(),
        batch.id
      );
      remaining = 0;
    } else {
      db.prepare(`UPDATE inventory SET quantity = 0, status = 'consumed', updated_at = ? WHERE id = ?`).run(
        new Date().toISOString(),
        batch.id
      );
      remaining -= batch.quantity;
    }
  }
  
  return remaining <= 0;
}

ordersRouter.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { status, date, date_from, date_to, table_no } = req.query;
  
  let sql = `SELECT * FROM orders WHERE 1=1`;
  const params: (string | number)[] = [];
  
  if (status) {
    sql += ` AND status = ?`;
    params.push(status as string);
  }
  if (date) {
    sql += ` AND DATE(created_at) = ?`;
    params.push(date as string);
  }
  if (date_from) {
    sql += ` AND created_at >= ?`;
    params.push(`${date_from} 00:00:00`);
  }
  if (date_to) {
    sql += ` AND created_at <= ?`;
    params.push(`${date_to} 23:59:59`);
  }
  if (table_no) {
    sql += ` AND table_no = ?`;
    params.push(table_no as string);
  }
  
  sql += ` ORDER BY created_at DESC`;
  
  const orders = db.prepare(sql).all(...params) as unknown as Order[];
  res.json(orders);
  return;
});

ordersRouter.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);
  
  const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(id) as unknown as Order | undefined;
  if (!order) {
    res.status(404).json({ error: 'not_found', message: 'Order not found' });
    return;
  }
  
  const items = db.prepare(`SELECT * FROM order_items WHERE order_id = ? ORDER BY id`).all(id) as unknown as OrderItem[];
  const payments = db.prepare(`SELECT * FROM payments WHERE order_id = ? ORDER BY id`).all(id) as unknown as Payment[];
  
  res.json({ ...order, items, payments });
  return;
});

ordersRouter.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { type, table_no, items } = req.body;
  
  if (!type || !items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'validation_error', message: 'type and items are required' });
    return;
  }
  
  if (!['dine-in', 'takeout', 'quick'].includes(type)) {
    res.status(400).json({ error: 'validation_error', message: 'Invalid order type' });
    return;
  }
  
  const orderNo = generateOrderNo();
  const now = new Date().toISOString();
  
  let subtotal = 0;
  let itemsCount = 0;
  
  const orderItemsData: Array<{ dish_id: number; dish_name: string; unit_price: number; quantity: number; amount: number; discount: number; note: string | null }> = [];
  
  for (const item of items) {
    const dish = db.prepare(`SELECT * FROM dishes WHERE id = ?`).get(item.dish_id) as unknown as { id: number; name: string; price: number } | undefined;
    if (!dish) {
      res.status(400).json({ error: 'validation_error', message: `Dish with id ${item.dish_id} not found` });
      return;
    }
    
    const quantity = item.quantity || 1;
    const discount = item.discount || 0;
    const amount = dish.price * quantity * (1 - discount);
    
    subtotal += amount;
    itemsCount += quantity;
    
    orderItemsData.push({
      dish_id: dish.id,
      dish_name: dish.name,
      unit_price: dish.price,
      quantity,
      amount,
      discount,
      note: item.note ?? null,
    });
  }
  
  try {
    db.exec('BEGIN');
    
    const insertOrderStmt = db.prepare(`
      INSERT INTO orders (order_no, type, table_no, status, items_count, subtotal, discount_amount, total_amount, paid_amount, created_at, updated_at)
      VALUES (?, ?, ?, 'dining', ?, ?, 0, ?, 0, ?, ?)
    `);
    
    const info = insertOrderStmt.run(orderNo, type, table_no ?? null, itemsCount, subtotal, subtotal, now, now);
    const orderId = info.lastInsertRowid as number;
    
    const insertItemStmt = db.prepare(`
      INSERT INTO order_items (order_id, dish_id, dish_name, unit_price, quantity, discount, amount, status, note, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'ordered', ?, ?)
    `);
    
    for (const itemData of orderItemsData) {
      insertItemStmt.run(orderId, itemData.dish_id, itemData.dish_name, itemData.unit_price, itemData.quantity, itemData.discount, itemData.amount, itemData.note, now);
    }
    
    for (const itemData of orderItemsData) {
      const bomItems = db.prepare(`
        SELECT di.ingredient_id, di.quantity, di.unit
        FROM dish_ingredients di
        WHERE di.dish_id = ?
      `).all(itemData.dish_id) as unknown as Array<{ ingredient_id: number; quantity: number; unit: string }>;
      
      for (const bom of bomItems) {
        const consumeQuantity = bom.quantity * itemData.quantity;
        deductInventory(db, bom.ingredient_id, consumeQuantity, bom.unit);
      }
    }
    
    db.exec('COMMIT');
    
    const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(orderId) as unknown as Order;
    const orderItems = db.prepare(`SELECT * FROM order_items WHERE order_id = ?`).all(orderId) as unknown as OrderItem[];
    
    res.status(201).json({ data: { ...order, items: orderItems }, message: 'Order created' });
    return;
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: 'internal', message: (err as Error).message });
    return;
  }
});

ordersRouter.post('/:id/items', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);
  const { items } = req.body;
  
  const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(id) as unknown as Order | undefined;
  if (!order) {
    res.status(404).json({ error: 'not_found', message: 'Order not found' });
    return;
  }
  
  if (order.status !== 'dining') {
    res.status(409).json({ error: 'conflict', message: 'Only dining orders can add items' });
    return;
  }
  
  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'validation_error', message: 'items must be non-empty array' });
    return;
  }
  
  const now = new Date().toISOString();
  let additionalSubtotal = 0;
  let additionalCount = 0;
  
  try {
    db.exec('BEGIN');
    
    const insertItemStmt = db.prepare(`
      INSERT INTO order_items (order_id, dish_id, dish_name, unit_price, quantity, discount, amount, status, note, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'ordered', ?, ?)
    `);
    
    for (const item of items) {
      const dish = db.prepare(`SELECT * FROM dishes WHERE id = ?`).get(item.dish_id) as unknown as { id: number; name: string; price: number } | undefined;
      if (!dish) {
        db.exec('ROLLBACK');
        res.status(400).json({ error: 'validation_error', message: `Dish with id ${item.dish_id} not found` });
        return;
      }
      
      const quantity = item.quantity || 1;
      const discount = item.discount || 0;
      const amount = dish.price * quantity * (1 - discount);
      
      insertItemStmt.run(id, dish.id, dish.name, dish.price, quantity, discount, amount, item.note ?? null, now);
      
      additionalSubtotal += amount;
      additionalCount += quantity;
      
      const bomItems = db.prepare(`
        SELECT di.ingredient_id, di.quantity, di.unit
        FROM dish_ingredients di
        WHERE di.dish_id = ?
      `).all(dish.id) as unknown as Array<{ ingredient_id: number; quantity: number; unit: string }>;
      
      for (const bom of bomItems) {
        const consumeQuantity = bom.quantity * quantity;
        deductInventory(db, bom.ingredient_id, consumeQuantity, bom.unit);
      }
    }
    
    db.prepare(`
      UPDATE orders 
      SET items_count = items_count + ?, subtotal = subtotal + ?, total_amount = subtotal + ?, updated_at = ?
      WHERE id = ?
    `).run(additionalCount, additionalSubtotal, additionalSubtotal, now, id);
    
    db.exec('COMMIT');
    
    const updatedOrder = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(id) as unknown as Order;
    const orderItems = db.prepare(`SELECT * FROM order_items WHERE order_id = ?`).all(id) as unknown as OrderItem[];
    
    res.json({ ...updatedOrder, items: orderItems });
    return;
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: 'internal', message: (err as Error).message });
    return;
  }
});

ordersRouter.patch('/:id/items/:itemId', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);
  const itemId = Number(req.params.itemId);
  const { status, note } = req.body;
  
  const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(id) as unknown as Order | undefined;
  if (!order) {
    res.status(404).json({ error: 'not_found', message: 'Order not found' });
    return;
  }
  
  const orderItem = db.prepare(`SELECT * FROM order_items WHERE id = ? AND order_id = ?`).get(itemId, id) as unknown as OrderItem | undefined;
  if (!orderItem) {
    res.status(404).json({ error: 'not_found', message: 'Order item not found' });
    return;
  }
  
  if (status && !['ordered', 'served', 'cancelled'].includes(status)) {
    res.status(400).json({ error: 'validation_error', message: 'Invalid status' });
    return;
  }
  
  const now = new Date().toISOString();
  
  if (status === 'cancelled' && orderItem.status !== 'cancelled') {
    try {
      db.exec('BEGIN');
      
      const dish = db.prepare(`SELECT * FROM dishes WHERE id = ?`).get(orderItem.dish_id) as unknown as { id: number } | undefined;
      if (dish) {
        const bomItems = db.prepare(`
          SELECT di.ingredient_id, di.quantity, di.unit
          FROM dish_ingredients di
          WHERE di.dish_id = ?
        `).all(dish.id) as unknown as Array<{ ingredient_id: number; quantity: number; unit: string }>;
        
        for (const bom of bomItems) {
          const returnQuantity = bom.quantity * orderItem.quantity;
          const batchNo = `R${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          db.prepare(`
            INSERT INTO inventory (ingredient_id, quantity, unit, batch_no, expiry_date, received_date, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, null, ?, 'active', ?, ?)
          `).run(bom.ingredient_id, returnQuantity, bom.unit, batchNo, now.split('T')[0], now, now);
        }
      }
      
      db.prepare(`UPDATE order_items SET status = 'cancelled', note = ?, updated_at = ? WHERE id = ?`).run(note ?? orderItem.note, now, itemId);
      
      db.prepare(`
        UPDATE orders 
        SET subtotal = subtotal - ?, total_amount = total_amount - ?, updated_at = ?
        WHERE id = ?
      `).run(orderItem.amount, orderItem.amount, now, id);
      
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      res.status(500).json({ error: 'internal', message: (err as Error).message });
      return;
    }
  } else {
    db.prepare(`UPDATE order_items SET status = ?, note = ?, updated_at = ? WHERE id = ?`).run(status ?? orderItem.status, note ?? orderItem.note, now, itemId);
  }
  
  const updatedItem = db.prepare(`SELECT * FROM order_items WHERE id = ?`).get(itemId) as unknown as OrderItem;
  res.json(updatedItem);
  return;
});

ordersRouter.post('/:id/checkout', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);
  const { discount_amount, pay_method, paid_amount, note } = req.body;
  
  const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(id) as unknown as Order | undefined;
  if (!order) {
    res.status(404).json({ error: 'not_found', message: 'Order not found' });
    return;
  }
  
  if (order.status !== 'dining') {
    res.status(409).json({ error: 'conflict', message: 'Only dining orders can be checked out' });
    return;
  }
  
  if (!pay_method || !['cash', 'wechat', 'alipay', 'aggregated'].includes(pay_method)) {
    res.status(400).json({ error: 'validation_error', message: 'pay_method is required' });
    return;
  }
  
  const now = new Date().toISOString();
  const finalDiscount = discount_amount || 0;
  const finalTotal = order.subtotal - finalDiscount;
  const finalPaid = paid_amount ?? finalTotal;
  
  if (finalPaid < 0) {
    res.status(400).json({ error: 'validation_error', message: 'paid_amount cannot be negative' });
    return;
  }
  
  try {
    db.exec('BEGIN');
    
    db.prepare(`
      UPDATE orders 
      SET status = 'paid', 
          discount_amount = ?, 
          total_amount = ?, 
          paid_amount = ?, 
          pay_method = ?, 
          pay_time = ?, 
          note = ?,
          updated_at = ?
      WHERE id = ?
    `).run(finalDiscount, finalTotal, finalPaid, pay_method, now, note ?? order.note, now, id);
    
    const insertPaymentStmt = db.prepare(`
      INSERT INTO payments (order_id, amount, method, transaction_id, status, paid_at, created_at)
      VALUES (?, ?, ?, ?, 'success', ?, ?)
    `);
    
    const transactionId = `TX${Date.now()}`;
    insertPaymentStmt.run(id, finalPaid, pay_method, transactionId, now, now);
    
    db.exec('COMMIT');
    
    const updatedOrder = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(id) as unknown as Order;
    const orderItems = db.prepare(`SELECT * FROM order_items WHERE order_id = ?`).all(id) as unknown as OrderItem[];
    const payments = db.prepare(`SELECT * FROM payments WHERE order_id = ?`).all(id) as unknown as Payment[];
    
    res.json({ ...updatedOrder, items: orderItems, payments });
    return;
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: 'internal', message: (err as Error).message });
    return;
  }
});

ordersRouter.post('/:id/refund', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);
  const { amount } = req.body;
  
  const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(id) as unknown as Order | undefined;
  if (!order) {
    res.status(404).json({ error: 'not_found', message: 'Order not found' });
    return;
  }
  
  if (order.status !== 'paid') {
    res.status(409).json({ error: 'conflict', message: 'Only paid orders can be refunded' });
    return;
  }
  
  const refundAmount = amount ?? order.paid_amount;
  
  if (refundAmount > order.paid_amount) {
    res.status(400).json({ error: 'validation_error', message: 'Refund amount cannot exceed paid amount' });
    return;
  }
  
  const now = new Date().toISOString();
  
  try {
    db.exec('BEGIN');
    
    db.prepare(`
      UPDATE orders 
      SET status = ?, paid_amount = paid_amount - ?, updated_at = ?
      WHERE id = ?
    `).run(refundAmount === order.paid_amount ? 'refunded' : 'paid', refundAmount, now, id);
    
    const insertPaymentStmt = db.prepare(`
      INSERT INTO payments (order_id, amount, method, transaction_id, status, paid_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    insertPaymentStmt.run(id, refundAmount, order.pay_method || 'wechat', `RF${Date.now()}`, 'success', now, now);
    
    db.exec('COMMIT');
    
    const updatedOrder = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(id) as unknown as Order;
    res.json(updatedOrder);
    return;
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: 'internal', message: (err as Error).message });
    return;
  }
});

ordersRouter.get('/daily-summary', (req: Request, res: Response) => {
  const db = getDb();
  const date = String(req.query.date || new Date().toISOString().split('T')[0]);
  
  const summary = db.prepare(`
    SELECT 
      COUNT(*) as orders_count,
      SUM(total_amount) as revenue,
      SUM(CASE WHEN pay_method = 'cash' THEN paid_amount ELSE 0 END) as cash_amount,
      SUM(CASE WHEN pay_method = 'wechat' THEN paid_amount ELSE 0 END) as wechat_amount,
      SUM(CASE WHEN pay_method = 'alipay' THEN paid_amount ELSE 0 END) as alipay_amount,
      SUM(CASE WHEN pay_method = 'aggregated' THEN paid_amount ELSE 0 END) as aggregated_amount
    FROM orders 
    WHERE DATE(created_at) = ? AND status = 'paid'
  `).get(date) as unknown as {
    orders_count: number;
    revenue: number;
    cash_amount: number;
    wechat_amount: number;
    alipay_amount: number;
    aggregated_amount: number;
  };
  
  res.json({
    date,
    orders_count: summary.orders_count || 0,
    revenue: summary.revenue || 0,
    by_method: {
      cash: summary.cash_amount || 0,
      wechat: summary.wechat_amount || 0,
      alipay: summary.alipay_amount || 0,
      aggregated: summary.aggregated_amount || 0,
    },
  });
  return;
});