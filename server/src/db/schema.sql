-- Linsight 数据库 Schema（16 张表）
-- 单一事实源：与 CONTRACT.md / server/src/types/index.ts 严格 1:1
-- 任何改动必须同步三处。命名：表名复数蛇形，字段蛇形。

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ============================================================
-- 1. 主数据表
-- ============================================================

-- ① dishes 菜品表
CREATE TABLE IF NOT EXISTS dishes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  price REAL NOT NULL DEFAULT 0,
  image_url TEXT,
  cost_estimate REAL NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_dishes_category ON dishes(category);
CREATE INDEX IF NOT EXISTS idx_dishes_active ON dishes(is_active);

-- ② ingredients 食材表
CREATE TABLE IF NOT EXISTS ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'other',
  unit TEXT NOT NULL,
  warning_threshold REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ingredients_category ON ingredients(category);

-- ③ dish_ingredients 菜品配方 BOM
CREATE TABLE IF NOT EXISTS dish_ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dish_id INTEGER NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  quantity REAL NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (dish_id, ingredient_id)
);
CREATE INDEX IF NOT EXISTS idx_bom_dish ON dish_ingredients(dish_id);
CREATE INDEX IF NOT EXISTS idx_bom_ingredient ON dish_ingredients(ingredient_id);

-- ④ suppliers 供应商表
CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  contact TEXT,
  phone TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ⑤ tables 桌台表
CREATE TABLE IF NOT EXISTS tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_no TEXT NOT NULL UNIQUE,
  capacity INTEGER NOT NULL DEFAULT 4,
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'occupied', 'reserved')),
  qrcode_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tables_status ON tables(status);

-- ============================================================
-- 2. 采购入库表
-- ============================================================

-- ⑥ purchase_orders 进货单主表
CREATE TABLE IF NOT EXISTS purchase_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT NOT NULL UNIQUE,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT,
  total_amount REAL NOT NULL DEFAULT 0,
  source_type TEXT NOT NULL CHECK (source_type IN ('image', 'voice', 'text', 'manual')),
  source_file_path TEXT,
  ai_raw_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  note TEXT,
  operator TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  confirmed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_created ON purchase_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);

-- ⑦ purchase_items 进货明细表
CREATE TABLE IF NOT EXISTS purchase_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  ingredient_id INTEGER REFERENCES ingredients(id) ON DELETE SET NULL,
  ingredient_name TEXT NOT NULL,
  quantity REAL NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL,
  unit_price REAL NOT NULL DEFAULT 0,
  amount REAL NOT NULL DEFAULT 0,
  ai_confidence REAL NOT NULL DEFAULT 1.0 CHECK (ai_confidence >= 0 AND ai_confidence <= 1),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pi_order ON purchase_items(order_id);
CREATE INDEX IF NOT EXISTS idx_pi_ingredient ON purchase_items(ingredient_id);

-- ============================================================
-- 3. 库存表
-- ============================================================

-- ⑧ inventory 库存批次表
CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  quantity REAL NOT NULL CHECK (quantity >= 0),
  unit TEXT NOT NULL,
  batch_no TEXT,
  purchase_order_id INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL,
  expiry_date TEXT,
  received_date TEXT NOT NULL DEFAULT (date('now')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'consumed', 'expired')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_inv_ingredient ON inventory(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_inv_status ON inventory(status);
CREATE INDEX IF NOT EXISTS idx_inv_expiry ON inventory(expiry_date);

-- ============================================================
-- 4. 收银点餐表
-- ============================================================

-- ⑨ orders 订单主表
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('dine-in', 'takeout', 'quick')),
  table_no TEXT,
  status TEXT NOT NULL DEFAULT 'dining' CHECK (status IN ('dining', 'paid', 'cancelled', 'refunded')),
  items_count INTEGER NOT NULL DEFAULT 0,
  subtotal REAL NOT NULL DEFAULT 0,
  discount_amount REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  pay_method TEXT,
  pay_time TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_no);

