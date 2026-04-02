import React, { useState, useEffect } from 'react';
import {
  Users, ShoppingCart, Cpu, Printer, Wifi, WifiOff, RefreshCw,
  ExternalLink, ChefHat, BarChart3, Clock, Package, CreditCard,
  Search, Filter, ArrowRight, CheckCircle, XCircle, AlertTriangle
} from 'lucide-react';

interface Tenant {
  id: string; name: string; slug: string; subdomain: string;
  plan: string; status: string; billing_status: string;
  stripe_customer_id: string; stripe_subscription_id: string;
  owner_email: string; owner_phone: string;
  logo_url: string; primary_color: string;
  created_at: string; total_orders: number; orders_today: number;
  menu_count: number; user_count: number;
  device_id: string; device_online: number; device_heartbeat: string; device_printer: number;
}

interface ChowBoxDevice {
  id: string; tenant_id: string; tenant_name: string; tenant_slug: string;
  hostname: string; tunnel_url: string; ip_address: string;
  printer_connected: number; is_currently_online: number;
  orders_today: number; sync_pending: number; uptime_seconds: number;
  memory_mb: number; node_version: string; last_heartbeat: string;
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

const SuperAdmin: React.FC = () => {
  const [tab, setTab] = useState<'tenants' | 'fleet' | 'overview'>('overview');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [devices, setDevices] = useState<ChowBoxDevice[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

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

            {/* Recent tenants */}
            <h3 className="text-white font-bold text-lg mb-3">Recent Signups</h3>
            <div className="space-y-2">
              {tenants.slice(0, 5).map(t => (
                <div key={t.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
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
                <div key={t.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition">
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
                    <a href={`https://${t.slug}.chownow.au`} target="_blank" className="text-orange-400 hover:text-orange-300 text-sm flex items-center gap-1">
                      Visit <ExternalLink size={12} />
                    </a>
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
    </div>
  );
};

export default SuperAdmin;
