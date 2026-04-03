import React, { useState, useEffect, useRef } from 'react';
import {
  Users, ShoppingCart, Cpu, Printer, Wifi, WifiOff, RefreshCw,
  ExternalLink, ChefHat, BarChart3, Clock, Package, CreditCard,
  Search, Filter, ArrowRight, CheckCircle, XCircle, AlertTriangle,
  X, Save, Eye, Edit2, Copy, ChevronLeft, ChevronRight
} from 'lucide-react';

interface Tenant {
  id: string; name: string; slug: string; subdomain: string;
  plan: string; status: string; billing_status: string;
  stripe_customer_id: string; stripe_subscription_id: string;
  owner_email: string; owner_phone: string;
  logo_url: string; primary_color: string;
  business_address: string; phone: string; email: string; timezone: string;
  created_at: string; total_orders: number; orders_today: number;
  menu_count: number; user_count: number;
  device_id: string; device_online: number; device_heartbeat: string; device_printer: number;
  device_tunnel_url?: string;
}

interface ChowBoxDevice {
  id: string; tenant_id: string; tenant_name: string; tenant_slug: string;
  hostname: string; tunnel_url: string; ip_address: string;
  printer_connected: number; is_currently_online: number;
  orders_today: number; sync_pending: number; uptime_seconds: number;
  memory_mb: number; node_version: string; last_heartbeat: string;
}

interface Order {
  id: string; customerName: string; customerEmail: string; customerPhone: string;
  items: any[]; total: number; status: string; cookDay: string; type: string;
  pickupTime: string; createdAt: string; collectionPin: string; source: string;
}

