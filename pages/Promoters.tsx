
import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, Users, Flame, Star, Quote, ArrowRight, Utensils, Music, Megaphone } from 'lucide-react';
import { useApp } from '../context/AppContext';

const Promoters: React.FC = () => {
  const { settings } = useApp();

  return (
    <div className="animate-in fade-in duration-700 pb-20">
      
      {/* Hero Section */}
      <div className="relative h-[60vh] min-h-[500px] w-full overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0">
              <div className="absolute inset-0 bg-black/60 z-10" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/80 z-20" />
              <img 
                src={settings.promotersHeroImage || "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1950&q=80"}
                className="w-full h-full object-cover"
                alt="Crowd at BBQ Truck"
              />
          </div>
          
          <div className="relative z-30 text-center px-4 max-w-4xl mx-auto">
              <div className="inline-flex items-center gap-2 bg-bbq-red text-white px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6 shadow-[0_0_20px_rgba(220,38,38,0.5)] border border-red-500">
                  <Megaphone size={14} /> Attention Event Organizers
              </div>
              <h1 className="text-5xl md:text-7xl font-display font-bold text-white mb-6 leading-tight drop-shadow-2xl">
                  WE BRING THE <span className="text-transparent bg-clip-text bg-gradient-to-br from-orange-500 to-yellow-500">HYPE</span><br/>
                  AND THE <span className="text-transparent bg-clip-text bg-gradient-to-br from-red-500 to-red-700">HEAT</span>
              </h1>
              <p className="text-xl md:text-2xl text-gray-200 font-light max-w-2xl mx-auto mb-10">
                  The ultimate BBQ experience for Festivals, Rodeos, and Major Events. High volume, authentic flavour, zero stress.
              </p>
              <Link 
                to="/contact" 
                className="bg-white text-black px-8 py-4 rounded-full font-bold uppercase tracking-widest text-lg hover:scale-105 transition-transform shadow-xl flex items-center gap-3 mx-auto w-fit"
              >
                  Book Your Business Now <ArrowRight size={20} />
              </Link>
          </div>
      </div>

      {/* The Stats / Why Us */}
      <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-4">WHY PROMOTERS CHOOSE US</h2>
              <div className="w-24 h-1 bg-bbq-red mx-auto rounded-full"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-bbq-charcoal p-8 rounded-2xl border border-white/10 hover:border-bbq-gold transition duration-300 group">
                  <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center text-bbq-gold mb-6 group-hover:scale-110 transition shadow-lg border border-white/5">
                      <Clock size={32} />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">High Volume Speed</h3>
                  <p className="text-gray-400 leading-relaxed">
                      We don't do queues that don't move. Our setup is engineered for speed without sacrificing quality. We serve hundreds of hungry festival-goers per hour, keeping your crowd happy and fed.
                  </p>
              </div>

              <div className="bg-bbq-charcoal p-8 rounded-2xl border border-white/10 hover:border-bbq-red transition duration-300 group">
                  <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center text-bbq-red mb-6 group-hover:scale-110 transition shadow-lg border border-white/5">
                      <Flame size={32} />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">The "Theatre" of BBQ</h3>
                  <p className="text-gray-400 leading-relaxed">
                      It's not just food; it's a show. The smell of Ironbark smoke, the sight of fresh brisket being sliced, the visual appeal of our setup—we add value to your event's atmosphere.
                  </p>
              </div>

              <div className="bg-bbq-charcoal p-8 rounded-2xl border border-white/10 hover:border-blue-500 transition duration-300 group">
                  <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center text-blue-500 mb-6 group-hover:scale-110 transition shadow-lg border border-white/5">
                      <Users size={32} />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">Reliable & Professional</h3>
                  <p className="text-gray-400 leading-relaxed">
                      Self-sufficient, fully compliant, and professional. We bump in, set up, serve a storm, and bump out clean. We are the vendor you don't have to worry about.
                  </p>
              </div>
          </div>
      </div>

      {/* Social Proof / Vibe */}
      <div className="bg-white text-black py-20 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 relative z-10">
              <div className="flex flex-col md:flex-row gap-12 items-center">
                  <div className="flex-1 space-y-6">
                      <div className="inline-block bg-black text-white text-xs font-bold px-3 py-1 rounded uppercase tracking-widest mb-2">
                          As seen at
                      </div>
                      <h2 className="text-4xl md:text-5xl font-display font-bold leading-none">
                          STRUMMING BIRD & FLAME BBQ FESTIVAL
                      </h2>
                      <p className="text-lg text-gray-700 font-medium">
                          "Wherever the crowd is, Your Business brings the flavour, the fun, and the smoke!"
                      </p>
                      <div className="flex items-center gap-2 text-yellow-600">
                          <Star fill="currentColor" size={24} />
                          <Star fill="currentColor" size={24} />
                          <Star fill="currentColor" size={24} />
                          <Star fill="currentColor" size={24} />
                          <Star fill="currentColor" size={24} />
                      </div>
                      <p className="text-gray-600 italic">
                          - Happy Festival Goers
                      </p>
                  </div>
                  <div className="flex-1 relative">
                      <div className="absolute -inset-4 bg-bbq-red rotate-3 rounded-2xl opacity-20"></div>
                      <img 
                        src={settings.promotersSocialImage || "https://strummingbird.com.au/wp-content/uploads/2025/06/SB25-Website-Image-Resize-4-1024x576.jpg"}
                        alt="Festival Vibe" 
                        className="w-full h-auto rounded-2xl shadow-2xl relative rotate-[-2deg] hover:rotate-0 transition duration-500"
                      />
                  </div>
              </div>
          </div>
      </div>

      {/* Menu Teaser */}
      <div className="py-20 px-6 text-center">
          <h2 className="text-3xl font-display font-bold text-white mb-12">THE FESTIVAL MENU</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-6xl mx-auto">
              <div className="bg-black/40 p-6 rounded-xl border border-white/10 hover:bg-white/5 transition">
                  <Utensils className="mx-auto text-bbq-gold mb-4" size={32} />
                  <h4 className="font-bold text-white text-lg">Brisket & Pork</h4>
                  <p className="text-sm text-gray-400 mt-2">12hr smoked staples that melt in your mouth.</p>
              </div>
              <div className="bg-black/40 p-6 rounded-xl border border-white/10 hover:bg-white/5 transition">
                  <Flame className="mx-auto text-red-500 mb-4" size={32} />
                  <h4 className="font-bold text-white text-lg">Smokey Hog</h4>
                  <p className="text-sm text-gray-400 mt-2">Our signature crowd pleaser sandwich.</p>
              </div>
              <div className="bg-black/40 p-6 rounded-xl border border-white/10 hover:bg-white/5 transition">
                  <Music className="mx-auto text-purple-500 mb-4" size={32} />
                  <h4 className="font-bold text-white text-lg">Pork Belly Lollipops</h4>
                  <p className="text-sm text-gray-400 mt-2">The famous "Meat Candy" on a stick.</p>
              </div>
              <div className="bg-black/40 p-6 rounded-xl border border-white/10 hover:bg-white/5 transition">
                  <Utensils className="mx-auto text-green-500 mb-4" size={32} />
                  <h4 className="font-bold text-white text-lg">Loaded Breakfast</h4>
                  <p className="text-sm text-gray-400 mt-2">Potato gems, brisket, egg. The morning cure.</p>
              </div>
          </div>
      </div>

      {/* Final CTA */}
      <div className="bg-bbq-red text-white py-16 px-6 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
          <div className="relative z-10 max-w-3xl mx-auto">
              <h2 className="text-4xl md:text-6xl font-display font-bold mb-6">SECURE YOUR DATE</h2>
              <p className="text-xl text-red-100 mb-8 font-medium">
                  Our calendar fills up fast for peak season. Don't leave your hungry crowd disappointed.
              </p>
              <Link 
                to="/contact" 
                className="inline-block bg-white text-bbq-red px-10 py-5 rounded-full font-bold uppercase tracking-widest text-lg hover:bg-black hover:text-white transition shadow-2xl transform hover:-translate-y-1"
              >
                  Contact Us Today
              </Link>
          </div>
      </div>

    </div>
  );
};

export default Promoters;
