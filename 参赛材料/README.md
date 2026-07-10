# Linsight 参赛材料

> TRAE AI 创造力大赛 · 初赛作品
> 作品名：Linsight — 嵌入工作流的 AI 经营分析助手（餐饮小店案例）

---

## 一、文件清单

| 文件 | 说明 |
|------|------|
| `参赛帖子.md` | TRAE 社区发帖内容（按大赛要求格式） |
| `Demo体验指南.md` | 评委本地启动 Demo 与体验路径（5–8 分钟闭环） |
| `评分维度对照.md` | 作品与评审 4 维度的逐项对照 |
| `screenshots/` | 产品截图 |

---

## 二、功能清单（实际可体验）

### 后端（server，端口 3001）

- **技术栈**：Node.js + Express + TypeScript + SQLite（`node:sqlite` 内置，免 native 编译）
- **14 个路由模块 / 50+ API 端点**：dishes / ingredients / dish-ingredients / tables / suppliers / purchase-orders / inventory / orders / payments / chat / daily-reports / loss-records / inventory-checks / ai-insights
- **AI 服务**：`callLlm()` 统一封装 TRAE model API，3 个业务函数（chatReply / generateDailyReport / recognizePurchaseOrder），无 key 自动 fallback
- **Demo 数据**：3 供应商 / 30 食材 / 20 菜品 / 20 BOM / 5 桌台 / 7 采购单 / 19 订单 / 17 库存批次，覆盖 2026-07-03 ~ 07-09 一周真实流水

### 商家端 web（端口 5173，11 个页面）

| 页面 | 路由 | 核心功能 |
|------|------|---------|
| 收银点餐 | `/` | 桌台选择 + 菜品菜单 + 加菜 + 结账弹窗（微信/支付宝/现金） |
| 厨房看板 | `/kitchen` | 就餐中订单实时状态 |
| 桌台管理 | `/tables` | 桌台状态与清理 |
| 订单查询 | `/orders` | 按状态/日期/桌台筛选历史订单 |
| 菜品管理 | `/dishes` | 菜品 CRUD |
| 库存查看 | `/inventory` | 30 食材库存 + 预警阈值 + 低库存标识 |
| 采购进货 | `/purchases` | 采购单列表 + 状态流转 |
| 日结 | `/daily-close` | 当日营收汇总 + 支付方式分布 |
| 损耗监控 | `/loss` | 理论消耗 vs 实际消耗差异 + AI 分析 |
| 经营日报 | `/reports` | 营收/成本/毛利/净利/TOP5菜品/单品利润明细 + AI 建议 |
| 退款管理 | `/refund` | 已支付订单退款 |

### 老板端 wechat（端口 5174，4 个 tab）

| Tab | 路由 | 核心功能 |
|----|------|---------|
| 💬 聊天 | `#/` | 微信风格对话；**发图识别进货单 + 确认入库闭环**；日报卡片渲染 |
| 📊 日报 | `#/reports` | 日报列表 + 选日期生成 + 指标卡片 + AI 摘要建议 |
| ⚖️ 盘点 | `#/check` | 实盘录入 + 理论应剩对比 + 差异对账 |
| 🔔 洞察 | `#/insights` | AI 主动产生的异常预警（损耗告警/对账差异/日报推送） |

### 顾客端 h5（端口 5175，5 个页面，完整流程）

菜单（分类 tab + 购物车浮动栏）→ 确认下单（备注/人数）→ 支付（微信/支付宝/现金）→ 成功页（订单号 + 已通知厨房）→ 订单状态（`/order/:id`）

### 落地页 index.html

- Hero 区：品牌「Linsight」+ 定位「AI 经营分析助手」
- 三端入口卡片（5173 / 5174 / 5175）
- **三个独占壁垒**：拍照入账 / 损耗监控 / 日报推送
- **老板的一天 · 时间轴控制器**（可点击切换场景，1 分钟体验一天闭环）
- 餐饮小店工作流对比（改造前 vs 改造后）
- 9 天冲刺时间轴 + 技术栈标签（SQLite / Node.js / Express / TypeScript / React / Vite / Tailwind CSS）

---

## 三、全链路闭环（已联调验证）

按「老板的一天」顺序，9 步全链路打通：

1. **采购进货**：老板发图 → AI 识别进货单 → 返回预览卡片含 order_id
2. **确认入库**：PATCH confirm → status=confirmed → 库存批次自动插入
3. **顾客下单**：POST orders → 触发 BOM 库存 FIFO 扣减
4. **支付**：POST checkout → status=paid + 支付记录
5. **库存联动**：下单后对应食材库存精确减少（如牛肉 25→24.7kg，扣 0.3kg）
6. **实盘对账**：POST inventory-checks → 理论 vs 实际差异 + 金额 + AI 预警
7. **损耗生成**：POST loss-records/generate → 30 食材损耗记录 + AI 分析
8. **日报生成**：POST daily-reports/generate → 营收/成本/毛利/净利/TOP菜品 + AI 摘要建议
9. **日报推送**：POST push → 微信端收到日报卡片 + 洞察记录入库

---

## 四、快速启动

```bash
# 1. 安装依赖（首次）
cd server && npm install && cd ../web && npm install && cd ../wechat && npm install && cd ../h5 && npm install

# 2. 初始化数据库
cd ../server && npm run db:init && npm run db:seed

# 3. 启动 4 个服务（4 个终端）
cd server  && npm run dev   # 后端 3001
cd web     && npm run dev   # 商家端 5173
cd wechat  && npm run dev   # 老板端 5174
cd h5      && npm run dev   # 顾客端 5175

# 4. 打开落地页
# 双击 index.html
```

详细体验路径见 `Demo体验指南.md`。

---

## 五、技术架构

- **后端**：Node.js + Express + TypeScript + SQLite（node:sqlite）
- **前端**：React + Vite + Tailwind CSS 4（三端：web / wechat / h5）
- **AI**：TRAE model API（对话理解 / OCR 识别 / 洞察生成），统一封装 + fallback
- **开发方法**：合同先行（CONTRACT.md）+ 4 路并行开发 + 10 窗口冲刺修复

---

## 六、提交前检查

- [ ] 从 TRAE 对话历史复制 Session ID，填入 `参赛帖子.md`
- [ ] 确认报名赛道与标签一致（社会服务）
- [ ] 确认社区报名帖链接已填入
- [ ] 如需上传 HTML 格式文件，将整个项目打包为 ZIP
