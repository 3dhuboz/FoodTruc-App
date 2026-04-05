
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, ArrowLeft, Loader2, UtensilsCrossed, ChefHat, MonitorSmartphone, Wifi } from 'lucide-react';
import PinGate from '../components/PinGate';
import WiFiSetup from '../components/WiFiSetup';

type Screen = 'landing' | 'staff-pin' | 'staff-choose' | 'admin-login' | 'admin-wifi';

interface Settings {
  businessName?: string;
  logoUrl?: string;
  adminUsername?: string;
  adminPassword?: string;
  rewards?: { staffPin?: string };
}

const CaptivePortal: React.FC = () => {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>('landing');
  const [settings, setSettings] = useState<Settings | null>(null);

  // Admin login state
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

  useEffect(() => {
    fetch('/api/v1/settings')
      .then(r => r.json())
      .then(d => setSettings(d))
      .catch(() => setSettings({}));
  }, []);

  const staffPin = settings?.rewards?.staffPin || '1234';
  const businessName = settings?.businessName || 'ChowBox';

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');
    setAdminLoading(true);

    // Dev backdoor
    if (adminUser === 'dev' && adminPass === '123') {
      setAdminLoading(false);
      setScreen('admin-wifi');
      return;
    }

    // Check against tenant settings
    if (adminUser === settings?.adminUsername && adminPass === settings?.adminPassword) {
      setAdminLoading(false);
      setScreen('admin-wifi');
      return;
    }

    setAdminLoading(false);
    setAdminError('Invalid credentials');
  };

  // ─── Landing Screen ─────────────────────────────────────────
  if (screen === 'landing') {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8">
          {/* Logo + Business Name */}
          <div className="text-center space-y-3">
            {settings?.logoUrl ? (
              <img src={settings.logoUrl} alt="" className="w-20 h-20 mx-auto rounded-2xl object-cover" />
            ) : (
              <div className="w-20 h-20 mx-auto rounded-2xl bg-orange-500/20 flex items-center justify-center">
                <UtensilsCrossed size={36} className="text-orange-400" />
              </div>
            )}
            <h1 className="text-white text-3xl font-black">{businessName}</h1>
            <p className="text-gray-500 text-sm">Powered by ChowNow</p>
          </div>

          {/* Main Actions */}
          <div className="space-y-3">
            {/* Order Food — big primary CTA */}
            <button
              onClick={() => navigate('/qr-order')}
              className="w-full bg-orange-500 text-white py-5 rounded-2xl font-bold text-xl hover:bg-orange-600 active:scale-[0.98] transition shadow-lg shadow-orange-900/30"
            >
              Order Food
            </button>

            {/* Staff + Admin row */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setScreen('staff-pin')}
                className="bg-gray-900 border border-gray-800 text-white py-4 rounded-xl font-bold hover:bg-gray-800 active:scale-[0.98] transition flex flex-col items-center gap-2"
              >
                <ChefHat size={24} className="text-orange-400" />
                <span className="text-sm">Staff</span>
              </button>
              <button
                onClick={() => setScreen('admin-login')}
                className="bg-gray-900 border border-gray-800 text-white py-4 rounded-xl font-bold hover:bg-gray-800 active:scale-[0.98] transition flex flex-col items-center gap-2"
              >
                <Lock size={24} className="text-orange-400" />
                <span className="text-sm">Admin</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Staff PIN Screen ───────────────────────────────────────
  if (screen === 'staff-pin') {
    return (
      <PinGate
        pin={staffPin}
        onUnlock={() => setScreen('staff-choose')}
        title="Staff Login"
        subtitle="Enter staff PIN"
        onBack={() => setScreen('landing')}
      />
    );
  }

  // ─── Staff Choose FOH/BOH ──────────────────────────────────
  if (screen === 'staff-choose') {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center space-y-2">
            <ChefHat size={48} className="text-orange-400 mx-auto" />
            <h1 className="text-white text-2xl font-black">Choose Your Station</h1>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => navigate('/foh')}
              className="w-full bg-orange-500 text-white py-5 rounded-2xl font-bold text-lg hover:bg-orange-600 active:scale-[0.98] transition"
            >
              <div className="flex items-center justify-center gap-3">
                <MonitorSmartphone size={24} />
                Front of House (POS)
              </div>
              <div className="text-orange-200 text-xs mt-1">Walk-up ordering + payments</div>
            </button>

            <button
              onClick={() => navigate('/boh')}
              className="w-full bg-gray-900 border border-gray-700 text-white py-5 rounded-2xl font-bold text-lg hover:bg-gray-800 active:scale-[0.98] transition"
            >
              <div className="flex items-center justify-center gap-3">
                <ChefHat size={24} className="text-orange-400" />
                Kitchen (BOH)
              </div>
              <div className="text-gray-500 text-xs mt-1">Order queue + cook tracking</div>
            </button>
          </div>

          <button onClick={() => setScreen('landing')} className="w-full text-gray-600 text-sm hover:text-gray-400 py-2 transition">
            <ArrowLeft size={14} className="inline mr-1" /> Back
          </button>
        </div>
      </div>
    );
  }

  // ─── Admin Login Screen ─────────────────────────────────────
  if (screen === 'admin-login') {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center space-y-2">
            <Lock size={40} className="text-orange-400 mx-auto" />
            <h1 className="text-white text-2xl font-black">Admin Login</h1>
            <p className="text-gray-500 text-sm">Sign in to manage {businessName}</p>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div className="relative">
              <User className="absolute left-3 top-3.5 text-gray-500" size={18} />
              <input
                type="text"
                placeholder="Username"
                value={adminUser}
                onChange={e => { setAdminUser(e.target.value); setAdminError(''); }}
                autoFocus
                className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 pl-10 text-white focus:border-orange-500 outline-none"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 text-gray-500" size={18} />
              <input
                type="password"
                placeholder="Password"
                value={adminPass}
                onChange={e => { setAdminPass(e.target.value); setAdminError(''); }}
                className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 pl-10 text-white focus:border-orange-500 outline-none"
              />
            </div>

            {adminError && (
              <div className="text-red-400 text-sm text-center bg-red-900/20 py-2 rounded-lg">{adminError}</div>
            )}

            <button
              type="submit"
              disabled={adminLoading || !adminUser || !adminPass}
              className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold hover:bg-orange-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {adminLoading ? <Loader2 className="animate-spin" size={18} /> : 'Sign In'}
            </button>
          </form>

          <button onClick={() => setScreen('landing')} className="w-full text-gray-600 text-sm hover:text-gray-400 py-2 transition">
            <ArrowLeft size={14} className="inline mr-1" /> Back
          </button>
        </div>
      </div>
    );
  }

  // ─── Admin WiFi Setup Screen ────────────────────────────────
  if (screen === 'admin-wifi') {
    return (
      <div className="fixed inset-0 bg-black flex flex-col overflow-y-auto">
        <div className="p-6 max-w-md mx-auto w-full space-y-6">
          <div className="text-center space-y-2">
            <Wifi size={40} className="text-orange-400 mx-auto" />
            <h1 className="text-white text-2xl font-black">Share Internet</h1>
            <p className="text-gray-500 text-sm">Connect ChowBox to your phone hotspot or WiFi for online ordering and syncing.</p>
          </div>

          <WiFiSetup
            onDone={() => navigate('/admin')}
            onSkip={() => navigate('/admin')}
          />
        </div>
      </div>
    );
  }

  return null;
};

export default CaptivePortal;
