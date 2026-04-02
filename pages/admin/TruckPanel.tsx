import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Order } from '../../types';
import { ChefHat, Monitor, Smartphone, QrCode, ExternalLink, Download, Copy, CheckCircle, Clock, Flame, Package, Users, DollarSign, TrendingUp } from 'lucide-react';

const TODAY = new Date().toISOString().split('T')[0];

const TruckPanel: React.FC = () => {
  const { orders, settings } = useApp();
  const [copied, setCopied] = useState(false);
  const [qrSize, setQrSize] = useState(300);

  // Build QR URL — works with HashRouter
  const baseUrl = window.location.origin + window.location.pathname;
  const qrOrderUrl = `${baseUrl}#/qr-order`;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(qrOrderUrl)}&bgcolor=000000&color=ffffff`;

  const handleCopy = () => {
    navigator.clipboard.writeText(qrOrderUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Today's stats
  const todayOrders = useMemo(() => orders.filter(o => o.cookDay === TODAY || o.createdAt?.startsWith(TODAY)), [orders]);
  const walkUpOrders = todayOrders.filter(o => o.userId === 'walk_up');
  const qrOrders = todayOrders.filter(o => o.userId === 'qr_customer');
  const activeOrders = todayOrders.filter(o => ['Confirmed', 'Cooking', 'Ready'].includes(o.status));
  const completedOrders = todayOrders.filter(o => o.status === 'Completed');
  const todayRevenue = todayOrders.filter(o => !['Cancelled', 'Rejected', 'Pending'].includes(o.status)).reduce((sum, o) => sum + o.total, 0);

  const statsByStatus = (status: Order['status']) => todayOrders.filter(o => o.status === status).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-white flex items-center gap-3">
          <ChefHat className="text-orange-400" size={28} />
          Truck Mode
        </h2>
        <p className="text-gray-400 mt-1">Launch front-of-house and kitchen displays, generate QR codes for customer ordering.</p>
      </div>

      {/* Quick Launch */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <a
          href="#/foh"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-gradient-to-br from-orange-600 to-orange-800 rounded-2xl p-6 flex items-center gap-5 hover:from-orange-500 hover:to-orange-700 transition group"
        >
          <div className="bg-black/20 p-4 rounded-xl">
            <Smartphone size={32} className="text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-black text-xl">Front of House</h3>
            <p className="text-orange-200 text-sm mt-0.5">Tablet order entry — take walk-up orders quickly</p>
          </div>
          <ExternalLink size={20} className="text-orange-300 group-hover:text-white transition" />
        </a>

        <a
          href="#/boh"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-gradient-to-br from-gray-700 to-gray-900 rounded-2xl p-6 flex items-center gap-5 hover:from-gray-600 hover:to-gray-800 transition group"
        >
          <div className="bg-black/20 p-4 rounded-xl">
            <Monitor size={32} className="text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-black text-xl">Kitchen Display</h3>
            <p className="text-gray-300 text-sm mt-0.5">BOH order queue — tap to advance, auto-SMS when ready</p>
          </div>
          <ExternalLink size={20} className="text-gray-400 group-hover:text-white transition" />
        </a>
      </div>

      {/* Today's Stats */}
      <div>
        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Today's Activity</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
              <Package size={14} /> Total Orders
            </div>
            <div className="text-white font-black text-2xl">{todayOrders.length}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
              <Flame size={14} className="text-orange-400" /> Active Now
            </div>
            <div className="text-orange-400 font-black text-2xl">{activeOrders.length}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
              <DollarSign size={14} className="text-green-400" /> Revenue
            </div>
            <div className="text-green-400 font-black text-2xl">${todayRevenue.toFixed(0)}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
              <CheckCircle size={14} /> Completed
            </div>
            <div className="text-white font-black text-2xl">{completedOrders.length}</div>
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="mt-3 flex flex-wrap gap-2">
          {(['Confirmed', 'Cooking', 'Ready', 'Completed', 'Cancelled'] as Order['status'][]).map(status => {
            const count = statsByStatus(status);
            if (count === 0) return null;
            const colors: Record<string, string> = {
              Confirmed: 'bg-yellow-900/30 text-yellow-400 border-yellow-800',
              Cooking: 'bg-orange-900/30 text-orange-400 border-orange-800',
              Ready: 'bg-green-900/30 text-green-400 border-green-800',
              Completed: 'bg-gray-800 text-gray-400 border-gray-700',
              Cancelled: 'bg-red-900/30 text-red-400 border-red-800',
            };
            return (
              <span key={status} className={`text-xs font-bold px-3 py-1 rounded-full border ${colors[status] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                {status}: {count}
              </span>
            );
          })}
        </div>

        {/* Channel breakdown */}
        {(walkUpOrders.length > 0 || qrOrders.length > 0) && (
          <div className="mt-3 flex gap-4 text-xs text-gray-500">
            {walkUpOrders.length > 0 && <span><Users size={12} className="inline mr-1" />{walkUpOrders.length} walk-up</span>}
            {qrOrders.length > 0 && <span><QrCode size={12} className="inline mr-1" />{qrOrders.length} QR orders</span>}
          </div>
        )}
      </div>

      {/* QR Code Generator */}
      <div>
        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Customer QR Code</h3>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col md:flex-row gap-6 items-center">
          {/* QR Preview */}
          <div className="bg-black p-4 rounded-2xl border border-gray-700">
            <img
              src={qrApiUrl}
              alt="QR Code for customer ordering"
              className="w-48 h-48"
              crossOrigin="anonymous"
            />
          </div>

          <div className="flex-1 space-y-4">
            <div>
              <h4 className="text-white font-bold text-lg">Scan to Order</h4>
              <p className="text-gray-400 text-sm mt-1">
                Print this QR code and display it on your truck. Customers scan it, order from their phone, and get an SMS when food is ready.
              </p>
            </div>

            {/* URL */}
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-gray-800 text-gray-300 text-xs px-3 py-2 rounded-lg truncate">
                {qrOrderUrl}
              </code>
              <button
                onClick={handleCopy}
                className="bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-lg transition"
                title="Copy URL"
              >
                {copied ? <CheckCircle size={16} className="text-green-400" /> : <Copy size={16} />}
              </button>
            </div>

            {/* Size selector */}
            <div className="flex items-center gap-3">
              <span className="text-gray-500 text-xs">Size:</span>
              {[200, 300, 500, 800].map(size => (
                <button
                  key={size}
                  onClick={() => setQrSize(size)}
                  className={`text-xs px-3 py-1 rounded-full transition ${
                    qrSize === size ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {size}px
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <a
                href={qrApiUrl}
                download={`${(settings.businessName || 'truck').replace(/\s+/g, '-').toLowerCase()}-qr-code.png`}
                className="bg-orange-500 hover:bg-orange-400 text-white font-bold px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 transition"
              >
                <Download size={16} /> Download PNG
              </a>
              <a
                href={`https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(qrOrderUrl)}&bgcolor=000000&color=ffffff&format=svg`}
                download={`${(settings.businessName || 'truck').replace(/\s+/g, '-').toLowerCase()}-qr-code.svg`}
                className="bg-gray-800 hover:bg-gray-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 transition"
              >
                <Download size={16} /> SVG
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Event Mode — Offline QR via Pi */}
      <div>
        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Event Mode (Offline)</h3>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* WiFi QR Code */}
            <div className="bg-black p-4 rounded-2xl border border-gray-700 shrink-0">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent('WIFI:T:nopass;S:StreetEats;;')}&bgcolor=000000&color=ffffff`}
                alt="WiFi QR Code"
                className="w-48 h-48"
                crossOrigin="anonymous"
              />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <h4 className="text-white font-bold text-lg">No Signal? No Problem.</h4>
                <p className="text-gray-400 text-sm mt-1">
                  When running at events with no mobile coverage, use the ChowNow Pi. Customers scan this WiFi QR code — their phone auto-connects to the local network and the ordering page opens automatically via captive portal. Zero internet required.
                </p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">WiFi Network</span>
                  <span className="text-white font-bold">StreetEats</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Password</span>
                  <span className="text-green-400 font-bold">None (open)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">How it works</span>
                  <span className="text-gray-300">Scan → auto-connect → menu opens</span>
                </div>
              </div>
              <div className="flex gap-2">
                <a
                  href={`https://api.qrserver.com/v1/create-qr-code/?size=800x800&data=${encodeURIComponent('WIFI:T:nopass;S:StreetEats;;')}&bgcolor=000000&color=ffffff`}
                  download="street-eats-wifi-qr.png"
                  className="bg-gray-700 hover:bg-gray-600 text-white font-bold px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 transition"
                >
                  <Download size={16} /> Download WiFi QR
                </a>
              </div>
              <p className="text-gray-600 text-xs">
                Requires a Raspberry Pi running the ChowNow local server. Print this QR code alongside your regular QR code — flip between them based on signal.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">How It Works</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex items-start gap-3">
            <span className="bg-orange-500 text-white font-black w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs">1</span>
            <div>
              <div className="text-white font-bold">Open FOH + BOH</div>
              <div className="text-gray-400">Open Front of House on your order tablet, Kitchen Display on your kitchen screen. Both use the staff PIN.</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="bg-orange-500 text-white font-black w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs">2</span>
            <div>
              <div className="text-white font-bold">Take Orders</div>
              <div className="text-gray-400">Walk-up customers: take orders on FOH. Queue customers: they scan the QR and order from their phone.</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="bg-orange-500 text-white font-black w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs">3</span>
            <div>
              <div className="text-white font-bold">Cook + Notify</div>
              <div className="text-gray-400">Kitchen taps orders on BOH to advance. When Ready, customer gets an SMS + their live status page updates.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TruckPanel;
