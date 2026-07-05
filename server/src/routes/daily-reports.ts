import { Router, type Request, type Response } from 'express';
import { getDb } from '../db/index.js';
import type { DailyReport, TopDish, DishProfitDetail, ChatLog, AiInsight } from '../types/index.js';
import { generateDailyReport, type DailyReportContext } from '../services/ai.js';

export const dailyReportsRouter = Router();

interface GenerateRequest {
  date: string;
}

interface PushResponse {
  report: DailyReport;
  chat_log: ChatLog;
  insight: AiInsight;
}

dailyReportsRouter.get('/', (req: Request, res: Response<DailyReport[]>) => {
  const db = getDb();
  const { date_from, date_to } = req.query;

  let sql = 'SELECT * FROM daily_reports WHERE 1=1';
  const params: (string | number)[] = [];

  if (date_from) {
    sql += ' AND report_date >= ?';
    params.push(date_from as string);
  }
  if (date_to) {
    sql += ' AND report_date <= ?';
    params.push(date_to as string);
  }

  sql += ' ORDER BY report_date DESC';

  const rows = db.prepare(sql).all(...params) as unknown as DailyReport[];
  for (const row of rows) {
    row.top_dishes = typeof row.top_dishes === 'string' ? JSON.parse(row.top_dishes) : null;
    row.dish_profit_detail = typeof row.dish_profit_detail === 'string' ? JSON.parse(row.dish_profit_detail) : null;
  }
  res.json(rows);
});

dailyReportsRouter.get('/:date', (req: Request, res: Response<DailyReport | { error: string; message: string }>) => {
  const db = getDb();
  const date = req.params.date;

  const row = db.prepare('SELECT * FROM daily_reports WHERE report_date = ?').get(date) as unknown as DailyReport | undefined;

  if (!row) {
    res.status(404).json({ error: 'not_found', message: 'Daily report not found' });
    return;
  }

  row.top_dishes = typeof row.top_dishes === 'string' ? JSON.parse(row.top_dishes) : null;
  row.dish_profit_detail = typeof row.dish_profit_detail === 'string' ? JSON.parse(row.dish_profit_detail) : null;
  res.json(row);
});

