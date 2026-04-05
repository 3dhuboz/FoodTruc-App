
import React, { useState } from 'react';

interface PinGateProps {
  pin: string;
  onUnlock: () => void;
  title?: string;
  subtitle?: string;
  onBack?: () => void;
}

const PinGate: React.FC<PinGateProps> = ({ pin, onUnlock, title = 'Staff Access', subtitle = 'Enter staff PIN', onBack }) => {
  const [entered, setEntered] = useState('');
  const [shake, setShake] = useState(false);

  const handleDigit = (d: string) => {
    const next = entered + d;
    if (next.length < pin.length) { setEntered(next); return; }
    if (next === pin) { onUnlock(); return; }
    setShake(true); setEntered('');
    setTimeout(() => setShake(false), 500);
  };

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-8">
      <div className="text-white text-2xl font-black tracking-wider">{title}</div>
      <div className={`flex gap-3 ${shake ? 'animate-bounce' : ''}`}>
        {Array.from({ length: pin.length }).map((_, i) => (
          <div key={i} className={`w-4 h-4 rounded-full border-2 ${i < entered.length ? 'bg-orange-400 border-orange-400' : 'border-gray-700'}`} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
          <button key={i} onClick={() => d === '⌫' ? setEntered(e => e.slice(0, -1)) : d ? handleDigit(d) : undefined} disabled={!d}
            className={`w-20 h-20 rounded-2xl text-2xl font-bold transition ${d ? 'bg-gray-900 text-white hover:bg-gray-800 active:scale-95' : 'invisible'}`}>{d}</button>
        ))}
      </div>
      <p className="text-gray-500 text-sm">{subtitle}</p>
      {onBack && (
        <button onClick={onBack} className="text-gray-600 text-sm hover:text-gray-400 mt-2">Back</button>
      )}
    </div>
  );
};

export default PinGate;