function timeAgo(d: string): string {
  if (!d) return 'Never';
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

const StatusDot: React.FC<{ online: boolean }> = ({ online }) => (
  <span className={`inline-block w-2.5 h-2.5 rounded-full ${online ? 'bg-green-400' : 'bg-red-400'}`} />
);

const statusColors: Record<string, string> = {
  Pending: 'bg-yellow-500/10 text-yellow-400',
  Confirmed: 'bg-blue-500/10 text-blue-400',
  Cooking: 'bg-orange-500/10 text-orange-400',
  Ready: 'bg-green-500/10 text-green-400',
  Collected: 'bg-gray-500/10 text-gray-400',
  Cancelled: 'bg-red-500/10 text-red-400',
};

// ─── Tenant Detail Drawer ────────────────────────────────────
const TenantDrawer: React.FC<{
  tenant: Tenant;
  onClose: () => void;
  onSaved: () => void;
}> = ({ tenant, onClose, onSaved }) => {
  const [detailTab, setDetailTab] = useState<'info' | 'orders'>('info');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: tenant.name,
    plan: tenant.plan,
    status: tenant.status,
    billing_status: tenant.billing_status || 'active',
    owner_email: tenant.owner_email || '',
    owner_phone: tenant.owner_phone || '',
    primary_color: tenant.primary_color || '#dc2626',
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersOffset, setOrdersOffset] = useState(0);
  const [ordersStatus, setOrdersStatus] = useState('');
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const fetchOrders = async (offset = 0, status = ordersStatus) => {
    setOrdersLoading(true);
    try {
      const params = new URLSearchParams({ tenant_id: tenant.id, limit: '25', offset: String(offset) });
      if (status) params.set('status', status);
      const res = await fetch(`/api/v1/admin/orders?${params}`);
      const data = await res.json();
      setOrders(data.orders || []);
      setOrdersTotal(data.total || 0);
      setOrdersOffset(offset);
    } catch {}
    setOrdersLoading(false);
  };

  useEffect(() => {
    if (detailTab === 'orders') fetchOrders(0);
  }, [detailTab]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch(`/api/v1/admin/tenants/${tenant.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSaveMsg('Saved');
        setEditing(false);
        onSaved();
        setTimeout(() => setSaveMsg(''), 2000);
      } else {
        const err = await res.json();
        setSaveMsg(err.error || 'Save failed');
      }
    } catch {
      setSaveMsg('Network error');
    }
    setSaving(false);
  };

  const copySlug = () => {
    navigator.clipboard.writeText(`${tenant.slug}.chownow.au`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div ref={overlayRef} className="absolute inset-0 bg-black/60" onClick={onClose} />
      {/* Drawer */}
      <div className="relative w-full max-w-xl bg-gray-950 border-l border-gray-800 overflow-y-auto animate-slide-in">
        {/* Header */}
        <div className="sticky top-0 bg-gray-950 border-b border-gray-800 px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={onClose} className="text-gray-400 hover:text-white p-1"><X size={18} /></button>
              <div className="min-w-0">
                <h2 className="text-white font-bold text-lg truncate">{tenant.name}</h2>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">{tenant.slug}.chownow.au</span>
                  <button onClick={copySlug} className="text-gray-600 hover:text-orange-400" title="Copy">
                    {copied ? <CheckCircle size={12} className="text-green-400" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${tenant.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                {tenant.status}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 font-bold">{tenant.plan}</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 mt-3">
            <a href={`https://${tenant.slug}.chownow.au`} target="_blank"
              className="flex items-center gap-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition">
              <Eye size={12} /> Visit Site
            </a>
            {tenant.device_id && tenant.device_tunnel_url && (
              <a href={`${tenant.device_tunnel_url}/admin`} target="_blank"
                className="flex items-center gap-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition">
                <Cpu size={12} /> ChowBox Admin
              </a>
            )}
          </div>

          {/* Detail Tabs */}
          <div className="flex gap-2 mt-3">
            {([
              { id: 'info' as const, label: 'Info & Edit', icon: Edit2 },
              { id: 'orders' as const, label: `Orders (${tenant.total_orders})`, icon: ShoppingCart },
            ]).map(t => (
              <button key={t.id} onClick={() => setDetailTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  detailTab === t.id ? 'bg-orange-500 text-white' : 'bg-gray-900 text-gray-400 hover:text-white'
                }`}>
                <t.icon size={12} /> {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* ── Info Tab ── */}
          {detailTab === 'info' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold text-sm">Tenant Details</h3>
                <div className="flex items-center gap-2">
                  {saveMsg && (
                    <span className={`text-xs font-bold ${saveMsg === 'Saved' ? 'text-green-400' : 'text-red-400'}`}>{saveMsg}</span>
                  )}
                  {editing ? (
                    <div className="flex gap-2">
                      <button onClick={() => setEditing(false)} className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg">Cancel</button>
                      <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-1 text-xs bg-orange-500 hover:bg-orange-400 text-white px-3 py-1.5 rounded-lg disabled:opacity-50">
                        <Save size={12} /> {saving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setEditing(true)}
                      className="flex items-center gap-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg">
                      <Edit2 size={12} /> Edit
                    </button>
                  )}
                </div>
              </div>

              {/* Metrics Row */}
              <div className="grid grid-cols-4 gap-3 mb-5">
                {[
                  { label: 'Orders', value: tenant.total_orders, color: 'text-white' },
                  { label: 'Today', value: tenant.orders_today, color: 'text-orange-400' },
                  { label: 'Menu', value: tenant.menu_count, color: 'text-white' },
                  { label: 'Users', value: tenant.user_count, color: 'text-white' },
                ].map(m => (
                  <div key={m.label} className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-center">
                    <div className="text-gray-500 text-[10px] uppercase tracking-widest">{m.label}</div>
                    <div className={`text-xl font-black ${m.color}`}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Fields */}
              <div className="space-y-3">
                <Field label="Name" value={form.name} editing={editing}
                  onChange={v => setForm(f => ({ ...f, name: v }))} />
                <SelectField label="Plan" value={form.plan} editing={editing}
                  options={[{ v: 'starter', l: 'Starter ($99/mo)' }, { v: 'pro', l: 'Pro ($149/mo)' }]}
                  onChange={v => setForm(f => ({ ...f, plan: v }))} />
                <SelectField label="Status" value={form.status} editing={editing}
                  options={[{ v: 'active', l: 'Active' }, { v: 'suspended', l: 'Suspended' }, { v: 'cancelled', l: 'Cancelled' }]}
                  onChange={v => setForm(f => ({ ...f, status: v }))} />
                <SelectField label="Billing" value={form.billing_status} editing={editing}
                  options={[{ v: 'active', l: 'Active' }, { v: 'past_due', l: 'Past Due' }, { v: 'unpaid', l: 'Unpaid' }, { v: 'cancelled', l: 'Cancelled' }]}
                  onChange={v => setForm(f => ({ ...f, billing_status: v }))} />
                <Field label="Owner Email" value={form.owner_email} editing={editing}
                  onChange={v => setForm(f => ({ ...f, owner_email: v }))} />
                <Field label="Owner Phone" value={form.owner_phone} editing={editing}
                  onChange={v => setForm(f => ({ ...f, owner_phone: v }))} />
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 text-xs w-24 shrink-0">Brand Color</span>
                  {editing ? (
                    <div className="flex items-center gap-2">
                      <input type="color" value={form.primary_color}
                        onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
                        className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
                      <span className="text-white text-sm font-mono">{form.primary_color}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded" style={{ background: form.primary_color }} />
                      <span className="text-white text-sm font-mono">{form.primary_color}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Billing Info */}
              {tenant.stripe_customer_id && (
                <div className="mt-5 bg-gray-900 border border-gray-800 rounded-lg p-4">
                  <h4 className="text-gray-400 text-xs uppercase tracking-widest mb-2 flex items-center gap-1"><CreditCard size={12} /> Stripe</h4>
                  <div className="space-y-1 text-sm">
                    <div><span className="text-gray-500">Customer:</span> <span className="text-white font-mono text-xs">{tenant.stripe_customer_id}</span></div>
                    {tenant.stripe_subscription_id && (
                      <div><span className="text-gray-500">Subscription:</span> <span className="text-white font-mono text-xs">{tenant.stripe_subscription_id}</span></div>
                    )}
                  </div>
                </div>
              )}

              {/* ChowBox Info */}
              <div className="mt-4 bg-gray-900 border border-gray-800 rounded-lg p-4">
                <h4 className="text-gray-400 text-xs uppercase tracking-widest mb-2 flex items-center gap-1"><Cpu size={12} /> ChowBox</h4>
                {tenant.device_id ? (
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <StatusDot online={!!tenant.device_online} />
                      <span className={tenant.device_online ? 'text-green-400' : 'text-red-400'}>
                        {tenant.device_online ? 'Online' : 'Offline'}
                      </span>
                      <span className="text-gray-600 text-xs">({timeAgo(tenant.device_heartbeat)})</span>
                    </div>
                    <div><span className="text-gray-500">Printer:</span> <span className={tenant.device_printer ? 'text-green-400' : 'text-red-400'}>{tenant.device_printer ? 'Connected' : 'Not connected'}</span></div>
                  </div>
                ) : (
                  <p className="text-gray-600 text-sm">No ChowBox deployed</p>
                )}
              </div>

              {/* Meta */}
              <div className="mt-4 text-xs text-gray-600">
                <div>ID: <span className="font-mono">{tenant.id}</span></div>
                <div>Created: {new Date(tenant.created_at).toLocaleDateString()}</div>
              </div>
            </div>
          )}

          {/* ── Orders Tab ── */}
          {detailTab === 'orders' && (
            <div>
              {/* Filters */}
              <div className="flex items-center gap-2 mb-4">
                <select value={ordersStatus} onChange={e => { setOrdersStatus(e.target.value); fetchOrders(0, e.target.value); }}
                  className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-sm text-white focus:border-orange-500 focus:outline-none">
                  <option value="">All statuses</option>
                  {['Pending', 'Confirmed', 'Cooking', 'Ready', 'Collected', 'Cancelled'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <span className="text-gray-500 text-xs ml-auto">{ordersTotal} total</span>
              </div>

              {ordersLoading ? (
                <div className="text-gray-500 text-sm text-center py-8">Loading orders...</div>
              ) : orders.length === 0 ? (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
                  <ShoppingCart size={32} className="text-gray-700 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No orders found</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {orders.map(o => (
                      <div key={o.id} className="bg-gray-900 border border-gray-800 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${statusColors[o.status] || 'bg-gray-500/10 text-gray-400'}`}>
                              {o.status}
                            </span>
                            {o.collectionPin && (
                              <span className="text-orange-400 font-mono font-bold text-xs">{o.collectionPin}</span>
                            )}
                          </div>
                          <span className="text-gray-500 text-xs">{timeAgo(o.createdAt)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <span className="text-white text-sm font-bold">{o.customerName}</span>
                            <span className="text-gray-600 text-xs ml-2">{o.type}</span>
                          </div>
                          <span className="text-white font-bold text-sm">${o.total.toFixed(2)}</span>
                        </div>
                        <div className="text-gray-500 text-xs mt-1">
                          {(o.items || []).length} item{(o.items || []).length !== 1 ? 's' : ''} · {o.source || 'walk_up'}
                          {o.customerPhone && <span> · {o.customerPhone}</span>}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {ordersTotal > 25 && (
                    <div className="flex items-center justify-between mt-4">
                      <button onClick={() => fetchOrders(Math.max(0, ordersOffset - 25))} disabled={ordersOffset === 0}
                        className="flex items-center gap-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg disabled:opacity-30">
                        <ChevronLeft size={12} /> Prev
                      </button>
                      <span className="text-gray-500 text-xs">
                        {ordersOffset + 1}–{Math.min(ordersOffset + 25, ordersTotal)} of {ordersTotal}
                      </span>
                      <button onClick={() => fetchOrders(ordersOffset + 25)} disabled={ordersOffset + 25 >= ordersTotal}
                        className="flex items-center gap-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg disabled:opacity-30">
                        Next <ChevronRight size={12} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-slide-in { animation: slide-in 0.2s ease-out; }
      `}</style>
    </div>
  );
};

// ─── Form field helpers ──────────────────────────────────────
const Field: React.FC<{ label: string; value: string; editing: boolean; onChange: (v: string) => void }> = ({ label, value, editing, onChange }) => (
  <div className="flex items-center gap-3">
    <span className="text-gray-500 text-xs w-24 shrink-0">{label}</span>
    {editing ? (
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-orange-500 focus:outline-none" />
    ) : (
      <span className="text-white text-sm">{value || '—'}</span>
    )}
  </div>
);

const SelectField: React.FC<{
  label: string; value: string; editing: boolean;
  options: { v: string; l: string }[];
  onChange: (v: string) => void;
}> = ({ label, value, editing, options, onChange }) => (
  <div className="flex items-center gap-3">
    <span className="text-gray-500 text-xs w-24 shrink-0">{label}</span>
    {editing ? (
      <select value={value} onChange={e => onChange(e.target.value)}
        className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-orange-500 focus:outline-none">
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    ) : (
      <span className="text-white text-sm capitalize">{value || '—'}</span>
    )}
  </div>
);

// ─── Main Super Admin ────────────────────────────────────────
const SuperAdmin: React.FC = () => {
  const [tab, setTab] = useState<'tenants' | 'fleet' | 'overview'>('overview');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [devices, setDevices] = useState<ChowBoxDevice[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  const fetchData = async () => {
    try {
      const [tRes, dRes] = await Promise.all([
        fetch('/api/v1/admin/tenants'),
        fetch('/api/v1/admin/fleet'),
      ]);
      const tData = await tRes.json();
      const dData = await dRes.json();
      setTenants(tData.tenants || []);
      setDevices(dData.devices || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchData(); const t = setInterval(fetchData, 15000); return () => clearInterval(t); }, []);

  const filtered = tenants.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.slug.toLowerCase().includes(search.toLowerCase())
  );

  const totalOrders = tenants.reduce((s, t) => s + (t.total_orders || 0), 0);
  const ordersToday = tenants.reduce((s, t) => s + (t.orders_today || 0), 0);
  const onlineDevices = devices.filter(d => d.is_currently_online).length;
  const activeTenants = tenants.filter(t => t.status === 'active').length;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/logo-horizontal.png" alt="ChowNow" className="h-8" />
            <span className="text-gray-600">|</span>
            <span className="text-orange-400 font-bold text-sm">Super Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchData} className="bg-gray-800 hover:bg-gray-700 p-2 rounded-lg transition"><RefreshCw size={14} /></button>
            <a href="/" className="text-gray-400 hover:text-white text-sm">Back to site</a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { id: 'overview' as const, label: 'Overview', icon: BarChart3 },
            { id: 'tenants' as const, label: 'Tenants', icon: Users },
            { id: 'fleet' as const, label: 'Fleet', icon: Cpu },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${tab === t.id ? 'bg-orange-500 text-white' : 'bg-gray-900 text-gray-400 hover:text-white'}`}>
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {tab === 'overview' && (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="text-gray-500 text-xs uppercase tracking-widest mb-1">Active Tenants</div>
                <div className="text-3xl font-black text-white">{activeTenants}</div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="text-gray-500 text-xs uppercase tracking-widest mb-1">Total Orders</div>
                <div className="text-3xl font-black text-orange-400">{totalOrders.toLocaleString()}</div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="text-gray-500 text-xs uppercase tracking-widest mb-1">Orders Today</div>
                <div className="text-3xl font-black text-green-400">{ordersToday}</div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="text-gray-500 text-xs uppercase tracking-widest mb-1">ChowBoxes Online</div>
                <div className="text-3xl font-black text-blue-400">{onlineDevices}/{devices.length}</div>
              </div>
            </div>

            {/* Recent tenants — clickable */}
            <h3 className="text-white font-bold text-lg mb-3">Recent Signups</h3>
            <div className="space-y-2">
              {tenants.slice(0, 5).map(t => (
                <div key={t.id} onClick={() => setSelectedTenant(t)}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:border-gray-700 transition">
                  <div className="flex items-center gap-3">
                    <StatusDot online={t.status === 'active'} />
                    <div>
                      <span className="text-white font-bold">{t.name}</span>
                      <span className="text-gray-500 text-sm ml-2">{t.slug}.chownow.au</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-400">{t.plan}</span>
                    <span className="text-orange-400 font-bold">{t.total_orders} orders</span>
                    <span className="text-gray-500">{timeAgo(t.created_at)}</span>
                    <ArrowRight size={14} className="text-gray-600" />
                  </div>
                </div>
              ))}
              {tenants.length === 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500">
                  No tenants yet. Signups from the landing page will appear here.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tenants Tab */}
        {tab === 'tenants' && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search tenants..." className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-600 focus:border-orange-500 focus:outline-none" />
              </div>
            </div>
            <div className="space-y-3">
              {filtered.map(t => (
                <div key={t.id} onClick={() => setSelectedTenant(t)}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition cursor-pointer">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-bold text-lg">{t.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${t.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                          {t.status}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 font-bold">{t.plan}</span>
                      </div>
                      <p className="text-gray-500 text-sm mt-0.5">{t.slug}.chownow.au</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <a href={`https://${t.slug}.chownow.au`} target="_blank" onClick={e => e.stopPropagation()}
                        className="text-orange-400 hover:text-orange-300 text-sm flex items-center gap-1">
                        Visit <ExternalLink size={12} />
                      </a>
                      <ArrowRight size={14} className="text-gray-600 ml-1" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                    <div><span className="text-gray-500">Orders:</span> <span className="text-white font-bold">{t.total_orders}</span></div>
                    <div><span className="text-gray-500">Today:</span> <span className="text-orange-400 font-bold">{t.orders_today}</span></div>
                    <div><span className="text-gray-500">Menu:</span> <span className="text-white">{t.menu_count} items</span></div>
                    <div><span className="text-gray-500">Email:</span> <span className="text-white">{t.owner_email || '—'}</span></div>
                    <div>
                      <span className="text-gray-500">ChowBox:</span>{' '}
                      {t.device_id ? (
                        <span className={`font-bold ${t.device_online ? 'text-green-400' : 'text-red-400'}`}>
                          {t.device_online ? 'Online' : 'Offline'}
                        </span>
                      ) : (
                        <span className="text-gray-600">Not deployed</span>
                      )}
                    </div>
                  </div>

                  {t.billing_status && t.billing_status !== 'active' && (
                    <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 flex items-center gap-2 text-red-400 text-xs font-bold">
                      <AlertTriangle size={12} /> Billing: {t.billing_status}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fleet Tab */}
        {tab === 'fleet' && (
          <div>
            {devices.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
                <Cpu size={48} className="text-gray-700 mx-auto mb-4" />
                <h3 className="text-white font-bold text-lg mb-2">No ChowBoxes connected</h3>
                <p className="text-gray-500 text-sm">Deployed ChowBoxes will appear here when they phone home.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {devices.map(d => {
                  const online = !!d.is_currently_online;
                  return (
                    <div key={d.id} className={`bg-gray-900 border rounded-xl overflow-hidden ${online ? 'border-gray-800' : 'border-red-500/20 opacity-75'}`}>
                      <div className={`px-4 py-2 flex items-center justify-between ${online ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                        <div className="flex items-center gap-2">
                          {online ? <Wifi size={12} className="text-green-400" /> : <WifiOff size={12} className="text-red-400" />}
                          <span className={`text-xs font-bold ${online ? 'text-green-400' : 'text-red-400'}`}>{online ? 'Online' : 'Offline'}</span>
                        </div>
                        <span className="text-gray-500 text-xs">{timeAgo(d.last_heartbeat)}</span>
                      </div>
                      <div className="p-4">
                        <h3 className="text-white font-bold">{d.tenant_name || d.hostname}</h3>
                        <p className="text-gray-500 text-xs mb-3">{d.tenant_slug}.chownow.au</p>
                        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                          <div><span className="text-gray-500">Orders:</span> <span className="text-white font-bold">{d.orders_today}</span></div>
                          <div><span className="text-gray-500">Printer:</span> <span className={d.printer_connected ? 'text-green-400' : 'text-red-400'}>{d.printer_connected ? 'Yes' : 'No'}</span></div>
                          <div><span className="text-gray-500">Sync:</span> <span className={d.sync_pending > 0 ? 'text-yellow-400' : 'text-green-400'}>{d.sync_pending || 'OK'}</span></div>
                          <div><span className="text-gray-500">Mem:</span> <span className="text-white">{d.memory_mb}MB</span></div>
                        </div>
                        {d.tunnel_url && (
                          <a href={`${d.tunnel_url}/admin`} target="_blank" className="block bg-orange-500 hover:bg-orange-400 text-white text-xs font-bold py-2 rounded-lg text-center transition">
                            Connect <ExternalLink size={10} className="inline ml-1" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tenant Detail Drawer */}
      {selectedTenant && (
        <TenantDrawer
          tenant={selectedTenant}
          onClose={() => setSelectedTenant(null)}
          onSaved={fetchData}
        />
      )}
    </div>
  );
};

export default SuperAdmin;
