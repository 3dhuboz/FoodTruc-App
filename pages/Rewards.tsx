
import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Flame, Star, CheckCircle, AlertCircle, ShieldCheck, Lock, Ticket, Gift, Trophy, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { RewardPrize } from '../types';

const Rewards: React.FC = () => {
    const { user, settings, verifyStaffPin } = useApp();
    const navigate = useNavigate();
    const config = settings.rewards || { enabled: false, maxStamps: 10, programName: '', rewardTitle: '', staffPin: '1234', rewardImage: '', possiblePrizes: [] };
    
    // Logic State
    const [isPinModalOpen, setIsPinModalOpen] = useState(false);
    const [pinAction, setPinAction] = useState<'ADD' | 'REDEEM'>('ADD');
    const [enteredPin, setEnteredPin] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    
    // Scratch Card State
    const [isScratched, setIsScratched] = useState(false);
    const [isScratching, setIsScratching] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Prize Shuffle State
    const [wonPrize, setWonPrize] = useState<RewardPrize | null>(null);
    const [shufflingIndex, setShufflingIndex] = useState(0);
    const [isShuffling, setIsShuffling] = useState(false);

    // Derived User State
    const currentStamps = user?.stamps || 0;
    const maxStamps = config.maxStamps || 10;
    const isFull = currentStamps >= maxStamps;

    const prizes = config.possiblePrizes && config.possiblePrizes.length > 0 
        ? config.possiblePrizes 
        : [{ id: 'default', title: config.rewardTitle || 'Mystery Prize', image: config.rewardImage }];

    // --- SCRATCH CARD EFFECT ---
    useEffect(() => {
        if (isFull && !isScratched && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                // Setup Canvas sizing
                const parent = canvas.parentElement;
                if (parent) {
                    canvas.width = parent.offsetWidth;
                    canvas.height = parent.offsetHeight;
                }

                // Draw Gold Foil
                ctx.fillStyle = '#C08F29'; // Base Gold
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Add texture/glitter
                for(let i=0; i<500; i++) {
                    ctx.fillStyle = Math.random() > 0.5 ? '#FCD34D' : '#78350F';
                    ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 2, 2);
                }
                
                // Text Label
                ctx.fillStyle = '#000';
                ctx.font = 'bold 24px Oswald';
                ctx.textAlign = 'center';
                ctx.fillText('SCRATCH TO REVEAL', canvas.width/2, canvas.height/2 + 8);
                
                ctx.globalCompositeOperation = 'destination-out';
            }
        }
    }, [isFull, isScratched]);

    const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isScratching || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;

        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }

        const x = clientX - rect.left;
        const y = clientY - rect.top;

        ctx.beginPath();
        ctx.arc(x, y, 30, 0, Math.PI * 2);
        ctx.fill();

        checkReveal();
    };

    const checkReveal = () => {
        if (!canvasRef.current) return;
        // Logic to check percentage cleared can go here
        // For now, assume any significant scratch triggers the process
    };

    const finishScratch = () => {
        setIsScratching(false);
        if (!isScratched) {
            // Auto complete scratch after interaction and start shuffle
            setTimeout(() => {
                setIsScratched(true);
                startShuffle();
            }, 300); 
        }
    };

    const startShuffle = () => {
        setIsShuffling(true);
        let count = 0;
        const maxShuffles = 20; // How many times it flicks before stopping
        const speed = 100; // ms

        const interval = setInterval(() => {
            setShufflingIndex(prev => (prev + 1) % prizes.length);
            count++;
            
            if (count > maxShuffles) {
                clearInterval(interval);
                const winnerIndex = Math.floor(Math.random() * prizes.length);
                setShufflingIndex(winnerIndex);
                setWonPrize(prizes[winnerIndex]);
                setIsShuffling(false);
            }
        }, speed);
    };

    // --- PIN LOGIC ---
    const handlePinSubmit = () => {
        const success = verifyStaffPin(enteredPin, pinAction);
        if (success) {
            setSuccessMsg(pinAction === 'ADD' ? 'STAMP ADDED!' : 'REWARD REDEEMED!');
            setTimeout(() => {
                setIsPinModalOpen(false);
                setSuccessMsg('');
                setEnteredPin('');
                if (pinAction === 'REDEEM') {
                    setIsScratched(false); // Reset ticket
                    setWonPrize(null); // Reset prize
                }
            }, 1500);
        } else {
            setErrorMsg('INCORRECT PIN');
            setEnteredPin('');
        }
    };

    const handleKeyPad = (num: string) => {
        if (enteredPin.length < 4) {
            setEnteredPin(prev => prev + num);
        }
    };

    const openModal = (action: 'ADD' | 'REDEEM') => {
        setPinAction(action);
        setIsPinModalOpen(true);
        setEnteredPin('');
        setErrorMsg('');
    };

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-in fade-in">
                <div className="relative mb-8">
                    <div className="absolute inset-0 bg-bbq-gold blur-2xl opacity-20 rounded-full animate-pulse"></div>
                    <Ticket size={80} className="text-bbq-gold relative z-10" strokeWidth={1} />
                </div>
                <h2 className="text-4xl font-display font-bold text-white mb-2 tracking-wide uppercase">Golden Ticket Club</h2>
                <p className="text-gray-400 mb-8 max-w-xs mx-auto text-lg">Earn stamps. Reveal prizes. <br/> Join the inner circle.</p>
                <button 
                    onClick={() => navigate('/login')}
                    className="bg-gradient-to-r from-bbq-gold to-yellow-600 text-black px-10 py-4 rounded-full font-black uppercase tracking-widest hover:scale-105 transition shadow-[0_0_30px_rgba(251,191,36,0.3)]"
                >
                    Get Your Ticket
                </button>
            </div>
        );
    }

    if (!config.enabled) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
                <AlertCircle size={48} className="text-gray-600 mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Program Paused</h2>
                <p className="text-gray-500">The rewards program is currently unavailable.</p>
            </div>
        );
    }

    // Build ticker prizes (duplicate for seamless loop)
    const tickerPrizes = [...prizes, ...prizes, ...prizes];

    return (
        <div className="max-w-4xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-8 overflow-hidden">
            
            {/* Header */}
            <div className="text-center mb-10 relative">
                <h1 className="text-5xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-b from-bbq-gold to-yellow-700 uppercase tracking-tight drop-shadow-sm mb-2">
                    {config.programName || "The Golden Ticket"}
                </h1>
                <p className="text-gray-400 text-sm font-mono tracking-widest uppercase">
                    Member: {user.name} // Status: {isFull ? 'ELIGIBLE' : 'COLLECTING'}
                </p>
            </div>

            {/* --- GOLDEN TICKET CONTAINER --- */}
            <div className="relative w-full max-w-2xl mx-auto perspective-1000 mb-12 px-4">
                <div className={`relative w-full aspect-[2/1] transition-transform duration-700 transform-style-3d ${isFull ? 'shadow-[0_0_50px_rgba(251,191,36,0.3)]' : 'shadow-2xl'}`}>
                    
                    {/* Ticket Visual */}
                    <div className="absolute inset-0 bg-gradient-to-br from-yellow-200 via-yellow-500 to-yellow-700 rounded-3xl overflow-hidden border-4 border-yellow-300">
                        {/* Texture */}
                        <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
                        
                        {/* Shiny Glare Animation */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-transparent translate-x-[-100%] animate-[shimmer_3s_infinite]"></div>

                        {/* Content Layout */}
                        <div className="absolute inset-0 p-6 md:p-8 flex flex-col">
                            
                            {/* Top Row */}
                            <div className="flex justify-between items-start mb-4">
                                <div className="bg-black/80 backdrop-blur text-bbq-gold px-4 py-1 rounded border border-bbq-gold font-bold text-xs uppercase tracking-widest">
                                    Admit One
                                </div>
                                <div className="text-black font-black text-xl md:text-2xl font-display tracking-tighter opacity-80">
                                    Your Business
                                </div>
                            </div>

                            {/* Middle Row (Dynamic) */}
                            <div className="flex-1 flex items-center justify-center relative">
                                {isFull ? (
                                    // REVEAL AREA
                                    <div className="w-full h-full bg-white/20 backdrop-blur-sm rounded-xl border-2 border-black/10 overflow-hidden relative group">
                                        
                                        {/* Underlying Prize (The Shuffle Layer) */}
                                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black p-4 text-center overflow-hidden">
                                            {/* Prize Animation */}
                                            {prizes.length > 0 && (
                                                <div className="flex flex-col items-center justify-center h-full w-full">
                                                    <div className={`transition-all duration-100 ${isShuffling ? 'blur-[1px] scale-95' : 'scale-100'}`}>
                                                        {prizes[shufflingIndex].image && (
                                                            <img 
                                                                src={prizes[shufflingIndex].image} 
                                                                className="w-20 h-20 md:w-24 md:h-24 object-cover rounded-full border-2 border-bbq-gold mb-2 shadow-[0_0_20px_rgba(251,191,36,0.5)] mx-auto" 
                                                                alt="Prize"
                                                            />
                                                        )}
                                                        <h3 className="text-bbq-gold font-bold text-xl md:text-2xl uppercase leading-none">{prizes[shufflingIndex].title}</h3>
                                                    </div>
                                                    
                                                    {wonPrize && !isShuffling && (
                                                        <p className="text-green-400 font-bold text-xs mt-2 animate-bounce bg-green-900/50 px-3 py-1 rounded-full uppercase tracking-wider">
                                                            Winner!
                                                        </p>
                                                    )}
                                                    {isShuffling && (
                                                        <p className="text-gray-500 font-mono text-xs mt-2 animate-pulse">CYCLING PRIZES...</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Scratch Overlay */}
                                        {!isScratched && (
                                            <canvas
                                                ref={canvasRef}
                                                className="absolute inset-0 cursor-crosshair touch-none"
                                                onMouseDown={() => setIsScratching(true)}
                                                onTouchStart={() => setIsScratching(true)}
                                                onMouseUp={finishScratch}
                                                onTouchEnd={finishScratch}
                                                onMouseMove={handleMouseMove}
                                                onTouchMove={handleMouseMove}
                                            />
                                        )}
                                    </div>
                                ) : (
                                    // STAMP GRID
                                    <div className="grid grid-cols-5 gap-3 w-full max-w-md">
                                        {Array.from({ length: maxStamps }).map((_, i) => {
                                            const filled = i < currentStamps;
                                            return (
                                                <div key={i} className="aspect-square relative flex items-center justify-center">
                                                    {/* Slot */}
                                                    <div className="absolute inset-0 border-2 border-black/20 rounded-full"></div>
                                                    {/* Stamp */}
                                                    {filled && (
                                                        <div className="absolute inset-0 bg-black rounded-full flex items-center justify-center animate-in zoom-in spin-in-12 duration-300 shadow-lg transform rotate-[-12deg]">
                                                            <Flame className="text-bbq-gold" size={20} fill="currentColor"/>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Bottom Row */}
                            <div className="mt-4 flex justify-between items-end">
                                <div className="text-black/60 font-mono text-xs font-bold">
                                    NO: {user.id.slice(0,8).toUpperCase()}
                                </div>
                                <div className="text-black font-black text-4xl font-display leading-none">
                                    {currentStamps} <span className="text-lg opacity-50">/ {maxStamps}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Ticket Stub Lines (Visual CSS) */}
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-12 bg-bbq-charcoal rounded-r-full border-r border-gray-700"></div>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-8 h-12 bg-bbq-charcoal rounded-l-full border-l border-gray-700"></div>
                </div>
            </div>

            {/* --- POSSIBLE WINNINGS (Classy Animation) --- */}
            {!isFull && prizes.length > 0 && (
                <div className="mb-12 max-w-3xl mx-auto px-4">
                    {/* Guaranteed Banner */}
                    <div className="relative mb-6 rounded-xl overflow-hidden border border-bbq-gold/30 shadow-[0_0_20px_rgba(251,191,36,0.1)]">
                        <div className="absolute inset-0 bg-gradient-to-r from-yellow-900/40 via-black to-yellow-900/40"></div>
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20"></div>
                        <div className="relative z-10 py-3 text-center">
                            <h4 className="text-white font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-2 animate-[pulse_3s_infinite]">
                                <Trophy size={16} className="text-bbq-gold"/> 
                                <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-bbq-gold to-white bg-[length:200%_auto] animate-[shimmer_3s_linear_infinite]">
                                    Guaranteed Winner Upon Completion
                                </span>
                                <Trophy size={16} className="text-bbq-gold"/>
                            </h4>
                        </div>
                    </div>

                    {/* Animated Ticker */}
                    <div className="relative overflow-hidden group">
                        <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-bbq-charcoal to-transparent z-10"></div>
                        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-bbq-charcoal to-transparent z-10"></div>
                        
                        <div className="flex animate-marquee hover:[animation-play-state:paused] w-fit">
                            {tickerPrizes.map((prize, idx) => (
                                <div key={idx} className="flex-shrink-0 w-48 px-2">
                                    <div className="bg-gray-900 border border-gray-800 p-3 rounded-xl flex flex-col items-center gap-2 h-full hover:border-bbq-gold/50 transition-colors duration-300">
                                        <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-gray-700 shadow-lg">
                                            <img src={prize.image || 'https://placehold.co/100'} className="w-full h-full object-cover" alt={prize.title} />
                                        </div>
                                        <div className="text-center">
                                            <span className="text-xs font-bold text-gray-300 leading-tight block">{prize.title}</span>
                                            <span className="text-[10px] text-gray-600 uppercase tracking-wide">Possible Prize</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* --- ACTION BUTTONS --- */}
            <div className="flex justify-center gap-4 px-4">
                {isFull ? (
                    isScratched && wonPrize && !isShuffling ? (
                        <button 
                            onClick={() => openModal('REDEEM')}
                            className="bg-green-600 text-white px-12 py-4 rounded-full font-bold uppercase tracking-widest text-lg hover:bg-green-500 transition shadow-[0_0_30px_rgba(34,197,94,0.4)] flex items-center gap-3 animate-pulse"
                        >
                            <Trophy size={24} /> Redeem Prize
                        </button>
                    ) : (
                        <div className="text-gray-400 text-sm animate-pulse flex items-center gap-2 bg-black/40 px-4 py-2 rounded-full border border-gray-700">
                            {isScratched ? <Gift className="text-bbq-gold animate-spin"/> : <Gift className="text-bbq-gold"/>} 
                            {isScratched ? 'Finding your prize...' : 'Scratch the gold area above to reveal!'}
                        </div>
                    )
                ) : (
                    <button 
                        onClick={() => openModal('ADD')}
                        className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white px-8 py-4 rounded-xl font-bold flex items-center gap-3 transition group"
                    >
                        <div className="bg-white text-black p-2 rounded-lg group-hover:rotate-12 transition">
                            <ShieldCheck size={20} />
                        </div>
                        <span>Staff Check-in (Add Stamp)</span>
                    </button>
                )}
            </div>

            {/* STAFF PIN MODAL */}
            {isPinModalOpen && (
                <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm bg-bbq-charcoal border border-gray-700 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95">
                        <div className="p-8 text-center">
                            {successMsg ? (
                                <div className="py-10">
                                    <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_#22c55e]">
                                        <CheckCircle size={40} className="text-white" />
                                    </div>
                                    <h3 className="text-2xl font-black text-white uppercase tracking-wider">{successMsg}</h3>
                                </div>
                            ) : (
                                <>
                                    <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-widest flex items-center justify-center gap-2">
                                        <Lock size={16} className="text-bbq-red"/> Staff Authorization
                                    </h3>
                                    {pinAction === 'REDEEM' && wonPrize && (
                                        <div className="bg-black/40 p-3 rounded mb-4 border border-gray-700">
                                            <p className="text-xs text-gray-400 uppercase">Customer Is Claiming</p>
                                            <p className="text-lg font-bold text-bbq-gold">{wonPrize.title}</p>
                                        </div>
                                    )}
                                    <p className="text-xs text-gray-500 mb-8">Enter 4-digit PIN to {pinAction.toLowerCase()}.</p>
                                    
                                    <div className="flex justify-center gap-4 mb-8">
                                        {[0, 1, 2, 3].map(i => (
                                            <div key={i} className={`w-3 h-3 rounded-full transition-all duration-200 ${enteredPin.length > i ? 'bg-bbq-red scale-125' : 'bg-gray-800'}`}></div>
                                        ))}
                                    </div>
                                    
                                    {errorMsg && <div className="text-red-500 text-xs font-bold mb-6 animate-shake bg-red-900/20 py-2 rounded">{errorMsg}</div>}

                                    <div className="grid grid-cols-3 gap-4 mb-8">
                                        {[1,2,3,4,5,6,7,8,9].map(num => (
                                            <button 
                                                key={num}
                                                onClick={() => handleKeyPad(num.toString())}
                                                className="h-16 rounded-2xl bg-black hover:bg-gray-900 text-white font-bold text-xl transition active:scale-95 border border-gray-800"
                                            >
                                                {num}
                                            </button>
                                        ))}
                                        <button 
                                            onClick={() => setEnteredPin('')}
                                            className="h-16 rounded-2xl bg-black hover:bg-red-900/30 text-red-400 font-bold text-sm transition border border-gray-800"
                                        >
                                            CLR
                                        </button>
                                        <button 
                                            onClick={() => handleKeyPad('0')}
                                            className="h-16 rounded-2xl bg-black hover:bg-gray-900 text-white font-bold text-xl transition active:scale-95 border border-gray-800"
                                        >
                                            0
                                        </button>
                                        <button 
                                            onClick={handlePinSubmit}
                                            className="h-16 rounded-2xl bg-white hover:bg-gray-200 text-black font-black text-sm transition"
                                        >
                                            GO
                                        </button>
                                    </div>

                                    <button onClick={() => setIsPinModalOpen(false)} className="text-gray-500 text-xs hover:text-white uppercase tracking-widest">Cancel Transaction</button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Rewards;
