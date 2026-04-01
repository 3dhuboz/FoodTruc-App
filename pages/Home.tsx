import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ShoppingCart, QrCode, Calendar, Clock, MapPin, ChefHat, ArrowRight, Flame, Gift } from 'lucide-react';

const Home: React.FC = () => {
  const { settings, menu, calendarEvents, orders } = useApp();
  const businessName = settings.businessName || 'Street Eats';
  const address = settings.businessAddress || '';
  const logo = settings.logoUrl;

  const today = new Date().toISOString().split('T')[0];

  // Upcoming events
  const upcomingEvents = useMemo(() => {
    return calendarEvents
      .filter(e => e.type === 'PUBLIC_EVENT' && e.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 3);
  }, [calendarEvents, today]);

  // Menu categories
  const categories = useMemo(() => {
    const cats = new Map<string, number>();
    menu.filter(i => i.available && !i.isPack).forEach(i => cats.set(i.category, (cats.get(i.category) || 0) + 1));
    return Array.from(cats.entries()).slice(0, 6);
  }, [menu]);

  // Featured items
  const featured = useMemo(() => {
    return menu
      .filter(i => i.available && !i.isPack && i.image && i.category !== 'Service')
      .sort((a, b) => b.price - a.price)
      .slice(0, 4);
  }, [menu]);

  return (
    <div className="animate-in fade-in duration-500 pb-20">

      {/* Hero */}
      <div className="relative bg-gradient-to-b from-orange-950/40 to-gray-950 px-6 py-16 md:py-24 text-center overflow-hidden">
        <div className="relative z-10 max-w-2xl mx-auto">
          {logo ? (
            <img src={logo} alt={businessName} className="h-20 mx-auto mb-6 object-contain" />
          ) : (
            <div className="inline-flex items-center justify-center p-4 bg-orange-500/10 rounded-2xl mb-6 border border-orange-500/20">
              <ChefHat size={40} className="text-orange-400" />
            </div>
          )}
          <h1 className="text-4xl md:text-6xl font-black text-white mb-4 leading-tight">
            {businessName}
          </h1>
          {address && (
            <p className="text-gray-400 flex items-center justify-center gap-2 mb-6">
              <MapPin size={16} className="text-orange-400" /> {address}
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/menu"
              className="bg-orange-500 hover:bg-orange-400 text-white font-black px-8 py-4 rounded-2xl flex items-center gap-2 transition active:scale-95 text-lg"
            >
              <ShoppingCart size={20} /> View Menu
            </Link>
            <Link
              to="/qr-order"
              className="bg-white/5 hover:bg-white/10 text-white font-bold px-8 py-4 rounded-2xl flex items-center gap-2 transition border border-white/10"
            >
              <QrCode size={20} /> Order Now
            </Link>
          </div>
        </div>
      </div>

      {/* Featured Items */}
      {featured.length > 0 && (
        <div className="max-w-6xl mx-auto px-6 py-12">
          <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Flame size={14} className="text-orange-400" /> Popular
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {featured.map(item => (
              <Link key={item.id} to="/menu" className="group">
                <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden hover:border-orange-500/30 transition">
                  {item.image && (
                    <img src={item.image} alt={item.name} className="w-full h-32 object-cover group-hover:scale-105 transition duration-300" />
                  )}
                  <div className="p-3">
                    <div className="text-white font-bold text-sm leading-tight">{item.name}</div>
                    <div className="text-orange-400 font-black mt-1">${item.price.toFixed(2)}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions Grid */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Menu Categories */}
          <Link to="/menu" className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-orange-500/30 transition group">
            <h3 className="text-white font-bold text-lg mb-3 flex items-center gap-2">
              <ShoppingCart size={18} className="text-orange-400" /> Our Menu
            </h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {categories.map(([cat, count]) => (
                <span key={cat} className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded-full">
                  {cat} ({count})
                </span>
              ))}
            </div>
            <span className="text-orange-400 text-sm font-bold flex items-center gap-1 group-hover:gap-2 transition-all">
              Browse full menu <ArrowRight size={14} />
            </span>
          </Link>

          {/* Order Now */}
          <Link to="/qr-order" className="bg-gradient-to-br from-orange-600 to-orange-800 rounded-2xl p-6 hover:from-orange-500 hover:to-orange-700 transition group">
            <h3 className="text-white font-bold text-lg mb-2 flex items-center gap-2">
              <QrCode size={18} /> Order Ahead
            </h3>
            <p className="text-orange-100 text-sm mb-3">
              Skip the queue — order from your phone and we'll text you when it's ready.
            </p>
            <span className="text-white text-sm font-bold flex items-center gap-1 group-hover:gap-2 transition-all">
              Start ordering <ArrowRight size={14} />
            </span>
          </Link>

          {/* Events or Rewards */}
          {settings.rewards?.enabled ? (
            <Link to="/rewards" className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-orange-500/30 transition group">
              <h3 className="text-white font-bold text-lg mb-2 flex items-center gap-2">
                <Gift size={18} className="text-orange-400" /> {settings.rewards.programName || 'Rewards'}
              </h3>
              <p className="text-gray-400 text-sm mb-3">
                Collect stamps with every order. Earn free food.
              </p>
              <span className="text-orange-400 text-sm font-bold flex items-center gap-1 group-hover:gap-2 transition-all">
                Join the program <ArrowRight size={14} />
              </span>
            </Link>
          ) : (
            <Link to="/events" className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-orange-500/30 transition group">
              <h3 className="text-white font-bold text-lg mb-2 flex items-center gap-2">
                <Calendar size={18} className="text-orange-400" /> Events
              </h3>
              <p className="text-gray-400 text-sm mb-3">
                Find out where we'll be next — markets, festivals, pop-ups.
              </p>
              <span className="text-orange-400 text-sm font-bold flex items-center gap-1 group-hover:gap-2 transition-all">
                See events <ArrowRight size={14} />
              </span>
            </Link>
          )}
        </div>
      </div>

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <div className="max-w-6xl mx-auto px-6 py-8">
          <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Calendar size={14} className="text-orange-400" /> Upcoming
          </h2>
          <div className="space-y-3">
            {upcomingEvents.map(event => {
              const eventDate = new Date(event.date + 'T00:00:00');
              return (
                <div key={event.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-4">
                  <div className="bg-orange-500/10 rounded-xl p-3 text-center min-w-[60px]">
                    <div className="text-orange-400 font-black text-lg">{eventDate.getDate()}</div>
                    <div className="text-gray-400 text-xs uppercase">{eventDate.toLocaleString('default', { month: 'short' })}</div>
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-bold">{event.title}</div>
                    {event.location && (
                      <div className="text-gray-500 text-sm flex items-center gap-1 mt-0.5">
                        <MapPin size={12} /> {event.location}
                      </div>
                    )}
                    {event.time && (
                      <div className="text-gray-500 text-sm flex items-center gap-1">
                        <Clock size={12} /> {event.time}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer tagline */}
      <div className="text-center py-12 px-6">
        <p className="text-gray-600 text-sm">
          Powered by <span className="text-orange-400 font-bold">Street Eats</span>
        </p>
      </div>
    </div>
  );
};

export default Home;
