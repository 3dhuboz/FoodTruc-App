
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../components/Toast';
import { ChevronLeft, ChevronRight, Lock, Unlock, ShoppingBag, Truck, Plus, Trash2, X, Save, Wand2, Image as ImageIcon, Loader2 } from 'lucide-react';
import { CalendarEvent } from '../../types';
import { generateMarketingImage, generateEventPromotion } from '../../services/gemini';

const Planner: React.FC = () => {
  const { calendarEvents, addCalendarEvent, updateCalendarEvent, removeCalendarEvent } = useApp();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingText, setIsGeneratingText] = useState(false);
  const [tagInput, setTagInput] = useState('');

  const [editingEvent, setEditingEvent] = useState<Partial<CalendarEvent>>({
      type: 'BLOCKED',
      title: '',
      location: '',
      time: '',
      startTime: '',
      endTime: '',
      description: '',
      image: '',
      tags: [],
      date: new Date().toISOString().split('T')[0]
  });

  // Calendar Logic
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    
    const days = [];
    // Add empty slots for previous month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null);
    }
    // Add actual days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const changeMonth = (offset: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  const openAddModal = (dateStr?: string) => {
      setEditingEvent({
          id: undefined, // New event
          type: 'BLOCKED',
          title: '',
          location: '',
          time: '',
          startTime: '14:00',
          endTime: '16:00',
          description: '',
          image: '',
          tags: [],
          date: dateStr || new Date().toISOString().split('T')[0]
      });
      setIsModalOpen(true);
  };

  const openEditModal = (event: CalendarEvent, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingEvent({ ...event });
      setIsModalOpen(true);
  };

  const handleSaveEvent = () => {
      if (!editingEvent.title || !editingEvent.date) return;

      if (editingEvent.id) {
          updateCalendarEvent(editingEvent as CalendarEvent);
          toast('Event updated!');
      } else {
          addCalendarEvent({
              ...editingEvent,
              id: `evt_${Date.now()}`
          } as CalendarEvent);
          toast('Event created!');
      }
      setIsModalOpen(false);
  };

  const handleDeleteEvent = () => {
      if (editingEvent.id && window.confirm("Delete this event?")) {
          removeCalendarEvent(editingEvent.id);
          toast('Event deleted.');
          setIsModalOpen(false);
      }
  };

  const handleGenerateImage = async () => {
      if (!editingEvent.title) {
          toast('Please enter a title first.', 'warning');
          return;
      }
      setIsGeneratingImage(true);
      const prompt = `BBQ food event: ${editingEvent.title}. ${editingEvent.description || ''}. Crowd, food truck, delicious smoked meat.`;
      const base64 = await generateMarketingImage(prompt);
      if (base64) {
          setEditingEvent(prev => ({ ...prev, image: base64 }));
      }
      setIsGeneratingImage(false);
  };

  const handleGenerateText = async () => {
      if (!editingEvent.title || !editingEvent.location || !editingEvent.time) {
           toast('Please enter Title, Location, and Time first.', 'warning');
           return;
      }
      setIsGeneratingText(true);
      const result = await generateEventPromotion(editingEvent.title, editingEvent.location, editingEvent.time);
      setEditingEvent(prev => ({ 
          ...prev, 
          description: result.description, 
          tags: result.tags 
      }));
      setIsGeneratingText(false);
  };

  const addTag = () => {
      if (tagInput && !editingEvent.tags?.includes(tagInput)) {
          setEditingEvent(prev => ({
              ...prev,
              tags: [...(prev.tags || []), tagInput]
          }));
          setTagInput('');
      }
  };

  const removeTag = (tag: string) => {
      setEditingEvent(prev => ({
          ...prev,
          tags: prev.tags?.filter(t => t !== tag)
      }));
  };

  const days = getDaysInMonth(currentDate);
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6 animate-in fade-in relative">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-gray-700 pb-4">
        <div>
          <h3 className="text-2xl font-bold text-white">Planner & Availability</h3>
          <p className="text-gray-400">Manage bookings and block out dates.</p>
        </div>
        <div className="flex gap-4 items-center">
            <button 
                onClick={() => openAddModal()}
                className="bg-bbq-red px-3 py-1.5 rounded text-sm font-bold flex items-center gap-1 hover:bg-red-700"
            >
                <Plus size={14}/> Add Event
            </button>
        </div>
      </div>
      
       <div className="flex items-center gap-4 text-xs bg-gray-900/50 p-2 rounded">
            <div className="flex items-center gap-1"><span className="w-3 h-3 bg-red-900 rounded-full border border-red-500"></span> Blocked</div>
            <div className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-900 rounded-full border border-blue-500"></span> Orders</div>
            <div className="flex items-center gap-1"><span className="w-3 h-3 bg-green-900 rounded-full border border-green-500"></span> Events</div>
      </div>

      {/* Calendar Controls */}
      <div className="flex justify-between items-center bg-gray-900 p-4 rounded-t-xl border border-gray-800">
        <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-gray-800 rounded"><ChevronLeft /></button>
        <h2 className="text-xl font-bold font-display uppercase tracking-wide">{monthName}</h2>
        <button onClick={() => changeMonth(1)} className="p-2 hover:bg-gray-800 rounded"><ChevronRight /></button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-px bg-gray-800 border border-gray-800 rounded-b-xl overflow-hidden">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="bg-gray-900 p-4 text-center text-sm font-bold text-gray-500 uppercase">{day}</div>
        ))}
        
        {days.map((date, idx) => {
          if (!date) return <div key={`empty-${idx}`} className="bg-bbq-charcoal/50 min-h-[120px]"></div>;
          
          const dateStr = date.toISOString().split('T')[0];
          const events = calendarEvents.filter(e => e.date === dateStr);
          const isBlocked = events.some(e => e.type === 'BLOCKED');
          const isPast = date < new Date(new Date().setHours(0,0,0,0));

          return (
            <div 
              key={dateStr} 
              className={`min-h-[120px] p-2 bg-bbq-charcoal transition relative group ${isBlocked ? 'bg-stripes-gray' : 'hover:bg-gray-700'}`}
              onClick={() => !isPast && openAddModal(dateStr)}
            >
              <div className="flex justify-between items-start mb-2">
                <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full ${date.toDateString() === new Date().toDateString() ? 'bg-bbq-red text-white' : 'text-gray-400'}`}>
                  {date.getDate()}
                </span>
                {!isPast && (
                  <button className="text-gray-600 hover:text-white opacity-0 group-hover:opacity-100 transition">
                    <Plus size={14} />
                  </button>
                )}
              </div>

              <div className="space-y-1">
                {events.map(evt => (
                  <div 
                    key={evt.id} 
                    onClick={(e) => openEditModal(evt, e)}
                    className={`text-xs p-1 rounded truncate border-l-2 cursor-pointer hover:brightness-110 ${
                      evt.type === 'BLOCKED' ? 'bg-red-900/40 border-red-500 text-red-200' :
                      evt.type === 'ORDER_PICKUP' ? 'bg-blue-900/40 border-blue-500 text-blue-200' :
                      'bg-green-900/40 border-green-500 text-green-200'
                    }`}
                    title={evt.title}
                  >
                    {evt.type === 'ORDER_PICKUP' && <ShoppingBag size={10} className="inline mr-1"/>}
                    {evt.type === 'PUBLIC_EVENT' && <Truck size={10} className="inline mr-1"/>}
                    {evt.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* EVENT MODAL */}
      {isModalOpen && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
              <div className="bg-bbq-charcoal border border-gray-700 rounded-xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar">
                  <div className="flex justify-between items-center p-4 border-b border-gray-700 sticky top-0 bg-bbq-charcoal z-10">
                      <h3 className="text-lg font-bold text-white">{editingEvent.id ? 'Edit Event' : 'Add Planner Event'}</h3>
                      <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20}/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-gray-400 font-bold mb-1">Date</label>
                            <input 
                                type="date"
                                value={editingEvent.date}
                                onChange={e => setEditingEvent({...editingEvent, date: e.target.value})}
                                className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 font-bold mb-1">Event Type</label>
                            <select
                                value={editingEvent.type}
                                onChange={e => setEditingEvent({...editingEvent, type: e.target.value as any})}
                                className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white"
                            >
                                <option value="BLOCKED">Blocked / Closed</option>
                                <option value="PUBLIC_EVENT">Public Event / Pop-up</option>
                                <option value="ORDER_PICKUP">Cook Day (Orders)</option>
                            </select>
                        </div>
                      </div>
                      
                      <div>
                          <label className="block text-xs text-gray-400 font-bold mb-1">Title</label>
                          <input 
                            value={editingEvent.title}
                            onChange={e => setEditingEvent({...editingEvent, title: e.target.value})}
                            placeholder="e.g. Friday Cook Up"
                            className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white"
                          />
                      </div>

                      {/* Cook Day Config */}
                      {editingEvent.type === 'ORDER_PICKUP' && (
                          <div className="bg-blue-900/20 p-4 rounded-lg border border-blue-800 space-y-4">
                              <h4 className="text-sm font-bold text-blue-200">Collection Window</h4>
                              <div className="grid grid-cols-2 gap-4">
                                  <div>
                                      <label className="block text-xs text-gray-400 font-bold mb-1">Start Time</label>
                                      <input 
                                          type="time"
                                          value={editingEvent.startTime}
                                          onChange={e => setEditingEvent({...editingEvent, startTime: e.target.value})}
                                          className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white"
                                      />
                                  </div>
                                  <div>
                                      <label className="block text-xs text-gray-400 font-bold mb-1">End Time</label>
                                      <input 
                                          type="time"
                                          value={editingEvent.endTime}
                                          onChange={e => setEditingEvent({...editingEvent, endTime: e.target.value})}
                                          className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white"
                                      />
                                  </div>
                              </div>
                              
                              <div>
                                  <label className="block text-xs text-gray-400 font-bold mb-1">Location</label>
                                  <input 
                                      value={editingEvent.location || ''}
                                      onChange={e => setEditingEvent({...editingEvent, location: e.target.value})}
                                      placeholder="e.g. West End HQ"
                                      className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white"
                                  />
                              </div>
                          </div>
                      )}

                      {editingEvent.type === 'PUBLIC_EVENT' && (
                        <div className="space-y-4 pt-2 border-t border-gray-700 animate-in fade-in">
                             <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-gray-400 font-bold mb-1">Location</label>
                                    <input 
                                        value={editingEvent.location || ''}
                                        onChange={e => setEditingEvent({...editingEvent, location: e.target.value})}
                                        placeholder="e.g. Green Beacon"
                                        className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400 font-bold mb-1">Display Time</label>
                                    <input 
                                        value={editingEvent.time || ''}
                                        onChange={e => setEditingEvent({...editingEvent, time: e.target.value})}
                                        placeholder="e.g. 12pm - 8pm"
                                        className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white"
                                    />
                                </div>
                             </div>

                             {/* IMAGE SECTION */}
                             <div>
                                 <label className="block text-xs text-gray-400 font-bold mb-1">Event Image</label>
                                 <div className="flex gap-2 mb-2">
                                     <input 
                                         value={editingEvent.image || ''}
                                         onChange={e => setEditingEvent({...editingEvent, image: e.target.value})}
                                         placeholder="Image URL"
                                         className="flex-1 bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm"
                                     />
                                     <button 
                                        onClick={handleGenerateImage}
                                        disabled={isGeneratingImage}
                                        className="bg-bbq-charcoal border border-gray-600 text-gray-300 hover:text-white px-3 rounded flex items-center justify-center"
                                        title="Generate Image with AI"
                                     >
                                         {isGeneratingImage ? <Loader2 className="animate-spin" size={16}/> : <ImageIcon size={16}/>}
                                     </button>
                                 </div>
                                 {editingEvent.image && (
                                     <div className="w-full h-32 rounded-lg overflow-hidden border border-gray-700 relative group">
                                         <img src={editingEvent.image} alt="Preview" className="w-full h-full object-cover"/>
                                         <button 
                                            onClick={() => setEditingEvent({...editingEvent, image: ''})}
                                            className="absolute top-2 right-2 bg-black/60 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition"
                                         >
                                             <X size={12}/>
                                         </button>
                                     </div>
                                 )}
                             </div>

                             {/* DESCRIPTION SECTION */}
                             <div>
                                <div className="flex justify-between items-end mb-1">
                                    <label className="block text-xs text-gray-400 font-bold">Public Description</label>
                                    <button 
                                        onClick={handleGenerateText}
                                        disabled={isGeneratingText}
                                        className="text-[10px] bg-bbq-gold text-black px-2 py-1 rounded font-bold flex items-center gap-1 hover:bg-yellow-500 disabled:opacity-50"
                                    >
                                        {isGeneratingText ? <Loader2 className="animate-spin" size={10}/> : <Wand2 size={10}/>} Auto-Write
                                    </button>
                                </div>
                                <textarea
                                    value={editingEvent.description || ''}
                                    onChange={e => setEditingEvent({...editingEvent, description: e.target.value})}
                                    placeholder="Promotional details..."
                                    className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm"
                                    rows={3}
                                />
                             </div>
                             
                             {/* TAGS SECTION */}
                             <div>
                                 <label className="block text-xs text-gray-400 font-bold mb-1">Tags (Hashtags)</label>
                                 <div className="flex gap-2 mb-2">
                                     <input 
                                         value={tagInput}
                                         onChange={e => setTagInput(e.target.value)}
                                         onKeyDown={e => e.key === 'Enter' && addTag()}
                                         placeholder="Add tag..."
                                         className="flex-1 bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm"
                                     />
                                     <button onClick={addTag} className="bg-gray-700 px-3 rounded text-white hover:bg-gray-600"><Plus size={16}/></button>
                                 </div>
                                 <div className="flex flex-wrap gap-2">
                                     {editingEvent.tags?.map(tag => (
                                         <span key={tag} className="bg-blue-900/40 text-blue-200 text-xs px-2 py-1 rounded flex items-center gap-1">
                                             {tag} <button onClick={() => removeTag(tag)} className="hover:text-white"><X size={10}/></button>
                                         </span>
                                     ))}
                                 </div>
                             </div>
                        </div>
                      )}
                      
                      <div className="flex justify-between items-center pt-4 border-t border-gray-700 mt-2">
                           {editingEvent.id ? (
                               <button onClick={handleDeleteEvent} className="text-red-500 hover:text-red-400 text-sm flex items-center gap-1">
                                   <Trash2 size={16}/> Delete
                               </button>
                           ) : (
                               <div></div>
                           )}
                           <div className="flex gap-2">
                               <button onClick={() => setIsModalOpen(false)} className="px-3 py-2 text-gray-300 hover:text-white text-sm">Cancel</button>
                               <button onClick={handleSaveEvent} className="px-4 py-2 bg-bbq-red rounded text-white font-bold text-sm flex items-center gap-2">
                                   <Save size={16}/> Save
                               </button>
                           </div>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Planner;
