
import React from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/Toast';
import { Calendar, MapPin, Clock, Share2, Bell, Check, BellOff, Megaphone, Utensils, Star, Flame, Coffee } from 'lucide-react';
import { Link } from 'react-router-dom';

const Events: React.FC = () => {
  const { calendarEvents, toggleReminder, reminders, settings } = useApp();
  const { toast } = useToast();

  const publicEvents = calendarEvents
    .filter(evt => evt.type === 'PUBLIC_EVENT' && new Date(evt.date) >= new Date(new Date().setHours(0,0,0,0)))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const handleShare = (evt: any) => {
    if (navigator.share) {
      navigator.share({
        title: `Your Business: ${evt.title}`,
        text: `Catch Your Business at ${evt.location} on ${new Date(evt.date).toLocaleDateString()}!`,
        url: window.location.href
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast('Link copied to clipboard!');
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-700 pb-20">
      
      {/* Header */}
      <div className="relative h-[40vh] min-h-[300px] rounded-2xl overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-black/60 z-10" />
          <img
            src={settings.eventsHeroImage || "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1950&q=80"}
            className="absolute inset-0 w-full h-full object-cover"
            alt="BBQ Event Crowd"
          />
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center p-6">
            <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-2 tracking-tight uppercase">
              Catch Us <span className="text-bbq-red">Live</span>
            </h1>
            <p className="text-gray-200 max-w-xl font-light text-lg">
              Pop-ups, brewery takeovers, and festivals. Follow the smoke.
            </p>
          </div>
      </div>

      {/* Events List */}
      <div className="max-w-4xl mx-auto space-y-8">
        <h2 className="text-2xl font-display font-bold border-b border-gray-800 pb-2 mb-4">Upcoming Locations</h2>
        {publicEvents.length === 0 ? (
          <div className="text-center py-20 bg-bbq-charcoal rounded-2xl border border-gray-800">
             <Calendar size={48} className="mx-auto text-gray-600 mb-4" />
             <h3 className="text-2xl font-bold text-white mb-2">No Upcoming Events</h3>
             <p className="text-gray-400">Check back soon or follow us on Instagram for last minute drops!</p>
          </div>
        ) : (
          publicEvents.map(evt => {
            const isReminded = reminders.includes(evt.id);

            return (
              <div key={evt.id} className="bg-bbq-charcoal border border-gray-800 rounded-2xl overflow-hidden hover:border-bbq-red/50 transition duration-300 flex flex-col md:flex-row group">
                  {/* Date Block (Mobile) */}
                  <div className="md:hidden bg-bbq-red text-white p-4 text-center">
                      <div className="text-sm font-bold uppercase">{new Date(evt.date).toLocaleDateString(undefined, {month:'long'})}</div>
                      <div className="text-3xl font-display font-bold">{new Date(evt.date).getDate()}</div>
                  </div>

                  {/* Image */}
                  <div className="w-full md:w-1/3 h-64 md:h-auto relative overflow-hidden">
                      <img src={evt.image || "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80"} alt={evt.title} className="w-full h-full object-cover group-hover:scale-110 transition duration-700" />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition"></div>
                  </div>

                  {/* Content */}
                  <div className="p-6 md:p-8 flex-1 flex flex-col justify-center">
                      <div className="hidden md:block text-bbq-red font-bold uppercase tracking-widest text-sm mb-2">
                          {new Date(evt.date).toLocaleDateString(undefined, {weekday: 'long', month: 'long', day: 'numeric'})}
                      </div>
                      
                      <h2 className="text-3xl font-display font-bold text-white mb-4 group-hover:text-bbq-gold transition">{evt.title}</h2>
                      
                      <div className="space-y-3 mb-6">
                          <div className="flex items-center gap-3 text-gray-300">
                              <MapPin className="text-bbq-red" size={20} />
                              <span className="text-lg">{evt.location}</span>
                          </div>
                          <div className="flex items-center gap-3 text-gray-400">
                              <Clock size={20} />
                              <span>{evt.time}</span>
                          </div>
                      </div>

                      <p className="text-gray-400 mb-6 line-clamp-2">{evt.description}</p>

                      <div className="flex gap-4 mt-auto">
                          <button 
                              onClick={() => toggleReminder(evt.id)}
                              className={`px-6 py-3 rounded-lg font-bold transition flex items-center gap-2 ${isReminded ? 'bg-green-600 text-white hover:bg-green-500' : 'bg-white text-black hover:bg-gray-200'}`}
                          >
                            {isReminded ? (
                                <><Check size={18}/> Reminder Set</>
                            ) : (
                                <><Bell size={18}/> Remind Me</>
                            )}
                          </button>
                          <button onClick={() => handleShare(evt)} className="p-3 border border-gray-600 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition">
                              <Share2 size={20} />
                          </button>
                      </div>
                      {isReminded && (
                          <div className="mt-3 text-xs text-green-400 flex items-center gap-1 animate-pulse">
                              <Check size={12}/> We'll notify you on this device.
                          </div>
                      )}
                      <div className="mt-4 text-xs text-gray-500 italic">
                          * Pre-ordering not available for events. Walk-ups only until sold out!
                      </div>
                  </div>
              </div>
            );
          })
        )}
      </div>

      {/* --- PROMOTER / HIRE US SECTION --- */}
      <div className="border-t border-gray-800 pt-12 mt-12 bg-black/30 -mx-4 px-4 md:-mx-8 md:px-8 pb-12">
          <div className="max-w-6xl mx-auto">
              <div className="text-center mb-10">
                  <div className="inline-block bg-bbq-red text-white text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full mb-3">
                      Attention Promoters
                  </div>
                  <h2 className="text-4xl md:text-5xl font-display font-bold text-white uppercase">
                      Want Your Business at <span className="text-bbq-gold">Your Event?</span>
                  </h2>
                  <p className="text-gray-400 max-w-2xl mx-auto mt-4 text-lg">
                      From the "Strumming Bird Festival" to the "Flame BBQ Festival", our pitmasters bring the aroma, the theatre, and the flavour that draws a crowd.
                  </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* CARD 1: BREAKFAST */}
                  <div className="bg-bbq-charcoal p-6 rounded-2xl border border-gray-700 hover:border-bbq-gold transition duration-300 group">
                      <div className="bg-yellow-900/30 w-12 h-12 rounded-full flex items-center justify-center text-yellow-500 mb-4 group-hover:bg-yellow-500 group-hover:text-black transition">
                          <Coffee size={24} />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">The Morning Cure</h3>
                      <p className="text-gray-400 text-sm leading-relaxed mb-4">
                          We bring smoky flavour to mornings. Our <span className="text-white font-bold">Loaded BBQ Breakfast</span> features potato gems topped with cheese, smoked meat, egg, bacon & smoky BBQ sauce.
                      </p>
                      <div className="text-xs font-bold text-yellow-500 uppercase tracking-widest">
                          Starts the day right
                      </div>
                  </div>

                  {/* CARD 2: SIGNATURE MEATS */}
                  <div className="bg-bbq-charcoal p-6 rounded-2xl border border-gray-700 hover:border-bbq-red transition duration-300 group relative overflow-hidden">
                      <div className="bg-red-900/30 w-12 h-12 rounded-full flex items-center justify-center text-red-500 mb-4 group-hover:bg-red-600 group-hover:text-white transition relative z-10">
                          <Flame size={24} />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2 relative z-10">Crowd Favourites</h3>
                      <p className="text-gray-400 text-sm leading-relaxed mb-4 relative z-10">
                          Juicy pulled pork, fall-off-the-bone ribs, <span className="text-white font-bold">The Smokey Hog</span>, and our famous <span className="text-white font-bold">Pork Belly Lollipops</span>. Real wood smoke, authentic flavour.
                      </p>
                      <div className="text-xs font-bold text-red-500 uppercase tracking-widest relative z-10">
                          #1 BBQ At Events
                      </div>
                  </div>

                  {/* CARD 3: VIBE & SIDES */}
                  <div className="bg-bbq-charcoal p-6 rounded-2xl border border-gray-700 hover:border-blue-500 transition duration-300 group">
                      <div className="bg-blue-900/30 w-12 h-12 rounded-full flex items-center justify-center text-blue-400 mb-4 group-hover:bg-blue-500 group-hover:text-white transition">
                          <Megaphone size={24} />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">The Full Experience</h3>
                      <p className="text-gray-400 text-sm leading-relaxed mb-4">
                          We don't just serve food; we create an atmosphere. Cheesy Mac & Cheese, loaded waffle fries, and the sight of fresh-cut brisket keeps the lines moving and the people happy.
                      </p>
                      <div className="text-xs font-bold text-blue-400 uppercase tracking-widest">
                          High Volume Capacity
                      </div>
                  </div>
              </div>

              <div className="mt-10 text-center">
                  <Link 
                    to="/contact" 
                    className="inline-flex items-center gap-3 bg-white text-black font-bold uppercase tracking-widest px-8 py-4 rounded-full hover:bg-gray-200 transition shadow-[0_0_20px_rgba(255,255,255,0.2)] transform hover:-translate-y-1"
                  >
                      <Utensils size={20} /> Book Us For Your Event
                  </Link>
              </div>
          </div>
      </div>

    </div>
  );
};

export default Events;
