
import React, { useState } from 'react';
import { Bot, User, Flame, Send, Loader2 } from 'lucide-react';
import { askPitmasterAI } from '../services/gemini';

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

const PitmasterChat: React.FC = () => {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
      { role: 'model', text: "G'day! It's Jay here (well, the digital version of me). I've got the smoker rolling on Ironbark. What can I help you with?" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleChatSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!chatInput.trim()) return;

      const userMsg: ChatMessage = { role: 'user', text: chatInput };
      setChatHistory(prev => [...prev, userMsg]);
      setChatInput('');
      setIsTyping(true);

      const responseText = await askPitmasterAI(
          chatHistory.concat(userMsg).map(m => ({ role: m.role, text: m.text })),
          userMsg.text
      );

      setChatHistory(prev => [...prev, { role: 'model', text: responseText }]);
      setIsTyping(false);
  };

  return (
    <div className="h-[600px] flex flex-col bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-2xl">
        <div className="bg-gray-800 p-4 border-b border-gray-700 flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-bbq-red to-red-900 rounded-full flex items-center justify-center shadow-lg border border-red-500/30">
                <Bot className="text-white" size={24} />
            </div>
            <div>
                <h3 className="font-bold text-white text-lg leading-none">Pitmaster Jay (AI)</h3>
                <p className="text-xs text-bbq-gold font-mono uppercase tracking-widest mt-1">Powered by Ironbark & Jay's Brain</p>
            </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black/20 custom-scrollbar">
            {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl p-4 shadow-md ${msg.role === 'user' ? 'bg-bbq-red text-white rounded-tr-none' : 'bg-gray-800 text-gray-200 border border-gray-700 rounded-tl-none'}`}>
                        <div className="flex items-center gap-2 mb-2 opacity-50 text-[10px] uppercase font-bold tracking-widest">
                            {msg.role === 'user' ? <User size={10}/> : <Flame size={10}/>}
                            {msg.role === 'user' ? 'You' : 'Jay'}
                        </div>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</div>
                    </div>
                </div>
            ))}
            {isTyping && (
                <div className="flex justify-start">
                    <div className="bg-gray-800 text-gray-400 text-xs p-3 rounded-xl border border-gray-700 italic flex items-center gap-2">
                        <Loader2 className="animate-spin" size={12}/> Jay is thinking...
                    </div>
                </div>
            )}
        </div>

        <form onSubmit={handleChatSubmit} className="p-4 bg-gray-800 border-t border-gray-700 flex gap-2">
            <input 
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Ask Jay about brisket temps, resting times, or wood types..."
                className="flex-1 bg-gray-900 border border-gray-600 rounded-xl p-4 text-white focus:border-bbq-red outline-none transition placeholder:text-gray-600"
            />
            <button 
                type="submit" 
                disabled={!chatInput.trim() || isTyping}
                className="bg-bbq-gold text-black p-4 rounded-xl font-bold hover:bg-yellow-500 disabled:opacity-50 transition shadow-lg"
            >
                <Send size={20} />
            </button>
        </form>
    </div>
  );
};

export default PitmasterChat;
