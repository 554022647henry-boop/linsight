import { Router, type Request, type Response } from 'express';
import { getDb } from '../db/index.js';
import type { PurchaseOrder, PurchaseItem } from '../types/index.js';
import { recognizePurchaseOrder } from '../services/ai.js';

export const purchaseOrdersRouter = Router();

function generateOrderNo(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `PO${year}${month}${day}-${seq}`;
}

purchaseOrdersRouter.get('/', (req: Request, res: Response) => {
  const { status, supplier_id, date_from, date_to } = req.query;
  const db = getDb();
  
  let sql = `SELECT * FROM purchase_orders WHERE 1=1`;
  const params: (string | number)[] = [];
  
  if (status) {
    sql += ` AND status = ?`;
    params.push(status as string);
  }
  if (supplier_id) {
    sql += ` AND supplier_id = ?`;
    params.push(Number(supplier_id));
  }
  if (date_from) {
    sql += ` AND created_at >= ?`;
    params.push(`${date_from} 00:00:00`);
  }
  if (date_to) {
    sql += ` AND created_at <= ?`;
    params.push(`${date_to} 23:59:59`);
  }
  
  sql += ` ORDER BY created_at DESC`;
  
  const orders = db.prepare(sql).all(...params) as unknown as PurchaseOrder[];
  res.json(orders);
  return;
});

purchaseOrdersRouter.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);
  
  const order = db.prepare(`SELECT * FROM purchase_orders WHERE id = ?`).get(id) as unknown as PurchaseOrder | undefined;
  if (!order) {
    res.status(404).json({ error: 'not_found', message: 'Purchase order not found' });
    return;
  }
  
  const items = db.prepare(`SELECT * FROM purchase_items WHERE order_id = ? ORDER BY id`).all(id) as unknown as PurchaseItem[];
  
  res.json({ ...order, items });
  return;
});

