# Linsight 开发契约（CONTRACT）

> **单一事实源（Single Source of Truth）。** 任何并行开发会话开工前必读本文件。
> 本文件与 `server/src/db/schema.sql` + `server/src/types/index.ts` 三者严格 1:1，任何改动必须同步三处并回到本窗口确认。

---

## 0. 给并行会话的开工须知

**你（Day 2 并行会话）的工作流程：**
1. 读本文件（CONTRACT.md）—— 这是契约，不许改
2. 读 `DEV_PLAN.md` 你负责的模块章节 —— 这是业务细节
3. 读 `CLAUDE.md` —— 这是项目协作规范
4. 实现 `server/src/routes/<你的模块>.ts` 里所有 501 占位端点的业务逻辑
5. 用 `server/src/db/index.ts` 的 `getDb()` 拿数据库连接（`node:sqlite` 的 `DatabaseSync`）
6. 用 `server/src/types/index.ts` 里的类型做 TS 类型约束
7. **不许改**：schema.sql、types/index.ts、其他模块的 routes 文件、CONTRACT.md
8. 改完一个端点立即用 curl 验证，再改下一个
9. 全部实现后跑 `npm run typecheck` 必须 0 错误

**数据库 API 速查（node:sqlite，与 better-sqlite3 几乎一致）：**
```ts
import { getDb } from '../db/index.js';
const db = getDb();
// 插入/更新/删除
const stmt = db.prepare('INSERT INTO dishes (name, price) VALUES (?, ?)');
const info = stmt.run('青椒肉丝', 28);  // info.lastInsertRowid
// 单行查询
const row = db.prepare('SELECT * FROM dishes WHERE id = ?').get(1);
// 多行查询
const rows = db.prepare('SELECT * FROM dishes WHERE is_active = ?').all(1);
// 事务
db.exec('BEGIN'); try { ...; db.exec('COMMIT') } catch { db.exec('ROLLBACK'); throw }
```

---

## 1. 数据库表清单（16 张）

| # | 表名 | 用途 | 关键字段 |
|---|------|------|---------|
| ① | dishes | 菜品 | name, category, price, cost_estimate, is_active |
| ② | ingredients | 食材 | name(UNIQUE), category, unit, warning_threshold |
| ③ | dish_ingredients | 菜品配方 BOM | dish_id, ingredient_id, quantity, unit (UNIQUE dish+ingredient) |
| ④ | suppliers | 供应商 | name, contact, phone |
| ⑤ | tables | 桌台 | table_no(UNIQUE), capacity, status(idle/occupied/reserved) |
| ⑥ | purchase_orders | 进货单主表 | order_no(UNIQUE), supplier_id, total_amount, source_type, source_file_path, ai_raw_text, status |
| ⑦ | purchase_items | 进货明细 | order_id, ingredient_id, quantity, unit_price, amount, ai_confidence |
| ⑧ | inventory | 库存批次 | ingredient_id, quantity, batch_no, expiry_date, status(active/consumed/expired) |
| ⑨ | orders | 订单主表 | order_no(UNIQUE), type, table_no, status, subtotal, discount_amount, total_amount, paid_amount |
| ⑩ | order_items | 订单明细 | order_id, dish_id, dish_name, unit_price, quantity, discount, amount |
| ⑪ | payments | 支付记录 | order_id, amount, method, transaction_id, status |
| ⑫ | chat_logs | AI 对话日志 | session_id, direction, message_type, content, ai_action |
| ⑬ | daily_reports | 日报表（经营数据体系） | report_date(UNIQUE), revenue, food_cost, labor_cost, loss_amount, gross_profit, net_profit, top_dishes(JSON), dish_profit_detail(JSON), reconcile_diff_amount, ai_summary, ai_suggestion |
| ⑭ | loss_records | 损耗记录 | record_date, ingredient_id, theoretical_consumption, actual_consumption, diff, diff_amount |
| ⑮ | ai_insights | AI 洞察推送 | insight_type, related_date, content, suggestion, is_read |
| ⑯ | inventory_checks | 关店实盘对账 | check_date, ingredient_id, theoretical_remaining, actual_remaining, diff, source |

