/**
 * POST /api/v1/admin/ai-coach
 * AI-powered operations analysis using real order data.
 * Reads OpenRouter key from platform settings (server-side, secure).
 *
 * Body: { period: 'today' | 'week' | 'month' }
 * Returns: { analysis: { overallScore, headline, insights, quickWins, watchOut } }
 */
import { getDB } from '../_lib/db';
import { getTenantFromRequest } from '../_lib/tenant';

function diffMinutes(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const d = (new Date(to).getTime() - new Date(from).getTime()) / 60000;
  return d > 0 && d < 480 ? Math.round(d * 10) / 10 : null;
}

function avg(arr: number[]): number | null {
  return arr.length > 0 ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10 : null;
}

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), {
    status: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' },
    });
  }

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const db = getDB(env);
    const body = await request.json() as any;
    const period = body.period || 'today';
    const { tenantId } = await getTenantFromRequest(request, env);

    // Get OpenRouter key from platform settings
    const platformRow = await db.prepare(
      "SELECT data FROM settings WHERE tenant_id = 'default' AND key = 'platform'"
    ).first() as any;
    const platformCfg = platformRow?.data ? JSON.parse(platformRow.data) : {};
    const apiKey = platformCfg.geminiApiKey;

    if (!apiKey) return json({ error: 'AI not configured. Set the OpenRouter API key in Super Admin Settings.' }, 400);

    // Calculate date range
    const now = new Date();
    let fromDate: string;
    if (period === 'week') {
      const d = new Date(now); d.setDate(d.getDate() - 7); fromDate = d.toISOString();
    } else if (period === 'month') {
      const d = new Date(now); d.setMonth(d.getMonth() - 1); fromDate = d.toISOString();
    } else {
      fromDate = now.toISOString().split('T')[0];
    }

    // Fetch orders
    const orders = await db.prepare(
      'SELECT * FROM orders WHERE tenant_id = ? AND created_at >= ? ORDER BY created_at DESC'
    ).bind(tenantId, fromDate).all();
    const rows = (orders.results || []) as any[];

    if (rows.length < 2) {
      return json({
        analysis: {
          overallScore: null,
          headline: 'Not enough data yet',
          insights: [{ category: 'data', title: 'Need more orders', finding: `Only ${rows.length} order(s) found for this period.`, advice: 'Process more orders through the full workflow (Confirmed → Cooking → Ready → Collected) to build up analytics data.', impact: 'high', dataPoint: `${rows.length} orders` }],
          quickWins: ['Process a few orders through the BOH kitchen display to start recording timing data'],
          watchOut: null,
          dataDisclaimer: `Based on ${rows.length} order(s) over ${period}.`,
        }
      });
    }

    // Build analytics summary for the AI
    const totalRevenue = rows.reduce((s: number, r: any) => s + (r.total || 0), 0);
    const completed = rows.filter((r: any) => r.status === 'Completed' || r.status === 'Ready').length;
    const cancelled = rows.filter((r: any) => r.status === 'Cancelled' || r.status === 'Rejected').length;

    const confirmToCook: number[] = [];
    const cookToReady: number[] = [];
    const readyToComplete: number[] = [];
    const totals: number[] = [];

    for (const r of rows) {
      const c2k = diffMinutes(r.confirmed_at || r.created_at, r.cooking_at);
      const k2r = diffMinutes(r.cooking_at, r.ready_at);
      const r2c = diffMinutes(r.ready_at, r.completed_at);
      const tot = diffMinutes(r.created_at, r.completed_at || r.ready_at);
      if (c2k !== null) confirmToCook.push(c2k);
      if (k2r !== null) cookToReady.push(k2r);
      if (r2c !== null) readyToComplete.push(r2c);
      if (tot !== null) totals.push(tot);
    }

    // Hourly distribution
    const hourCounts: Record<number, number> = {};
    for (const r of rows) {
      const h = new Date(r.created_at).getHours();
      hourCounts[h] = (hourCounts[h] || 0) + 1;
    }
    const peakHour = Object.entries(hourCounts).sort((a, b) => Number(b[1]) - Number(a[1]))[0];

    // Source breakdown
    const sources: Record<string, number> = {};
    for (const r of rows) { const s = r.source || 'walk_up'; sources[s] = (sources[s] || 0) + 1; }

    // Top items
    const itemCounts: Record<string, number> = {};
    for (const r of rows) {
      let items: any[] = [];
      try { items = typeof r.items === 'string' ? JSON.parse(r.items) : (r.items || []); } catch {}
      for (const e of items) {
        const name = e.item?.name || e.name || 'Unknown';
        itemCounts[name] = (itemCounts[name] || 0) + (e.quantity || 1);
      }
    }
    const topItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Build the data summary for AI
    const dataSummary = {
      period,
      totalOrders: rows.length,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      avgOrderValue: Math.round((totalRevenue / rows.length) * 100) / 100,
      completedOrders: completed,
      cancelledOrders: cancelled,
      completionRate: Math.round((completed / rows.length) * 100),
      timing: {
        avgWaitToStartCooking: avg(confirmToCook),
        avgCookTime: avg(cookToReady),
        avgPickupWait: avg(readyToComplete),
        avgTotalFulfillment: avg(totals),
        fastestOrder: totals.length > 0 ? Math.round(Math.min(...totals) * 10) / 10 : null,
        slowestOrder: totals.length > 0 ? Math.round(Math.max(...totals) * 10) / 10 : null,
        ordersWithTimingData: totals.length,
      },
      peakHour: peakHour ? { hour: Number(peakHour[0]), orders: peakHour[1] } : null,
      hourlyDistribution: hourCounts,
      orderSources: sources,
      topSellingItems: topItems.map(([name, qty]) => ({ name, quantity: qty })),
    };

    // Call OpenRouter
    const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://chownow.au',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are an expert food truck operations analyst for ChowNow, a food truck POS platform. You have been given REAL operational data from a food truck's actual orders. Your job is to analyze patterns and provide specific, evidence-based advice.

