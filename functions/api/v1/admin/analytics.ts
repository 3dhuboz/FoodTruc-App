/**
 * GET /api/v1/admin/analytics
 * Returns order analytics for a tenant over a period.
 *
 * Query params:
 *   tenant_id — required
 *   period — 'today' | 'week' | 'month' | 'custom' (default: 'today')
 *   from — ISO date (for custom period)
 *   to — ISO date (for custom period)
 */
import { getDB } from '../_lib/db';
import { getTenantFromRequest } from '../_lib/tenant';

function diffMinutes(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  return (new Date(to).getTime() - new Date(from).getTime()) / 60000;
}

export const onRequest = async (context: any) => {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' },
    });
  }

  if (request.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const url = new URL(request.url);
    const { tenantId: resolvedTenant } = await getTenantFromRequest(request, env);
    const tenantId = url.searchParams.get('tenant_id') || resolvedTenant;
    const period = url.searchParams.get('period') || 'today';

    const db = getDB(env);

    // Calculate date range
    const now = new Date();
    let fromDate: string;
    let toDate = now.toISOString();

    if (period === 'custom') {
      fromDate = url.searchParams.get('from') || now.toISOString().split('T')[0];
      toDate = url.searchParams.get('to') || toDate;
    } else if (period === 'week') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      fromDate = d.toISOString();
    } else if (period === 'month') {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 1);
      fromDate = d.toISOString();
    } else {
      // today
      fromDate = now.toISOString().split('T')[0];
    }

    // Fetch all orders in the period
    const orders = await db.prepare(
      `SELECT * FROM orders WHERE tenant_id = ? AND created_at >= ? AND created_at <= ? ORDER BY created_at DESC`
    ).bind(tenantId, fromDate, toDate).all();

    const rows = (orders.results || []) as any[];

    // ─── Summary ─────────────────────────────────────────────
    const totalOrders = rows.length;
    const totalRevenue = rows.reduce((s, r) => s + (r.total || 0), 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const ordersCompleted = rows.filter(r => r.status === 'Completed' || r.status === 'Ready').length;
    const ordersCancelled = rows.filter(r => r.status === 'Cancelled' || r.status === 'Rejected').length;
    const ordersPending = rows.filter(r => r.status === 'Pending' || r.status === 'Awaiting Payment').length;

    // ─── Timing Metrics ──────────────────────────────────────
    const timings: { confirmToCook: number[]; cookToReady: number[]; readyToComplete: number[]; total: number[] } = {
      confirmToCook: [], cookToReady: [], readyToComplete: [], total: [],
    };

    for (const r of rows) {
      const c2k = diffMinutes(r.confirmed_at || r.created_at, r.cooking_at);
      const k2r = diffMinutes(r.cooking_at, r.ready_at);
      const r2c = diffMinutes(r.ready_at, r.completed_at);
      const tot = diffMinutes(r.created_at, r.completed_at || r.ready_at);

      if (c2k !== null && c2k > 0 && c2k < 480) timings.confirmToCook.push(c2k);
      if (k2r !== null && k2r > 0 && k2r < 480) timings.cookToReady.push(k2r);
      if (r2c !== null && r2c > 0 && r2c < 480) timings.readyToComplete.push(r2c);
      if (tot !== null && tot > 0 && tot < 480) timings.total.push(tot);
    }

    const avg = (arr: number[]) => arr.length > 0 ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10 : null;

    const timing = {
      avgConfirmToCook: avg(timings.confirmToCook),
      avgCookToReady: avg(timings.cookToReady),
      avgReadyToComplete: avg(timings.readyToComplete),
      avgTotalFulfillment: avg(timings.total),
      fastest: timings.total.length > 0 ? Math.round(Math.min(...timings.total) * 10) / 10 : null,
      slowest: timings.total.length > 0 ? Math.round(Math.max(...timings.total) * 10) / 10 : null,
      sampleSize: timings.total.length,
    };

    // ─── Hourly Breakdown ────────────────────────────────────
    const hourlyMap: Record<number, { orders: number; revenue: number }> = {};
    for (let h = 0; h < 24; h++) hourlyMap[h] = { orders: 0, revenue: 0 };
    for (const r of rows) {
      const h = new Date(r.created_at).getHours();
      hourlyMap[h].orders++;
      hourlyMap[h].revenue += r.total || 0;
    }
    const hourly = Object.entries(hourlyMap).map(([h, v]) => ({ hour: parseInt(h), ...v }));
    const peakHour = hourly.reduce((best, h) => h.orders > best.orders ? h : best, { hour: 0, orders: 0, revenue: 0 });

    // ─── By Source ───────────────────────────────────────────
    const bySource: Record<string, { count: number; revenue: number }> = {};
    for (const r of rows) {
      const src = r.source || 'walk_up';
      if (!bySource[src]) bySource[src] = { count: 0, revenue: 0 };
      bySource[src].count++;
      bySource[src].revenue += r.total || 0;
    }

    // ─── By Status ───────────────────────────────────────────
    const byStatus: Record<string, number> = {};
    for (const r of rows) {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    }

    // ─── Top Items ───────────────────────────────────────────
    const itemMap: Record<string, { quantity: number; revenue: number }> = {};
    for (const r of rows) {
      let items: any[] = [];
      try { items = typeof r.items === 'string' ? JSON.parse(r.items) : (r.items || []); } catch {}
      for (const entry of items) {
        const name = entry.item?.name || entry.name || 'Unknown';
        const price = entry.item?.price || entry.price || 0;
        const qty = entry.quantity || 1;
        if (!itemMap[name]) itemMap[name] = { quantity: 0, revenue: 0 };
        itemMap[name].quantity += qty;
        itemMap[name].revenue += price * qty;
      }
    }
    const topItems = Object.entries(itemMap)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    // ─── Raw orders for CSV ──────────────────────────────────
    const csvOrders = rows.map(r => ({
      id: r.id,
      date: r.created_at?.split('T')[0] || '',
      time: r.created_at?.split('T')[1]?.substring(0, 5) || '',
      customer: r.customer_name,
      phone: r.customer_phone || '',
      total: r.total,
      source: r.source || 'walk_up',
      status: r.status,
      collectionPin: r.collection_pin || '',
      confirmToCookMin: diffMinutes(r.confirmed_at || r.created_at, r.cooking_at),
      cookToReadyMin: diffMinutes(r.cooking_at, r.ready_at),
      readyToCompleteMin: diffMinutes(r.ready_at, r.completed_at),
      totalMin: diffMinutes(r.created_at, r.completed_at || r.ready_at),
    }));

    return Response.json({
      summary: {
        totalOrders, totalRevenue: Math.round(totalRevenue * 100) / 100,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
        ordersCompleted, ordersCancelled, ordersPending,
      },
      timing,
      hourly,
      peakHour,
      bySource,
      byStatus,
      topItems,
      orders: csvOrders,
      period, fromDate, toDate,
    }, { headers: { 'Access-Control-Allow-Origin': '*' } });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
};