完整 DDL 见 `server/src/db/schema.sql`。

---

## 2. 共享 TS 类型

路径：`server/src/types/index.ts`

| 类型 | 对应表 | 备注 |
|------|--------|------|
| Dish | dishes | is_active: 0\|1 |
| Ingredient | ingredients | |
| DishIngredient | dish_ingredients | |
| Supplier | suppliers | |
| RestaurantTable | tables | status: TableStatus |
| TableStatus | — | 'idle' \| 'occupied' \| 'reserved' |
| PurchaseOrder | purchase_orders | |
| PurchaseItem | purchase_items | ai_confidence: 0~1 |
| PurchaseSourceType | — | 'image' \| 'voice' \| 'text' \| 'manual' |
| PurchaseStatus | — | 'pending' \| 'confirmed' \| 'cancelled' |
| InventoryBatch | inventory | |
| InventoryStatus | — | 'active' \| 'consumed' \| 'expired' |
| Order | orders | |
| OrderType | — | 'dine-in' \| 'takeout' \| 'quick' |
| OrderStatus | — | 'dining' \| 'paid' \| 'cancelled' \| 'refunded' |
| OrderItem | order_items | |
| OrderItemStatus | — | 'ordered' \| 'served' \| 'cancelled' |
| Payment | payments | |
| PayMethod | — | 'cash' \| 'wechat' \| 'alipay' \| 'aggregated' |
| PaymentStatus | — | 'success' \| 'pending' \| 'failed' |
| ChatLog | chat_logs | |
| ChatDirection | — | 'incoming' \| 'outgoing' |
| ChatMessageType | — | 'text' \| 'image' \| 'voice' \| 'card' |
| DailyReport | daily_reports | top_dishes/dish_profit_detail 为 JSON 字符串，TS 类型为对象数组 |
| TopDish | — | DailyReport.top_dishes 元素 |
| DishProfitDetail | — | DailyReport.dish_profit_detail 元素 |
| LossRecord | loss_records | |
| AiInsight | ai_insights | |
| InsightType | — | 'daily_report' \| 'loss_warning' \| 'price_alert' \| 'expiry_alert' \| 'reconcile_alert' |
| InventoryCheck | inventory_checks | |
| InventoryCheckSource | — | 'voice' \| 'text' \| 'manual' |
| ApiError | — | 通用错误响应 |
| Paginated\<T\> | — | 分页响应 |
| CreatedResponse\<T\> | — | 创建响应 |

---

## 3. API 端点清单

> Base URL: `http://localhost:3001/api`
> 所有占位返回 501 `{ error: 'not_implemented' }`，Day 2 替换为真实实现。
> 响应体未特别说明均为 JSON。

### 3.1 菜品 dishes

| Method | Path | 说明 | 请求 | 响应 |
|--------|------|------|------|------|
| GET | /dishes | 列表 | query: category?, is_active? | Dish[] |
| GET | /dishes/:id | 详情（含 BOM） | — | Dish & { bom: DishIngredient[] } |
| POST | /dishes | 创建 | Omit\<Dish,'id'\|'created_at'\|'updated_at'\> | CreatedResponse\<Dish\> |
| PUT | /dishes/:id | 更新 | Partial\<Omit\<Dish,'id'\|'created_at'\|'updated_at'\>\> | Dish |
| PATCH | /dishes/:id/status | 上下架 | { is_active: 0\|1 } | Dish |
| DELETE | /dishes/:id | 删除 | — | { message: string } |

### 3.2 食材 ingredients

| Method | Path | 说明 | 请求 | 响应 |
|--------|------|------|------|------|
| GET | /ingredients | 列表 | query: category? | Ingredient[] |
| GET | /ingredients/:id | 详情 | — | Ingredient |
| POST | /ingredients | 创建 | Omit\<Ingredient,'id'\|'created_at'\|'updated_at'\> | CreatedResponse\<Ingredient\> |
| PUT | /ingredients/:id | 更新 | Partial\<...\> | Ingredient |
| DELETE | /ingredients/:id | 删除 | — | { message } |

### 3.3 菜品配方 dish-ingredients（BOM）

