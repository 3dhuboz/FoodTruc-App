import React, { useState } from 'react';
import { ExternalLink, Sparkles, RefreshCw, Maximize2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const SocialAIBridge: React.FC = () => {
  const { settings } = useApp();
  const url = settings.socialAiStudioUrl || 'https://socialaistudio.au';
  const [key, setKey] = useState(0);

  return (
    <div className="flex flex-col h-full -m-5 md:-m-6" style={{ minHeight: 'calc(100vh - 200px)' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-amber-400" />
          <span className="text-xs font-semibold text-white">Social AI Studio</span>
          <span className="text-[10px] text-gray-500 hidden sm:block">— powered by Penny Wise I.T</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setKey(k => k + 1)}
            title="Reload"
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition"
          >
            <RefreshCw size={13} />
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in new tab"
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition"
          >
            <ExternalLink size={13} />
          </a>
        </div>
      </div>

      {/* Iframe */}
      <iframe
        key={key}
        src={url}
        title="Social AI Studio"
        className="flex-1 w-full border-0"
        style={{ minHeight: 'calc(100vh - 240px)' }}
        allow="clipboard-write; clipboard-read"
      />
    </div>
  );
};

export default SocialAIBridge;
