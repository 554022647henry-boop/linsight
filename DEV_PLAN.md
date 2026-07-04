# Linsight 开发方案（DEV_PLAN）

> 本文档是 Linsight 餐饮小店案例的完整技术开发方案，覆盖技术栈、数据库、各模块设计、Demo 路径。
> 配套文档：`CASE_餐饮小店.md`（案例故事与差异论述）、`PROJECT_BRIEF.md`（项目定调）。

---

## 一、技术栈选型

### 1.1 数据库：SQLite（本地，单文件）

**结论：用本地 SQLite，不上云。**

**为什么本地而非云：**
- Demo 参赛作品，评委双击即用，不依赖网络
- 本地启动快，数据可控，方便预置 Demo 数据
- 不需要真实多用户并发

**为什么 SQLite 而非 JSON/CSV：**
- 损耗监控需要多表 JOIN（销售 × BOM × 库存），JSON 做不了
- 日结/月结需要聚合查询（GROUP BY、SUM）
- 单文件 `.db`，零配置，Demo 携带方便
- 后续要上云可平滑迁移到 PostgreSQL（SQL 语法几乎一致）

**技术实现：** Node.js + `better-sqlite3`（同步 API，简单稳定）

### 1.2 后端：Node.js + Express + TypeScript

- 前后端统一 TS/JS，一套语言
- `better-sqlite3` 同步 API，写起来直接
- 生态成熟，TRAE 集成方便

### 1.3 前端：React + Vite + Tailwind CSS

- 商家后台（Web）：点餐、收银、管理、看板
- 顾客端：H5（兼容后续小程序化）
- Demo 落地页：单文件 HTML（已有 `index.html`）

### 1.4 AI 能力：通过 TRAE 模型 API 调用

| 能力 | 用途 | 调用方式 |
|------|------|---------|
| 视觉 OCR | 识别进货单图片 | 多模态模型 |
| 语音转文字 | 老板语音日报/补录 | ASR 模型 |
| 对话理解 | 多模态输入解析、异常反问 | LLM |
| 洞察生成 | 经营日报、损耗分析、行动建议 | LLM + 数据 prompt |

### 1.5 项目目录结构（草案）

```
Linsight/
├── PROJECT_BRIEF.md              # 项目定调
├── CASE_餐饮小店.md               # 案例故事与差异论述
├── DEV_PLAN.md                   # 本文档
├── index.html                    # Demo 落地页
├── references/                   # 参考资料
├── server/                       # 后端
│   ├── src/
│   │   ├── db/
│   │   │   ├── schema.sql        # 建表语句
│   │   │   ├── seed.sql          # Demo 数据
│   │   │   └── index.ts          # DB 连接
│   │   ├── routes/               # API 路由
│   │   ├── ai/                   # AI 能力封装
│   │   └── index.ts
│   ├── uploads/                  # 进货单图片等本地存档
│   └── linsight.db               # SQLite 数据库文件
├── web/                          # 商家后台前端（收银/管理）
│   └── src/
├── wechat/                       # 老板微信端（Demo 视觉主体，模拟微信聊天）
│   └── src/
├── h5/                           # 顾客点餐端
│   └── src/
└── data/                         # Demo 数据素材
    ├── 进货单图片/
    ├── 销售流水/
    └── 库存快照/
```

---

## 二、数据库设计（16 张表）

### 2.1 主数据表

#### ① dishes（菜品表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增 |
| name | TEXT | 菜品名（青椒肉丝） |
| category | TEXT | 分类（主食/小菜/饮品） |
| price | REAL | 售价 |
| image_url | TEXT | 图片路径 |
| cost_estimate | REAL | 估算成本（AI 根据 BOM 算） |
| is_active | INTEGER | 1上架 / 0下架 |
| sort_order | INTEGER | 排序 |
| created_at | TEXT | |
| updated_at | TEXT | |

#### ② ingredients（食材表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | |
| name | TEXT | 食材名（牛肉、青菜） |
| category | TEXT | 分类（肉类/蔬菜/调料） |
| unit | TEXT | 标准单位（g/kg/个） |
| warning_threshold | REAL | 库存预警阈值 |
| created_at | TEXT | |
| updated_at | TEXT | |

#### ③ dish_ingredients（菜品配方 BOM）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | |
| dish_id | INTEGER FK → dishes.id | |
| ingredient_id | INTEGER FK → ingredients.id | |
| quantity | REAL | 用量 |
| unit | TEXT | 单位（与 ingredients.unit 对齐） |
| created_at | TEXT | |
| updated_at | TEXT | |

