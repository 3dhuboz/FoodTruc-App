import React, { useState, useEffect } from 'react';
import { Cpu, Wifi, WifiOff, Printer, ExternalLink, RefreshCw, Clock, ShoppingCart, CloudOff, Activity } from 'lucide-react';

interface ChowBoxDevice {
  id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  hostname: string;
  tunnel_url: string;
  ip_address: string;
  printer_connected: number;
  is_online: number;
  is_currently_online: number;
  orders_today: number;
  sync_pending: number;
  uptime_seconds: number;
  memory_mb: number;
  node_version: string;
  last_heartbeat: string;
  created_at: string;
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return 'Never';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatUptime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const FleetPanel: React.FC = () => {
  const [devices, setDevices] = useState<ChowBoxDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchDevices = async () => {
    try {
      const res = await fetch('/api/v1/admin/fleet');
      const data = await res.json();
      setDevices(data.devices || []);
      setLastRefresh(new Date());
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchDevices();
    const timer = setInterval(fetchDevices, 10000); // Refresh every 10s
    return () => clearInterval(timer);
  }, []);

  const onlineCount = devices.filter(d => d.is_currently_online).length;
  const totalCount = devices.length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Cpu size={24} className="text-orange-400" /> ChowBox Fleet
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            {onlineCount}/{totalCount} online &middot; Last refresh: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button onClick={fetchDevices} className="bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-lg transition">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Empty state */}
      {!loading && devices.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
          <Cpu size={48} className="text-gray-700 mx-auto mb-4" />
          <h3 className="text-white font-bold text-lg mb-2">No ChowBoxes connected</h3>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            When you deploy a ChowBox to a customer, it will appear here automatically once it phones home.
            Heartbeats are sent every 30 seconds.
          </p>
        </div>
      )}

      {/* Device grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {devices.map(device => {
          const online = !!device.is_currently_online;
          return (
            <div key={device.id} className={`bg-gray-900 border rounded-2xl overflow-hidden transition-all ${online ? 'border-gray-800 hover:border-green-500/30' : 'border-red-500/20 opacity-75'}`}>
              {/* Status bar */}
              <div className={`px-4 py-2 flex items-center justify-between ${online ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                <div className="flex items-center gap-2">
                  {online ? <Wifi size={14} className="text-green-400" /> : <WifiOff size={14} className="text-red-400" />}
                  <span className={`text-xs font-bold uppercase tracking-widest ${online ? 'text-green-400' : 'text-red-400'}`}>
                    {online ? 'Online' : 'Offline'}
                  </span>
                </div>
                <span className="text-gray-500 text-xs">{timeAgo(device.last_heartbeat)}</span>
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="text-white font-bold text-lg mb-0.5">{device.tenant_name || device.hostname || device.id}</h3>
                <p className="text-gray-500 text-xs mb-4">{device.tenant_slug ? `${device.tenant_slug}.chownow.au` : device.id}</p>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                  <div className="flex items-center gap-2">
                    <ShoppingCart size={12} className="text-orange-400" />
                    <span className="text-gray-400">Orders today:</span>
                    <span className="text-white font-bold">{device.orders_today}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Printer size={12} className={device.printer_connected ? 'text-green-400' : 'text-red-400'} />
                    <span className="text-gray-400">Printer:</span>
                    <span className={`font-bold ${device.printer_connected ? 'text-green-400' : 'text-red-400'}`}>
                      {device.printer_connected ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={12} className="text-gray-400" />
                    <span className="text-gray-400">Uptime:</span>
                    <span className="text-white font-bold">{formatUptime(device.uptime_seconds)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CloudOff size={12} className={device.sync_pending > 0 ? 'text-yellow-400' : 'text-gray-600'} />
                    <span className="text-gray-400">Sync:</span>
                    <span className={`font-bold ${device.sync_pending > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                      {device.sync_pending > 0 ? `${device.sync_pending} pending` : 'OK'}
                    </span>
                  </div>
                </div>

                {/* Details */}
                <div className="text-xs text-gray-600 space-y-1 mb-4">
                  <div>IP: {device.ip_address || 'Unknown'} &middot; Mem: {device.memory_mb}MB &middot; {device.node_version}</div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {device.tunnel_url && (
                    <a
                      href={`${device.tunnel_url}/admin`}
                      target="_blank"
                      rel="noopener"
                      className="flex-1 bg-orange-500 hover:bg-orange-400 text-white text-sm font-bold py-2 rounded-lg transition text-center flex items-center justify-center gap-1.5"
                    >
                      <ExternalLink size={14} /> Connect
                    </a>
                  )}
                  {device.ip_address && (
                    <a
                      href={`http://${device.ip_address}/admin`}
                      target="_blank"
                      rel="noopener"
                      className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-sm font-bold py-2 rounded-lg transition text-center flex items-center justify-center gap-1.5"
                    >
                      <Activity size={14} /> Local
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FleetPanel;
