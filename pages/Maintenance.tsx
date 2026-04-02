
import React from 'react';
import { useApp } from '../context/AppContext';
import { Mail, MapPin, Facebook, Instagram, Flame, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';

const Maintenance: React.FC = () => {
  const { settings } = useApp();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black relative overflow-hidden text-white p-6">
      {/* Background Effect */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-20 blur-sm"
        style={{ backgroundImage: `url('${settings.maintenanceImage || "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1950&q=80"}')` }}
      ></div>
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent"></div>

      <div className="relative z-10 text-center max-w-2xl mx-auto space-y-8 animate-in fade-in zoom-in duration-700">
        
        <div className="w-24 h-24 bg-black/50 border-2 border-bbq-red rounded-full flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(217,56,30,0.4)] animate-pulse-slow">
            <Flame size={48} className="text-bbq-red" />
        </div>

        <div className="space-y-4">
            <h1 className="text-5xl md:text-7xl font-display font-bold uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-br from-white to-gray-400">
                Cooking <br/><span className="text-bbq-red">Low & Slow</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 font-light">
                Our site is currently down for maintenance or getting a fresh rub. <br/>
                We'll be back online shortly!
            </p>
            <p className="text-gray-500 italic">Sorry for the inconvenience.</p>
        </div>

        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 shadow-2xl">
            <h3 className="text-bbq-gold font-bold uppercase tracking-widest text-sm mb-6 border-b border-white/10 pb-4">
                Get In Touch
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                <div className="flex items-center gap-4">
                    <div className="bg-gray-800 p-2 rounded-lg text-bbq-red"><Mail size={20}/></div>
                    <div>
                        <p className="text-xs text-gray-500 uppercase font-bold">Email</p>
                        <a href="mailto:admin@chownow.au" className="font-bold hover:text-bbq-gold transition">admin@chownow.au</a>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="bg-gray-800 p-2 rounded-lg text-bbq-red"><MapPin size={20}/></div>
                    <div>
                        <p className="text-xs text-gray-500 uppercase font-bold">Location</p>
                        <p className="font-bold">Ipswich, QLD</p>
                    </div>
                </div>
            </div>

            <div className="flex justify-center gap-4 mt-8 pt-6 border-t border-white/10">
                <p className="text-gray-500 text-sm">Follow us on social media — coming soon!</p>
            </div>
        </div>

        <div className="pt-12">
            <Link to="/login" className="text-gray-600 hover:text-white flex items-center justify-center gap-2 text-sm transition">
                <Lock size={14} /> Staff Login
            </Link>
        </div>

      </div>
    </div>
  );
};

export default Maintenance;