> 联合唯一：(dish_id, ingredient_id)

#### ④ suppliers（供应商表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | |
| name | TEXT | 供应商名 |
| contact | TEXT | 联系人 |
| phone | TEXT | 电话 |
| note | TEXT | 备注 |
| created_at | TEXT | |

#### ⑤ tables（桌台表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | |
| table_no | TEXT | 桌号（A1, A2） |
| capacity | INTEGER | 容纳人数 |
| status | TEXT | idle / occupied |
| qrcode_path | TEXT | 扫码点餐二维码图片 |
| created_at | TEXT | |

### 2.2 采购入库表

#### ⑥ purchase_orders（进货单主表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | |
| order_no | TEXT UNIQUE | 单号 PO20260703-001 |
| supplier_id | INTEGER FK → suppliers.id | 可空，识别后绑定 |
| supplier_name | TEXT | 冗余，方便查询 |
| total_amount | REAL | 总金额 |
| source_type | TEXT | 来源类型：image / voice / text / manual |
| source_file_path | TEXT | **原始文件路径（图片/语音留存溯源）** |
| ai_raw_text | TEXT | AI 识别出的原始文本 |
| status | TEXT | pending / confirmed / cancelled |
| note | TEXT | 备注 |
| operator | TEXT | 操作人 |
| created_at | TEXT | |
| confirmed_at | TEXT | |

> 关键：source_file_path 实现你说的"图片留存存档可追溯"

#### ⑦ purchase_items（进货明细表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | |
| order_id | INTEGER FK → purchase_orders.id | |
| ingredient_id | INTEGER FK → ingredients.id | 可空，未匹配时为空 |
| ingredient_name | TEXT | 冗余 |
| quantity | REAL | 数量 |
| unit | TEXT | 单位 |
| unit_price | REAL | 单价 |
| amount | REAL | 金额 = quantity × unit_price |
| ai_confidence | REAL | AI 识别置信度（0-1），用于异常判断 |
| created_at | TEXT | |

### 2.3 库存表

#### ⑧ inventory（库存批次表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | |
| ingredient_id | INTEGER FK → ingredients.id | |
| quantity | REAL | 当前数量 |
| unit | TEXT | 单位 |
| batch_no | TEXT | 批次号 |
| purchase_order_id | INTEGER FK → purchase_orders.id | 来源进货单 |
| expiry_date | TEXT | 保质期 |
| received_date | TEXT | 入库日期 |
| status | TEXT | active / consumed / expired |
| created_at | TEXT | |
| updated_at | TEXT | |

> 按批次管理：同一食材不同批次独立记录，支持先进先出与临期预警

### 2.4 收银点餐表

#### ⑨ orders（订单主表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | |
| order_no | TEXT UNIQUE | 单号 OD20260703-001 |
| type | TEXT | dine-in（堂食）/ takeout（外带）/ quick（快餐） |
| table_no | TEXT | 堂食桌号 |
| status | TEXT | dining / paid / cancelled / refunded |
| items_count | INTEGER | 菜品总份数 |
| subtotal | REAL | 菜品小计 |
| discount_amount | REAL | 折扣金额 |
| total_amount | REAL | 应付 = subtotal − discount_amount |
| paid_amount | REAL | 实付 |
| pay_method | TEXT | cash / wechat / alipay / aggregated / mixed |
| pay_time | TEXT | |
| note | TEXT | 订单备注 |
| created_at | TEXT | |
| updated_at | TEXT | |

#### ⑩ order_items（订单明细表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | |
| order_id | INTEGER FK → orders.id | |
| dish_id | INTEGER FK → dishes.id | |
| dish_name | TEXT | 冗余（菜品改名不影响历史） |
| unit_price | REAL | 下单时价格 |
| quantity | INTEGER | 份数 |
| discount | REAL | 单品折扣率（0-1） |
| amount | REAL | = unit_price × quantity × (1 − discount) |
| status | TEXT | ordered / served / cancelled |
| note | TEXT | 备注（少辣、不要葱） |
| created_at | TEXT | |

#### ⑪ payments（支付记录表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | |
| order_id | INTEGER FK → orders.id | |
| amount | REAL | |
| method | TEXT | cash / wechat / alipay / aggregated |
| transaction_id | TEXT | 第三方流水号（电子支付） |
| status | TEXT | success / pending / failed |
| paid_at | TEXT | |
| created_at | TEXT | |