purchaseOrdersRouter.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { supplier_id, supplier_name, items, note, operator } = req.body;
  
  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'validation_error', message: 'items is required and must be non-empty array' });
    return;
  }
  
  let totalAmount = 0;
  for (const item of items) {
    if (!item.ingredient_name || item.quantity <= 0) {
      res.status(400).json({ error: 'validation_error', message: 'Each item must have ingredient_name and positive quantity' });
      return;
    }
    const amount = (item.quantity || 0) * (item.unit_price || 0);
    totalAmount += amount;
    item.amount = amount;
    item.ai_confidence = item.ai_confidence ?? 1.0;
  }
  
  const orderNo = generateOrderNo();
  const now = new Date().toISOString();
  
  const insertStmt = db.prepare(`
    INSERT INTO purchase_orders (order_no, supplier_id, supplier_name, total_amount, source_type, status, note, operator, created_at)
    VALUES (?, ?, ?, ?, 'manual', 'pending', ?, ?, ?)
  `);
  
  try {
    db.exec('BEGIN');
    
    const info = insertStmt.run(orderNo, supplier_id ?? null, supplier_name ?? null, totalAmount, note ?? null, operator ?? null, now);
    const orderId = info.lastInsertRowid as number;
    
    const insertItemStmt = db.prepare(`
      INSERT INTO purchase_items (order_id, ingredient_id, ingredient_name, quantity, unit, unit_price, amount, ai_confidence, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const item of items) {
      insertItemStmt.run(orderId, item.ingredient_id ?? null, item.ingredient_name, item.quantity, item.unit ?? 'kg', item.unit_price ?? 0, item.amount ?? 0, item.ai_confidence ?? 1.0, now);
    }
    
    db.exec('COMMIT');
    
    const order = db.prepare(`SELECT * FROM purchase_orders WHERE id = ?`).get(orderId) as unknown as PurchaseOrder;
    const orderItems = db.prepare(`SELECT * FROM purchase_items WHERE order_id = ?`).all(orderId) as unknown as PurchaseItem[];
    
    res.status(201).json({ data: { ...order, items: orderItems }, message: 'Purchase order created' });
    return;
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: 'internal', message: (err as Error).message });
    return;
  }
});

purchaseOrdersRouter.post('/recognize', async (req: Request, res: Response) => {
  const { source_type, content } = req.body;

  if (!source_type || !content) {
    res.status(400).json({ error: 'validation_error', message: 'source_type and content are required' });
    return;
  }

  // 调用 LLM 解析进货单，失败则 fallback 到 mock
  interface PendingItem {
    ingredient_name: string;
    quantity: number;
    unit: string;
    unit_price: number;
    amount: number;
    ai_confidence: number;
  }
  interface Anomaly {
    item_id: number;
    type: string;
    message: string;
  }

  let items: PendingItem[];
  let supplierName: string;
  let anomalies: Anomaly[];

  const aiResult = await recognizePurchaseOrder(content);
  if (aiResult && aiResult.items.length > 0) {
    supplierName = aiResult.supplier_name ?? 'AI 识别供应商';
    items = aiResult.items.map((item) => {
      const quantity = item.quantity ?? 0;
      const unitPrice = item.unit_price ?? 0;
      const hasNullField =
        item.quantity === null || item.unit_price === null || item.unit === null;
      return {
        ingredient_name: item.name,
        quantity,
        unit: item.unit ?? 'kg',
        unit_price: unitPrice,
        amount: quantity * unitPrice,
        ai_confidence: hasNullField ? 0.6 : 0.9
      };
    });

    anomalies = [];
    items.forEach((item, idx) => {
      if (item.ai_confidence < 0.7) {
        anomalies.push({
          item_id: idx + 1,
          type: 'confidence',
          message: `${item.ingredient_name} 字段识别不完整，置信度低，建议人工确认`
        });
      }
      if (item.amount > 500) {
        anomalies.push({
          item_id: idx + 1,
          type: 'price',
          message: `${item.ingredient_name} 金额 ${item.amount.toFixed(0)} 元，金额较高，建议核对`
        });
      }
    });
  } else {
    // fallback：固定 mock 数据
    supplierName = '供应商张老板';
    items = [
      { ingredient_name: '牛肉', quantity: 15, unit: 'kg', unit_price: 42, amount: 630, ai_confidence: 0.95 },
      { ingredient_name: '青菜', quantity: 30, unit: 'kg', unit_price: 4.5, amount: 135, ai_confidence: 0.92 },
      { ingredient_name: '鸡蛋', quantity: 100, unit: '个', unit_price: 0.8, amount: 80, ai_confidence: 0.88 },
    ];
    anomalies = [
      { item_id: 1, type: 'price', message: '牛肉单价 42 元/kg，比上周均价高 8%' },
      { item_id: 3, type: 'confidence', message: '鸡蛋置信度 0.88，建议确认数量' },
    ];
  }

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const orderNo = generateOrderNo();
  const now = new Date().toISOString();

  const db = getDb();

  try {
    db.exec('BEGIN');

    const insertStmt = db.prepare(`
      INSERT INTO purchase_orders (order_no, supplier_id, supplier_name, total_amount, source_type, ai_raw_text, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
    `);

    const info = insertStmt.run(orderNo, null, supplierName, totalAmount, source_type, content, now);
    const orderId = info.lastInsertRowid as number;

    const insertItemStmt = db.prepare(`
      INSERT INTO purchase_items (order_id, ingredient_id, ingredient_name, quantity, unit, unit_price, amount, ai_confidence, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      insertItemStmt.run(orderId, null, item.ingredient_name, item.quantity, item.unit, item.unit_price, item.amount, item.ai_confidence, now);
    }

    db.exec('COMMIT');

    const order = db.prepare(`SELECT * FROM purchase_orders WHERE id = ?`).get(orderId) as unknown as PurchaseOrder;
    const orderItems = db.prepare(`SELECT * FROM purchase_items WHERE order_id = ?`).all(orderId) as unknown as PurchaseItem[];

    res.status(201).json({ pending_order: { ...order, items: orderItems }, anomalies });
    return;
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: 'internal', message: (err as Error).message });
    return;
  }
});

