
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Flame, CheckSquare, ClipboardList, Thermometer, Clock, Plus, BookOpen, MessageSquare } from 'lucide-react';
import PitmasterChat from '../../components/PitmasterChat';

// Interfaces for local state
interface TempLog {
  id: string;
  time: string;
  smokerTemp: string;
  meatTemp: string;
  note: string;
}

// Standard Recipes Data
const RECIPES = [
    {
        id: 'r1',
        title: 'Central Texas Brisket',
        type: 'BEEF',
        pitTemp: '250°F - 275°F',
        targetTemp: '203°F',
        wood: 'Ironbark',
        method: [
            'Trim hard fat to 1/4 inch. Remove silver skin.',
            'Rub heavily with 50/50 Salt & Pepper (16 mesh).',
            'Smoke at 275°F until bark sets (approx 165°F internal).',
            'Wrap in pink butcher paper with tallow.',
            'Continue cooking until probe tender (approx 203°F).',
            'Rest in cooler for minimum 2-4 hours before slicing.'
        ]
    },
    {
        id: 'r2',
        title: 'Pulled Pork Shoulder',
        type: 'PORK',
        pitTemp: '275°F',
        targetTemp: '205°F',
        wood: 'Ironbark/Fruit Mix',
        method: [
            'Score fat cap in diamond pattern.',
            'Apply binder (mustard) and Your Business Pork Rub.',
            'Smoke for 5-6 hours until bark is dark mahogany.',
            'Spritz with Apple Cider Vinegar every hour after mark sets.',
            'Wrap in foil at 165°F if bark is too dark, otherwise power through.',
            'Pull at 205°F when bone wiggles loose. Rest 1 hour.'
        ]
    },
    {
        id: 'r3',
        title: 'St. Louis Ribs',
        type: 'PORK',
        pitTemp: '275°F',
        targetTemp: 'Bend Test',
        wood: 'Ironbark/Cherry',
        method: [
            'Remove membrane from back of ribs.',
            'Season generously with sweet rub.',
            'Smoke for 3 hours un-wrapped.',
            'Wrap with butter, brown sugar, and honey for 1.5 - 2 hours.',
            'Unwrap and glaze with BBQ sauce for final 30 mins to tack up.',
            'Done when rack bends significantly when held by one end.'
        ]
    },
    {
        id: 'r4',
        title: 'Dino Beef Ribs',
        type: 'BEEF',
        pitTemp: '285°F',
        targetTemp: '203°F',
        wood: 'Ironbark',
        method: [
            'Remove heavy membrane/silver skin from top side only.',
            'Heavy SPG (Salt, Pepper, Garlic) Rub.',
            'Smoke un-wrapped the entire time (approx 6-8 hours).',
            'Spritz with water/worcestershire mix if looking dry.',
            'Probe for tenderness between bones (like butter).',
            'Rest for 1 hour minimum.'
        ]
    }
];