> 支持一单多次支付（混合支付：部分现金 + 部分微信）

### 2.5 AI 与洞察表

#### ⑫ chat_logs（AI 对话日志）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | |
| session_id | TEXT | 会话 ID（模拟微信会话） |
| direction | TEXT | incoming（老板发来）/ outgoing（AI 推送） |
| message_type | TEXT | text / image / voice |
| content | TEXT | 文本内容或文件路径 |
| ai_action | TEXT | AI 执行的动作：created_purchase_order / confirmed / pushed_report |
| created_at | TEXT | |

#### ⑬ daily_reports（日报表，AI 生成，含完整经营数据体系）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | |
| report_date | TEXT UNIQUE | 报告日期 |
| revenue | REAL | 营收（Σ 菜品售价 × 份数） |
| food_cost | REAL | 食材成本（Σ 销售菜品 × BOM × 采购单价） |
| labor_cost | REAL | 人工成本（预设日薪/月薪折算分摊） |
| loss_amount | REAL | 损耗金额（来自 loss_records） |
| total_cost | REAL | 总成本 = 食材 + 人工 + 损耗 |
| gross_profit | REAL | 毛利 = 营收 − 食材成本 |
| gross_margin | REAL | 毛利率 |
| net_profit | REAL | 净利 = 营收 − 总成本 |
| customer_count | INTEGER | 客流 |
| avg_transaction | REAL | 客单价 |
| top_dishes | TEXT | 畅销菜（JSON） |
| dish_profit_detail | TEXT | **单品利润明细（JSON：每菜 售价/食材成本/分摊成本/净利）** |
| reconcile_diff_amount | REAL | **对账差异金额（实盘差异合计，来自 inventory_checks）** |
| ai_summary | TEXT | **AI 人话总结** |
| ai_suggestion | TEXT | **AI 行动建议** |
| created_at | TEXT | |

> 经营数据体系 = 营收（菜品×份数×单价）+ 成本（食材+人工分摊+损耗）+ 单品利润（分摊后每菜净利）+ 对账（理论应剩 vs 老板实盘）。关店时生成数据，早 8 点推送 AI 解读。

#### ⑭ loss_records（损耗记录表，AI 生成）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | |
| record_date | TEXT | |
| ingredient_id | INTEGER FK → ingredients.id | |
| ingredient_name | TEXT | 冗余 |
| theoretical_consumption | REAL | 理论消耗 = 销售菜品 × BOM |
| actual_consumption | REAL | 实际消耗 = 期初 + 采购 − 期末 |
| diff | REAL | 差值 = 实际 − 理论 |
| diff_amount | REAL | 差值金额 |
| ai_analysis | TEXT | AI 分析原因 |
| created_at | TEXT | |

#### ⑯ inventory_checks（关店实盘对账表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | |
| check_date | TEXT | 对账日期 |
| ingredient_id | INTEGER FK → ingredients.id | |
| ingredient_name | TEXT | 冗余 |
| theoretical_remaining | REAL | 理论应剩 = 期初 + 采购 − 理论消耗 |
| actual_remaining | REAL | 老板实盘报数（语音/文字录入） |
| diff | REAL | 差值 = 实际 − 理论 |
| diff_amount | REAL | 差值金额 |
| source | TEXT | voice / text / manual（老板录入方式） |
| ai_note | TEXT | AI 对差异的提示 |
| created_at | TEXT | |

> 关店时老板语音/文字报"牛肉还剩 8 斤、青菜 3 斤"，AI 与系统理论应剩对比，差异即对账结果，汇总进 daily_reports.reconcile_diff_amount。这是"关店对账"环节的落地点。

#### ⑮ ai_insights（AI 洞察推送记录）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | |
| insight_type | TEXT | daily_report / loss_warning / price_alert / expiry_alert |
| related_date | TEXT | |
| content | TEXT | 洞察内容 |
| suggestion | TEXT | 建议 |
| is_read | INTEGER | 0未读 / 1已读 |
| created_at | TEXT | |

### 2.6 表关系概览