RULES — follow these strictly:
1. ONLY make claims directly supported by the data provided. Never fabricate numbers.
2. Always reference the specific data point backing each insight (e.g., "your average cook time of 14.2 minutes").
3. Use food service industry benchmarks where applicable (fast-casual target: 8-12 min prep, <3 min pickup wait).
4. Be constructive and encouraging — you're a coach, not a critic.
5. Prioritize highest-impact improvements first.
6. If timing data is missing or insufficient, acknowledge this honestly and explain why it matters.
7. Keep advice practical and actionable for a food truck operation (1-3 staff, limited space).

Respond with valid JSON matching this structure exactly:
{
  "overallScore": <number 1-10>,
  "headline": "<one compelling sentence summarizing performance>",
  "insights": [
    {
      "category": "<timing|revenue|efficiency|demand>",
      "title": "<short title, max 6 words>",
      "finding": "<what the data shows — cite the number>",
      "advice": "<specific action to take>",
      "impact": "<high|medium|low>",
      "dataPoint": "<the exact number this is based on>"
    }
  ],
  "quickWins": ["<actionable thing 1>", "<actionable thing 2>", "<actionable thing 3>"],
  "watchOut": "<one thing to monitor or be careful about>"
}

Provide 3-6 insights. Focus on timing bottlenecks, revenue opportunities, demand patterns, and operational efficiency.`
          },
          {
            role: 'user',
            content: `Analyze this food truck's operational data for the period "${period}":\n\n${JSON.stringify(dataSummary, null, 2)}`
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('[AI Coach] OpenRouter error:', errText);
      return json({ error: `AI analysis failed (${aiResponse.status})` }, 500);
    }

    const aiData = await aiResponse.json() as any;
    const content = aiData.choices?.[0]?.message?.content || '';

    let analysis;
    try {
      const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      analysis = JSON.parse(cleaned);
    } catch {
      return json({ error: 'AI returned invalid analysis format' }, 500);
    }

    // Add metadata
    analysis.dataDisclaimer = `Based on ${rows.length} orders over ${period}. ${totals.length > 0 ? `Timing data available for ${totals.length} orders.` : 'No timing data recorded yet — process orders through BOH to start tracking.'} Insights are derived from your actual operational data.`;
    analysis.analyzedAt = new Date().toISOString();
    analysis.orderCount = rows.length;
    analysis.period = period;

    return json({ analysis });
  } catch (err: any) {
    console.error('[AI Coach] Error:', err);
    return json({ error: err.message }, 500);
  }
};
