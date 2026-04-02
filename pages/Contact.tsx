
import React, { useState } from 'react';
import { Mail, MapPin, Send, Instagram, Facebook, ChevronDown, ChevronUp, HelpCircle, Clock, CheckCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';

const Contact: React.FC = () => {
  const { settings } = useApp();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });
  const [isSent, setIsSent] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTimeout(() => {
      setIsSent(true);
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
    }, 1000);
  };

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  const mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent('Ipswich, QLD')}&t=&z=13&ie=UTF8&iwloc=&output=embed`;

  const faqs = [
    {
        q: "Do we offer private catering?",
        a: "Yes we offer catering at your house, a public hall, wedding chapel etc. A minimum of 45 people are required for us to attend."
    },
    {
        q: "Business or workplace catering?",
        a: "Absolutely. We cater for corporate lunches, milestones, and Christmas parties. Minimum 45 people."
    },
    {
        q: "Minimum notice required?",
        a: "We prefer at least 2 weeks notice, but can sometimes squeeze you in with 7 days notice depending on our schedule."
    },
    {
        q: "Is a deposit required?",
        a: "Yes, a 50% deposit secures your date. The remaining balance is due prior to the event."
    }
  ];

  return (
    <div className="animate-in fade-in duration-700 pb-20">
      
      {/* HEADER SECTION */}
      <div className="text-center py-20 relative overflow-hidden bg-black">
         <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-black z-0"></div>
         <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] z-0"></div>
         
         <div className="relative z-10 px-4">
             <h1 className="text-5xl md:text-8xl font-display font-bold text-white mb-6 uppercase leading-none tracking-tighter">
                 Let's Talk <span className="text-bbq-red">Meat</span>
             </h1>
             <p className="text-xl text-gray-400 font-light max-w-2xl mx-auto">
                 Have a question about a booking, our menu, or where the truck is parked? Drop us a line.
             </p>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 max-w-7xl mx-auto mb-20 overflow-hidden rounded-3xl border border-gray-800 shadow-2xl">
        
        {/* LEFT: INFO & MAP */}
        <div className="lg:col-span-5 bg-bbq-charcoal p-8 md:p-12 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 p-32 bg-bbq-red/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
            
            <div className="relative z-10 space-y-8">
                <div>
                    <h3 className="text-2xl font-bold text-white mb-6 font-display uppercase tracking-widest border-b border-gray-700 pb-4">Get In Touch</h3>
                    <div className="space-y-6">
                        <div className="flex gap-4">
                            <div className="bg-black/40 w-12 h-12 flex items-center justify-center rounded-lg text-bbq-gold border border-white/5">
                                <Mail size={20}/>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-500 uppercase">Email</p>
                                <a href="mailto:admin@chownow.au" className="text-white text-lg font-bold hover:text-bbq-red transition">admin@chownow.au</a>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="bg-black/40 w-12 h-12 flex items-center justify-center rounded-lg text-bbq-gold border border-white/5">
                                <Clock size={20}/>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-500 uppercase">Office Hours</p>
                                <p className="text-white font-bold">Mon - Fri: 9am - 5pm</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="w-full h-48 rounded-xl overflow-hidden border border-gray-700 bg-gray-900 relative shadow-lg grayscale hover:grayscale-0 transition duration-500">
                     <iframe 
                        width="100%" 
                        height="100%" 
                        src={mapSrc}
                        frameBorder="0" 
                        scrolling="no" 
                        className="opacity-70 hover:opacity-100 transition"
                     ></iframe>
                </div>

                <div className="flex gap-4 pt-4">
                    <p className="text-gray-500 text-sm">Follow us on social media — coming soon!</p>
                </div>
            </div>
        </div>

        {/* RIGHT: FORM */}
        <div className="lg:col-span-7 bg-white p-8 md:p-12 relative">
            {isSent ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-10 animate-in zoom-in">
                    <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
                        <CheckCircle size={48}/>
                    </div>
                    <h3 className="text-3xl font-bold text-gray-900 mb-2 font-display">MESSAGE RECEIVED</h3>
                    <p className="text-gray-500 text-lg mb-8 max-w-sm">
                        Thanks for reaching out! We'll fire up the laptop and get back to you shortly.
                    </p>
                    <button onClick={() => setIsSent(false)} className="text-bbq-red font-bold hover:underline">Send another message</button>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-6 h-full flex flex-col justify-center">
                    <div>
                        <h3 className="text-3xl font-bold text-gray-900 font-display mb-2">SEND A MESSAGE</h3>
                        <p className="text-gray-500">Fill out the form below and we will be in touch.</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Name</label>
                            <input 
                                required
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-gray-900 focus:border-bbq-red focus:ring-1 focus:ring-bbq-red outline-none transition"
                                placeholder="Your Name"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Phone</label>
                            <input 
                                value={formData.phone}
                                onChange={e => setFormData({...formData, phone: e.target.value})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-gray-900 focus:border-bbq-red focus:ring-1 focus:ring-bbq-red outline-none transition"
                                placeholder="Optional"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Email</label>
                        <input 
                            required
                            type="email"
                            value={formData.email}
                            onChange={e => setFormData({...formData, email: e.target.value})}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-gray-900 focus:border-bbq-red focus:ring-1 focus:ring-bbq-red outline-none transition"
                            placeholder="you@email.com"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Topic</label>
                        <select 
                            value={formData.subject}
                            onChange={e => setFormData({...formData, subject: e.target.value})}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-gray-900 focus:border-bbq-red focus:ring-1 focus:ring-bbq-red outline-none transition"
                        >
                            <option value="">Select a topic...</option>
                            <option value="Catering">Catering Inquiry</option>
                            <option value="Feedback">Feedback</option>
                            <option value="General">General Question</option>
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Message</label>
                        <textarea 
                            required
                            value={formData.message}
                            onChange={e => setFormData({...formData, message: e.target.value})}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-gray-900 focus:border-bbq-red focus:ring-1 focus:ring-bbq-red outline-none transition h-32 resize-none"
                            placeholder="Tell us what you need..."
                        />
                    </div>

                    <button type="submit" className="w-full bg-bbq-red text-white font-bold py-4 rounded-lg hover:bg-red-800 transition flex items-center justify-center gap-2 shadow-xl transform hover:-translate-y-1">
                        <Send size={18} /> SEND ENQUIRY
                    </button>
                </form>
            )}
        </div>
      </div>

      {/* FAQ SECTION */}
      <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-10">
              <h2 className="text-3xl font-display font-bold text-white flex items-center justify-center gap-2">
                  <HelpCircle className="text-gray-500"/> FAQ
              </h2>
          </div>
          
          <div className="space-y-4">
              {faqs.map((item, index) => (
                  <div key={index} className="bg-bbq-charcoal border border-gray-700 rounded-xl overflow-hidden transition-all duration-300 hover:border-gray-500">
                      <button 
                        onClick={() => toggleFaq(index)}
                        className="w-full p-5 text-left flex justify-between items-center"
                      >
                          <span className="font-bold text-white uppercase tracking-wide">{item.q}</span>
                          {openFaqIndex === index ? <ChevronUp className="text-bbq-red"/> : <ChevronDown className="text-gray-500"/>}
                      </button>
                      
                      <div 
                        className={`overflow-hidden transition-all duration-300 ease-in-out ${openFaqIndex === index ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}
                      >
                          <div className="p-5 pt-0 text-gray-400 leading-relaxed border-t border-gray-700">
                              {item.a}
                          </div>
                      </div>
                  </div>
              ))}
          </div>
      </div>

    </div>
  );
};

export default Contact;