```
dishes ──< dish_ingredients >── ingredients
                                      │
                                      │
suppliers ──< purchase_orders ──< purchase_items >── ingredients
                  │                        │
                  │ (source_file_path)     │
                  ▼                        ▼
              uploads/                  inventory（批次）
                                           │
tables ──< orders ──< order_items >── dishes
              │
              └──< payments

orders + dish_ingredients → 理论消耗 → loss_records
inventory 实际消耗          → 差值
                                       │
                                       ▼
inventory_checks（关店实盘对账）→ reconcile_diff_amount
                                       │
                                       ▼
                  daily_reports（经营数据体系：营收/食材成本/人工/单品利润/对账）
                  ai_insights（AI 推送）
chat_logs（全程对话留痕，老板微信端入口）
```

---

## 三、模块设计

### 3.1 菜品配方管理（节点 1）

**目的：** 建立菜品→食材的 BOM，为损耗监控提供理论消耗基准。

**功能：**
- 菜品 CRUD（名称、分类、售价、图片、上下架）
- 食材 CRUD（名称、分类、单位、预警阈值）
- BOM 维护：给菜品绑定食材 + 用量
- **AI 辅助录入**：老板语音"青椒肉丝一份用一两牛肉"，AI 转 → dish=青椒肉丝, ingredient=牛肉, quantity=50, unit=g
- AI 自动估算成本：根据 BOM × 最近采购单价，算出 cost_estimate，供毛利预览

**录入流程：**
```
老板语音描述 → AI 解析 → 自动填表 → 老板确认 → 入库
（老板只需确认，不用手填数字）
```

### 3.2 采购进货（节点 2，核心独占）

**核心流程：**

```
┌─────────────────────────────────────────────────────────────┐
│  1. 老板发图片/语音/文字到微信群（模拟）                          │
│     ↓                                                        │
│  2. AI 多模态识别 → 生成 pending 进货单                         │
│     - source_type 记录来源                                    │
│     - source_file_path 留存原始图片/语音                        │
│     - ai_raw_text 记录识别原文                                 │
│     - ai_confidence 标注每条明细置信度                          │
│     ↓                                                        │
│  3. AI 异常检测                                                │
│     - 价格偏离历史均价 20%+ → 标红                              │
│     - 数量异常（如牛肉一次买 500 斤）→ 标红                       │
│     - 置信度 < 0.7 → 标红                                     │
│     ↓                                                        │
│  4. 推送进货单给老板确认                                        │
│     - 无异常 → "已自动入账，回复 1 确认或回复修改"                 │
│     - 有异常 → "⚠️ 牛腩价格 45 元/斤，比上周贵 18%，确认吗？"     │
│     ↓                                                        │
│  5. 老板确认/修改 → status=confirmed                           │
│     ↓                                                        │
│  6. 自动入库（创建 inventory 批次记录）                          │
└─────────────────────────────────────────────────────────────┘
```

**图片留存与溯源：**
- 每张进货单图片存 `server/uploads/purchases/{order_no}.jpg`
- `purchase_orders.source_file_path` 记录路径
- 老板随时可查"3 天前那批牛肉的单子"→ 调出原图

**多模态输入示例：**
- 图片：进货单照片 → OCR
- 语音："今天在菜市场买了 15 斤青菜，30 斤牛肉，一共 1200 块" → ASR + 解析
- 文字：微信发来的供应商对账单截图 → OCR
- 手动：老板在后台手动补录

### 3.3 入库管理（节点 3）

**机制：** 采购单确认后自动入库，无需二次操作。

**批次管理：**
- 每次进货生成一个 inventory 批次
- 记录保质期（从进货单识别或老板补录）
- 临期前 3 天推送预警到 ai_insights

**库存查询：**
- 实时库存 = SUM(inventory.quantity WHERE status=active)
- 低库存预警：低于 ingredients.warning_threshold 时推送

### 3.4 收银点餐系统（节点 4，详细）⭐

**定位：面向青年社交型餐饮的轻量收银系统，不做夫妻店、不做大型连锁。**

**双端架构：**
- **商家端（Web 后台）**：点餐、收银、厨房看板、管理
- **顾客端（H5）**：扫码点餐、在线支付（Demo 模拟）

#### 3.4.1 商家端功能清单（一期 Demo）