| Method | Path | 说明 | 请求 | 响应 |
|--------|------|------|------|------|
| GET | /dishes/:dishId/ingredients | 某菜的 BOM | — | DishIngredient[] |
| POST | /dishes/:dishId/ingredients | 添加 BOM 项 | { ingredient_id, quantity, unit } | CreatedResponse\<DishIngredient\> |
| PUT | /dish-ingredients/:id | 更新用量 | { quantity?, unit? } | DishIngredient |
| DELETE | /dish-ingredients/:id | 删除 BOM 项 | — | { message } |
| POST | /dish-ingredients/parse | AI 语音解析 BOM | { voice_text } | { dish, ingredient, quantity, unit } |

### 3.4 桌台 tables

| Method | Path | 说明 | 请求 | 响应 |
|--------|------|------|------|------|
| GET | /tables | 列表 | — | RestaurantTable[] |
| GET | /tables/:id | 详情 | — | RestaurantTable |
| POST | /tables | 创建 | { table_no, capacity?, qrcode_path? } | CreatedResponse |
| PUT | /tables/:id | 更新 | Partial | RestaurantTable |
| PATCH | /tables/:id/status | 切状态 | { status: TableStatus } | RestaurantTable |
| DELETE | /tables/:id | 删除 | — | { message } |

### 3.5 供应商 suppliers

| Method | Path | 说明 | 请求 | 响应 |
|--------|------|------|------|------|
| GET | /suppliers | 列表 | — | Supplier[] |
| GET | /suppliers/:id | 详情 | — | Supplier |
| POST | /suppliers | 创建 | Omit\<Supplier,'id'\|'created_at'\> | CreatedResponse |
| PUT | /suppliers/:id | 更新 | Partial | Supplier |
| DELETE | /suppliers/:id | 删除 | — | { message } |

### 3.6 采购进货 purchase-orders（核心独占）⭐

| Method | Path | 说明 | 请求 | 响应 |
|--------|------|------|------|------|
| GET | /purchase-orders | 列表 | query: status?, supplier_id?, date_from?, date_to? | PurchaseOrder[] |
| GET | /purchase-orders/:id | 详情（含 items） | — | PurchaseOrder & { items: PurchaseItem[] } |
| POST | /purchase-orders | 手动创建 | { supplier_id?, supplier_name?, items[], note?, operator? } | CreatedResponse |
| POST | /purchase-orders/recognize | **AI 识别** ⭐ | { source_type, content } | { pending_order, anomalies[] } |
| PATCH | /purchase-orders/:id/confirm | 确认入库 | { modifications?[] } | PurchaseOrder（副作用：创建 inventory 批次） |
| PATCH | /purchase-orders/:id/cancel | 取消 | — | PurchaseOrder |
| GET | /purchase-orders/:id/source-file | 下载原始文件 | — | 文件流 |

**recognize 端点说明：**
- `source_type=image`：content = base64 或文件路径，调 AI OCR
- `source_type=voice`：content = 语音文本（Demo 直接传文字）
- `source_type=text`：content = 文本内容
- 返回 pending_order（不入库，等确认）+ anomalies（异常列表：价格偏离 20%+、数量异常、置信度 < 0.7）

### 3.7 库存 inventory

| Method | Path | 说明 | 请求 | 响应 |
|--------|------|------|------|------|
| GET | /inventory | 当前库存（按食材聚合） | — | Array\<{ ingredient_id, ingredient_name, total_quantity, unit, warning_threshold, is_low }\> |
| GET | /inventory/batches | 批次列表 | query: ingredient_id?, status? | InventoryBatch[] |
| GET | /inventory/expiring | 临期预警 | query: days?(默认3) | Array |
| GET | /inventory/low | 低库存预警 | — | Array |

### 3.8 订单 orders

