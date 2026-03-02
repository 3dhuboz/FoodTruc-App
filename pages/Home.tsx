
import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Truck, ShoppingBag, Facebook, Flame, ChefHat, Utensils, MapPin, Calendar, Star, Megaphone, Music, Ticket, Gift, Bot, MessageSquare, Sparkles } from 'lucide-react';
import { PLACEHOLDER_IMG } from '../constants';

const Home: React.FC = () => {
  const { calendarEvents, settings } = useApp();
  const [liveFbPosts, setLiveFbPosts] = useState<string[]>([]);
  const navigate = useNavigate();
  
  // Filter for next pickup day
  const nextCookEvent = calendarEvents
    .filter(evt => evt.type === 'ORDER_PICKUP' && new Date(evt.date) >= new Date(new Date().setHours(0,0,0,0)))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

  // Calculate pickup date (1 day after the stored cutoff date)
  const pickupDate = nextCookEvent ? (() => {
      const d = new Date(nextCookEvent.date);
      d.setDate(d.getDate() + 1);
      return d;
  })() : null;

  const fallbackImages = [
    "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&w=600&h=600&q=80",
    "https://images.unsplash.com/photo-1623653387945-2fd25214f8fc?auto=format&fit=crop&w=600&h=600&q=80",
    "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&h=600&q=80",
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&h=600&q=80",
    "https://images.unsplash.com/photo-1606131731446-5568d87113aa?auto=format&fit=crop&w=600&h=600&q=80",
    "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&h=600&q=80",
    "https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=600&h=600&q=80",
    "https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?auto=format&fit=crop&w=600&h=600&q=80",
  ];

  // Fetch Live Facebook Page Posts
  useEffect(() => {
    if (!settings.facebookConnected || !settings.facebookPageAccessToken || !settings.facebookPageId) {
        if (settings.manualTickerImages && settings.manualTickerImages.length > 0) {
            setLiveFbPosts(settings.manualTickerImages);
        } else {
            setLiveFbPosts([]);
        }
        return;
    }
    const fetchFacebookFeed = async () => {
        try {
            const res = await fetch(`https://graph.facebook.com/v18.0/${settings.facebookPageId}/posts?fields=full_picture,permalink_url&access_token=${settings.facebookPageAccessToken}&limit=10`);
            const data = await res.json();
            if (!res.ok || data.error) {
                // Token expired or API error — fall back to manual images
                console.warn('Facebook API error, using manual ticker:', data.error?.message);
                if (settings.manualTickerImages?.length > 0) {
                    setLiveFbPosts(settings.manualTickerImages);
                }
                return;
            }
            if (data.data) {
                const images = data.data
                    .filter((item: any) => item.full_picture) 
                    .map((item: any) => item.full_picture);
                if (images.length > 0) {
                    setLiveFbPosts(images);
                } else if (settings.manualTickerImages?.length > 0) {
                    setLiveFbPosts(settings.manualTickerImages);
                }
            }
        } catch (e) {
            console.error('Facebook feed fetch error:', e);
            if (settings.manualTickerImages?.length > 0) {
                setLiveFbPosts(settings.manualTickerImages);
            }
        }
    };
    fetchFacebookFeed();
  }, [settings.facebookConnected, settings.facebookPageAccessToken, settings.facebookPageId, settings.manualTickerImages]);

  const sourceImages = liveFbPosts.length > 0 ? liveFbPosts : fallbackImages;
  let tickerItems = [...sourceImages];
  while (tickerItems.length < 10) { tickerItems = [...tickerItems, ...sourceImages]; }

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.src = PLACEHOLDER_IMG;
  };

  const handleAskJay = () => {
      navigate('/pitmaster-ai');
  };

  return (
    <div className="space-y-16 animate-in fade-in duration-700 relative">
      
      {/* FLOATING PROMOTER BADGE */}
      <Link to="/promoters" className="fixed bottom-24 right-4 z-40 bg-white text-black p-1 pl-4 rounded-full shadow-[0_0_20px_rgba(255,255,255,0.3)] flex items-center gap-3 group hover:scale-105 transition-transform border-2 border-bbq-red md:bottom-8">
          <div className="text-xs font-bold uppercase tracking-tighter leading-none text-right">
              Event<br/>Promoters
          </div>
          <div className="bg-bbq-red text-white p-2 rounded-full group-hover:rotate-12 transition-transform">
              <Megaphone size={18} />
          </div>
      </Link>

      {/* --- REIMAGINED HERO SECTION --- */}
      <section className="flex flex-col lg:flex-row gap-4 pb-2 px-2 lg:h-[88vh] lg:min-h-[700px]">

        {/* LEFT: CATERING HERO (Feast Image) */}
        <Link to="/diy" className="relative flex-1 group overflow-hidden rounded-3xl border border-white/10 shadow-2xl min-h-[500px] lg:min-h-0">
            <div className="absolute inset-0">
               <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-black/80 z-10" />
               <img
                 src={settings.heroCateringImage || "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1200&q=80"}
                 className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                 alt="Catering Feast"
                 onError={handleImageError}
               />
            </div>

            <div className="absolute inset-0 z-20 flex flex-col justify-end p-8 md:p-12 items-start">
                <div className="bg-bbq-gold text-black font-black uppercase tracking-widest text-xs px-4 py-2 rounded-full mb-6 backdrop-blur-sm shadow-[0_0_20px_rgba(251,191,36,0.5)]">
                    Private & Corporate Events
                </div>
                <h2 className="text-5xl md:text-7xl font-display font-bold text-white mb-4 leading-[0.9] drop-shadow-2xl">
                    FEAST <br/> LIKE A <span className="text-transparent bg-clip-text bg-gradient-to-r from-bbq-gold to-yellow-200">KING</span>
                </h2>
                <p className="text-gray-200 text-lg md:text-xl font-medium max-w-md mb-8 leading-relaxed">
                    From backyard birthdays to corporate blowouts. We bring the smoker, the meat, and the vibe to you.
                </p>
                <div className="bg-white text-black font-bold uppercase tracking-widest px-8 py-4 rounded-full flex items-center gap-3 hover:bg-bbq-gold transition-all shadow-xl group-hover:translate-x-2">
                    <ChefHat size={20} /> Build Your Menu <ArrowRight size={18} />
                </div>
            </div>
        </Link>

        {/* RIGHT: NEXT COOK HERO (Smoker Image) */}
        <Link to="/menu" className="relative flex-1 group overflow-hidden rounded-3xl border border-white/10 shadow-2xl min-h-[500px] lg:min-h-0">
             {/* Image Layer */}
            <div className="absolute inset-0">
               <div className="absolute inset-0 bg-gradient-to-t from-bbq-red/40 to-transparent mix-blend-overlay z-10" />
               <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/90 z-20" />
               <img
                 src={settings.heroCookImage || "https://images.unsplash.com/photo-1432139555190-58524dae6a55?auto=format&fit=crop&w=1200&q=80"}
                 className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105 filter contrast-125"
                 alt="Smoker and Brisket"
                 onError={handleImageError}
               />
            </div>

            {/* Content Layer */}
            <div className="absolute inset-0 z-30 flex flex-col justify-end p-8 md:p-12 items-start">
                <div className="flex items-center gap-2 mb-6">
                    <div className="bg-red-600 text-white font-black uppercase tracking-widest text-xs px-4 py-2 rounded-full shadow-[0_0_20px_rgba(220,38,38,0.6)] animate-pulse">
                        Next Pit Fire
                    </div>
                    <Flame className="text-red-500 animate-bounce" fill="currentColor" />
                </div>
                
                <h2 className="text-5xl md:text-7xl font-display font-bold text-white mb-6 leading-[0.9] drop-shadow-2xl">
                    TASTE <br/> THE <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">SMOKE</span>
                </h2>
                
                <div className="w-full bg-black/60 backdrop-blur-md p-6 rounded-2xl border border-white/10 mb-8 transform group-hover:-translate-y-2 transition-transform duration-500">
                    {nextCookEvent && pickupDate ? (
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <span className="text-xs text-gray-400 uppercase font-bold tracking-widest">Next Pickup</span>
                                <div className="text-3xl font-display font-bold text-white">{pickupDate.toLocaleDateString(undefined, {weekday:'long'})}</div>
                                <div className="text-lg text-bbq-gold font-bold">{pickupDate.toLocaleDateString(undefined, {month:'short', day:'numeric'})}</div>
                                <div className="text-[10px] text-red-400 font-bold uppercase mt-1 bg-red-900/30 px-2 py-0.5 rounded inline-block border border-red-900/50">
                                    Order by {new Date(nextCookEvent.date).toLocaleDateString(undefined, {weekday:'short'})} 5pm
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="flex items-center justify-end gap-2 text-red-400 mb-1">
                                    <MapPin size={16}/> <span className="text-xs font-bold uppercase">{nextCookEvent.location}</span>
                                </div>
                                <div className="inline-block bg-white/10 rounded px-2 py-1 text-xs text-gray-300">
                                    Limited Capacity
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 py-2">
                            <Calendar className="text-gray-500" size={24} />
                            <span className="text-gray-300 font-bold">Pit dates announcing soon. Stay tuned!</span>
                        </div>
                    )}
                </div>

                <div className="bg-gradient-to-r from-red-700 to-red-900 text-white font-bold uppercase tracking-widest px-8 py-4 rounded-full flex items-center gap-3 hover:shadow-[0_0_30px_rgba(220,38,38,0.5)] transition-all group-hover:scale-105 w-full md:w-auto justify-center">
                    <ShoppingBag size={20} /> Order Now
                </div>
            </div>
        </Link>
      </section>

      {/* --- AI PITMASTER JAY (REDESIGNED V2 - CHAT PREVIEW) --- */}
      <section className="mx-4">
          <div className="relative rounded-3xl overflow-hidden border border-white/10 group shadow-2xl">
              
              {/* Background */}
              <div className="absolute inset-0 bg-neutral-900"></div>
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1600&q=80')] bg-cover bg-center opacity-20 mix-blend-overlay transition duration-1000 group-hover:scale-105"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-black via-black/90 to-transparent"></div>

              <div className="relative z-10 flex flex-col md:flex-row items-stretch min-h-[400px]">
                  
                  {/* Left: Avatar & Hook */}
                  <div className="flex-1 p-8 md:p-12 flex flex-col justify-center space-y-6">
                      <div className="flex items-center gap-4">
                          <div className="relative">
                              <div className="w-16 h-16 bg-bbq-red rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(220,38,38,0.5)] border-2 border-white/20">
                                  <Bot size={32} className="text-white" />
                              </div>
                              <div className="absolute -bottom-1 -right-1 bg-green-500 w-4 h-4 rounded-full border-2 border-black animate-pulse"></div>
                          </div>
                          <div>
                              <h3 className="text-white font-bold text-xl uppercase tracking-wider">Pitmaster Jay <span className="text-bbq-gold text-xs bg-white/10 px-2 py-0.5 rounded ml-2 align-middle">AI Beta</span></h3>
                              <p className="text-gray-400 text-sm">Online & Ready to Roast</p>
                          </div>
                      </div>

                      <h2 className="text-4xl md:text-5xl font-display font-bold text-white leading-tight">
                          GOT A <span className="text-bbq-red">BRISKET</span> EMERGENCY?
                      </h2>
                      
                      <p className="text-gray-300 text-lg max-w-md leading-relaxed">
                          Don't ruin the roast. Ask Jay about temperatures, wood pairings, resting times, or how to save a dry piece of meat.
                      </p>

                      <div className="pt-4">
                          <button 
                            onClick={handleAskJay}
                            className="bg-white text-black font-black uppercase tracking-widest px-8 py-4 rounded-full flex items-center gap-3 hover:bg-bbq-gold transition-all shadow-[0_0_25px_rgba(255,255,255,0.2)] group-hover:translate-x-2"
                          >
                              <MessageSquare size={20} className="fill-current"/> Ask Jay A Question
                          </button>
                      </div>
                  </div>

                  {/* Right: Chat Preview (Visual) */}
                  <div className="flex-1 bg-white/5 backdrop-blur-sm border-l border-white/5 p-8 flex flex-col justify-center relative overflow-hidden">
                      {/* Decorative Code/Data Elements */}
                      <div className="absolute top-4 right-4 flex gap-2">
                          <div className="w-2 h-2 rounded-full bg-red-500"></div>
                          <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      </div>

                      <div className="space-y-4 max-w-sm mx-auto w-full">
                          {/* Bot Message */}
                          <div className="flex gap-3">
                              <div className="w-8 h-8 rounded-full bg-bbq-red shrink-0 flex items-center justify-center"><Bot size={16} className="text-white"/></div>
                              <div className="bg-gray-800 p-3 rounded-2xl rounded-tl-none border border-gray-700 text-sm text-gray-200 shadow-lg">
                                  <p>What's cooking today? Need help with that stall at 160°F?</p>
                              </div>
                          </div>

                          {/* User Message Simulation */}
                          <div className="flex gap-3 justify-end">
                              <div className="bg-white text-black p-3 rounded-2xl rounded-tr-none text-sm font-medium shadow-lg">
                                  <p>How long should I rest a 4kg pork shoulder?</p>
                              </div>
                          </div>

                          {/* Bot Typing */}
                          <div className="flex gap-3">
                              <div className="w-8 h-8 rounded-full bg-bbq-red shrink-0 flex items-center justify-center"><Bot size={16} className="text-white"/></div>
                              <div className="bg-gray-800 p-3 rounded-2xl rounded-tl-none border border-gray-700 text-gray-400 text-xs flex items-center gap-2 w-fit">
                                  <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"></span>
                                  <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                                  <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                              </div>
                          </div>
                      </div>

                      {/* Floating Particles/Smoke Effect (CSS based) */}
                      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/50 to-transparent pointer-events-none"></div>
                  </div>
              </div>
          </div>
      </section>

      {/* --- GOLDEN TICKET AD --- */}
      <section className="mx-2 md:mx-4">
          <Link to="/rewards" className="relative rounded-3xl overflow-hidden block group h-48 md:h-64 border-2 border-bbq-gold/50 hover:border-bbq-gold transition-all duration-500 shadow-[0_0_40px_rgba(251,191,36,0.15)]">
              {/* Background */}
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-900 via-black to-yellow-900"></div>
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-30"></div>
              
              {/* Animated Shine */}
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:animate-[shimmer_2s_infinite]"></div>

              <div className="relative z-10 h-full flex flex-col md:flex-row items-center justify-between px-8 md:px-16 text-center md:text-left gap-4">
                  <div className="flex-1">
                      <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                          <Ticket className="text-bbq-gold rotate-12" size={32} />
                          <h3 className="text-3xl md:text-5xl font-display font-bold text-white uppercase tracking-tight">The Golden Ticket</h3>
                      </div>
                      <p className="text-bbq-gold/80 font-bold uppercase tracking-widest text-sm md:text-base">Eat Meat. Collect Stamps. Get Rewarded.</p>
                  </div>
                  <div className="flex-shrink-0">
                      <div className="bg-white text-black font-black uppercase tracking-widest px-8 py-4 rounded-full flex items-center gap-2 group-hover:scale-105 transition-transform shadow-xl">
                          <Gift size={20} className="text-bbq-gold fill-bbq-gold" /> Join The Club
                      </div>
                  </div>
              </div>
          </Link>
      </section>

      {/* --- PROMOTER PARALLAX SECTION (Floating Advertising) --- */}
      <section className="relative w-full h-[500px] overflow-hidden flex items-center justify-center my-12 group">
          {/* Parallax Background */}
          <div 
            className="absolute inset-0 bg-fixed bg-cover bg-center"
            style={{ 
                backgroundImage: `url('${settings.homePromoterImage || "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1950&q=80"}')` 
            }}
          ></div>
          <div className="absolute inset-0 bg-black/60 group-hover:bg-black/50 transition duration-700"></div>
          
          <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
              <div className="flex justify-center mb-4">
                  <div className="bg-bbq-red text-white font-black uppercase tracking-widest text-xs px-4 py-1 rounded-full flex items-center gap-2">
                      <Music size={14} /> Festivals & Rodeos
                  </div>
              </div>
              <h2 className="text-5xl md:text-7xl font-display font-bold text-white mb-6 drop-shadow-xl">
                  BRINGING THE <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-yellow-500">SMOKE</span> TO EVENTS
              </h2>
              <p className="text-gray-200 text-lg md:text-xl font-medium max-w-3xl mx-auto mb-8 leading-relaxed drop-shadow-md">
                  We fire up the grill and serve up mouth-watering BBQ at festivals, rodeos, markets, and private events. Wherever the crowd is, Your Business brings the flavour, the fun, and the smoke!
              </p>
              
              <div className="flex flex-col md:flex-row gap-4 justify-center items-center">
                  <Link to="/events" className="bg-white text-black font-bold uppercase tracking-widest px-8 py-4 rounded-full flex items-center gap-3 hover:bg-gray-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.4)]">
                      <Star size={20} className="text-bbq-gold fill-bbq-gold" /> See Us In Action
                  </Link>
                  <Link to="/promoters" className="text-white border-2 border-white/30 hover:border-white font-bold uppercase tracking-widest px-8 py-4 rounded-full flex items-center gap-3 transition-all">
                      Promoter Enquiries <ArrowRight size={20} />
                  </Link>
              </div>
          </div>
      </section>

      {/* PHILOSOPHY / INTRO */}
      <section className="relative max-w-5xl mx-auto px-6 py-12 text-center">
         <div className="absolute top-0 left-0 text-gray-800 opacity-20 -z-10 transform -translate-x-12 -translate-y-12">
            <Flame size={200} />
         </div>

         <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-8">
           WE DON'T DO <span className="text-bbq-red italic">FAST</span> FOOD. <br/>
           WE DO <span className="text-bbq-gold italic">GOOD</span> FOOD.
         </h2>
         <p className="text-gray-400 text-lg md:text-xl leading-relaxed font-light max-w-3xl mx-auto">
            Your Business is a family owned operation obsessed with the ritual of fire and meat. We treat every brisket with respect, smoking it for 12+ hours over seasoned Ironbark until it falls apart at the sight of a fork. This isn't just lunch—it's a religious experience.
         </p>
         
         <div className="grid grid-cols-3 gap-8 mt-12 border-t border-gray-800 pt-12">
            <div>
                <h4 className="text-4xl font-display font-bold text-bbq-red">12+</h4>
                <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Hours Smoked</p>
            </div>
            <div>
                <h4 className="text-4xl font-display font-bold text-bbq-red">100%</h4>
                <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Ironbark Wood</p>
            </div>
            <div>
                <h4 className="text-4xl font-display font-bold text-bbq-red">4.9</h4>
                <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Star Rating</p>
            </div>
         </div>
      </section>

      {/* CARDS SECTION - GLASSMORPHISM */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 px-4 max-w-7xl mx-auto">
          <Link to="/events" className="relative h-64 rounded-2xl overflow-hidden group border border-white/10 hover:border-bbq-red/50 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent z-10" />
            <img 
                src={settings.eventsHeroImage || "https://images.unsplash.com/photo-1565123409695-7b5ef63a2efb?auto=format&fit=crop&w=800&q=80"}
                alt="Events" 
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition duration-700" 
                onError={handleImageError} 
            />
            <div className="absolute bottom-0 left-0 w-full p-8 z-20">
                <div className="flex items-center gap-3 mb-2">
                    <Truck size={24} className="text-bbq-gold" />
                    <h3 className="text-2xl font-display font-bold uppercase text-white">Food Truck Schedule</h3>
                </div>
                <p className="text-gray-300 text-sm mb-4">Find out where we're popping up next.</p>
                <div className="flex items-center gap-2 text-bbq-gold text-xs font-bold uppercase tracking-widest">
                    View Calendar <ArrowRight size={14} />
                </div>
            </div>
          </Link>

          <Link to="/menu" className="relative h-64 rounded-2xl overflow-hidden group border border-white/10 hover:border-bbq-red/50 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent z-10" />
            <img src="https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=800&q=80" alt="Menu" className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition duration-700" onError={handleImageError} />
            <div className="absolute bottom-0 left-0 w-full p-8 z-20">
                <div className="flex items-center gap-3 mb-2">
                    <Utensils size={24} className="text-bbq-gold" />
                    <h3 className="text-2xl font-display font-bold uppercase text-white">Full Menu</h3>
                </div>
                <p className="text-gray-300 text-sm mb-4">Browse our complete selection of meats.</p>
                <div className="flex items-center gap-2 text-bbq-gold text-xs font-bold uppercase tracking-widest">
                    View Items <ArrowRight size={14} />
                </div>
            </div>
          </Link>
      </section>

      {/* REINSTALLED LIVE FACEBOOK PAGE FEED TICKER */}
      <section className="py-12 border-t border-gray-900 bg-black/20 overflow-hidden relative">
        <div className="max-w-7xl mx-auto px-4 mb-8 flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
                <div className="bg-gradient-to-tr from-blue-600 to-blue-400 p-0.5 rounded-full">
                    <div className="bg-black p-2 rounded-full">
                        <Facebook size={20} className="text-white" />
                    </div>
                </div>
                <div>
                     <h2 className="text-2xl font-display font-bold text-white leading-none">FROM THE PAGE</h2>
                     <p className="text-xs text-gray-400 font-bold tracking-widest uppercase flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${liveFbPosts.length > 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></span> 
                        @foodtruckapp
                     </p>
                </div>
            </div>
            <a href="https://facebook.com/foodtruckapp" target="_blank" className="text-xs font-bold text-white border border-white/20 px-4 py-2 rounded-full hover:bg-white hover:text-black transition">
                Follow Page
            </a>
        </div>
        
        <div className="relative w-full overflow-hidden group py-4">
            <div className="flex w-fit animate-marquee-scroll hover:[animation-play-state:paused]">
                <div className="flex gap-4 px-2">
                    {tickerItems.map((img, i) => (
                        <div key={`track1-${i}`} className="relative w-64 h-64 shrink-0 rounded-xl overflow-hidden border border-white/10 group-hover:grayscale transition duration-500 hover:!grayscale-0 cursor-pointer">
                            <img src={img} alt="Facebook Post" className="w-full h-full object-cover" onError={handleImageError} />
                            <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition flex items-center justify-center">
                                <Facebook className="text-white" size={32} />
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex gap-4 px-2">
                    {tickerItems.map((img, i) => (
                        <div key={`track2-${i}`} className="relative w-64 h-64 shrink-0 rounded-xl overflow-hidden border border-white/10 group-hover:grayscale transition duration-500 hover:!grayscale-0 cursor-pointer">
                            <img src={img} alt="Facebook Post" className="w-full h-full object-cover" onError={handleImageError} />
                            <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition flex items-center justify-center">
                                <Facebook className="text-white" size={32} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