| 模块 | 功能 | 说明 |
|------|------|------|
| **桌台管理** | 桌台列表、状态切换 | 简化：5-10 桌，不做分区 |
| **开台点餐** | 选桌号 → 加菜（选菜品+数量+备注）→ 下单 | 服务员操作，10 秒完成一桌 |
| **加菜/退菜** | 已下单订单追加菜品、退单个菜 | 退菜需备注原因 |
| **厨房看板** | 订单列表 + 出餐标记 | 简化：列表展示，点击"已出餐"，不做打印 |
| **结账收银** | 查看账单 → 选支付方式 → 打折 → 确认收款 | 核心环节，见下文 |
| **退款** | 已支付订单全额/部分退款 | 记录原因 |
| **日结** | 当日营收汇总、各支付方式占比 | 一键生成日结 |
| **订单查询** | 按日期/桌号/状态查历史订单 | |
| **菜品管理** | 菜品 CRUD、上下架、排序 | |
| **桌台管理** | 桌台 CRUD、生成二维码 | |

#### 3.4.2 结账收银流程（核心）

```
┌──────────────────────────────────────┐
│  1. 选订单 → 显示账单明细              │
│     - 菜品列表、小计、应付金额          │
│  2. 打折（可选）                       │
│     - 整单折扣：输入折扣率（如 8 折）   │
│     - 或减免金额（如减 10 元）          │
│     - 或选优惠券（二期：抖音券/大众券）  │
│  3. 选支付方式                         │
│     - 现金                             │
│     - 微信扫码（生成二维码，顾客扫）    │
│     - 支付宝扫码                       │
│     - 聚合码（老板出示码牌，顾客扫）    │
│     - 混合支付（部分现金 + 部分电子）   │
│  4. 确认收款                           │
│     - 现金：输入实收，系统算找零        │
│     - 电子：模拟支付成功回调            │
│  5. 订单完成 → status=paid             │
│     - 触发库存扣减（按 BOM 算理论消耗） │
│     - 触发毛利计算                     │
└──────────────────────────────────────┘
```

#### 3.4.3 顾客端功能清单（H5 扫码点餐，一期 Demo）

| 功能 | 说明 |
|------|------|
| 扫码进入 | 扫桌台二维码，自动绑定桌号 |
| 浏览菜单 | 分类 + 图片 + 价格 |
| 加购物车 | 选菜品 + 数量 + 备注（少辣） |
| 提交订单 | 确认后下单，进厨房看板 |
| 查看订单 | 自己点的菜、上菜状态 |
| 在线支付 | Demo 模拟微信支付（不接真实支付） |

> Demo 阶段顾客端可简化为"模拟下单"，重点是让数据流跑通。

#### 3.4.4 二期功能（Demo 不实现，仅标注）

- 抖音券 / 大众点评券核销
- 美团/饿了么外卖对接
- 会员系统
- 排队叫号
- 多门店
- 厨房打印
- 营销活动（满减、套餐）

#### 3.4.5 与外部支付渠道的对接（接入老板已有的商户号）

**目的：** 拉取真实交易明细，与系统订单对账（解决 CASE_餐饮小店.md 卡点 1 的"金额对账"部分）。

| 渠道 | 对接方式 | 拿到的数据 |
|------|---------|-----------|
| 微信支付商户号 | `GET https://api.mch.weixin.qq.com/v3/bill/tradebill` | 交易时间、订单号、金额、手续费 |
| 支付宝商户号 | 支付宝商户平台对账 API | 同上 |
| 银行聚合收款码 | 银行商户平台 API 或导账单 | 同上 |
| 现金 | 老板关店语音日报 | 金额 |

**对账逻辑：**
- 系统订单金额（来自收银系统） vs 第三方流水金额（来自 API）
- 差异项标红，推送给老板
- **注意：第三方 API 只返回金额，不返回菜品明细——菜品销量来自我们自己的收银系统，这是为什么需要做收银小系统的根本原因。**

> **这就解决了卡点 1：菜品销量来自我们自己的收银系统（结构化数据），金额对账来自第三方 API，两者结合既有销量又有真实流水。**

### 3.5 损耗/偷漏监控（节点 5，AI 独占）

**计算公式：**
```
理论消耗 = Σ(销售菜品 × BOM 用量)
实际消耗 = 期初库存 + 本期采购 − 期末库存
损耗/偷漏 = 实际消耗 − 理论消耗
```

**每日计算流程：**
1. 凌晨跑批：计算昨日每个食材的理论消耗与实际消耗
2. 算差值与差值金额
3. AI 分析差值原因（对照历史、对照销售波动）
4. 写入 loss_records
5. 差值超阈值 → 推送 ai_insights