purchaseOrdersRouter.patch('/:id/confirm', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);
  const { modifications } = req.body;
  
  const order = db.prepare(`SELECT * FROM purchase_orders WHERE id = ?`).get(id) as unknown as PurchaseOrder | undefined;
  if (!order) {
    res.status(404).json({ error: 'not_found', message: 'Purchase order not found' });
    return;
  }
  
  if (order.status !== 'pending') {
    res.status(409).json({ error: 'conflict', message: 'Only pending orders can be confirmed' });
    return;
  }
  
  try {
    db.exec('BEGIN');
    
    if (modifications && Array.isArray(modifications)) {
      for (const mod of modifications) {
        const setClauses: string[] = [];
        const params: (number | string)[] = [];
        
        if (mod.quantity !== undefined) {
          setClauses.push('quantity = ?');
          params.push(mod.quantity);
        }
        if (mod.unit_price !== undefined) {
          setClauses.push('unit_price = ?');
          params.push(mod.unit_price);
        }
        
        if (setClauses.length > 0) {
          params.push(mod.item_id);
          db.prepare(`UPDATE purchase_items SET ${setClauses.join(', ')}, amount = quantity * unit_price WHERE id = ?`).run(...params);
        }
      }
    }
    
    const totalAmount = db.prepare(`SELECT SUM(amount) as total FROM purchase_items WHERE order_id = ?`).get(id) as unknown as { total: number };
    
    db.prepare(`UPDATE purchase_orders SET status = 'confirmed', total_amount = ?, confirmed_at = ? WHERE id = ?`).run(
      totalAmount.total ?? 0,
      new Date().toISOString(),
      id
    );
    
    const items = db.prepare(`SELECT * FROM purchase_items WHERE order_id = ?`).all(id) as unknown as PurchaseItem[];
    
    for (const item of items) {
      const ingredient = db.prepare(`SELECT * FROM ingredients WHERE name = ?`).get(item.ingredient_name) as unknown as { id: number; unit: string } | undefined;
      const ingredientId = ingredient?.id ?? item.ingredient_id;
      
      if (ingredientId) {
        const batchNo = `B${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        db.prepare(`
          INSERT INTO inventory (ingredient_id, quantity, unit, batch_no, purchase_order_id, expiry_date, received_date, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
        `).run(
          ingredientId,
          item.quantity,
          item.unit,
          batchNo,
          id,
          null,
          new Date().toISOString().split('T')[0],
          new Date().toISOString(),
          new Date().toISOString()
        );
      }
    }
    
    db.exec('COMMIT');
    
    const updatedOrder = db.prepare(`SELECT * FROM purchase_orders WHERE id = ?`).get(id) as unknown as PurchaseOrder;
    const updatedItems = db.prepare(`SELECT * FROM purchase_items WHERE order_id = ?`).all(id) as unknown as PurchaseItem[];
    
    res.json({ ...updatedOrder, items: updatedItems });
    return;
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: 'internal', message: (err as Error).message });
    return;
  }
});

purchaseOrdersRouter.patch('/:id/cancel', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);
  
  const order = db.prepare(`SELECT * FROM purchase_orders WHERE id = ?`).get(id) as unknown as PurchaseOrder | undefined;
  if (!order) {
    res.status(404).json({ error: 'not_found', message: 'Purchase order not found' });
    return;
  }
  
  if (order.status === 'cancelled') {
    res.json(order);
    return;
  }
  
  if (order.status === 'confirmed') {
    res.status(409).json({ error: 'conflict', message: 'Confirmed orders cannot be cancelled' });
    return;
  }
  
  db.prepare(`UPDATE purchase_orders SET status = 'cancelled' WHERE id = ?`).run(id);
  
  const updatedOrder = db.prepare(`SELECT * FROM purchase_orders WHERE id = ?`).get(id) as unknown as PurchaseOrder;
  res.json(updatedOrder);
  return;
});

purchaseOrdersRouter.get('/:id/source-file', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);
  
  const order = db.prepare(`SELECT * FROM purchase_orders WHERE id = ?`).get(id) as unknown as PurchaseOrder | undefined;
  if (!order) {
    res.status(404).json({ error: 'not_found', message: 'Purchase order not found' });
    return;
  }
  
  if (!order.source_file_path) {
    res.status(404).json({ error: 'not_found', message: 'Source file not found' });
    return;
  }
  
  res.status(200).json({ message: 'Source file download', file_path: order.source_file_path });
  return;
});