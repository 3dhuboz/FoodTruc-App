
import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../components/Toast';
import { Send, Users, UserCheck, Search, CheckSquare, Square, Loader2, AlertCircle, Smartphone } from 'lucide-react';
import { User, UserRole } from '../../types';

const normalizePhone = (raw: string): string => {
  let phone = raw.replace(/[\s\-()]/g, '');
  if (phone.startsWith('+')) return phone;
  if (phone.startsWith('0')) phone = phone.slice(1);
  if (phone.startsWith('61')) return '+' + phone;
  return '+61' + phone;
};

const SmsBlast: React.FC = () => {
  const { users, settings } = useApp();
  const { toast } = useToast();

  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sendMode, setSendMode] = useState<'all' | 'selected'>('all');
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ sent: 0, failed: 0, total: 0 });

  // Only customers with phone numbers
  const eligibleCustomers = useMemo(() =>
    users.filter(u => u.role === UserRole.CUSTOMER && u.phone && u.phone.trim().length >= 8),
    [users]
  );

  const filteredCustomers = useMemo(() =>
    eligibleCustomers.filter(u =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.phone || '').includes(searchTerm)
    ),
    [eligibleCustomers, searchTerm]
  );

  const recipients = sendMode === 'all'
    ? eligibleCustomers
    : eligibleCustomers.filter(u => selectedIds.has(u.id));

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredCustomers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCustomers.map(u => u.id)));
    }
  };

  const handleSend = async () => {
    if (!message.trim()) {
      toast('Please enter a message.', 'warning');
      return;
    }
    if (recipients.length === 0) {
      toast('No recipients selected or no customers have phone numbers.', 'warning');
      return;
    }
    if (!settings.smsSettings?.enabled) {
      toast('SMS is not configured. Go to Settings > SMS to set up ClickSend.', 'error');
      return;
    }

    const confirm = window.confirm(
      `Send this SMS to ${recipients.length} customer${recipients.length > 1 ? 's' : ''}?\n\n"${message.slice(0, 100)}${message.length > 100 ? '...' : ''}"`
    );
    if (!confirm) return;

    setIsSending(true);
    setSendProgress({ sent: 0, failed: 0, total: recipients.length });

    let sent = 0;
    let failed = 0;

    for (const customer of recipients) {
      try {
        const res = await fetch('/api/v1/sms/blast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            settings: settings.smsSettings,
            to: normalizePhone(customer.phone!),
            message: message.replace(/\{name\}/g, customer.name).replace(/\{business\}/g, settings.businessName || 'Your Business'),
          }),
        });
        if (res.ok) sent++;
        else failed++;
      } catch {
        failed++;
      }
      setSendProgress({ sent, failed, total: recipients.length });
    }

    setIsSending(false);

    if (failed === 0) {
      toast(`SMS blast sent to ${sent} customer${sent > 1 ? 's' : ''}!`);
    } else {
      toast(`Sent ${sent}, failed ${failed} of ${recipients.length}.`, 'warning');
    }
  };

  const charsLeft = 160 - message.length;
  const smsSegments = Math.ceil(message.length / 160) || 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Send size={18} className="text-green-400" /> SMS Blast
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Send a text message to all or selected customers. Variables: {'{name}'}, {'{business}'}
          </p>
        </div>
        <div className="text-right text-xs text-gray-500">
          <p><strong className="text-green-400">{eligibleCustomers.length}</strong> customers with phone numbers</p>
        </div>
      </div>

      {/* Message */}
      <div className="bg-gray-900/50 p-5 rounded-xl border border-gray-800 space-y-4">
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase">Message</label>
          <textarea
            title="SMS blast message"
            rows={4}
            maxLength={480}
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={`Hey {name}! 🍖 Big news from ${settings.businessName || 'Your Business'}...`}
            className="w-full bg-black/40 border border-gray-700 rounded-lg p-3 text-white text-sm resize-none mt-1"
          />
          <div className="flex justify-between text-xs mt-1">
            <span className={charsLeft < 0 ? 'text-red-400' : 'text-gray-500'}>
              {message.length} chars · {smsSegments} SMS segment{smsSegments > 1 ? 's' : ''}
            </span>
            <span className="text-gray-500">{charsLeft >= 0 ? `${charsLeft} left in segment` : `${Math.abs(charsLeft)} over single SMS`}</span>
          </div>
        </div>

        {/* Send Mode */}
        <div className="flex gap-3">
          <button
            onClick={() => setSendMode('all')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-bold transition ${
              sendMode === 'all'
                ? 'bg-green-600/20 border-green-600 text-green-400'
                : 'bg-black/20 border-gray-700 text-gray-400 hover:border-gray-500'
            }`}
          >
            <Users size={15} /> All Customers ({eligibleCustomers.length})
          </button>
          <button
            onClick={() => setSendMode('selected')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-bold transition ${
              sendMode === 'selected'
                ? 'bg-blue-600/20 border-blue-600 text-blue-400'
                : 'bg-black/20 border-gray-700 text-gray-400 hover:border-gray-500'
            }`}
          >
            <UserCheck size={15} /> Select ({selectedIds.size})
          </button>
        </div>
      </div>

      {/* Customer Selection */}
      {sendMode === 'selected' && (
        <div className="bg-gray-900/50 p-5 rounded-xl border border-gray-800 space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                title="Search customers"
                placeholder="Search by name, email, or phone..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-black/40 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-white text-sm"
              />
            </div>
            <button
              onClick={toggleAll}
              className="text-xs font-bold text-blue-400 hover:text-blue-300 whitespace-nowrap"
            >
              {selectedIds.size === filteredCustomers.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1 custom-scrollbar">
            {filteredCustomers.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No customers with phone numbers found.</p>
            ) : (
              filteredCustomers.map(u => (
                <button
                  key={u.id}
                  onClick={() => toggleSelect(u.id)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition ${
                    selectedIds.has(u.id) ? 'bg-blue-900/20 border border-blue-700' : 'bg-black/10 border border-transparent hover:border-gray-700'
                  }`}
                >
                  {selectedIds.has(u.id) ? (
                    <CheckSquare size={16} className="text-blue-400 shrink-0" />
                  ) : (
                    <Square size={16} className="text-gray-600 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{u.name}</p>
                    <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                      <Smartphone size={10} /> {u.phone}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Send */}
      <div className="flex items-center gap-4">
        <button
          disabled={isSending || !message.trim() || recipients.length === 0}
          onClick={handleSend}
          className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl text-sm transition flex items-center justify-center gap-2"
        >
          {isSending ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Sending {sendProgress.sent + sendProgress.failed}/{sendProgress.total}...
            </>
          ) : (
            <>
              <Send size={16} />
              Send to {recipients.length} Customer{recipients.length !== 1 ? 's' : ''}
            </>
          )}
        </button>
      </div>

      {!settings.smsSettings?.enabled && (
        <div className="flex items-start gap-2 p-3 bg-yellow-900/20 border border-yellow-700 rounded-lg text-sm text-yellow-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>SMS is not configured. Set up ClickSend in <strong>Settings &gt; SMS Settings</strong> before sending.</span>
        </div>
      )}

      {isSending && (
        <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800">
          <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span>Progress</span>
            <span>{sendProgress.sent + sendProgress.failed} / {sendProgress.total}</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${((sendProgress.sent + sendProgress.failed) / Math.max(sendProgress.total, 1)) * 100}%` }}
            />
          </div>
          <div className="flex gap-4 mt-2 text-xs">
            <span className="text-green-400">✓ {sendProgress.sent} sent</span>
            {sendProgress.failed > 0 && <span className="text-red-400">✗ {sendProgress.failed} failed</span>}
          </div>
        </div>
      )}
    </div>
  );
};

export default SmsBlast;