**洞察输出（不是数字，是结论）：**
- 正常："本周青菜损耗 3%，属正常范围"
- 异常："⚠️ 本周牛肉对不上 200 元（实际比理论多消耗 4 斤），比上周翻倍。可能原因：①偷漏 ②浪费 ③配方没执行。建议：查厨房监控或盘点"
- 趋势："本月损耗率从 5% 升到 9%，主要来自肉类，建议复盘切割流程"

### 3.6 经营数据体系与日报推送（节点 6，含关店对账）

> 合并 CASE 文档原节点 1（早 8 点日报）与节点 6（关店对账）。本质上是同一套经营数据体系的"采集→计算→推送"：关店时生成数据，早 8 点推送 AI 解读。

**定位：** 这不是一张报表，是一套**经营数据体系**——营收、成本、单品利润、对账四个板块，AI 把它翻译成人话推给老板。

**四大数据板块：**

| 板块 | 组成 | 数据来源 |
|------|------|---------|
| **营收** | Σ(菜品售价 × 份数)，按菜/按支付方式拆 | orders + order_items |
| **成本** | 食材成本 + 人工成本（分摊）+ 损耗 | food_cost + labor_cost + loss_amount |
| **单品利润** | 每个菜：售价 − 食材成本 − 分摊成本（人工/损耗按销量分摊） | dish_profit_detail (JSON) |
| **对账** | 理论应剩库存 vs 老板实盘报数，差异即对账结果 | inventory_checks → reconcile_diff_amount |

**关店对账环节（数据采集）：**

```
┌─────────────────────────────────────────────────────┐
│  关店时，老板语音/文字报实盘：                          │
│  "牛肉还剩 8 斤，青菜 3 斤，鸡蛋 20 个"                │
│     ↓                                                │
│  AI 解析 → 写入 inventory_checks.actual_remaining    │
│     ↓                                                │
│  系统算理论应剩 = 期初 + 采购 − 理论消耗               │
│     ↓                                                │
│  差值 = 实际 − 理论 → diff_amount                     │
│     ↓                                                │
│  汇总 → daily_reports.reconcile_diff_amount          │
│  差异超阈值 → ai_insights 推送（关店即推，不等早 8 点） │
└─────────────────────────────────────────────────────┘
```

> 老板本来关店就要盘一下库存，这是嵌入"本来就在做的事"。系统算理论应剩，老板只报实际数字，AI 对差异告警。

**早 8 点日报推送（AI 解读）：**

**推送时间：** 每日早 8:00（Demo 由时间轴控制器触发）
**推送渠道：** 老板微信端（见 3.7），chat_logs 留痕

**日报内容（结论 + 建议，不是报表）：**

```
📊 昨日经营日报（7月3日）

💰 营收 4280 元 | 毛利 1280 元 | 毛利率 30% | 净利 680 元
👥 客流 134 人 | 客单价 32 元

📈 比上周日均：
  营收 ↓ 8%
  毛利 ↓ 18% ⚠️

🔍 原因分析：
  牛腩采购价 38→45 元/斤（涨 18%），牛肉饭销量占比 35%
  拉低毛利约 220 元

🥩 单品利润 TOP/BOTTOM：
  酸梅汤套餐  毛利 68%（畅销）
  牛腩饭      毛利 12%（⚠️ 最低，受采购价拖累）

⚖️ 关店对账：
  牛肉 差异 -4 斤（约 -180 元）⚠️ 建议查
  青菜 差异 +0.3 斤（正常）

💡 今日建议：
  1. 推酸梅汤套餐对冲（预计补 200 元）
  2. 牛腩饭暂时下架，推鸡肉饭替代
  3. 联系供应商张老板谈价
  4. 牛肉差异连续 2 天超标，建议复盘厨房

⚠️ 其他提醒：
  - 冰箱还有 8 斤牛腩，2 天后到期

[点击查看详细数据]
```

**AI 生成逻辑：**
1. 关店时：跑 loss_records（理论 vs 实际消耗）+ inventory_checks（实盘对账）→ 写 daily_reports 数据行
2. 早 8 点：读 daily_reports，对比历史 7 日均值算涨跌
3. 异常归因（采购价波动？销量结构变化？对账差异？）
4. 单品利润排序，找 TOP/BOTTOM
5. 生成行动建议（基于规则 + LLM）
6. 组装成人话文案，推送到老板微信端