| Method | Path | 说明 | 请求 | 响应 |
|--------|------|------|------|------|
| GET | /orders | 列表 | query: status?, date?, date_from?, date_to?, table_no? | Order[] |
| GET | /orders/:id | 详情（含 items + payments） | — | Order & { items: OrderItem[], payments: Payment[] } |
| POST | /orders | 创建 | { type, table_no?, items[] } | CreatedResponse\<Order\> |
| POST | /orders/:id/items | 加菜 | { items[] } | Order |
| PATCH | /orders/:id/items/:itemId | 退菜/改状态 | { status, note? } | OrderItem |
| POST | /orders/:id/checkout | **结账** ⭐ | { discount_amount?, discount_type?, pay_method, paid_amount, note? } | Order（副作用：库存扣减、毛利计算） |
| POST | /orders/:id/refund | 退款 | { amount?, reason } | Order |
| GET | /orders/daily-summary | 日结 | query: date | { revenue, orders_count, by_method: {...} } |

### 3.9 支付 payments

| Method | Path | 说明 | 请求 | 响应 |
|--------|------|------|------|------|
| GET | /payments | 列表 | query: order_id?, method?, date? | Payment[] |
| GET | /payments/:id | 详情 | — | Payment |
| POST | /payments | 单独记录（混合支付） | { order_id, amount, method, transaction_id?, status? } | CreatedResponse |

### 3.10 聊天 chat（老板微信端入口）

| Method | Path | 说明 | 请求 | 响应 |
|--------|------|------|------|------|
| GET | /chat/sessions | 会话列表 | — | Array\<{ session_id, last_message, last_time }\> |
| GET | /chat/sessions/:sessionId/messages | 会话消息 | — | ChatLog[] |
| POST | /chat/messages | **老板发消息** | { session_id, message_type, content } | { received: ChatLog, ai_replies: ChatLog[] } |
| POST | /chat/push | AI 推送（Demo 手动触发） | { session_id, message_type, content, ai_action? } | ChatLog |

**messages 端点逻辑：** 老板发图/语音/文字 → AI 识别是进货单还是实盘还是闲聊 → 执行对应动作 → 返回 AI 回复卡片

### 3.11 日报 daily-reports（经营数据体系）⭐

| Method | Path | 说明 | 请求 | 响应 |
|--------|------|------|------|------|
| GET | /daily-reports | 列表 | query: date_from?, date_to? | DailyReport[] |
| GET | /daily-reports/:date | 按日期取 | — | DailyReport |
| POST | /daily-reports/generate | **生成某日报告** ⭐ | { date } | DailyReport（聚合 orders + BOM + loss + inventory_checks） |
| POST | /daily-reports/:date/push | **推送到微信端** | — | { report: DailyReport, chat_log: ChatLog, insight: AiInsight } |

### 3.12 损耗 loss-records

| Method | Path | 说明 | 请求 | 响应 |
|--------|------|------|------|------|
| GET | /loss-records | 列表 | query: date?, date_from?, date_to?, ingredient_id? | LossRecord[] |
| POST | /loss-records/generate | 生成某日损耗 | { date } | LossRecord[] |

**generate 逻辑：** 理论消耗 = Σ 销售菜品 × BOM；实际消耗 = 期初 + 采购 − 期末；diff = 实际 − 理论

### 3.13 实盘对账 inventory-checks

| Method | Path | 说明 | 请求 | 响应 |
|--------|------|------|------|------|
| GET | /inventory-checks | 列表 | query: date?, ingredient_id? | InventoryCheck[] |
| POST | /inventory-checks | **老板报实盘** | { check_date, items[]: { ingredient_id, actual_remaining, source? } } | InventoryCheck[]（副作用：算 diff，超阈值推 ai_insights） |
| POST | /inventory-checks/generate | 系统自动跑 | { date } | InventoryCheck[] |

### 3.14 AI 洞察 ai-insights

| Method | Path | 说明 | 请求 | 响应 |
|--------|------|------|------|------|
| GET | /ai-insights | 列表 | query: type?, is_read?, date? | AiInsight[] |
| GET | /ai-insights/unread | 未读 | — | AiInsight[] |
| PATCH | /ai-insights/:id/read | 标记已读 | — | AiInsight |

---

## 4. 命名规范