-- ⑩ order_items 订单明细表
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  dish_id INTEGER REFERENCES dishes(id) ON DELETE SET NULL,
  dish_name TEXT NOT NULL,
  unit_price REAL NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  discount REAL NOT NULL DEFAULT 0 CHECK (discount >= 0 AND discount <= 1),
  amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ordered' CHECK (status IN ('ordered', 'served', 'cancelled')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_oi_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_oi_dish ON order_items(dish_id);

-- ⑪ payments 支付记录表
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount REAL NOT NULL CHECK (amount >= 0),
  method TEXT NOT NULL CHECK (method IN ('cash', 'wechat', 'alipay', 'aggregated')),
  transaction_id TEXT,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'pending', 'failed')),
  paid_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pay_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_pay_method ON payments(method);

-- ============================================================
-- 5. AI 与洞察表
-- ============================================================

-- ⑫ chat_logs AI 对话日志
CREATE TABLE IF NOT EXISTS chat_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  message_type TEXT NOT NULL CHECK (message_type IN ('text', 'image', 'voice', 'card')),
  content TEXT NOT NULL,
  ai_action TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_logs(created_at);

-- ⑬ daily_reports 日报表（含完整经营数据体系）
CREATE TABLE IF NOT EXISTS daily_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_date TEXT NOT NULL UNIQUE,
  revenue REAL NOT NULL DEFAULT 0,
  food_cost REAL NOT NULL DEFAULT 0,
  labor_cost REAL NOT NULL DEFAULT 0,
  loss_amount REAL NOT NULL DEFAULT 0,
  total_cost REAL NOT NULL DEFAULT 0,
  gross_profit REAL NOT NULL DEFAULT 0,
  gross_margin REAL NOT NULL DEFAULT 0,
  net_profit REAL NOT NULL DEFAULT 0,
  customer_count INTEGER NOT NULL DEFAULT 0,
  avg_transaction REAL NOT NULL DEFAULT 0,
  top_dishes TEXT,
  dish_profit_detail TEXT,
  reconcile_diff_amount REAL NOT NULL DEFAULT 0,
  ai_summary TEXT,
  ai_suggestion TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_dr_date ON daily_reports(report_date);

-- ⑭ loss_records 损耗记录表
CREATE TABLE IF NOT EXISTS loss_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_date TEXT NOT NULL,
  ingredient_id INTEGER REFERENCES ingredients(id) ON DELETE SET NULL,
  ingredient_name TEXT NOT NULL,
  theoretical_consumption REAL NOT NULL DEFAULT 0,
  actual_consumption REAL NOT NULL DEFAULT 0,
  diff REAL NOT NULL DEFAULT 0,
  diff_amount REAL NOT NULL DEFAULT 0,
  ai_analysis TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_lr_date ON loss_records(record_date);
CREATE INDEX IF NOT EXISTS idx_lr_ingredient ON loss_records(ingredient_id);

-- ⑮ ai_insights AI 洞察推送记录
CREATE TABLE IF NOT EXISTS ai_insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  insight_type TEXT NOT NULL CHECK (insight_type IN ('daily_report', 'loss_warning', 'price_alert', 'expiry_alert', 'reconcile_alert')),
  related_date TEXT,
  content TEXT NOT NULL,
  suggestion TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_date ON ai_insights(related_date);
CREATE INDEX IF NOT EXISTS idx_ai_read ON ai_insights(is_read);

-- ⑯ inventory_checks 关店实盘对账表
CREATE TABLE IF NOT EXISTS inventory_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  check_date TEXT NOT NULL,
  ingredient_id INTEGER REFERENCES ingredients(id) ON DELETE SET NULL,
  ingredient_name TEXT NOT NULL,
  theoretical_remaining REAL NOT NULL DEFAULT 0,
  actual_remaining REAL NOT NULL DEFAULT 0,
  diff REAL NOT NULL DEFAULT 0,
  diff_amount REAL NOT NULL DEFAULT 0,
  source TEXT NOT NULL CHECK (source IN ('voice', 'text', 'manual')),
  ai_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ic_date ON inventory_checks(check_date);
CREATE INDEX IF NOT EXISTS idx_ic_ingredient ON inventory_checks(ingredient_id);
