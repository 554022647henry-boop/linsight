# Linsight 项目进程日志（PROJECT_LOG）

> 本文档记录 Linsight 项目的关键决策、文档更新、开发进展。
> **倒序排列（最新在最上）。** 任何重要决策/文档变更/开发节点都追加到本文档。

---

## 文档清单

| 文档 | 用途 | 状态 |
|------|------|------|
| `PROJECT_BRIEF.md` | 项目宏观定调（理念、比赛策略、9 天计划） | 定稿 |
| `CASE_餐饮小店.md` | 首个案例故事、工作流拆解、差异论述、卡点 | 框架定稿，节点编号待与 DEV_PLAN 对齐 |
| `DEV_PLAN.md` | 技术开发方案（16 表 + 9 模块 + 优先级） | 已对齐最新决策 |
| `CONTRACT.md` | **开发契约（单一事实源）：表/类型/端点/命名规范/变更规则** | Day 1 定稿 |
| `PROJECT_LOG.md` | 本文档，项目进程记录 | 持续更新 |
| `index.html` | Demo 落地页（待升级为左右分屏 + 时间轴） | 旧版 |

---

## 2026-07-05｜Day 3 AI 接入 + 三端 UI 完整 + 落地页 Demo 入口

### 本次完成（Day 3）

4 路并行会话实现 + 总工程师审核修正。commit `96d77ce`：31 文件，4065 行。

