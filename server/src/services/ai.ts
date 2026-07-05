/**
 * TRAE model API 封装
 *
 * 统一入口 callLlm(systemPrompt, userMessage, history?)：
 *   - 从环境变量读取 TRAE_API_KEY / TRAE_API_ENDPOINT / TRAE_MODEL
 *   - 失败（缺 key / 网络错 / 非 2xx / 解析失败）一律返回 null，调用方走 fallback
 *   - 不抛异常，不阻断业务流程
 *
 * 业务函数：
 *   - chatReply                 老板聊天助手
 *   - generateDailyReport       日报 AI 摘要 + 建议
 *   - recognizePurchaseOrder    进货单文本解析
 */

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface TraeConfig {
  apiKey: string | undefined;
  endpoint: string;
  model: string;
}

function getConfig(): TraeConfig {
  return {
    apiKey: process.env.TRAE_API_KEY,
    endpoint:
      process.env.TRAE_API_ENDPOINT ||
      'https://api.trae.ai/v1/chat/completions',
    model: process.env.TRAE_MODEL || 'trae-chat'
  };
}

export function isLlmEnabled(): boolean {
  return !!process.env.TRAE_API_KEY;
}

/**
 * 调用 TRAE model API。任何失败均返回 null。
 */
export async function callLlm(
  systemPrompt: string,
  userMessage: string,
  history?: LlmMessage[]
): Promise<string | null> {
  const config = getConfig();
  if (!config.apiKey) {
    return null;
  }

  const messages: LlmMessage[] = [
    { role: 'system', content: systemPrompt },
    ...(history ?? []),
    { role: 'user', content: userMessage }
  ];

  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.7,
        stream: false
      })
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(
        `[ai] TRAE API returned ${response.status}: ${text.slice(0, 200)}`
      );
      return null;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content ?? null;
  } catch (err) {
    console.error('[ai] TRAE API call failed:', (err as Error).message);
    return null;
  }
}

// ============================================================
// 1. 聊天助手
// ============================================================

const CHAT_SYSTEM_PROMPT =
  '你是餐饮店老板的经营助手，用口语化的中文回答，要具体、有数字、给建议。回答简短，不超过 100 字。';

export async function chatReply(
  userMessage: string,
  history: LlmMessage[]
): Promise<string | null> {
  return callLlm(CHAT_SYSTEM_PROMPT, userMessage, history);
}

// ============================================================
// 2. 日报 AI 生成
// ============================================================

export interface DailyReportContext {
  date: string;
  revenue: number;
  food_cost: number;
  gross_profit: number;
  gross_margin: number;
  net_profit: number;
  customer_count: number;
  avg_transaction: number;
  loss_amount: number;
  reconcile_diff_amount: number;
  top_dishes: Array<{
    dish_name: string;
    sold_count: number;
    revenue: number;
  }>;
  dish_profit_detail: Array<{
    dish_name: string;
    sold_count: number;
    revenue: number;
    food_cost: number;
    net_profit: number;
    margin: number;
  }>;
}

export interface DailyReportAiResult {
  summary: string;
  suggestions: string[];
}

const DAILY_REPORT_SYSTEM_PROMPT = `你是餐饮经营分析师。根据以下经营数据，用老板能听懂的话写日报。
要求：① 一段话摘要（含具体数字）② 3 条可执行建议（每条不超过 30 字）。
严格按以下格式输出，不要其他说明：
摘要：<一段话摘要>
建议：
1. <建议1>
2. <建议2>
3. <建议3>`;

export async function generateDailyReport(
  ctx: DailyReportContext
): Promise<DailyReportAiResult | null> {
  const userMessage = JSON.stringify(
    {
      date: ctx.date,
      revenue: ctx.revenue.toFixed(2),
      food_cost: ctx.food_cost.toFixed(2),
      gross_profit: ctx.gross_profit.toFixed(2),
      gross_margin: ctx.gross_margin.toFixed(1),
      net_profit: ctx.net_profit.toFixed(2),
      customer_count: ctx.customer_count,
      avg_transaction: ctx.avg_transaction.toFixed(2),
      loss_amount: ctx.loss_amount.toFixed(2),
      reconcile_diff_amount: ctx.reconcile_diff_amount.toFixed(2),
      top_dishes: ctx.top_dishes,
      dish_profit_detail: ctx.dish_profit_detail
    },
    null,
    2
  );

  const reply = await callLlm(DAILY_REPORT_SYSTEM_PROMPT, userMessage);
  if (!reply) return null;

  return parseDailyReportReply(reply);
}

function parseDailyReportReply(reply: string): DailyReportAiResult {
  const summaryMatch = reply.match(
    /摘要[：:]\s*([\s\S]*?)(?=\n\s*建议[：:]|$)/
  );
  const summary = (summaryMatch?.[1] ?? reply).trim();

  const suggestionsSection = reply.split(/建议[：:]/)[1] ?? '';
  const suggestions = suggestionsSection
    .split('\n')
    .map((line) => line.replace(/^\s*\d+[.、)]\s*/, '').trim())
    .filter((line) => line.length > 0)
    .slice(0, 3);

  if (!summary || suggestions.length === 0) {
    return { summary: reply.trim(), suggestions };
  }

  return { summary, suggestions };
}

// ============================================================
// 3. 进货单识别
// ============================================================

export interface RecognizedPurchaseItem {
  name: string;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
}

export interface RecognizeResult {
  supplier_name: string | null;
  items: RecognizedPurchaseItem[];
}

const PURCHASE_RECOGNIZE_SYSTEM_PROMPT = `你是餐饮进货单识别助手。解析用户提供的进货单文本（可能是 OCR 结果、语音转文字、或纯文本），提取商品信息。
返回严格的 JSON 格式（只输出 JSON，不要其他文字、不要 markdown 代码块）：
{
  "supplier_name": "供应商名称或 null",
  "items": [
    { "name": "商品名", "quantity": 15, "unit": "kg", "unit_price": 42 }
  ]
}
注意：
- 金额不需要返回，系统会自动计算 quantity * unit_price
- 单位用标准中文：kg、g、斤、个、瓶、袋、桶、箱、包、升
- 如果某字段无法识别，填 null
- 不要包含合计行、备注行等非商品信息`;

export async function recognizePurchaseOrder(
  content: string
): Promise<RecognizeResult | null> {
  const reply = await callLlm(PURCHASE_RECOGNIZE_SYSTEM_PROMPT, content);
  if (!reply) return null;

  const jsonText = extractJson(reply);
  if (!jsonText) return null;

  try {
    const parsed = JSON.parse(jsonText) as Partial<RecognizeResult>;
    if (!parsed.items || !Array.isArray(parsed.items)) return null;
    return {
      supplier_name: parsed.supplier_name ?? null,
      items: parsed.items
    };
  } catch {
    return null;
  }
}

function extractJson(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1);
  }
  return null;
}
