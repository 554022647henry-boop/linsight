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

## 2026-07-05｜Day 3 并行开发启动（进行中）

### Day 3 战略目标

把 Day 2 的"能跑的系统"升级为"能 Demo 的产品"——AI 真实接入 + 三端 UI 完整 + 落地页 Demo 入口。

### Day 3 并行分工（4 路）

| 路 | 模块 | 产出文件 | 输入 |
|---|------|---------|------|
| 1 | 后端 AI 真实接入 | server/src/services/ai.ts + 改 chat/daily-reports/purchase-orders | CONTRACT 3.6/3.10/3.11/3.13 |
| 2 | 微信老板端 | wechat/src/{api,pages,App}.tsx | CONTRACT 3.10/3.11 |
| 3 | 顾客 H5 点餐端 | h5/src/{api,pages,App}.tsx | CONTRACT 3.1/3.8 |
| 4 | 落地页 Demo 入口 + 时间轴进度 | index.html 增量 | 无 |

### Day 3 验收标准

- 后端：AI 端点真实调 TRAE model API，无 key 时 fallback 到 mock
- wechat：聊天页能发消息收回复 + 日报页能生成并显示
- h5：扫码 → 选菜 → 下单全流程跑通，订单进后端
- 落地页：三个 Demo 入口可点击，时间轴进度状态正确
- 联调：web 点餐 → 后端创单；wechat 发消息 → AI 真实回复；日报生成 → 推送到 wechat

### Day 3 待办

- [ ] 4 路并行实现
- [ ] 合并 conflict review（预期零冲突，各路改不同文件）
- [ ] 全量 typecheck + 三端 dev 联调
- [ ] commit Day 3

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