### 3.7 老板微信端（前端模块，Demo 视觉主体）⭐

> 这是评委看 Demo 的**主视角入口**。老板的一天都从这里发生：收推送、发进货单照片、语音报实盘。收银系统等是后台数据源，不作为视觉主体。

**定位：** 模拟微信聊天界面（Web 实现），老板与 AI 助手的对话窗口。

**功能清单：**

| 功能 | 说明 | 对应节点 |
|------|------|---------|
| **接收 AI 推送** | 经营日报、异常告警、临期预警、对账差异 | 节点 6 |
| **发图片给 AI** | 拍进货单照片发群 → AI 识别入账 | 节点 2 |
| **发语音给 AI** | 语音补数量、语音报实盘、语音日报 | 节点 2/6 |
| **确认/修改进货单** | AI 推确认卡片，老板回"1"或"改牛腩 45→42" | 节点 2 |
| **关店实盘录入** | 语音/文字报库存 → 触发对账 | 节点 6 |
| **历史消息回看** | 翻看往期日报、告警 | — |

**实现形态：**
- Web 模拟微信聊天 UI（不接真实企业微信，Demo 阶段用 Web 模拟）
- 左侧对话流（气泡：老板 incoming / AI outgoing）
- AI 推送的可视化卡片（日报卡片、进货单确认卡片、对账差异卡片）
- 输入框支持：文字、模拟图片上传、模拟语音

**与后端交互：**
- 所有消息进 chat_logs 留痕
- AI 动作经 chat_logs.ai_action 记录（created_purchase_order / pushed_report / reconciled）

### 3.8 Demo 时间轴控制器（链路演示载体）⭐

> 评委不会等一天。Demo 需要一个"时间快进/场景切换"机制，把老板的一天压缩成几分钟演示。

**定位：** Demo 落地页的全局控制器，驱动"老板的一天"完整链路按场景推进。

**场景节点：**

| 时间 | 场景 | 触发的系统动作 |
|------|------|--------------|
| 早 8:00 | 早晨看日报 | 推送昨日经营日报到老板微信端 |
| 上午 | 进货到货 | 老板发进货单照片 → AI 入账入库 |
| 中午-晚 | 营业接单 | 收银系统产生订单数据，库存按 BOM 扣减 |
| 关店 | 盘点对账 | 老板语音报实盘 → 对账差异 → 关店告警 |
| 次日早 8:00 | 新日报 | 基于昨日完整数据推送 AI 解读 |

**控制器功能：**
- 场景切换按钮（上一段/下一段/跳转）
- 每个场景预置触发数据（模拟时间到的效果，不等真实跑批）
- 同步驱动左右分屏：左屏（改造前/SaaS 路径）vs 右屏（改造后/Linsight 路径，即老板微信端 + 后台数据变化）
- 数据变化可视化：库存数字滚动、金额累计、对账差异高亮

**与各模块关系：**
- 时间轴是"导演"，各业务模块是"演员"
- 切到"进货"场景 → 自动喂预置进货单图片给 AI → 微信端显示入账对话
- 切到"关店"场景 → 触发实盘对账流程 → 微信端显示差异告警

### 3.9 月度总结（节点 7，Stage 2，Demo 不实现）

> Demo 阶段不实现，标注为第二阶段。结构上 daily_reports 已含净利/单品利润，月度可由日表聚合 + AI 月度复盘生成，后续接入。CASE 文档节点 7 保留为长期规划。

---

## 四、AI 能力集成

### 4.1 AI 调用封装

```typescript
// server/src/ai/index.ts（草案）
export async function recognizePurchaseOrder(input: {
  type: 'image' | 'voice' | 'text';
  content: string;  // 文件路径或文本
}): Promise<{
  supplier?: string;
  items: Array<{ name: string; quantity: number; unit: string; unit_price: number }>;
  total_amount: number;
  raw_text: string;
  confidence: number;
}> { ... }

export async function generateDailyReport(date: string): Promise<{
  summary: string;
  suggestion: string;
}> { ... }

export async function analyzeLoss(records: LossRecord[]): Promise<{
  analysis: string;
}> { ... }

export async function parseVoiceBOM(voice: string): Promise<{
  dish: string;
  ingredient: string;
  quantity: number;
  unit: string;
}> { ... }
```

### 4.2 关键 Prompt 设计

**进货单识别 Prompt（要点）：**
- 识别供应商、商品名、数量、单位、单价、金额
- 标注每项置信度
- 发现价格偏离历史时主动提示

