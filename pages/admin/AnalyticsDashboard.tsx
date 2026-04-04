import React, { useState, useEffect } from 'react';
import {
  BarChart3, Download, TrendingUp, Timer, Zap, Loader2,
  Sparkles, AlertTriangle, CheckCircle, Clock, DollarSign,
  Target, ShoppingBag, ArrowRight, Info, Star, XCircle
} from 'lucide-react';

interface Insight {
  category: string;
  title: string;
  finding: string;
  advice: string;
  impact: string;
  dataPoint: string;
}

interface CoachAnalysis {
  overallScore: number | null;
  headline: string;
  insights: Insight[];
  quickWins: string[];
  watchOut: string | null;
  dataDisclaimer: string;
  analyzedAt?: string;
  orderCount?: number;
  period?: string;
}

const categoryIcon = (cat: string) => {
  switch (cat) {
    case 'timing': return <Timer size={14} className="text-blue-400" />;
    case 'revenue': return <DollarSign size={14} className="text-green-400" />;
    case 'efficiency': return <Zap size={14} className="text-yellow-400" />;
    case 'demand': return <TrendingUp size={14} className="text-purple-400" />;
    default: return <Target size={14} className="text-gray-400" />;
  }
};

const impactBadge = (impact: string) => {
  const colors = {
    high: 'bg-red-500/10 text-red-400 border-red-500/20',
    medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    low: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  };
  return colors[impact as keyof typeof colors] || colors.low;
};

const scoreColor = (score: number | null) => {
  if (score === null) return 'text-gray-500';
  if (score >= 8) return 'text-green-400';
  if (score >= 6) return 'text-yellow-400';
  if (score >= 4) return 'text-orange-400';
  return 'text-red-400';
};

const timingColor = (mins: number | null) => {
  if (mins === null) return 'text-gray-500';
  if (mins < 10) return 'text-green-400';
  if (mins < 20) return 'text-yellow-400';
  if (mins < 30) return 'text-orange-400';
  return 'text-red-400';
};

