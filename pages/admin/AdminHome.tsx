import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Order } from '../../types';
import {
  ChefHat,
  Monitor,
  Smartphone,
  QrCode,
  ExternalLink,
  Download,
  UtensilsCrossed,
  Settings,
  CalendarDays,
  DollarSign,
  ShoppingCart,
  Clock,
  Flame,
  Package,
  CheckCircle,
  AlertCircle,
  WifiOff,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';

interface AdminHomeProps {
  onNavigate?: (tab: string) => void;
}

// ── Status badge colors ──
const STATUS_COLORS: Record<string, string> = {
  Pending:    'bg-purple-500/20 text-purple-300',
  Confirmed:  'bg-yellow-500/20 text-yellow-300',
  Cooking:    'bg-orange-500/20 text-orange-300',
  Ready:      'bg-green-500/20 text-green-300',
  Completed:  'bg-gray-600/30 text-gray-400',
  Cancelled:  'bg-red-500/20 text-red-400',
  Rejected:   'bg-red-500/20 text-red-400',
  'Awaiting Payment': 'bg-purple-500/20 text-purple-300',
  Paid:       'bg-blue-500/20 text-blue-300',
  Shipped:    'bg-blue-500/20 text-blue-300',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const AdminHome: React.FC<AdminHomeProps> = ({ onNavigate }) => {
  const { orders, menu, settings, calendarEvents, isOnline, pendingSyncCount } = useApp();

  // ── Today's data ──
  const TODAY = useMemo(() => new Date().toISOString().split('T')[0], []);

  const todayOrders = useMemo(
    () => orders.filter((o) => o.cookDay === TODAY || o.createdAt?.startsWith(TODAY)),
    [orders, TODAY],
  );

  const todayRevenue = useMemo(
    () =>
      todayOrders
        .filter((o) => !['Cancelled', 'Rejected', 'Pending'].includes(o.status))
        .reduce((sum, o) => sum + o.total, 0),
    [todayOrders],
  );

  const activeCount = useMemo(
    () => todayOrders.filter((o) => ['Confirmed', 'Cooking', 'Ready'].includes(o.status)).length,
    [todayOrders],
  );

  const completedCount = useMemo(
    () => todayOrders.filter((o) => o.status === 'Completed').length,
    [todayOrders],
  );

  // ── Setup checklist ──
  const checklistItems = useMemo(() => {
    const items = [
      {
        key: 'businessName',
        label: 'Set your business name',
        done: Boolean(settings.businessName),
        tab: 'settings',
      },
      {
        key: 'logo',
        label: 'Upload your logo',
        done: Boolean(settings.logoUrl),
        tab: 'settings',
      },
      {
        key: 'menu',
        label: 'Add menu items',
        done: menu.length > 0,
        tab: 'menu',
      },
      {
        key: 'payments',
        label: 'Connect payments',
        done: (settings as any).stripeConnected === true,
        tab: 'settings',
      },
      {
        key: 'cookDay',
        label: 'Schedule your first cook day',
        done: calendarEvents.length > 0,
        tab: 'planner',
      },
    ];
    return items;
  }, [settings, menu, calendarEvents]);

  const completedSteps = checklistItems.filter((i) => i.done).length;
  const allComplete = completedSteps === checklistItems.length;

  // ── QR code URL ──
  const qrOrderUrl = `${window.location.origin}${window.location.pathname}#/qr-order`;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrOrderUrl)}&bgcolor=000000&color=ffffff`;

  // ── Recent orders (last 5) ──
  const recentOrders = useMemo(
    () =>
      [...todayOrders]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5),
    [todayOrders],
  );

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div>
        <h2 className="text-2xl font-black text-white flex items-center gap-3">
          <ChefHat className="text-orange-400" size={28} />
          Dashboard
        </h2>
        <p className="text-gray-400 mt-1">
          {settings.businessName ? `Welcome back, ${settings.businessName}` : 'Your daily operations at a glance'}
        </p>
      </div>

      {/* ── Offline banner ── */}
      {!isOnline && (
        <div className="flex items-center gap-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 px-4 py-3">
          <WifiOff size={18} className="text-yellow-400 shrink-0" />
          <p className="text-yellow-300 text-sm">
            You are offline.{' '}
            {pendingSyncCount > 0 && (
              <span className="text-yellow-400 font-semibold">
                {pendingSyncCount} change{pendingSyncCount !== 1 ? 's' : ''} waiting to sync.
              </span>
            )}
          </p>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          Section 1 — Setup Checklist
         ═══════════════════════════════════════════════ */}
      {!allComplete && (
        <div className="rounded-2xl bg-gray-900 border border-gray-800 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-bold text-lg">Getting Started</h3>
            <span className="text-xs font-semibold text-gray-400">
              {completedSteps}/{checklistItems.length} complete
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-500"
              style={{ width: `${(completedSteps / checklistItems.length) * 100}%` }}
            />
          </div>

          {/* Items */}
          <ul className="space-y-2">
            {checklistItems.map((item) => (
              <li key={item.key}>
                <button
                  onClick={() => !item.done && onNavigate?.(item.tab)}
                  disabled={item.done}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                    item.done
                      ? 'text-gray-500 cursor-default'
                      : 'text-gray-300 hover:bg-white/5 hover:text-white cursor-pointer'
                  }`}
                >
                  {item.done ? (
                    <CheckCircle size={18} className="text-green-500 shrink-0" />
                  ) : (
                    <AlertCircle size={18} className="text-orange-400 shrink-0" />
                  )}
                  <span className={`text-sm font-medium ${item.done ? 'line-through' : ''}`}>
                    {item.label}
                  </span>
                  {!item.done && (
                    <ArrowRight size={14} className="ml-auto text-gray-600" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          Section 2 — Today's Snapshot
         ═══════════════════════════════════════════════ */}
      <div>
        <h3 className="text-white font-bold text-lg mb-3 flex items-center gap-2">
          <TrendingUp size={18} className="text-gray-400" />
          Today&rsquo;s Snapshot
        </h3>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Orders */}
          <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <ShoppingCart size={16} className="text-blue-400" />
              </div>
            </div>
            <p className="text-2xl font-black text-white">{todayOrders.length}</p>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">Orders</p>
          </div>

          {/* Revenue */}
          <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                <DollarSign size={16} className="text-green-400" />
              </div>
            </div>
            <p className="text-2xl font-black text-white">
              ${todayRevenue.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">Revenue</p>
          </div>

          {/* Active */}
          <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <Flame size={16} className="text-orange-400" />
              </div>
            </div>
            <p className="text-2xl font-black text-white">{activeCount}</p>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">Active</p>
          </div>

          {/* Completed */}
          <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-gray-600/20 flex items-center justify-center">
                <CheckCircle size={16} className="text-gray-400" />
              </div>
            </div>
            <p className="text-2xl font-black text-white">{completedCount}</p>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">Completed</p>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          Section 3 — Quick Actions
         ═══════════════════════════════════════════════ */}
      <div>
        <h3 className="text-white font-bold text-lg mb-3">Quick Actions</h3>

        <div className="grid grid-cols-2 gap-3">
          {/* FOH */}
          <a
            href="#/foh"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-gradient-to-br from-orange-600 to-orange-800 p-5 flex flex-col gap-3 hover:from-orange-500 hover:to-orange-700 transition group"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-black/20 flex items-center justify-center">
                <Smartphone size={22} className="text-white" />
              </div>
              <ExternalLink size={16} className="text-orange-300 group-hover:text-white transition" />
            </div>
            <div>
              <h4 className="text-white font-bold text-sm">Open Front of House</h4>
              <p className="text-orange-200 text-xs mt-0.5">Take walk-up orders</p>
            </div>
          </a>

          {/* BOH / Kitchen */}
          <a
            href="#/boh"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-gradient-to-br from-gray-700 to-gray-900 p-5 flex flex-col gap-3 hover:from-gray-600 hover:to-gray-800 transition group"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-black/20 flex items-center justify-center">
                <Monitor size={22} className="text-white" />
              </div>
              <ExternalLink size={16} className="text-gray-400 group-hover:text-white transition" />
            </div>
            <div>
              <h4 className="text-white font-bold text-sm">Open Kitchen</h4>
              <p className="text-gray-300 text-xs mt-0.5">Kitchen display queue</p>
            </div>
          </a>

          {/* QR Code */}
          <div className="rounded-xl bg-blue-600/20 border border-blue-500/20 p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <QrCode size={22} className="text-blue-300" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <img
                src={qrApiUrl}
                alt="QR code for customer ordering"
                width={64}
                height={64}
                className="rounded-lg"
                loading="lazy"
              />
              <div className="min-w-0">
                <h4 className="text-white font-bold text-sm">QR Code</h4>
                <p className="text-blue-300 text-xs mt-0.5">Customer ordering</p>
              </div>
            </div>
          </div>

          {/* Edit Menu */}
          <button
            onClick={() => onNavigate?.('menu')}
            className="rounded-xl bg-purple-600/20 border border-purple-500/20 p-5 flex flex-col gap-3 text-left hover:bg-purple-600/30 transition group"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <UtensilsCrossed size={22} className="text-purple-300" />
              </div>
              <ArrowRight size={16} className="text-purple-400 group-hover:text-white transition" />
            </div>
            <div>
              <h4 className="text-white font-bold text-sm">Edit Menu</h4>
              <p className="text-purple-300 text-xs mt-0.5">{menu.length} item{menu.length !== 1 ? 's' : ''}</p>
            </div>
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          Section 4 — Recent Orders
         ═══════════════════════════════════════════════ */}
      {todayOrders.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-bold text-lg flex items-center gap-2">
              <Clock size={18} className="text-gray-400" />
              Recent Orders
            </h3>
            <button
              onClick={() => onNavigate?.('orders')}
              className="text-xs text-orange-400 hover:text-orange-300 font-semibold flex items-center gap-1 transition"
            >
              View all <ArrowRight size={12} />
            </button>
          </div>

          <div className="rounded-2xl bg-gray-900 border border-gray-800 divide-y divide-gray-800/70 overflow-hidden">
            {recentOrders.map((order) => (
              <div
                key={order.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition"
              >
                {/* PIN or short ID */}
                <div className="w-12 h-12 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
                  <span className="text-white font-black text-sm">
                    {order.collectionPin || order.id.slice(-4).toUpperCase()}
                  </span>
                </div>

                {/* Customer + time */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {order.customerName || 'Walk-up'}
                  </p>
                  <p className="text-xs text-gray-500">{timeAgo(order.createdAt)}</p>
                </div>

                {/* Status badge */}
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide shrink-0 ${
                    STATUS_COLORS[order.status] || 'bg-gray-700 text-gray-300'
                  }`}
                >
                  {order.status}
                </span>

                {/* Total */}
                <span className="text-sm font-bold text-gray-300 w-16 text-right shrink-0">
                  ${order.total.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminHome;
