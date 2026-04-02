import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useTenant } from '../context/TenantContext';
import { Link, useLocation } from 'react-router-dom';
import { ChefHat, UtensilsCrossed, CalendarDays, User as UserIcon, LogOut, LayoutDashboard, Mail, MapPin, Menu, X, Gift, AlertTriangle, Image as ImageIcon, QrCode, ShoppingCart, WifiOff } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout, cart, settings, connectionError, isOnline, pendingSyncCount } = useApp();
  const { tenant } = useTenant();
  const location = useLocation();
  // Tenant name takes priority, then settings, then fallback
  const businessName = tenant?.name || settings.businessName || 'ChowNow';
  // Tenant logo takes priority, then settings logo
  const logoUrl = tenant?.logoUrl || settings?.logoUrl;

  const brandColor = tenant?.primaryColor || '#f97316';
  const isActive = (path: string) => location.pathname === path ? 'text-[var(--brand-color)]' : 'text-gray-400 hover:text-white';

  const NavItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => (
    <Link to={to} className={`flex flex-col items-center justify-center space-y-1 ${isActive(to)} transition-colors duration-300`}>
      <Icon size={22} strokeWidth={1.5} />
      <span className="text-[10px] uppercase font-bold tracking-widest">{label}</span>
    </Link>
  );

  return (
    <div className="min-h-screen flex flex-col pb-20 md:pb-0 relative overflow-x-hidden">

      {/* Connection / Offline Banner */}
      {connectionError && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-yellow-600 text-black text-xs font-bold p-2 text-center flex items-center justify-center gap-2">
          <WifiOff size={14} />
          <span>{connectionError}</span>
          {pendingSyncCount > 0 && <span className="bg-black/20 px-2 py-0.5 rounded-full">{pendingSyncCount} pending</span>}
        </div>
      )}

      {/* Desktop Header */}
      <header className={`hidden md:flex items-center justify-between px-8 py-4 fixed top-0 left-0 right-0 z-50 bg-gray-950/90 backdrop-blur-xl border-b border-gray-800/50 transition-all ${connectionError ? 'mt-8' : ''}`}>
        <Link to="/" className="flex items-center gap-3 group">
          {logoUrl ? (
            <div className="w-12 h-12 flex items-center justify-center overflow-visible">
              <img src={logoUrl} alt={businessName} className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
              <ChefHat className="text-orange-400" size={22} />
            </div>
          )}
          <div className="flex flex-col">
            <h1 className="text-xl font-black text-white uppercase tracking-wide leading-none group-hover:text-orange-400 transition-colors">{businessName}</h1>
          </div>
        </Link>

        <nav className="flex items-center gap-6 bg-gray-900/60 px-6 py-2.5 rounded-full border border-gray-800">
          <Link to="/" className={`font-bold text-sm tracking-widest uppercase transition ${isActive('/')}`}>Home</Link>
          <Link to="/menu" className={`font-bold text-sm tracking-widest uppercase transition ${isActive('/menu')}`}>Menu</Link>
          <Link to="/qr-order" className={`font-bold text-sm tracking-widest uppercase transition flex items-center gap-1 ${isActive('/qr-order')}`}>
            <QrCode size={14} /> Order
          </Link>
          <Link to="/events" className={`font-bold text-sm tracking-widest uppercase transition ${isActive('/events')}`}>Events</Link>
          {settings.rewards?.enabled && (
            <Link to="/rewards" className={`font-bold text-sm tracking-widest uppercase transition flex items-center gap-1 ${isActive('/rewards')}`}>
              <Gift size={14} className="text-orange-400" /> Rewards
            </Link>
          )}
          <Link to="/contact" className={`font-bold text-sm tracking-widest uppercase transition ${isActive('/contact')}`}>Contact</Link>
          {(user?.role === 'ADMIN' || user?.role === 'DEV') && (
            <Link to="/admin" className={`font-bold text-sm tracking-widest uppercase transition ${isActive('/admin')}`}>Admin</Link>
          )}
        </nav>

        <div className="flex items-center gap-4">
          {!isOnline && (
            <span className="text-xs bg-yellow-900 text-yellow-400 px-2 py-1 rounded-full font-bold flex items-center gap-1">
              <WifiOff size={10} /> Offline
            </span>
          )}
          {user ? (
            <div className="flex items-center gap-3">
              <Link to="/profile" className="flex items-center gap-2 hover:bg-white/5 p-2 rounded-lg transition">
                <div className="text-right hidden lg:block">
                  <p className="text-xs text-gray-400">Welcome,</p>
                  <p className="text-sm font-bold text-orange-400 leading-none">{user.name.split(' ')[0]}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center border border-gray-700">
                  <UserIcon size={16} />
                </div>
              </Link>
              <button onClick={logout} className="p-2 hover:text-red-500 transition" title="Logout"><LogOut size={20} /></button>
            </div>
          ) : (
            <Link to="/login" className="px-5 py-2 bg-orange-500 hover:bg-orange-400 text-white text-sm font-bold uppercase tracking-wider rounded-full transition">
              Login
            </Link>
          )}
        </div>
      </header>

      {/* Mobile Header */}
      <header className={`md:hidden flex items-center justify-between p-4 fixed top-0 w-full z-50 bg-gray-950/90 backdrop-blur-xl border-b border-gray-800/50 ${connectionError ? 'mt-8' : ''}`}>
        <Link to="/" className="flex items-center gap-2">
          {logoUrl ? (
            <div className="w-9 h-9 flex items-center justify-center overflow-visible">
              <img src={logoUrl} alt={businessName} className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
              <ChefHat className="text-orange-400" size={18} />
            </div>
          )}
          <h1 className="text-lg font-black text-white uppercase tracking-tight">{businessName}</h1>
        </Link>
        <div className="flex items-center gap-3">
          {!isOnline && <WifiOff size={16} className="text-yellow-400" />}
          {cart.length > 0 && (
            <Link to="/order" className="bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
              {cart.length} <UtensilsCrossed size={12} />
            </Link>
          )}
          {user && (
            <button onClick={logout} className="text-gray-400 hover:text-white"><LogOut size={20} /></button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className={`flex-1 w-full max-w-7xl mx-auto p-4 md:p-8 pt-24 md:pt-28 ${connectionError ? 'mt-8' : ''}`}>
        {children}
      </main>

      {/* Footer */}
      <footer className="relative bg-gray-900 border-t border-gray-800 pt-12 pb-24 md:pb-8 mt-12">
        <div className="max-w-7xl mx-auto px-8 grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Brand */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {logoUrl ? (
                <img src={logoUrl} alt={businessName} className="h-10 object-contain" />
              ) : (
                <ChefHat size={24} className="text-orange-400" />
              )}
              <h3 className="font-black text-xl uppercase text-white">{businessName}</h3>
            </div>
            {settings.businessAddress && (
              <p className="text-gray-500 text-sm flex items-center gap-2">
                <MapPin size={14} className="text-orange-400 shrink-0" /> {settings.businessAddress}
              </p>
            )}
          </div>

          {/* Links */}
          <div>
            <h4 className="font-bold text-orange-400 uppercase tracking-widest text-xs mb-4">Explore</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li><Link to="/" className="hover:text-white transition">Home</Link></li>
              <li><Link to="/menu" className="hover:text-white transition">Menu</Link></li>
              <li><Link to="/qr-order" className="hover:text-white transition">Order Now</Link></li>
              <li><Link to="/events" className="hover:text-white transition">Events</Link></li>
              <li><Link to="/contact" className="hover:text-white transition">Contact</Link></li>
            </ul>
          </div>

          {/* Powered by */}
          <div>
            <p className="text-xs text-gray-600 mt-4">
              © {new Date().getFullYear()} {businessName}. All rights reserved.
            </p>
            <p className="text-xs text-gray-700 mt-2">
              Powered by <span className="text-orange-400 font-bold">ChowNow</span>
            </p>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-gray-950/95 backdrop-blur-xl border-t border-gray-800 flex justify-around py-3 pb-safe z-50">
        <NavItem to="/" icon={ChefHat} label="Home" />
        <NavItem to="/menu" icon={UtensilsCrossed} label="Menu" />
        <NavItem to="/qr-order" icon={QrCode} label="Order" />
        {(user?.role === 'ADMIN' || user?.role === 'DEV') ? (
          <NavItem to="/admin" icon={LayoutDashboard} label="Admin" />
        ) : (
          <NavItem to="/events" icon={CalendarDays} label="Events" />
        )}
        {user ? (
          <NavItem to="/profile" icon={UserIcon} label="Profile" />
        ) : (
          <NavItem to="/login" icon={UserIcon} label="Login" />
        )}
      </nav>
    </div>
  );
};

export default Layout;
