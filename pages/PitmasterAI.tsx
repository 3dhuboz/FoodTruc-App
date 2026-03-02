
import React from 'react';
import PitmasterChat from '../components/PitmasterChat';
import { ArrowLeft, Bot } from 'lucide-react';
import { Link } from 'react-router-dom';

const PitmasterAI: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 pb-20 animate-in fade-in slide-in-from-bottom-4">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <div className="text-center md:text-left">
                <Link to="/" className="text-gray-400 hover:text-white flex items-center gap-2 text-sm font-bold mb-2 justify-center md:justify-start">
                    <ArrowLeft size={16}/> Back Home
                </Link>
                <h1 className="text-3xl md:text-4xl font-display font-bold text-white flex items-center gap-3">
                    <Bot className="text-bbq-red" size={32}/> ASK PITMASTER JAY
                </h1>
                <p className="text-gray-400 mt-2 max-w-xl">
                    Stuck on a stall? Wondering about resting times? Jay has uploaded his brain to the cloud. Ask him anything about the Your Business method.
                </p>
            </div>
        </div>

        {/* Chat Interface */}
        <PitmasterChat />

        <div className="mt-8 p-6 bg-bbq-charcoal rounded-xl border border-gray-700 text-center">
            <h4 className="text-white font-bold mb-2">Disclaimer</h4>
            <p className="text-xs text-gray-400 leading-relaxed">
                "Pitmaster Jay AI" offers advice based on Jay's general Low & Slow principles. 
                However, real-world meat varies! Use your probe, trust your feel, and don't blame the bot if you burn the snag.
            </p>
        </div>
    </div>
  );
};

export default PitmasterAI;
