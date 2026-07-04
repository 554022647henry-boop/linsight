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