**日报生成 Prompt（要点）：**
- 输入：当日数据 + 历史 7 日均值
- 输出：人话总结 + 行动建议
- 风格：像参谋一样说话，先结论后细节

---

## 五、Demo 实现路径

### 5.1 Demo 数据准备（`data/` 目录）

- 1 家店、5 张桌、20 个菜品、30 个食材、20 条 BOM
- 1 周的进货单图片（5-10 张，含 2 张无数量的散买）
- 1 周的销售流水（每天 100-150 单）
- 1 周的库存快照
- 3 个供应商

### 5.2 Demo 核心界面（落地页 `index.html` 升级版）

**左右分屏对比，展现改造前/后：**

| 左屏（改造前/SaaS 路径） | 右屏（改造后/Linsight 路径） |
|------------------------|---------------------------|
| 老板打开 App → 翻报表 → 自己算 | 早 8 点微信推送日报，5 秒看完 |
| 老板手动录进货单（5 分钟） | 拍照发微信群，AI 自动入账（10 秒） |
| 厨师不填报损单 → 损耗黑洞 | AI 算差值，主动告警"牛肉对不上 200 元" |
| 月底会计算账 3 天 | 实时毛利 + 月度 AI 复盘 |

### 5.3 开发优先级

| 优先级 | 模块 | 说明 |
|--------|------|------|
| P0 | 数据库 + 基础数据 | 16 张表 + Demo 数据 seed |
| P0 | 老板微信端（3.7）⭐ | Demo 视觉主体，老板一天交互入口 |
| P0 | 采购进货 + AI 识别 | 核心独占能力 |
| P0 | 收银点餐系统（商家端） | 跑通点餐→结账→订单数据 |
| P1 | 损耗监控 + 经营数据体系/日报推送（3.6） | AI 洞察输出，含关店对账 |
| P1 | Demo 落地页 + 时间轴控制器（3.8） | 左右分屏 + 老板一天链路演示 |
| P2 | 顾客端 H5 扫码点餐 | 数据补充 |
| P2 | 第三方支付 API 对接 | 金额对账（模拟） |
| P3 | 语音输入支持 | 多模态展示 |
| Stage 2 | 月度总结（3.9） | Demo 不实现 |

---

## 六、已确认决策（2026-07-03 全部锁定）

| # | 决策项 | 选定 | 理由 |
|---|--------|------|------|
| 1 | 数据库 | SQLite 本地单文件 | Demo 零配置，上云可迁移 PostgreSQL |
| 2 | 后端语言 | Node.js + TypeScript | 前后端一套语言最省事 |
| 3 | 收银系统范围 | 商家端完整 + 顾客端模拟 | 数据流跑通即可，精力留给 AI 洞察 |
| 4 | 第三方支付对接 | 模拟数据（接口预留） | Demo 稳定第一，PaymentService 封装好未来切真 API |
| 5 | 顾客端 H5 | 模拟下单（不真做扫码） | 5 分钟搞定，评委不扫码 |

**下一步：按 P0 → P1 → P2 优先级进入开发。**

---

## 七、与 CASE_餐饮小店.md 的对应

| CASE 文档节点 | DEV_PLAN 对应模块 |
|--------------|------------------|
| 节点 1 菜品配方录入 | 3.1 菜品配方管理 |
| 节点 2 采购进货 | 3.2 采购进货 |
| 节点 3 入库 | 3.3 入库管理 |
| 节点 4 收银（原卡点 1） | 3.4 收银点餐系统 ⭐ 已解决 |
| 节点 5 损耗监控 | 3.5 损耗/偷漏监控 |
| 原节点 1（早 8 点日报）+ 原节点 6（关店对账），合并 | 3.6 经营数据体系与日报推送 ⭐ |
| 节点 7 月度总结 | 3.9 月度总结（Stage 2，Demo 不实现） |
| —（新增）Demo 视觉主体 | 3.7 老板微信端 ⭐ |
| —（新增）Demo 链路演示载体 | 3.8 Demo 时间轴控制器 ⭐ |
| 卡点 1 收银菜品销量 | **已解决：自建收银系统出菜品销量 + 第三方 API 出金额对账** |
| 卡点 2 现金处理 | 3.4.5 表中"现金：老板语音日报" |
| 卡点 3 BOM 录入 | 3.1 AI 辅助录入 |