| 维度 | 规范 | 示例 |
|------|------|------|
| 表名 | 复数蛇形 | dishes, purchase_orders, inventory_checks |
| 字段名 | 蛇形 | created_at, source_file_path, ai_raw_text |
| TS 类型 | 大驼峰单数 | Dish, PurchaseOrder, InventoryCheck |
| TS 枚举/联合类型 | 同上 | OrderStatus, PayMethod |
| API 路径 | 烤串（kebab） | /api/purchase-orders, /api/daily-reports |
| TS 文件名 | 烤串 | dish-ingredients.ts, daily-reports.ts |
| 变量 | 小驼峰 | purchaseOrder, dailyReport |
| 常量 | 大写蛇形 | MAX_DISCOUNT_RATE |
| 日期格式 | ISO 8601 | 2026-07-04 或 2026-07-04T08:00:00Z |
| 日期字段（仅日期） | TEXT 'YYYY-MM-DD' | report_date, check_date, record_date |
| 日期时间字段 | TEXT ISO datetime | created_at, paid_at |

---

## 5. 错误响应规范

```ts
// 4xx 客户端错误
{ error: 'validation_error', message: 'quantity must be positive', code?: 'INVALID_QUANTITY' }
{ error: 'not_found', message: 'Dish not found' }
{ error: 'conflict', message: 'Table A1 is occupied' }

// 5xx 服务端错误
{ error: 'internal', message: err.message }
```

HTTP 状态码：200(OK) / 201(Created) / 400(Validation) / 404(Not Found) / 409(Conflict) / 500(Internal)

---

## 6. 契约变更规则 ⚠️

**任何并行会话不得私自修改以下文件：**
- `CONTRACT.md`（本文件）
- `server/src/db/schema.sql`
- `server/src/types/index.ts`
- 其他模块的 `routes/*.ts`
- `server/src/db/index.ts`

**变更流程：**
1. 发现需要改契约 → 停下当前实现
2. 回到主治理窗口（本会话）说明改动需求
3. 主窗口统一改三处（schema + types + CONTRACT.md）+ 追加 changelog
4. 通知所有并行会话 pull 最新契约
5. 并行会话基于新契约继续

**CONTRACT.md Changelog：**

| 日期 | 改动 | 原因 |
|------|------|------|
| 2026-07-04 | 初始版本，16 表 + 14 路由模块 + 全部端点 | Day 1 脚手架 |

---

## 7. Day 2 并行分工

| 路 | 模块 | 负责 routes | 输入文档 | 关键端点 |
|---|------|------------|---------|---------|
| 1 | 后端 API 实现（数据层） | dishes, ingredients, dish-ingredients, tables, suppliers | CONTRACT + DEV_PLAN 3.1 | CRUD 全套 |
| 2 | 后端 API 实现（业务层） | purchase-orders, inventory, orders, payments | CONTRACT + DEV_PLAN 3.2-3.5 | recognize, checkout, confirm |
| 3 | 后端 API 实现（AI 层） | chat, daily-reports, loss-records, inventory-checks, ai-insights | CONTRACT + DEV_PLAN 3.6 | generate, push |
| 4 | 商家端 web 前端 | — | CONTRACT + DEV_PLAN 3.4 | 收银/管理 UI |
| 5 | 老板微信端 wechat 前端 | — | CONTRACT + DEV_PLAN 3.7 | 微信聊天 UI |
| 6 | 落地页 + 时间轴 | — | CONTRACT + DEV_PLAN 3.8 + 5.2 | index.html + 时间轴 |

> 实际并行度根据你的窗口数调整。建议至少 3 路：后端 / 前端 web / 前端 wechat+落地页。

---

## 8. 启动与验证

**后端启动：**
```bash
cd server
npm install              # 已完成
npm run db:init          # 建表（已验证）
npm run dev              # 启动开发服务器，http://localhost:3001
npm run typecheck        # 类型检查，必须 0 错误
```

**健康检查：**
```bash
curl http://localhost:3001/api/health
# { "status": "ok", "service": "linsight-server", "time": "..." }
```

**前端启动（Day 1 末尾初始化）：**
```bash
cd web && npm run dev      # http://localhost:5173
cd wechat && npm run dev   # http://localhost:5174
cd h5 && npm run dev       # http://localhost:5175
```
