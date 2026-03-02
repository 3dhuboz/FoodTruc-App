
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/Toast';
import { UserRole } from '../types';
import { useNavigate } from 'react-router-dom';
import { Facebook, Mail, User, Shield, Lock, ArrowLeft, Loader2 } from 'lucide-react';

const Login: React.FC = () => {
  const { login, settings } = useApp();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'LOGIN' | 'SIGNUP' | 'ADMIN'>('LOGIN');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  // Admin Credentials
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');

  const handleSocialLogin = (platform: 'Google' | 'Facebook') => {
    toast('Social Login requires further configuration in Firebase Console.', 'info');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
        if (mode === 'ADMIN') {
            await login(UserRole.ADMIN, adminUser, adminPass);
            navigate('/admin');
        } else if (mode === 'LOGIN') {
            await login(UserRole.CUSTOMER, email, password, undefined, rememberMe);
            navigate('/');
        } else {
            await login(UserRole.CUSTOMER, email, password, name, rememberMe);
            navigate('/profile');
        }
    } catch (error) {
        // Error handling is inside AppContext for now (alert)
        console.error(error);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 md:mt-20 p-8 bg-bbq-charcoal rounded-xl shadow-2xl border border-gray-800 space-y-8 animate-in fade-in slide-in-from-bottom-4 relative overflow-hidden">
      
      {/* Decorative */}
      <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
          {mode === 'ADMIN' ? <Shield size={100} /> : <User size={100} />}
      </div>

      <div className="text-center space-y-2 relative z-10">
          <h2 className="text-3xl font-display font-bold text-white">
              {mode === 'LOGIN' ? 'WELCOME BACK' : mode === 'SIGNUP' ? 'JOIN THE FAMILY' : 'STAFF ACCESS'}
          </h2>
          <p className="text-gray-400 text-sm">
              {mode === 'LOGIN' ? 'Login to view your orders and points.' : mode === 'SIGNUP' ? 'Create an account to order and track rewards.' : 'Secure area for authorized personnel only.'}
          </p>
      </div>

      {mode === 'ADMIN' ? (
          <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
              <div className="relative">
                  <User className="absolute left-3 top-3.5 text-bbq-red" size={18} />
                  <input 
                      type="text" 
                      placeholder="Username"
                      value={adminUser}
                      onChange={e => setAdminUser(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 pl-10 text-white focus:border-bbq-red outline-none"
                  />
              </div>
              <div className="relative">
                  <Lock className="absolute left-3 top-3.5 text-bbq-red" size={18} />
                  <input 
                      type="password" 
                      placeholder="Password"
                      value={adminPass}
                      onChange={e => setAdminPass(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 pl-10 text-white focus:border-bbq-red outline-none"
                  />
              </div>
              <button type="submit" disabled={isLoading} className="w-full bg-bbq-red text-white py-3 rounded-lg font-bold hover:bg-red-700 transition shadow-lg shadow-red-900/20 flex justify-center items-center gap-2">
                  {isLoading ? <Loader2 className="animate-spin" size={20}/> : 'Access Dashboard'}
              </button>
              <button type="button" onClick={() => setMode('LOGIN')} className="w-full text-gray-400 hover:text-white text-sm flex items-center justify-center gap-2">
                  <ArrowLeft size={14}/> Back to Customer Login
              </button>
          </form>
      ) : (
          <>
            <div className="space-y-3 relative z-10">
                <button 
                    type="button"
                    onClick={() => handleSocialLogin('Google')}
                    className="w-full bg-white text-black py-3 rounded-lg font-bold hover:bg-gray-200 transition flex items-center justify-center gap-3"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35 11.1h-9.17v2.98h5.24c-.27 1.67-1.6 4.5-5.24 4.5c-3.15 0-5.73-2.54-5.73-5.73s2.58-5.73 5.73-5.73c1.48 0 2.82.52 3.86 1.51l2.25-2.25C16.7 4.96 14.7 4.13 12.18 4.13C7.75 4.13 4.14 7.74 4.14 12.17s3.61 8.04 8.04 8.04c4.64 0 7.73-3.26 7.73-7.91c0-.57-.06-1.12-.16-1.6z"/></svg>
                    Continue with Google
                </button>
                <button 
                    type="button"
                    onClick={() => handleSocialLogin('Facebook')}
                    className="w-full bg-[#1877F2] text-white py-3 rounded-lg font-bold hover:bg-[#166fe5] transition flex items-center justify-center gap-3"
                >
                    <Facebook size={20} fill="currentColor" />
                    Continue with Facebook
                </button>
            </div>

            <div className="relative flex py-2 items-center z-10">
                <div className="flex-grow border-t border-gray-700"></div>
                <span className="flex-shrink-0 mx-4 text-gray-500 text-xs uppercase tracking-widest">Or using Email</span>
                <div className="flex-grow border-t border-gray-700"></div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
                <div className="space-y-4">
                    {mode === 'SIGNUP' && (
                        <div className="relative">
                            <User className="absolute left-3 top-3.5 text-gray-500" size={18} />
                            <input 
                                type="text" 
                                placeholder="Full Name"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 pl-10 text-white focus:border-bbq-red outline-none"
                                required
                            />
                        </div>
                    )}
                    <div className="relative">
                        <Mail className="absolute left-3 top-3.5 text-gray-500" size={18} />
                        <input 
                            type="email" 
                            placeholder="Email Address"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 pl-10 text-white focus:border-bbq-red outline-none"
                            required
                        />
                    </div>
                    <div className="relative">
                        <Lock className="absolute left-3 top-3.5 text-gray-500" size={18} />
                        <input 
                            type="password" 
                            placeholder="Password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 pl-10 text-white focus:border-bbq-red outline-none"
                            required
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center gap-2 cursor-pointer text-gray-400">
                        <input 
                            type="checkbox" 
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            className="rounded bg-gray-800 border-gray-700 text-bbq-red focus:ring-bbq-red" 
                        />
                        Remember me
                    </label>
                    {mode === 'LOGIN' && <a href="#" className="text-bbq-red hover:underline">Forgot password?</a>}
                </div>

                <button type="submit" disabled={isLoading} className="w-full bg-bbq-red text-white py-3 rounded-lg font-bold hover:bg-red-700 transition shadow-lg shadow-red-900/20 flex justify-center items-center gap-2">
                    {isLoading ? <Loader2 className="animate-spin" size={20}/> : (mode === 'LOGIN' ? 'Login' : 'Create Account')}
                </button>
            </form>

            <div className="text-center text-sm text-gray-400 relative z-10">
                {mode === 'LOGIN' ? (
                    <>Don't have an account? <button onClick={() => setMode('SIGNUP')} className="text-white font-bold hover:underline">Sign up</button></>
                ) : (
                    <>Already have an account? <button onClick={() => setMode('LOGIN')} className="text-white font-bold hover:underline">Log in</button></>
                )}
            </div>

            <div className="pt-6 border-t border-gray-800 text-center relative z-10">
                <button onClick={() => setMode('ADMIN')} className="text-xs text-gray-600 hover:text-gray-400 font-mono">
                    [Staff / Admin Access]
                </button>
            </div>
          </>
      )}
    </div>
  );
};

export default Login;
