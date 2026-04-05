
import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, Lock, CheckCircle, AlertCircle, Loader2, ArrowLeft, Signal } from 'lucide-react';

interface Network {
  ssid: string;
  signal: number;
  security: string;
}

interface WiFiSetupProps {
  onDone: () => void;
  onSkip: () => void;
}

const SignalBars: React.FC<{ signal: number }> = ({ signal }) => {
  const bars = signal > 75 ? 4 : signal > 50 ? 3 : signal > 25 ? 2 : 1;
  return (
    <div className="flex items-end gap-0.5 h-4">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className={`w-1 rounded-sm ${i <= bars ? 'bg-orange-400' : 'bg-gray-700'}`} style={{ height: `${i * 25}%` }} />
      ))}
    </div>
  );
};

const WiFiSetup: React.FC<WiFiSetupProps> = ({ onDone, onSkip }) => {
  const [networks, setNetworks] = useState<Network[]>([]);
  const [scanning, setScanning] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<Network | null>(null);
  const [password, setPassword] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [status, setStatus] = useState<{ ssid?: string; online?: boolean } | null>(null);

  const scan = async () => {
    setScanning(true);
    setResult(null);
    try {
      const res = await fetch('/network/scan');
      const data = await res.json();
      setNetworks(data.networks || []);
    } catch {
      setNetworks([]);
    }
    setScanning(false);
  };

  const checkStatus = async () => {
    try {
      const res = await fetch('/network/status');
      const data = await res.json();
      setStatus({ ssid: data.connected?.ssid, online: data.online });
    } catch {}
  };

  useEffect(() => {
    scan();
    checkStatus();
  }, []);

  const connect = async () => {
    if (!selectedNetwork) return;
    setConnecting(true);
    setResult(null);
    try {
      const res = await fetch('/network/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ssid: selectedNetwork.ssid, password: password || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setResult({ success: true, message: `Connected to ${selectedNetwork.ssid}` });
        setSelectedNetwork(null);
        setPassword('');
        // Re-check status after a delay for internet verification
        setTimeout(checkStatus, 3000);
      } else {
        setResult({ success: false, message: data.error || 'Connection failed' });
      }
    } catch (err: any) {
      setResult({ success: false, message: err.message || 'Connection failed' });
    }
    setConnecting(false);
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      {/* Current status */}
      {status && (
        <div className={`flex items-center gap-3 p-4 rounded-xl ${status.online ? 'bg-green-900/30 border border-green-800' : status.ssid ? 'bg-yellow-900/30 border border-yellow-800' : 'bg-gray-900 border border-gray-800'}`}>
          {status.online ? <CheckCircle size={20} className="text-green-400" /> : status.ssid ? <Wifi size={20} className="text-yellow-400" /> : <WifiOff size={20} className="text-gray-500" />}
          <div>
            <div className="text-white text-sm font-bold">
              {status.online ? 'Online' : status.ssid ? 'Connected — No Internet' : 'No Connection'}
            </div>
            {status.ssid && <div className="text-gray-400 text-xs">{status.ssid}</div>}
          </div>
        </div>
      )}

      {/* Password modal for selected network */}
      {selectedNetwork ? (
        <div className="space-y-4">
          <button onClick={() => { setSelectedNetwork(null); setPassword(''); }} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm">
            <ArrowLeft size={16} /> Back to networks
          </button>
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-4">
            <div className="flex items-center gap-3">
              <Wifi size={20} className="text-orange-400" />
              <div>
                <div className="text-white font-bold">{selectedNetwork.ssid}</div>
                <div className="text-gray-500 text-xs">{selectedNetwork.security || 'Open'}</div>
              </div>
            </div>
            {selectedNetwork.security && (
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 text-gray-500" size={16} />
                <input
                  type="password"
                  placeholder="WiFi Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && connect()}
                  className="w-full bg-black/60 border border-gray-700 rounded-lg p-3 pl-10 text-white focus:border-orange-500 outline-none"
                />
              </div>
            )}
            <button
              onClick={connect}
              disabled={connecting || (!!selectedNetwork.security && !password)}
              className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold hover:bg-orange-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {connecting ? <><Loader2 className="animate-spin" size={18} /> Connecting...</> : 'Connect'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Scan header */}
          <div className="flex items-center justify-between">
            <h2 className="text-white font-bold text-lg">Available Networks</h2>
            <button onClick={scan} disabled={scanning} className="text-orange-400 hover:text-orange-300 p-2 rounded-lg transition">
              <RefreshCw size={18} className={scanning ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Network list */}
          <div className="space-y-2">
            {scanning && networks.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                Scanning for networks...
              </div>
            ) : networks.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <WifiOff className="mx-auto mb-2" size={24} />
                No networks found
              </div>
            ) : (
              networks.map((net) => (
                <button
                  key={net.ssid}
                  onClick={() => setSelectedNetwork(net)}
                  className="w-full flex items-center justify-between p-4 bg-gray-900 hover:bg-gray-800 rounded-xl border border-gray-800 transition"
                >
                  <div className="flex items-center gap-3">
                    <Wifi size={18} className="text-gray-400" />
                    <span className="text-white font-medium">{net.ssid}</span>
                    {net.security && <Lock size={12} className="text-gray-600" />}
                  </div>
                  <SignalBars signal={net.signal} />
                </button>
              ))
            )}
          </div>
        </>
      )}

      {/* Result message */}
      {result && (
        <div className={`flex items-center gap-3 p-4 rounded-xl ${result.success ? 'bg-green-900/30 border border-green-800' : 'bg-red-900/30 border border-red-800'}`}>
          {result.success ? <CheckCircle size={18} className="text-green-400" /> : <AlertCircle size={18} className="text-red-400" />}
          <span className={result.success ? 'text-green-300 text-sm' : 'text-red-300 text-sm'}>{result.message}</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="space-y-3 pt-2">
        <button onClick={onDone} className="w-full bg-orange-500 text-white py-4 rounded-xl font-bold text-lg hover:bg-orange-600 transition">
          Continue to Dashboard
        </button>
        <button onClick={onSkip} className="w-full text-gray-500 hover:text-gray-300 py-3 text-sm transition">
          Skip — Stay Offline
        </button>
      </div>
    </div>
  );
};

export default WiFiSetup;