const Pitmaster: React.FC = () => {
  const { orders, calendarEvents } = useApp();
  const [activeTab, setActiveTab] = useState<'live' | 'recipes' | 'ai'>('live');
  
  // -- Meat Math Logic --
  const nextCookEvent = calendarEvents
    .filter(e => e.type === 'ORDER_PICKUP' && new Date(e.date) >= new Date(new Date().setHours(0,0,0,0)))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

  const cookDate = nextCookEvent ? nextCookEvent.date : new Date().toISOString().split('T')[0];

  const activeOrders = orders.filter(o => 
    o.cookDay.split('T')[0] === cookDate && 
    ['Pending', 'Paid', 'Confirmed', 'Cooking', 'Awaiting Payment'].includes(o.status)
  );

  const totals: Record<string, { qty: number, unit?: string }> = {};
  activeOrders.forEach(order => {
      order.items.forEach(line => {
          const key = line.item.name + (line.selectedOption ? ` (${line.selectedOption})` : '');
          if (!totals[key]) {
              totals[key] = { qty: 0, unit: line.item.unit };
          }
          totals[key].qty += line.quantity;
      });
  });

  // -- Run Sheet Logic --
  const defaultTasks = [
      { id: 't1', time: '04:00 AM', task: 'Fire Up Pit (Target 275°F)', done: false },
      { id: 't2', time: '05:00 AM', task: 'Trim & Rub Briskets', done: false },
      { id: 't3', time: '06:00 AM', task: 'Meat On', done: false },
      { id: 't4', time: '09:00 AM', task: 'Spritz / Check Bark', done: false },
      { id: 't5', time: '11:00 AM', task: 'Wrap Briskets (Paper)', done: false },
      { id: 't6', time: '02:00 PM', task: 'Pull & Rest (Cooler)', done: false },
      { id: 't7', time: '04:30 PM', task: 'Slice for Service', done: false },
  ];
  const [tasks, setTasks] = useState(defaultTasks);

  const toggleTask = (id: string) => {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  // -- Temp Log Logic --
  const [logs, setLogs] = useState<TempLog[]>([]);
  const [newLog, setNewLog] = useState({ smoker: '', meat: '', note: '' });

  const addLog = () => {
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLogs([{ id: Date.now().toString(), time: now, smokerTemp: newLog.smoker, meatTemp: newLog.meat, note: newLog.note }, ...logs]);
      setNewLog({ smoker: '', meat: '', note: '' });
  };

  return (
    <div className="space-y-6 animate-in fade-in">
        
        {/* Sub Navigation */}
        <div className="flex space-x-2 border-b border-gray-700 pb-2">
            <button 
                onClick={() => setActiveTab('live')}
                className={`px-4 py-2 rounded-t-lg font-bold flex items-center gap-2 ${activeTab === 'live' ? 'bg-bbq-red text-white' : 'bg-transparent text-gray-400 hover:text-white'}`}
            >
                <Flame size={18} /> Live Ops
            </button>
            <button 
                onClick={() => setActiveTab('recipes')}
                className={`px-4 py-2 rounded-t-lg font-bold flex items-center gap-2 ${activeTab === 'recipes' ? 'bg-bbq-red text-white' : 'bg-transparent text-gray-400 hover:text-white'}`}
            >
                <BookOpen size={18} /> Recipe Book
            </button>
            <button 
                onClick={() => setActiveTab('ai')}
                className={`px-4 py-2 rounded-t-lg font-bold flex items-center gap-2 ${activeTab === 'ai' ? 'bg-bbq-red text-white' : 'bg-transparent text-gray-400 hover:text-white'}`}
            >
                <MessageSquare size={18} /> Ask Jay
            </button>
        </div>

        {/* --- VIEW: LIVE OPS --- */}
        {activeTab === 'live' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in slide-in-from-left-4">
                {/* Left Col: Meat Math & Run Sheet */}
                <div className="space-y-6">
                    {/* Meat Math Card */}
                    <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
                        <div className="flex items-center gap-3 mb-4 border-b border-gray-800 pb-4">
                            <ClipboardList className="text-bbq-gold" />
                            <div>
                                <h3 className="text-xl font-bold text-white">Meat Math</h3>
                                <p className="text-sm text-gray-400">Prep totals for {new Date(cookDate).toLocaleDateString()}</p>
                            </div>
                        </div>
                        
                        {Object.keys(totals).length === 0 ? (
                            <div className="text-gray-500 italic text-center py-4">No active orders for this date.</div>
                        ) : (
                            <div className="space-y-2">
                                {Object.entries(totals).map(([name, data]) => (
                                    <div key={name} className="flex justify-between items-center bg-black/20 p-3 rounded border border-gray-800">
                                        <span className="font-bold text-gray-300">{name}</span>
                                        <span className="text-bbq-red font-mono font-bold text-lg">
                                            {data.qty} <span className="text-xs text-gray-500">{data.unit || 'x'}</span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Run Sheet */}
                    <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
                        <div className="flex items-center gap-3 mb-4 border-b border-gray-800 pb-4">
                            <CheckSquare className="text-green-500" />
                            <h3 className="text-xl font-bold text-white">Run Sheet</h3>
                        </div>
                        <div className="space-y-3">
                            {tasks.map(task => (
                                <div key={task.id} 
                                    onClick={() => toggleTask(task.id)}
                                    className={`flex items-center gap-4 p-3 rounded border cursor-pointer transition ${task.done ? 'bg-green-900/20 border-green-900 opacity-50' : 'bg-black/20 border-gray-800 hover:border-gray-600'}`}
                                >
                                    <div className={`w-6 h-6 rounded border flex items-center justify-center ${task.done ? 'bg-green-500 border-green-500' : 'border-gray-600'}`}>
                                        {task.done && <CheckSquare size={14} className="text-white"/>}
                                    </div>
                                    <div className="flex-1">
                                        <div className={`font-bold ${task.done ? 'line-through text-gray-500' : 'text-white'}`}>{task.task}</div>
                                    </div>
                                    <div className="text-xs font-mono text-bbq-gold bg-black/40 px-2 py-1 rounded">
                                        {task.time}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Col: Temp Log */}
                <div className="space-y-6">
                    <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 h-full flex flex-col">
                        <div className="flex items-center gap-3 mb-4 border-b border-gray-800 pb-4">
                            <Thermometer className="text-red-500" />
                            <h3 className="text-xl font-bold text-white">Pit Log</h3>
                        </div>

                        {/* Input Area */}
                        <div className="bg-black/30 p-4 rounded-lg border border-gray-800 mb-6">
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="text-xs text-gray-500 font-bold uppercase mb-1 block">Pit Temp (°F)</label>
                                    <input 
                                        type="number" 
                                        placeholder="275"
                                        value={newLog.smoker}
                                        onChange={e => setNewLog({...newLog, smoker: e.target.value})}
                                        className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white font-mono text-lg"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 font-bold uppercase mb-1 block">Meat Temp (°F)</label>
                                    <input 
                                        type="number" 
                                        placeholder="165"
                                        value={newLog.meat}
                                        onChange={e => setNewLog({...newLog, meat: e.target.value})}
                                        className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white font-mono text-lg"
                                    />
                                </div>
                            </div>
                            <div className="mb-4">
                                <label className="text-xs text-gray-500 font-bold uppercase mb-1 block">Notes</label>
                                <input 
                                    placeholder="Added splits, wrapped, spritzed..."
                                    value={newLog.note}
                                    onChange={e => setNewLog({...newLog, note: e.target.value})}
                                    className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-sm"
                                />
                            </div>
                            <button 
                                onClick={addLog}
                                disabled={!newLog.smoker && !newLog.meat}
                                className="w-full bg-bbq-red text-white font-bold py-3 rounded hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <Plus size={18} /> Add Log Entry
                            </button>
                        </div>

                        {/* Logs List */}
                        <div className="flex-1 overflow-y-auto space-y-2 max-h-[500px] custom-scrollbar pr-2">
                            {logs.length === 0 ? (
                                <div className="text-center text-gray-600 py-10">
                                    <Clock size={48} className="mx-auto mb-2 opacity-20"/>
                                    <p>No logs recorded yet today.</p>
                                </div>
                            ) : (
                                logs.map(log => (
                                    <div key={log.id} className="flex items-center gap-4 bg-gray-800/50 p-3 rounded border border-gray-700">
                                        <div className="text-xs font-mono text-gray-400 w-16 text-center border-r border-gray-700 pr-2">
                                            {log.time}
                                        </div>
                                        <div className="flex-1 grid grid-cols-2 gap-2">
                                            <div className="text-sm">
                                                <span className="text-gray-500 text-xs uppercase mr-2">Pit</span>
                                                <span className="text-red-400 font-bold font-mono">{log.smokerTemp}°F</span>
                                            </div>
                                            <div className="text-sm">
                                                <span className="text-gray-500 text-xs uppercase mr-2">Meat</span>
                                                <span className="text-blue-400 font-bold font-mono">{log.meatTemp}°F</span>
                                            </div>
                                        </div>
                                        {log.note && (
                                            <div className="text-xs text-gray-300 italic border-l border-gray-700 pl-3 max-w-[150px] truncate">
                                                {log.note}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* --- VIEW: RECIPE BOOK --- */}
        {activeTab === 'recipes' && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-right-4">
                 {RECIPES.map(recipe => (
                     <div key={recipe.id} className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden hover:border-gray-500 transition shadow-lg">
                         <div className="bg-gray-800 p-4 border-b border-gray-700 flex justify-between items-center">
                             <h3 className="font-bold text-white text-lg">{recipe.title}</h3>
                             <span className={`text-xs font-bold px-2 py-1 rounded ${recipe.type === 'BEEF' ? 'bg-red-900 text-red-200' : 'bg-pink-900 text-pink-200'}`}>
                                 {recipe.type}
                             </span>
                         </div>
                         <div className="p-4 grid grid-cols-3 gap-2 border-b border-gray-800">
                             <div className="text-center">
                                 <div className="text-xs text-gray-500 uppercase font-bold">Pit Temp</div>
                                 <div className="text-bbq-gold font-bold font-mono">{recipe.pitTemp}</div>
                             </div>
                             <div className="text-center border-l border-gray-800">
                                 <div className="text-xs text-gray-500 uppercase font-bold">Target</div>
                                 <div className="text-red-400 font-bold font-mono">{recipe.targetTemp}</div>
                             </div>
                             <div className="text-center border-l border-gray-800">
                                 <div className="text-xs text-gray-500 uppercase font-bold">Wood</div>
                                 <div className="text-gray-300 font-bold">{recipe.wood}</div>
                             </div>
                         </div>
                         <div className="p-4 bg-black/20">
                             <h4 className="text-xs text-gray-500 uppercase font-bold mb-2">Method</h4>
                             <ul className="list-disc list-inside space-y-1 text-sm text-gray-300">
                                 {recipe.method.map((step, i) => (
                                     <li key={i}>{step}</li>
                                 ))}
                             </ul>
                         </div>
                     </div>
                 ))}
             </div>
        )}

        {/* --- VIEW: AI ASSISTANT --- */}
        {activeTab === 'ai' && (
            <div className="animate-in zoom-in-95">
                <PitmasterChat />
            </div>
        )}
    </div>
  );
};

export default Pitmaster;
