
import React, { useState, useMemo } from 'react';
import { Utensils, CalendarCheck, Share2, Settings, Users, CalendarDays, Flame, Cloud, WifiOff, Package, Code2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import OrderManager from './OrderManager';
import MenuManager from './MenuManager';
import CateringManager from './CateringManager';
import SocialAIBridge from './SocialAIBridge';
import SettingsManager from './SettingsManager';
import CustomerManager from './CustomerManager';
import Planner from './Planner';
import Pitmaster from './Pitmaster';

type TabId = 'orders' | 'planner' | 'pitmaster' | 'menu' | 'catering' | 'customers' | 'social' | 'settings' | 'devtools';

interface TabDef { id: TabId; icon: React.ElementType; label: string; devOnly?: boolean }

const ALL_TABS: TabDef[] = [
  { id: 'orders',    icon: CalendarCheck, label: 'Orders' },
  { id: 'planner',   icon: CalendarDays,  label: 'Planner' },
  { id: 'pitmaster', icon: Flame,         label: 'Pitmaster' },
  { id: 'menu',      icon: Utensils,      label: 'Menu' },
  { id: 'catering',  icon: Package,       label: 'Catering' },
  { id: 'customers', icon: Users,         label: 'Customers' },
  { id: 'social',    icon: Share2,        label: 'Social & AI' },
  { id: 'settings',  icon: Settings,      label: 'Settings' },
  { id: 'devtools',  icon: Code2,         label: 'Dev Tools', devOnly: true },
];

const AdminDashboard: React.FC = () => {
  const { connectionError, user } = useApp();
  const isDev = user?.role === 'DEV';
  const tabs = useMemo(() => ALL_TABS.filter(t => !t.devOnly || isDev), [isDev]);
  const [activeTab, setActiveTab] = useState<TabId>('orders');

  const activeLabel = tabs.find(t => t.id === activeTab)?.label ?? '';

  return (
    <div className="flex -mx-4 md:-mx-8 min-h-[calc(100vh-160px)]">

      {/* ── Sidebar (desktop) ── */}
      <aside className="hidden md:flex flex-col w-44 shrink-0 border-r border-gray-800/70 bg-gray-950/40">
        <div className="px-4 py-4 border-b border-gray-800/70">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
            {isDev ? 'Dev Panel' : 'Admin Panel'}
          </p>
        </div>

        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {tabs.map(({ id, icon: Icon, label, devOnly }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                activeTab === id
                  ? devOnly ? 'bg-purple-700 text-white shadow-sm' : 'bg-bbq-red text-white shadow-sm'
                  : devOnly ? 'text-purple-400 hover:text-white hover:bg-purple-900/20' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </nav>

        <div className="px-3 py-3 border-t border-gray-800/70">
          {isDev && (
            <span className="text-[10px] flex items-center gap-1.5 text-purple-400 mb-1.5">
              <Code2 size={10} /> Developer Mode
            </span>
          )}
          {connectionError ? (
            <span className="text-[10px] flex items-center gap-1.5 text-red-400">
              <WifiOff size={10} /> Offline
            </span>
          ) : (
            <span className="text-[10px] flex items-center gap-1.5 text-green-500">
              <Cloud size={10} /> Live · Firestore
            </span>
          )}
        </div>
      </aside>

      {/* ── Mobile tab bar ── */}
      <div className="md:hidden fixed bottom-[72px] left-0 right-0 z-40 flex overflow-x-auto bg-gray-950/95 border-t border-gray-800 backdrop-blur-md">
        {tabs.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex flex-col items-center gap-0.5 px-3.5 py-2 shrink-0 text-[9px] font-bold uppercase tracking-wide transition-all ${
              activeTab === id ? 'text-white border-t-2 border-bbq-red' : 'text-gray-500 border-t-2 border-transparent'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Section header bar */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-800/60 bg-gray-950/20">
          {(() => { const t = tabs.find(x => x.id === activeTab); return t ? <t.icon size={15} className="text-gray-400" /> : null; })()}
          <span className="text-sm font-semibold text-white">{activeLabel}</span>
        </div>

        {/* Page content */}
        <div className="flex-1 p-5 md:p-6 overflow-auto">
          {activeTab === 'orders'    && <OrderManager />}
          {activeTab === 'planner'   && <Planner />}
          {activeTab === 'pitmaster' && <Pitmaster />}
          {activeTab === 'menu'      && <MenuManager />}
          {activeTab === 'catering'  && <CateringManager />}
          {activeTab === 'customers' && <CustomerManager />}
          {activeTab === 'social'    && <SocialAIBridge />}
          {activeTab === 'settings'  && <SettingsManager mode="admin" />}
          {activeTab === 'devtools'  && <SettingsManager mode="dev" />}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
