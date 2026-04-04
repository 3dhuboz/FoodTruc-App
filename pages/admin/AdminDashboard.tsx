
import React, { useState } from 'react';
import { Home, Utensils, CalendarDays, ShoppingCart, Settings, Cloud, WifiOff, BarChart3 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';
import AdminHome from './AdminHome';
import OrderManager from './OrderManager';
import MenuManager from './MenuManager';
import SettingsManager from './SettingsManager';
import Planner from './Planner';
import AnalyticsDashboard from './AnalyticsDashboard';

type TabId = 'home' | 'menu' | 'planner' | 'orders' | 'settings';

interface TabDef { id: TabId; icon: React.ElementType; label: string }

const TABS: TabDef[] = [
  { id: 'home',     icon: Home,         label: 'Home' },
  { id: 'orders',   icon: ShoppingCart,  label: 'Orders' },
  { id: 'menu',     icon: Utensils,      label: 'Menu' },
  { id: 'planner',  icon: CalendarDays,  label: 'Planner' },
  { id: 'settings', icon: Settings,      label: 'Settings' },
];

const AdminDashboard: React.FC = () => {
  const { connectionError, settings, menu } = useApp();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Auto-redirect to setup wizard if unconfigured
  const needsSetup = !settings?.businessName || menu.length === 0;
  if (needsSetup && activeTab === 'home') {
    // Show home with checklist — wizard is at /setup
  }

  const activeLabel = TABS.find(t => t.id === activeTab)?.label ?? '';

  return (
    <div className="flex -mx-4 md:-mx-8 min-h-[calc(100vh-160px)]">

      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex flex-col w-44 shrink-0 border-r border-gray-800/70 bg-gray-950/40">
        <div className="px-4 py-4 border-b border-gray-800/70">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
            Admin Panel
          </p>
        </div>

        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {TABS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => { setActiveTab(id); setShowAnalytics(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                activeTab === id
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </nav>

        <div className="px-3 py-3 border-t border-gray-800/70">
          {connectionError ? (
            <span className="text-[10px] flex items-center gap-1.5 text-red-400">
              <WifiOff size={10} /> Offline
            </span>
          ) : (
            <span className="text-[10px] flex items-center gap-1.5 text-green-500">
              <Cloud size={10} /> Live
            </span>
          )}
        </div>
      </aside>

      {/* Mobile tab bar */}
      <div className="md:hidden fixed bottom-[72px] left-0 right-0 z-40 flex overflow-x-auto bg-gray-950/95 border-t border-gray-800 backdrop-blur-md">
        {TABS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => { setActiveTab(id); setShowAnalytics(false); }}
            className={`flex flex-col items-center gap-0.5 px-3.5 py-2 shrink-0 text-[9px] font-bold uppercase tracking-wide transition-all ${
              activeTab === id ? 'text-white border-t-2 border-orange-500' : 'text-gray-500 border-t-2 border-transparent'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Section header */}
        {activeTab !== 'home' && (
          <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-800/60 bg-gray-950/20">
            {(() => { const t = TABS.find(x => x.id === activeTab); return t ? <t.icon size={15} className="text-gray-400" /> : null; })()}
            <span className="text-sm font-semibold text-white">{activeLabel}</span>
            {activeTab === 'orders' && (
              <button
                onClick={() => setShowAnalytics(!showAnalytics)}
                className={`ml-auto text-xs font-bold px-3 py-1 rounded-full transition ${
                  showAnalytics ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                <BarChart3 size={12} className="inline mr-1" />
                {showAnalytics ? 'Orders' : 'Analytics'}
              </button>
            )}
          </div>
        )}

        {/* Page content */}
        <div className="flex-1 p-5 md:p-6 overflow-auto">
          {activeTab === 'home'     && <AdminHome onNavigate={(tab) => setActiveTab(tab as TabId)} />}
          {activeTab === 'orders'   && !showAnalytics && <OrderManager />}
          {activeTab === 'orders'   && showAnalytics && <AnalyticsDashboard />}
          {activeTab === 'menu'     && <MenuManager />}
          {activeTab === 'planner'  && <Planner />}
          {activeTab === 'settings' && <SettingsManager />}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
