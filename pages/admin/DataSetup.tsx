
import React, { useState } from 'react';
import { seedDatabase, createAdminAuth } from '../../services/dataSeeder';
import { Database, CheckCircle, AlertTriangle, Loader2, Shield, Flame } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DataSetup: React.FC = () => {
  const [status, setStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const navigate = useNavigate();

  const handleSeed = async () => {
    setIsLoading(true);
    setStatus('Initializing...');
    setError('');
    try {
      const result = await seedDatabase();
      setStatus(result);
      setTimeout(() => navigate('/'), 2000);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "An error occurred during seeding.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuth = async () => {
      setIsLoading(true);
      setStatus('Creating Admin Auth...');
      try {
          // Default password from constants is not secure for auth creation, using a hardcoded string the user MUST change
          const result = await createAdminAuth("password123");
          setStatus(result);
      } catch (e: any) {
          setError(e.message);
      } finally {
          setIsLoading(false);
      }
  };

  return (
    <div className="min-h-screen bg-bbq-dark flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-bbq-charcoal border border-gray-700 rounded-xl p-8 shadow-2xl space-y-8">
        <div className="text-center">
            <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-bbq-red">
                <Database size={40} className="text-white" />
            </div>
            <h1 className="text-3xl font-display font-bold text-white mb-2">System Setup</h1>
            <p className="text-gray-400 text-sm">Initialize your Firebase Database with default Your Business data.</p>
        </div>

        <div className="space-y-4">
            <div className="bg-blue-900/20 border border-blue-800 p-4 rounded-lg flex gap-3">
                <AlertTriangle className="text-blue-400 shrink-0" />
                <p className="text-xs text-blue-200">
                    <strong>Run this once:</strong> This will overwrite existing 'Settings' and 'Menu' collections with defaults. Existing Orders will remain safe.
                </p>
            </div>

            {error && (
                <div className="bg-red-900/20 border border-red-800 p-4 rounded-lg flex gap-3 text-red-300 text-sm">
                    <AlertTriangle className="shrink-0" />
                    {error}
                </div>
            )}

            {status && (
                <div className="bg-green-900/20 border border-green-800 p-4 rounded-lg flex gap-3 text-green-300 text-sm items-center">
                    {isLoading ? <Loader2 className="animate-spin shrink-0"/> : <CheckCircle className="shrink-0" />}
                    {status}
                </div>
            )}

            <button 
                onClick={handleSeed}
                disabled={isLoading}
                className="w-full bg-bbq-red hover:bg-red-700 text-white font-bold py-4 rounded-lg flex items-center justify-center gap-3 transition shadow-lg disabled:opacity-50"
            >
                <Flame size={20} /> Initialize Database Data
            </button>
            
            <button 
                onClick={handleAuth}
                disabled={isLoading}
                className="w-full bg-gray-800 hover:bg-gray-700 text-white font-bold py-4 rounded-lg flex items-center justify-center gap-3 transition border border-gray-600 disabled:opacity-50"
            >
                <Shield size={20} /> Create Admin Login
            </button>
        </div>
        
        <div className="text-center">
            <button onClick={() => navigate('/')} className="text-gray-500 text-sm hover:text-white">Skip to Home</button>
        </div>
      </div>
    </div>
  );
};

export default DataSetup;