**后端 AI 真实接入**
- ✅ 新增 [server/src/services/ai.ts](file:///d:/Projects/Linsight/server/src/services/ai.ts) — TRAE model API 封装
  - `callLlm(systemPrompt, userMessage, history?)` 统一入口，失败返回 null 不阻断
  - `chatReply` / `generateDailyReport` / `recognizePurchaseOrder` 三个业务函数
  - 环境变量：TRAE_API_KEY / TRAE_API_ENDPOINT / TRAE_MODEL
- ✅ [chat.ts](file:///d:/Projects/Linsight/server/src/routes/chat.ts) — POST /messages 接 LLM，10 条历史上下文
- ✅ [daily-reports.ts](file:///d:/Projects/Linsight/server/src/routes/daily-reports.ts) — /generate 的 ai_summary/ai_suggestion 接 LLM
- ✅ [purchase-orders.ts](file:///d:/Projects/Linsight/server/src/routes/purchase-orders.ts) — /recognize 接 LLM 解析进货单
- ✅ [.env.example](file:///d:/Projects/Linsight/.env.example) — 配置模板

**微信老板端（wechat）**
- ✅ [ChatPage.tsx](file:///d:/Projects/Linsight/wechat/src/pages/ChatPage.tsx) — 微信风格聊天 UI（绿色 header / 气泡 / 输入栏 / 语音图片按钮 / 卡片消息渲染）
- ✅ [ReportPage.tsx](file:///d:/Projects/Linsight/wechat/src/pages/ReportPage.tsx) — 日报页（日期选择 / 指标卡片 / AI 摘要建议 / 生成推送按钮）
- ✅ api/chat.ts + api/reports.ts — API 封装
- ✅ App.tsx — HashRouter + 底部 tab（聊天/日报）

**顾客 H5 点餐端（h5）**
- ✅ [MenuPage.tsx](file:///d:/Projects/Linsight/h5/src/pages/MenuPage.tsx) — 菜单页（分类 tab / 菜品列表 / 购物车浮动栏 / 购物车展开 sheet）
- ✅ [ConfirmPage.tsx](file:///d:/Projects/Linsight/h5/src/pages/ConfirmPage.tsx) — 确认下单页（明细 / 备注 / 人数 / 提交）
- ✅ [SuccessPage.tsx](file:///d:/Projects/Linsight/h5/src/pages/SuccessPage.tsx) — 成功页（订单号 / 已通知厨房）
- ✅ [CartContext.tsx](file:///d:/Projects/Linsight/h5/src/cart/CartContext.tsx) — 购物车状态管理
- ✅ api/client.ts + dishes.ts + orders.ts — API 封装

**落地页 Demo 入口**
- ✅ [index.html](file:///d:/Projects/Linsight/index.html) — 新增 Live Demo section：三个入口卡片（5173/5174/5175）
- ✅ 时间轴进度状态：Day1 done(绿) / Day2-4 doing(金+脉冲) / Day5-9 todo

### 审核发现的问题与修正

**问题 1：daily-reports fallback 建议逻辑 bug**
- 现象：7-01/02/03 净利均为负（-547/-547/-754 元），但 AI 建议"经营状况良好，继续保持"
- 原因：fallback 只检查毛利率/损耗/对账差异，没检查净利。毛利率 96.5%（因为食材成本低），损耗 0，对账差异 0，所以 suggestions 为空，默认推"良好"
- 修正：加 `if (net_profit < 0) suggestions.push(亏损提示)`，且毛利率检查加 `net_profit >= 0` 前置条件
- 修正后效果：7-01/02/03 均正确提示"当日亏损 547/547/754 元，建议提升客流或控制人工成本"

**问题 2：chat fallback 文案太弱**
- 现象：用户问"昨天生意怎么样"，AI 回复"好的，收到您的消息！"
- 原因：无 TRAE_API_KEY 时，非进货/盘点问题统一回复"好的，收到您的消息！"
- 修正：识别经营类关键词（生意/怎么样/日报/营收/利润），引导到日报页或提示配置 TRAE_API_KEY

**非问题（已确认正常）**
- h5 下单 API 返回 `{ data: {...}, message: '...' }` 而非直接返回 order —— 这是后端设计，h5 前端 `CreatedOrderResponse` 类型已正确对齐
- 7-03 营收仅 48 元 —— seed 数据里 7-03 只有 1 单 paid（48 元），另 2 单是 dining 未支付，符合预期

### 关键决策

1. **AI service 统一封装** — 所有 LLM 调用走 `callLlm()`，失败一律返回 null，调用方走 fallback。不抛异常，不阻断业务
2. **无 key 时智能 fallback** — 不是简单的"AI 不可用"，而是根据问题类型给不同引导（经营类→日报页，进货类→识别中，其他→Demo 模式提示）
3. **保留 mock 数据的"发现问题"价值** — 7-01/02/03 全部亏损（人工 800/天 vs 营收 200-300），AI 主动提示"亏损"，正好展示产品"帮老板发现问题"的价值
4. **wechat 用 HashRouter** — 微信端用 hash 路由避免刷新 404，h5 用 BrowserRouter（需服务器支持，Demo 够用）

### 验证结果

| 项目 | 结果 |
|------|------|
| 后端 typecheck | ✅ 0 错误 |
| web typecheck | ✅ 0 错误 |
| wechat typecheck | ✅ 0 错误 |
| h5 typecheck | ✅ 0 错误 |
| /api/health | ✅ ok |
| /api/dishes | ✅ 20 条 |
| /api/orders (POST) | ✅ 201，order_no + items |
| /api/daily-reports/generate | ✅ 营收/毛利/净利/建议均正确 |
| /api/chat/messages | ✅ fallback 回复正确 |
| h5→web 联调 | ✅ h5 下单，web 看到 dining 订单 |
| 落地页 Demo 入口 | ✅ 三个卡片链接正确 |
| 时间轴进度 | ✅ Day1 done / Day2-4 doing / Day5-9 todo |

### Day 3 传承给 Day 4 的资产

| 资产 | 位置 | Day 4 用途 |
|------|------|-----------|
| AI service 封装 | server/src/services/ai.ts | Day 4 配 TRAE_API_KEY 即启用真实 AI |
| 三端完整 UI | web/wechat/h5 | Day 4 联调打磨，不做大改 |
| 落地页 | index.html | Day 4 加 Demo 引导文案 |
| 修正后的 fallback | daily-reports.ts + chat.ts | Day 4 真实 AI 接入后保留作 fallback |

### 待用户决策的问题清单（已确认 OK，待解决）

#### P0｜经营分析数据体系
- 人工成本写死 800/天 → 所有日期净利为负
- 食材成本取历史平均价非 FIFO
- 毛利率 96.5% 失真（未含调料/水电/房租）
- 日报指标偏少（缺损耗率/库存周转/价格趋势）
- AI 建议是规则匹配非深度分析

**需要用户输入**：
- [ ] 真实成本结构（人工/房租/水电比例）
- [ ] 日报重点指标
- [ ] AI 洞察分析维度
- [ ] 是否加周报/月报

#### P1｜TRAE_API_KEY
- [ ] 用户提供 key 或走 fallback

#### P1｜Demo 故事线（Day 5 定稿）
- [ ] 确认演示路径和卖点

#### P2｜视觉打磨（Day 5-6）
- [ ] 确认是否提档三前端视觉

---

### 修订后排期（Day 4-9）

| Day | 日期 | 主线 | 交付物 |
|-----|------|------|--------|
| 4 | 7-06 | 经营分析数据体系重构 + 配 TRAE_API_KEY | 合理 seed + FIFO 成本 + 完整日报指标 |
| 5 | 7-07 | 三端联调打磨 + Demo 故事线定稿 | 边角 case 修复 + Demo 脚本 |
| 6 | 7-08 | 视觉打磨 + AI 洞察深化 | 参赛级 UI + AI 分析维度落地 |
| 7 | 7-09 | 全链路彩排 + 录屏 | Demo 视频 + 截图 |
| 8 | 7-10 | 提交材料整理 | 参赛提交包 |
| 9 | 7-11 | 缓冲/收尾 | 最终提交 |

Day 4 具体任务（等用户输入后开工）：
1. 改 seed.sql：按用户给的成本结构调整，让至少 2-3 天盈利
2. 改 daily-reports.ts：FIFO 批次价 + 调料分摊 + 补损耗率/库存周转
3. 配 TRAE_API_KEY（若用户提供）
4. 改 ai.ts 日报提示词：深化分析维度

Day 4 不做：前端视觉打磨、Demo 脚本、录屏

## 2026-07-05｜Day 3 并行开发启动（原计划）

---

## 2026-07-04｜Day 2 全栈功能实现完成

### 本次完成（Day 2）

按 Day 1 制定的"路径 C+D 融合"方案，4 路并行会话实现全栈功能。commit `3ca3e48`：65 文件，15740 行。

**后端 API 完整实现（14 个路由模块）**
- ✅ `purchase-orders` — AI 识别(mock) + 确认入库 + 取消，含异常检测
- ✅ `orders` — 下单(触发库存 FIFO 扣减) + 加菜 + 结账 + 查询
- ✅ `inventory` — 批次管理 + 预警 + 消耗扣减逻辑
- ✅ `dishes` / `ingredients` / `tables` / `suppliers` — 完整 CRUD
- ✅ `dish-ingredients` — BOM 管理（仅 /parse 端点保留 501，非核心）
- ✅ `ai-insights` / `chat` / `daily-reports` — mock 返回，结构对齐契约
- ✅ `daily-reports/generate` — 日结聚合 SQL 真实实现（营收/成本/毛利/客流/TOP 菜品/单品利润明细）
- ⚠️ AI 层均为 mock：chat 是关键词匹配，ai_summary 是模板拼接，purchase-orders/recognize 返回固定 3 商品

**前端 web 商家端（完整实现）**
- ✅ [Cashier.tsx](file:///d:/Projects/Linsight/web/src/pages/Cashier.tsx) — 桌台选择 + 点餐清单 + 加菜 + 结账弹窗
- ✅ [KitchenBoard.tsx](file:///d:/Projects/Linsight/web/src/pages/KitchenBoard.tsx) — 厨房看板（就餐中订单实时状态）
- ✅ [DishManagement.tsx](file:///d:/Projects/Linsight/web/src/pages/DishManagement.tsx) — 菜品 CRUD 管理
- ✅ App.tsx 路由布局 + API 层（config/dishes/orders/tables）+ 类型定义

**Demo 数据（seed.sql）**
- 3 供应商 / 30 食材 / 20 菜品 / 20 BOM / 5 桌台
- 7 采购单 / 19 订单 / 17 支付记录 / 19 库存批次
- 覆盖 2026-06-28 至 2026-07-03 一周流水

**验证**
- 后端 typecheck 0 错误，`npm run dev` 起服务
- API 联调：/api/dishes 返回 20 条，/api/tables 返回 5 条，/api/orders?status=dining 返回 2 条
- 前端 web dev 启动，前后端联调通过（GET /api/tables 200, GET /api/dishes 200, GET /api/orders 200）

### 关键决策

1. **4 路并行分工** —— 数据层/业务层/AI 层/前端 web 各开一个会话，各路改不同文件零冲突
2. **AI 层 mock 优先** —— Day 2 先把结构对齐契约，真实 AI 调用留 Day 3，避免 Day 2 被 API key 问题阻塞
3. **daily-reports 聚合 SQL 真实实现** —— 这是 Demo 的核心数据引擎，不能 mock；ai_summary 暂用模板拼接，Day 3 接 TRAE
4. **orders 下单触发库存 FIFO 扣减** —— 真实业务逻辑，扣减 inventory 批次，扣完标记 consumed
5. **seed.sql 字段对齐 schema** —— 返工修正（见下）

### 遇到的问题与返工

**问题：seed.sql 字段名与 schema.sql 不一致**
- 现象：`npm run db:seed` 报错 `table ingredients has no column named stock_qty`
- 原因：并行会话写 seed.sql 时用了旧字段名（`stock_qty`/`min_stock`/`cost_per_unit`/`supplier_id`），而 schema.sql 里 ingredients 表只有 `name/unit/warning_threshold`
- 修复：删除旧 db 文件 → 改 seed.sql 字段名对齐 schema → 重新 db:init + db:seed
- 教训：**并行开发的集成成本**。4 路会话各自认为对齐了契约，但合并时才发现字段不一致。总工程师（本窗口）的职责就是做集成审查和字段对齐。返工只花 5 分钟，是并行模式的正常成本。

**问题：git 仓库丢失**
- 现象：`git log` 报 `not a git repository`
- 原因：不明（可能是环境重置）
- 修复：`git init` + 重新 add + commit。Day 1 的 commit 历史丢失，但代码完整
- 教训：关键节点要 push 到远程，本地 git 不可靠

### Day 2 传承给 Day 3 的资产

| 资产 | 位置 | Day 3 用途 |
|------|------|-----------|
| 完整后端 API | server/src/routes/ | Day 3 窗口 1 在此基础上接 AI |
| 真实聚合 SQL | daily-reports.ts /generate | Day 3 窗口 1 只需替换 ai_summary 生成方式 |
| Demo 数据 | seed.sql | Day 3 所有联调依赖这份数据 |
| web 商家端 | web/src/ | Day 3 联调验收用（已完整，不改） |
| 契约文档 | CONTRACT.md | Day 3 各窗口的单一事实源 |
| 落地页 | index.html | Day 3 窗口 4 只做增量（已是参赛级） |

### Day 2 待办（已全部完成）

- [x] 4 路并行实现 routes 业务逻辑（替换 501 占位）
- [x] seed.sql + 1 周 Demo 数据
- [x] 前端 web 收银/管理 UI
- [ ] 前端 wechat 微信聊天 UI（移至 Day 3）
- [ ] 落地页 + 时间轴控制器（移至 Day 3，落地页已就绪，只需加 Demo 入口）

---

## 2026-07-04｜Day 1 脚手架搭建完成

### 本次完成（Day 1）

按"路径 C+D 融合"方案，单窗搭完可分发的契约层。Day 2 起 4 路并行会话只需读 `CONTRACT.md` + 自己模块的 `DEV_PLAN` 段落即可独立开工。

**后端（`server/`）**
- 技术栈：Express + TypeScript + `node:sqlite`（Node 24 内置，替代 better-sqlite3，免 native 编译）
- `schema.sql`：16 张表完整 DDL（外键/索引/唯一约束/CHECK 约束）
- `src/types/index.ts`：所有实体 interface + 枚举联合类型，与 schema 1:1
- `src/routes/`：14 个路由模块，全部端点签名 + JSDoc + 501 占位（共 ~50 个端点）
- `src/db/index.ts`：DB 连接 + `initSchema()`（幂等）
- `src/index.ts`：Express 入口，挂载 `/api` 路由，启动即建表
- 验证：`npm run typecheck` 0 错误；`npm run dev` 起服务；`/api/health` 返回 ok；`/api/dishes` 返回 501

**前端（`web/` `wechat/` `h5/`）**
- 技术栈：Vite 5 + React 18 + Tailwind CSS 4（`@tailwindcss/vite` 插件，零配置）
- 三个独立 Vite 项目，端口 5173/5174/5175，API 代理到 3001
- 各自占位 App.tsx（web=商家端、wechat=微信聊天 UI、h5=顾客点餐）
- 验证：web `npm run dev` 启动成功（559ms）

**契约文档（`CONTRACT.md`）**
- 16 表清单 + 全部 TS 类型映射 + ~50 端点详细规格（请求/响应/副作用）
- 命名规范、错误响应规范、契约变更规则
- Day 2 并行分工表 + 给并行会话的开工须知 + DB API 速查

### 关键决策

1. **数据库从 better-sqlite3 换 `node:sqlite`** —— 环境无 VS Build Tools，better-sqlite3 编译失败；Node 24 内置 `node:sqlite`（实验性但 API 稳定，与 better-sqlite3 几乎一致），零编译依赖。需 `--experimental-sqlite` flag 启动。
2. **seed.sql 移至 Day 2** —— Day 1 保持纯契约层，seed 数据由后端会话实现 API 时顺带造，避免契约层混入业务数据。

### Day 2 并行分工（4 路）

| 路 | 模块 | routes 文件 | 输入 |
|---|------|------------|------|
| 1 | 后端 API（数据层） | dishes/ingredients/dish-ingredients/tables/suppliers | CONTRACT 3.1-3.5 |
| 2 | 后端 API（业务层） | purchase-orders/inventory/orders/payments | CONTRACT 3.6-3.9 |
| 3 | 后端 API（AI 层） | chat/daily-reports/loss-records/inventory-checks/ai-insights | CONTRACT 3.10-3.14 |
| 4 | 前端 web（收银/管理） | — | CONTRACT + DEV_PLAN 3.4 |

> 老板微信端（wechat）+ 落地页/时间轴由本窗口或第 5 路承接，依据并行度调整。

### 待办（Day 2）

- [ ] 4 路并行实现 routes 业务逻辑（替换 501 占位）
- [ ] seed.sql + 1 周 Demo 数据
- [ ] 前端 web 收银/管理 UI
- [ ] 前端 wechat 微信聊天 UI（mock 数据先行）
- [ ] 落地页 + 时间轴控制器

---

## 2026-07-04｜DEV_PLAN 评估与补全

### 本次决策

1. **顾客端 H5 保留** —— 不砍，Demo 阶段做模拟下单即可，工作量可控。
2. **节点合并**：CASE 原节点 1（早 8 点日报）+ 原节点 6（关店对账）→ DEV_PLAN 3.6 合并为「经营数据体系与日报推送」。本质是同一套经营数据的采集→计算→推送。
3. **节点 7 月度总结**降级为 Stage 2，Demo 不实现。
4. **新增两个 Demo 关键模块**：老板微信端（3.7）、Demo 时间轴控制器（3.8）。

### DEV_PLAN 本次改动

**数据库（15→16 张表）**
- ⑬ `daily_reports` 扩展为完整经营数据体系：营收 / 食材成本 / 人工成本 / 损耗 / 总成本 / 毛利 / 净利 / 单品利润明细（JSON）/ 对账差异金额
- 新增 ⑯ `inventory_checks`（关店实盘对账表）：老板语音/文字报实盘 → 系统算理论应剩 → 差异对账

**模块设计**
- 3.6 升级为「经营数据体系与日报推送」——含四板块（营收/成本/单品利润/对账）+ 关店实盘录入流程 + 早 8 点 AI 解读推送
- 新增 3.7 老板微信端（Demo 视觉主体）：模拟微信聊天 UI，老板收推送/发进货单/语音报实盘/确认修改，所有交互进 chat_logs
- 新增 3.8 Demo 时间轴控制器：场景切换（早 8 点→进货→营业→关店→次日早 8 点），驱动左右分屏 + 数据变化可视化
- 3.9 月度总结标注 Stage 2

**优先级 / 目录 / 对应表**
- 目录新增 `wechat/`（老板微信端）
- 优先级表新增：老板微信端（P0）、时间轴控制器（P1）、月度总结（Stage 2）
- 与 CASE 对应表更新节点合并、新增模块映射

### 待办（下一轮）

- [ ] 同步更新 `CASE_餐饮小店.md` 节点编号，使其与 DEV_PLAN 合并方案一致
- [ ] 进入开发：按 P0 → P1 → P2 顺序

---

## 2026-07-03｜项目定调

### 关键决策（全部锁定）

- **场景锁定**：餐饮小店（中式快餐/轻食）作为 Case A
- **核心理念**：Linsight vs SaaS 的差异不在 AI 能力，在"形态"——SaaS 要被打开，Linsight 嵌入老板本就在做的事
- **三个独占壁垒**：① 拍照发微信群自动入全链路 ② 损耗监控（理论 vs 实际消耗差值） ③ 经营日报主动推送微信
- **技术栈**：SQLite + Node.js/TS/Express + React/Vite/Tailwind
- **收银系统**：商家端完整 + 顾客端模拟（解决卡点 1：菜品销量来自自建收银 + 金额对账来自第三方 API）
- **第三方支付**：模拟数据，PaymentService 封装预留接口

### 文档产出

- `PROJECT_BRIEF.md` 定稿
- `CASE_餐饮小店.md` 框架定稿（7 节点工作流 + 3 卡点）
- `DEV_PLAN.md` 初版（15 表 + 7 模块）

### 未解决卡点

- 卡点 1 收银菜品销量 → 已在 DEV_PLAN 3.4 解决（自建收银出销量 + API 出对账）
- 卡点 2 现金处理 → 倾向老板关店语音日报
- 卡点 3 BOM 录入准确度 → AI 辅助录入，待验证