dailyReportsRouter.post('/generate', async (req: Request, res: Response<DailyReport>) => {
  const db = getDb();
  const { date } = req.body as GenerateRequest;

  const revenueStmt = db.prepare(`
    SELECT COALESCE(SUM(total_amount), 0) as revenue
    FROM orders
    WHERE status = 'paid' AND DATE(created_at) = ?
  `);
  const revenue = (revenueStmt.get(date) as unknown as { revenue: number }).revenue;

  const foodCostStmt = db.prepare(`
    SELECT COALESCE(SUM(oi.quantity * di.quantity * pi.unit_price / pi.quantity), 0) as food_cost
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN dish_ingredients di ON oi.dish_id = di.dish_id
    JOIN purchase_items pi ON di.ingredient_id = pi.ingredient_id
    WHERE o.status = 'paid' AND DATE(o.created_at) = ?
  `);
  const food_cost = (foodCostStmt.get(date) as unknown as { food_cost: number }).food_cost;

  const labor_cost = 800;

  const lossAmountStmt = db.prepare(`
    SELECT COALESCE(SUM(diff_amount), 0) as loss_amount
    FROM loss_records
    WHERE record_date = ?
  `);
  const loss_amount = (lossAmountStmt.get(date) as unknown as { loss_amount: number }).loss_amount;

  const total_cost = food_cost + labor_cost + loss_amount;
  const gross_profit = revenue - food_cost;
  const gross_margin = revenue > 0 ? (gross_profit / revenue) * 100 : 0;
  const net_profit = revenue - total_cost;

  const customerCountStmt = db.prepare(`
    SELECT COUNT(DISTINCT id) as count
    FROM orders
    WHERE status = 'paid' AND DATE(created_at) = ?
  `);
  const customer_count = (customerCountStmt.get(date) as unknown as { count: number }).count;
  const avg_transaction = customer_count > 0 ? revenue / customer_count : 0;

  const topDishesStmt = db.prepare(`
    SELECT 
      oi.dish_id,
      oi.dish_name,
      SUM(oi.quantity) as sold_count,
      SUM(oi.amount) as revenue
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.status = 'paid' AND DATE(o.created_at) = ?
    GROUP BY oi.dish_id, oi.dish_name
    ORDER BY sold_count DESC
    LIMIT 5
  `);
  const top_dishes = topDishesStmt.all(date) as unknown as TopDish[];

  const dishProfitStmt = db.prepare(`
    SELECT 
      oi.dish_id,
      oi.dish_name,
      SUM(oi.quantity) as sold_count,
      SUM(oi.amount) as revenue,
      COALESCE(SUM(oi.quantity * di.quantity * pi.unit_price / pi.quantity), 0) as food_cost
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    LEFT JOIN dish_ingredients di ON oi.dish_id = di.dish_id
    LEFT JOIN purchase_items pi ON di.ingredient_id = pi.ingredient_id
    WHERE o.status = 'paid' AND DATE(o.created_at) = ?
    GROUP BY oi.dish_id, oi.dish_name
  `);
  const profitRows = dishProfitStmt.all(date) as unknown as Array<{
    dish_id: number;
    dish_name: string;
    sold_count: number;
    revenue: number;
    food_cost: number;
  }>;

  const total_sold = profitRows.reduce((sum, r) => sum + r.sold_count, 0);
  const allocated_cost = total_sold > 0 ? (labor_cost + loss_amount) / total_sold : 0;

  const dish_profit_detail: DishProfitDetail[] = profitRows.map(row => ({
    dish_id: row.dish_id,
    dish_name: row.dish_name,
    sold_count: row.sold_count,
    revenue: row.revenue,
    food_cost: row.food_cost,
    allocated_cost: row.sold_count * allocated_cost,
    net_profit: row.revenue - row.food_cost - row.sold_count * allocated_cost,
    margin: row.revenue > 0 ? ((row.revenue - row.food_cost) / row.revenue) * 100 : 0
  }));

  const reconcileDiffStmt = db.prepare(`
    SELECT COALESCE(SUM(diff_amount), 0) as reconcile_diff_amount
    FROM inventory_checks
    WHERE check_date = ?
  `);
  const reconcile_diff_amount = (reconcileDiffStmt.get(date) as unknown as { reconcile_diff_amount: number }).reconcile_diff_amount;

  // 调用 LLM 生成日报摘要 + 建议，失败则 fallback 到模板
  const ctx: DailyReportContext = {
    date,
    revenue,
    food_cost,
    gross_profit,
    gross_margin,
    net_profit,
    customer_count,
    avg_transaction,
    loss_amount,
    reconcile_diff_amount,
    top_dishes,
    dish_profit_detail
  };
  const aiResult = await generateDailyReport(ctx);

  let ai_summary: string;
  let ai_suggestion: string;
  if (aiResult) {
    ai_summary = aiResult.summary;
    ai_suggestion = aiResult.suggestions.join('；');
  } else {
    ai_summary = `📊 ${date} 经营日报：营收 ${revenue.toFixed(0)} 元，毛利 ${gross_profit.toFixed(0)} 元，毛利率 ${gross_margin.toFixed(1)}%，净利 ${net_profit.toFixed(0)} 元。客流 ${customer_count} 人，客单价 ${avg_transaction.toFixed(0)} 元。`;

    const suggestions: string[] = [];
    if (net_profit < 0) suggestions.push(`当日亏损 ${Math.abs(net_profit).toFixed(0)} 元，建议提升客流或控制人工成本`);
    if (gross_margin < 25 && net_profit >= 0) suggestions.push('毛利率偏低，建议优化菜品结构');
    if (loss_amount > revenue * 0.1) suggestions.push('损耗过高，建议加强库存管理');
    if (Math.abs(reconcile_diff_amount) > 100) suggestions.push(`对账差异 ${reconcile_diff_amount.toFixed(0)} 元，建议核查`);
    if (suggestions.length === 0) suggestions.push('经营状况良好，继续保持');
    ai_suggestion = suggestions.join('；');
  }

  const existing = db.prepare('SELECT * FROM daily_reports WHERE report_date = ?').get(date);
  if (existing) {
    const updateStmt = db.prepare(`
      UPDATE daily_reports SET
        revenue = ?, food_cost = ?, labor_cost = ?, loss_amount = ?,
        total_cost = ?, gross_profit = ?, gross_margin = ?, net_profit = ?,
        customer_count = ?, avg_transaction = ?, top_dishes = ?,
        dish_profit_detail = ?, reconcile_diff_amount = ?, ai_summary = ?,
        ai_suggestion = ?
      WHERE report_date = ?
    `);
    updateStmt.run(
      revenue, food_cost, labor_cost, loss_amount,
      total_cost, gross_profit, gross_margin, net_profit,
      customer_count, avg_transaction, JSON.stringify(top_dishes),
      JSON.stringify(dish_profit_detail), reconcile_diff_amount, ai_summary,
      ai_suggestion, date
    );
  } else {
    const insertStmt = db.prepare(`
      INSERT INTO daily_reports
        (report_date, revenue, food_cost, labor_cost, loss_amount,
         total_cost, gross_profit, gross_margin, net_profit,
         customer_count, avg_transaction, top_dishes,
         dish_profit_detail, reconcile_diff_amount, ai_summary, ai_suggestion)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertStmt.run(
      date, revenue, food_cost, labor_cost, loss_amount,
      total_cost, gross_profit, gross_margin, net_profit,
      customer_count, avg_transaction, JSON.stringify(top_dishes),
      JSON.stringify(dish_profit_detail), reconcile_diff_amount, ai_summary, ai_suggestion
    );
  }

  const report = db.prepare('SELECT * FROM daily_reports WHERE report_date = ?').get(date) as unknown as DailyReport;
  report.top_dishes = top_dishes;
  report.dish_profit_detail = dish_profit_detail;

  res.json(report);
});

dailyReportsRouter.post('/:date/push', (req: Request, res: Response<PushResponse | { error: string; message: string }>) => {
  const db = getDb();
  const date = req.params.date;

  const report = db.prepare('SELECT * FROM daily_reports WHERE report_date = ?').get(date) as unknown as DailyReport | undefined;

  if (!report) {
    res.status(404).json({ error: 'not_found', message: 'Daily report not found' });
    return;
  }

  report.top_dishes = typeof report.top_dishes === 'string' ? JSON.parse(report.top_dishes) : null;
  report.dish_profit_detail = typeof report.dish_profit_detail === 'string' ? JSON.parse(report.dish_profit_detail) : null;

  const pushStmt = db.prepare(`
    INSERT INTO chat_logs (session_id, direction, message_type, content, ai_action)
    VALUES ('default', 'outgoing', 'card', ?, 'pushed_report')
  `);
  const pushInfo = pushStmt.run(JSON.stringify({
    type: 'daily_report',
    date,
    revenue: report.revenue,
    gross_profit: report.gross_profit,
    gross_margin: report.gross_margin,
    net_profit: report.net_profit,
    customer_count: report.customer_count,
    avg_transaction: report.avg_transaction,
    summary: report.ai_summary,
    suggestion: report.ai_suggestion
  }));

  const chat_log = db.prepare('SELECT * FROM chat_logs WHERE id = ?').get(pushInfo.lastInsertRowid) as unknown as ChatLog;

  const insightStmt = db.prepare(`
    INSERT INTO ai_insights (insight_type, related_date, content, suggestion, is_read)
    VALUES ('daily_report', ?, ?, ?, 0)
  `);
  const insightInfo = insightStmt.run(date, report.ai_summary || '', report.ai_suggestion || null);

  const insight = db.prepare('SELECT * FROM ai_insights WHERE id = ?').get(insightInfo.lastInsertRowid) as unknown as AiInsight;

  res.json({ report, chat_log, insight });
});