const AnalyticsDashboard: React.FC = () => {
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // AI Coach state
  const [coachData, setCoachData] = useState<CoachAnalysis | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState('');

  const fetchAnalytics = async (p: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/analytics?period=${p}`);
      const d = await res.json();
      setData(d);
    } catch {}
    setLoading(false);
  };

  const runCoach = async () => {
    setCoachLoading(true);
    setCoachError('');
    try {
      const res = await fetch('/api/v1/admin/ai-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period }),
      });
      const d = await res.json();
      if (d.error) { setCoachError(d.error); }
      else { setCoachData(d.analysis); }
    } catch (e: any) {
      setCoachError(e.message || 'Failed to connect');
    }
    setCoachLoading(false);
  };

  useEffect(() => { fetchAnalytics(period); setCoachData(null); }, [period]);

  const downloadCSV = () => {
    if (!data?.orders?.length) return;
    const headers = ['Order ID', 'Date', 'Time', 'Customer', 'Phone', 'Total', 'Source', 'Status', 'PIN', 'Wait to Cook (min)', 'Cook Time (min)', 'Pickup Wait (min)', 'Total Time (min)'];
    const rows = data.orders.map((o: any) => [
      o.id, o.date, o.time, o.customer, o.phone, o.total, o.source, o.status, o.collectionPin,
      o.confirmToCookMin?.toFixed(1) || '', o.cookToReadyMin?.toFixed(1) || '',
      o.readyToCompleteMin?.toFixed(1) || '', o.totalMin?.toFixed(1) || '',
    ]);
    const csv = [headers.join(','), ...rows.map((r: any) => r.map((v: any) => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chownow-orders-${period}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold font-display flex items-center gap-2">
          <BarChart3 size={22} className="text-orange-400" /> Performance Analytics
        </h3>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {(['today', 'week', 'month'] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${period === p ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
              </button>
            ))}
          </div>
          <button onClick={downloadCSV} disabled={!data?.orders?.length}
            className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition">
            <Download size={12} /> CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-500"><Loader2 size={24} className="animate-spin mx-auto mb-3" /> Loading analytics...</div>
      ) : !data ? (
        <div className="text-center py-16 text-gray-600">No data available</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
              <div className="text-gray-500 text-[10px] uppercase tracking-widest mb-1">Orders</div>
              <div className="text-3xl font-black text-white">{data.summary.totalOrders}</div>
            </div>
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
              <div className="text-gray-500 text-[10px] uppercase tracking-widest mb-1">Revenue</div>
              <div className="text-3xl font-black text-green-400">${data.summary.totalRevenue?.toFixed(0)}</div>
            </div>
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
              <div className="text-gray-500 text-[10px] uppercase tracking-widest mb-1">Avg Order</div>
              <div className="text-3xl font-black text-orange-400">${data.summary.avgOrderValue?.toFixed(0)}</div>
            </div>
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
              <div className="text-gray-500 text-[10px] uppercase tracking-widest mb-1">Completed</div>
              <div className="text-3xl font-black text-blue-400">{data.summary.ordersCompleted}/{data.summary.totalOrders}</div>
            </div>
          </div>

          {/* Workflow Timing */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
            <h4 className="text-white font-bold mb-4 flex items-center gap-2"><Timer size={16} className="text-orange-400" /> Workflow Timing</h4>
            {data.timing.sampleSize > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                {[
                  { label: 'Wait to Start Cooking', value: data.timing.avgConfirmToCook, sub: 'Confirmed → Cooking' },
                  { label: 'Cook Time', value: data.timing.avgCookToReady, sub: 'Cooking → Ready' },
                  { label: 'Pickup Wait', value: data.timing.avgReadyToComplete, sub: 'Ready → Collected' },
                  { label: 'Total Fulfillment', value: data.timing.avgTotalFulfillment, sub: 'Order → Done' },
                  { label: 'Fastest Order', value: data.timing.fastest, sub: '' },
                  { label: 'Slowest Order', value: data.timing.slowest, sub: '' },
                ].map(m => (
                  <div key={m.label}>
                    <div className="text-gray-500 text-[10px] uppercase tracking-widest mb-1">{m.label}</div>
                    <div className={`text-2xl font-black ${m.label === 'Fastest Order' ? 'text-green-400' : m.label === 'Slowest Order' ? 'text-red-400' : timingColor(m.value)}`}>
                      {m.value !== null ? `${m.value} min` : '—'}
                    </div>
                    {m.sub && <div className="text-gray-600 text-[10px]">{m.sub}</div>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-sm">No timing data yet. Timestamps are recorded as orders move through statuses on the kitchen display.</p>
            )}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Hourly */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
              <h4 className="text-white font-bold text-sm mb-4 flex items-center gap-2"><TrendingUp size={14} className="text-blue-400" /> Orders by Hour</h4>
              <div className="flex items-end gap-0.5 h-28">
                {(data.hourly || []).filter((h: any) => h.hour >= 6 && h.hour <= 22).map((h: any) => {
                  const maxOrders = Math.max(...(data.hourly || []).map((x: any) => x.orders), 1);
                  const height = h.orders > 0 ? Math.max((h.orders / maxOrders) * 100, 4) : 0;
                  const isPeak = data.peakHour?.hour === h.hour && h.orders > 0;
                  return (
                    <div key={h.hour} className="flex-1 flex flex-col items-center justify-end gap-0.5" title={`${h.hour}:00 — ${h.orders} orders, $${h.revenue.toFixed(0)}`}>
                      {h.orders > 0 && <span className="text-[8px] text-gray-500">{h.orders}</span>}
                      <div className={`w-full rounded-t transition-all ${isPeak ? 'bg-orange-500' : h.orders > 0 ? 'bg-blue-500/60' : 'bg-gray-800/30'}`}
                        style={{ height: `${height}%` }} />
                      <span className="text-[8px] text-gray-600">{h.hour}</span>
                    </div>
                  );
                })}
              </div>
              {data.peakHour?.orders > 0 && (
                <p className="text-xs text-gray-500 mt-2">Peak: <span className="text-orange-400 font-bold">{data.peakHour.hour}:00</span> ({data.peakHour.orders} orders, ${data.peakHour.revenue?.toFixed(0)})</p>
              )}
            </div>

            {/* Source + Top Items */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
              <h4 className="text-white font-bold text-sm mb-3 flex items-center gap-2"><Zap size={14} className="text-yellow-400" /> Order Sources</h4>
              <div className="space-y-2 mb-4">
                {Object.entries(data.bySource || {}).map(([src, d]: [string, any]) => {
                  const pct = data.summary.totalOrders > 0 ? Math.round((d.count / data.summary.totalOrders) * 100) : 0;
                  return (
                    <div key={src}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-gray-400 text-sm capitalize">{src === 'qr' ? 'QR Order' : src === 'walk_up' ? 'Walk-up' : src}</span>
                        <span className="text-white text-sm font-bold">{d.count} · ${d.revenue.toFixed(0)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${src === 'qr' ? 'bg-blue-500' : 'bg-orange-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <h4 className="text-white font-bold text-sm mb-2 flex items-center gap-2"><ShoppingBag size={14} className="text-pink-400" /> Top Items</h4>
              <div className="space-y-1.5">
                {(data.topItems || []).slice(0, 5).map((item: any, i: number) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <span className="text-gray-400 truncate mr-2">{i + 1}. {item.name}</span>
                    <span className="text-white font-bold shrink-0">{item.quantity}x · ${item.revenue.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ─── AI PERFORMANCE COACH ─────────────────────────────── */}
          <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-xl overflow-hidden">
            <div className="p-5 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center">
                    <Sparkles size={20} className="text-orange-400" />
                  </div>
                  <div>
                    <h4 className="text-white font-bold">AI Performance Coach</h4>
                    <p className="text-gray-500 text-xs">Evidence-based analysis of your operations</p>
                  </div>
                </div>
                <button onClick={runCoach} disabled={coachLoading || data.summary.totalOrders === 0}
                  className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white font-bold px-4 py-2 rounded-lg text-sm transition">
                  {coachLoading ? <><Loader2 size={14} className="animate-spin" /> Studying your data...</> : <><Sparkles size={14} /> Analyze My Operations</>}
                </button>
              </div>
            </div>

            {coachError && (
              <div className="p-4 bg-red-950/20 border-b border-red-800/30 text-red-400 text-sm flex items-center gap-2">
                <XCircle size={14} /> {coachError}
              </div>
            )}

            {coachData && (
              <div className="p-5 space-y-5">
                {/* Score + Headline */}
                <div className="flex items-start gap-4">
                  {coachData.overallScore !== null && (
                    <div className="text-center shrink-0">
                      <div className={`text-4xl font-black ${scoreColor(coachData.overallScore)}`}>{coachData.overallScore}</div>
                      <div className="text-gray-600 text-[10px] uppercase tracking-widest">/10</div>
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-white font-bold text-lg">{coachData.headline}</p>
                    <p className="text-gray-500 text-xs mt-1 flex items-center gap-1">
                      <Info size={10} /> {coachData.dataDisclaimer}
                    </p>
                  </div>
                </div>

                {/* Insights */}
                <div className="space-y-3">
                  {(coachData.insights || []).map((insight, i) => (
                    <div key={i} className="bg-black/30 border border-gray-800 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        {categoryIcon(insight.category)}
                        <span className="text-white font-bold text-sm">{insight.title}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-bold uppercase ${impactBadge(insight.impact)}`}>
                          {insight.impact}
                        </span>
                      </div>
                      <p className="text-gray-300 text-sm mb-2">{insight.finding}</p>
                      <div className="flex items-start gap-2 bg-gray-900/50 rounded p-2.5">
                        <ArrowRight size={12} className="text-orange-400 shrink-0 mt-0.5" />
                        <p className="text-orange-300 text-sm">{insight.advice}</p>
                      </div>
                      <p className="text-gray-600 text-[10px] mt-2 font-mono">Data: {insight.dataPoint}</p>
                    </div>
                  ))}
                </div>

                {/* Quick Wins */}
                {coachData.quickWins?.length > 0 && (
                  <div className="bg-green-950/20 border border-green-800/30 rounded-lg p-4">
                    <h5 className="text-green-400 font-bold text-sm mb-2 flex items-center gap-2"><CheckCircle size={14} /> Quick Wins</h5>
                    <ul className="space-y-1.5">
                      {coachData.quickWins.map((win, i) => (
                        <li key={i} className="text-green-300 text-sm flex items-start gap-2">
                          <span className="text-green-500 shrink-0">-</span> {win}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Watch Out */}
                {coachData.watchOut && (
                  <div className="bg-yellow-950/20 border border-yellow-800/30 rounded-lg p-4">
                    <h5 className="text-yellow-400 font-bold text-sm mb-1 flex items-center gap-2"><AlertTriangle size={14} /> Watch Out</h5>
                    <p className="text-yellow-300 text-sm">{coachData.watchOut}</p>
                  </div>
                )}

                {/* Timestamp */}
                {coachData.analyzedAt && (
                  <p className="text-gray-700 text-[10px] text-right">
                    Analyzed {new Date(coachData.analyzedAt).toLocaleString()} · {coachData.orderCount} orders · {coachData.period}
                  </p>
                )}
              </div>
            )}

            {!coachData && !coachLoading && !coachError && (
              <div className="p-6 text-center text-gray-600 text-sm">
                Click "Analyze My Operations" to get AI-powered insights based on your actual order data. No generic advice — every recommendation is backed by your numbers.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AnalyticsDashboard;
