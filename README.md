# Linsight · AI 经营分析助手

> Lens + Insight — **让老板不费劲就能看懂经营状况**

[![GitHub Pages](https://img.shields.io/badge/demo-live-brightgreen)](https://554022647henry-boop.github.io/linsight/)

---

## 项目介绍

Linsight 是一个嵌入经营工作流的 **AI 经营分析系统**。核心能力是**自动看懂经营数据，主动告诉老板问题在哪、该做什么**。

它不是 BI 看板，不是问数机器人，不是一个工具——它是一个从"帮老板看懂经营"出发、终局是**改变老板经营方式**的 AI 系统。

### 三阶段演进

| 阶段 | 做什么 | 老板的感受 |
|------|--------|-----------|
| **Phase 1 · 助手** | 数据进来 → AI 自动分析 → 主动推洞察 | "我不用管，系统会告诉我" |
| **Phase 2 · 嵌入工作流** | AI 开始参与接单、对账、管库存 | "我的事就在系统里做" |
| **Phase 3 · 工作流再造** | 整个经营方式跑在 AI 系统上 | "有了它之后我做事不一样了" |

### 理念来源

> "AI 不是给旧流程装插件，而是重写一家公司的组织、流程和决策方式。这种重构只有一号位能拍板。"
> — 李开复 · 零一万物 CEO

---

## 比赛背景

参与 **TRAE AI 创造力大赛**（The Real AI Engineer），目标赛道——"造个新解法"。

| 项目 | 内容 |
|------|------|
| 赛事 | TRAE AI 创造力大赛 |
| 主题 | "人人都可以创造" |
| 初赛截止 | 2026.07.15 |
| 决赛路演 | 2026.08.21-08.22 · 深圳 |

首个落地 Case：**餐饮小店老板老王**——把"靠感觉经营"换成 AI 嵌入工作流的经营系统。

---

## 项目结构

```
├── index.html                 # 落地页（GitHub Pages）
├── serve-landing.js           # 本地 HTTP 服务器
│
├── h5/                        # 顾客点餐 H5 端（React + Vite）
├── web/                       # 商家管理后台 Web 端
├── wechat/                    # 老板微信端
├── server/                    # 后端 API（Express + SQLite）
├── assets/                    # 截图资源
├── references/                # 参考资料
│
├── CLAUDE.md                  # AI 协作规范
├── PROJECT_BRIEF.md           # 项目宏观定调与理念
├── CASE_餐饮小店.md            # 案例故事与工作流
├── DEV_PLAN.md                # 技术开发方案
├── PROJECT_LOG.md             # 项目进程日志
└── 参赛材料/                  # 比赛提交材料
```

---

## 快速体验

### 落地页（GitHub Pages）

👉 **https://554022647henry-boop.github.io/linsight/**

### 本地运行

```bash
# 启动落地页
node serve-landing.js

# 启动后端
cd server && npm install && npm run dev

# 启动 H5 前端
cd h5 && npm install && npm run dev
```

---

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 H5 | React + Vite + TypeScript |
| 商家端 | 原生 HTML/JS |
| 微信端 | 原生 HTML/JS |
| 后端 | Node.js + Express |
| 数据库 | SQLite |
| AI | Claude API / DeepSeek |
| 部署 | GitHub Pages（落地页） |

---

## 相关文档

- [项目宏观定调](PROJECT_BRIEF.md)
- [案例故事：餐饮小店](CASE_餐饮小店.md)
- [技术开发方案](DEV_PLAN.md)
- [项目进程日志](PROJECT_LOG.md)

---

**作者：** 贺钰涵（Henry Yuhan） · 香港中文大学（深圳）商业分析与信息系统硕士
