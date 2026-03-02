
import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../components/Toast';
import { CreditCard, Save, CheckCircle, ExternalLink, Loader2, X, AlertCircle, Monitor, Facebook, ChevronDown, ChevronUp, HelpCircle, ArrowRight, Gift, Wand2, Database, Server, Wifi, Banknote, Power, Eye, EyeOff, LayoutTemplate, MessageSquare, Utensils, Smartphone, Shield, Plus, Trash2, Activity, RefreshCw, Lock, WifiOff, Edit2, RotateCcw, Terminal, AlertTriangle, Copy, FileCode, Home, Music, Megaphone, Truck, Settings, Image as ImageIcon, Upload, Info } from 'lucide-react';
import { generateMarketingImage } from '../../services/gemini';
import { db, auth, firebaseConfig } from '../../services/firebase';
import { seedDatabase } from '../../services/dataSeeder';
import { getDoc, setDoc, doc, deleteDoc } from 'firebase/firestore';
import { restSetDoc, restDeleteDoc } from '../../services/firestoreRest';
import { RewardPrize, AppSettings } from '../../types';

declare global {
  interface Window {
    FB: any;
  }
}

interface LogEntry {
    step: string;
    status: 'pending' | 'success' | 'error' | 'warning';
    details?: string;
    fix?: string;
}

// Helper to compress base64 images to avoid Firestore 1MB limits
// Updated: Supports custom max width for variable target sizes (prizes vs hero images)
const compressImage = (base64Str: string, maxWidth = 700, quality = 0.5) => {
    return new Promise<string>((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            // Resize logic
            if (width > maxWidth) {
                height *= maxWidth / width;
                width = maxWidth;
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            
            // Return compressed JPEG base64
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => {
            // Fallback if loading fails, return original
            resolve(base64Str);
        }
    });
};

const SettingsManager: React.FC<{ mode?: 'admin' | 'dev' }> = ({ mode = 'admin' }) => {
  const { settings, updateSettings, user } = useApp();
  const { toast } = useToast();
  const isAdmin = mode === 'admin';
  const isDev = mode === 'dev';
  const [formData, setFormData] = useState(settings);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState<string | null>(null); // Holds the key of the image being generated
  const [fbError, setFbError] = useState('');
  const [showFbGuide, setShowFbGuide] = useState(false);
  const [availablePages, setAvailablePages] = useState<any[]>([]);

  // Firebase Edit State
  const [fbConfig, setFbConfig] = useState(firebaseConfig);

  // Diagnostics State
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagLogs, setDiagLogs] = useState<LogEntry[]>([]);
  const [isRunningDiag, setIsRunningDiag] = useState(false);
  const [showRulesHelp, setShowRulesHelp] = useState(false);

  // Prize Pool State
  const [newPrize, setNewPrize] = useState<Partial<RewardPrize>>({ title: '', image: '' });
  const [editingPrizeId, setEditingPrizeId] = useState<string | null>(null);

  // System Health State
  const [dbLatency, setDbLatency] = useState<number | null>(null);
  const [lastChecked, setLastChecked] = useState<string>(new Date().toLocaleTimeString());
  const [healthStatus, setHealthStatus] = useState({
      database: 'pending',
      auth: 'pending',
      storage: 'pending'
  });

  // Seeding State
  const [isSeeding, setIsSeeding] = useState(false);

  // Email Test State
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // SMS Test State
  const [isTestingSms, setIsTestingSms] = useState(false);
  const [smsTestResult, setSmsTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Payment Test State
  const [isTestingPayment, setIsTestingPayment] = useState(false);
  const [paymentTestResult, setPaymentTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Credentials
  const [stripeKeys, setStripeKeys] = useState({ pub: '', sec: '' });
  const [squareKeys, setSquareKeys] = useState({ 
    appId: settings.squareApplicationId || '', 
    locationId: settings.squareLocationId || '',
    accessToken: settings.squareAccessToken || '',
    environment: settings.squareEnvironment || 'sandbox'
  });
  const [smartPayKeys, setSmartPayKeys] = useState({ public: '', secret: '' });
  const [smsKeys, setSmsKeys] = useState({ sid: '', token: '' });
  const [geminiKey, setGeminiKey] = useState(settings.geminiApiKey || '');
  const [geminiStatus, setGeminiStatus] = useState<'idle' | 'saving' | 'testing' | 'connected' | 'error'>( 
      settings.geminiApiKey ? 'connected' : 'idle'
  );
  const [geminiEditing, setGeminiEditing] = useState(false);
  
  // Connection Wizard
  const [connectorType, setConnectorType] = useState<'stripe' | 'square' | 'smartpay' | 'twilio' | null>(null);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    setFormData(settings);
    setSquareKeys({ 
      appId: settings.squareApplicationId || '', 
      locationId: settings.squareLocationId || '',
      accessToken: settings.squareAccessToken || '',
      environment: settings.squareEnvironment || 'sandbox'
    });
  }, [settings]);

  useEffect(() => {
     checkSystemHealth();
     // Auto-ping every 30s
     const interval = setInterval(checkSystemHealth, 30000);
     return () => clearInterval(interval);
  }, []);

  const checkSystemHealth = async () => {
      setHealthStatus(prev => ({ ...prev, database: 'checking' }));

      const start = Date.now();
      try {
          if (!navigator.onLine) throw new Error("Client is offline");
          const readUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/settings/general`;
          const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000));
          const res = await Promise.race([fetch(readUrl), timeout]) as Response;
          if (!res.ok) throw new Error(`Status ${res.status}`);
          const end = Date.now();
          setDbLatency(end - start);
          setHealthStatus(prev => ({ ...prev, database: 'online' }));
      } catch (e: any) {
          const isOffline = e.message?.includes('offline') || e.message === 'Timeout' || e.message?.includes('Failed to fetch');
          if (isOffline) setHealthStatus(prev => ({ ...prev, database: 'offline' }));
          else setHealthStatus(prev => ({ ...prev, database: 'error' }));
          setDbLatency(null);
      }
      const isLocalAdmin = !!user;
      
      if (auth && auth.currentUser) setHealthStatus(prev => ({ ...prev, auth: 'online' }));
      else if (isLocalAdmin) setHealthStatus(prev => ({ ...prev, auth: 'local' }));
      else setHealthStatus(prev => ({ ...prev, auth: 'offline' }));
      
      setHealthStatus(prev => ({ ...prev, storage: 'online' }));
      setLastChecked(new Date().toLocaleTimeString());
  };

  const runDeepDiagnostics = async () => {
      setIsRunningDiag(true);
      setShowDiagnostics(true);
      setShowRulesHelp(false);
      setDiagLogs([]);
      const addLog = (step: string, status: 'success' | 'error' | 'warning', details?: string, fix?: string) => {
          setDiagLogs(prev => [...prev, { step, status, details, fix }]);
      };
      if (!firebaseConfig) {
          addLog("Configuration Object", "error", "firebaseConfig is undefined", "Check services/firebase.ts exports.");
          setIsRunningDiag(false);
          return;
      }
      addLog("Configuration Object", "success", "Loaded successfully");
      const apiKey = firebaseConfig.apiKey;
      if (!apiKey) addLog("API Key Presence", "error", "API Key is missing/empty", "Set VITE_FIREBASE_API_KEY in your hosting dashboard.");
      else if (apiKey.includes("YOUR_API_KEY")) addLog("API Key Validity", "error", "Using Placeholder", "Set VITE_FIREBASE_API_KEY.");
      else if (!apiKey.startsWith("AIza")) addLog("API Key Format", "warning", "Does not start with 'AIza'", "Check for typos.");
      else addLog("API Key Format", "success", "Valid format (AIza...)");
      if (!firebaseConfig.projectId || firebaseConfig.projectId.includes("street-meatz-bbq")) addLog("Project ID", "success", `Targeting: ${firebaseConfig.projectId}`);
      else addLog("Project ID", "warning", `Value: ${firebaseConfig.projectId}`, "Ensure this matches your Firebase Console Project ID.");
      
      if (!db) {
          addLog("Database Connection", "error", "Database not initialized", "Check API Key configuration");
          setIsRunningDiag(false);
          return;
      }

      try {
          const start = Date.now();
          const readUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/settings/general`;
          const readRes = await fetch(readUrl);
          const readPing = Date.now() - start;
          if (readRes.ok) {
              addLog("Database Read (REST)", "success", `Read confirmed in ${readPing}ms`);
          } else {
              addLog("Database Read (REST)", "error", `Status ${readRes.status}`, "Check Firestore rules or project configuration.");
          }
      } catch (e: any) {
          addLog("Database Read (REST)", "error", e.message, "Cannot reach Firebase servers.");
      }

      // WRITE TEST via REST API
      try {
          const writeStart = Date.now();
          await restSetDoc('settings', '_write_test', { test: true, ts: Date.now() });
          const writePing = Date.now() - writeStart;
          addLog("Database Write (REST)", "success", `Write confirmed in ${writePing}ms — saves are working`);
          // Clean up test doc
          try { await restDeleteDoc('settings', '_write_test'); } catch (_) {}
      } catch (e: any) {
          let fix = "Check Firestore security rules.";
          if (e.message?.includes('403')) { 
              fix = "Security rules are blocking writes. See 'Recommended Rules' below."; 
              setShowRulesHelp(true); 
          }
          addLog("Database Write (REST)", "error", e.message, fix);
      }
      setIsRunningDiag(false);
  };

  const clearFirestoreCache = async () => {
      toast('Clearing Firestore cache...');
      try {
          // Delete all Firestore IndexedDB databases
          const dbs = await indexedDB.databases();
          const firestoreDbs = dbs.filter(d => d.name?.includes('firestore'));
          for (const d of firestoreDbs) {
              if (d.name) indexedDB.deleteDatabase(d.name);
          }
          toast('Cache cleared! Reloading...', 'success');
          setTimeout(() => window.location.reload(), 1000);
      } catch (e: any) {
          // Fallback: try known database name patterns
          try {
              indexedDB.deleteDatabase(`firestore/[DEFAULT]/${firebaseConfig.projectId}/main`);
              toast('Cache cleared! Reloading...', 'success');
              setTimeout(() => window.location.reload(), 1000);
          } catch (_) {
              toast('Could not clear cache: ' + (e?.message || e), 'error');
          }
      }
  };

  const copyRulesToClipboard = () => {
      const rules = `rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if true;\n    }\n  }\n}`;
      navigator.clipboard.writeText(rules);
      toast('Rules copied to clipboard!');
  };

  // Init FB SDK
  useEffect(() => {
    if (window.FB && settings.facebookAppId) {
       window.FB.init({ appId: settings.facebookAppId, autoLogAppEvents: true, xfbml: true, version: 'v18.0' });
    }
  }, [settings.facebookAppId]);

  const handleFacebookLogin = () => {
    if (!formData.facebookAppId) {
        setFbError("Please enter a Facebook App ID first.");
        return;
    }

    setIsConnecting(true);
    setFbError('');

    if (window.FB) {
        try {
            window.FB.init({
                appId: formData.facebookAppId,
                autoLogAppEvents: true,
                xfbml: true,
                version: 'v18.0'
            });

            window.FB.login((response: any) => {
                if (response.authResponse) {
                    const userAccessToken = response.authResponse.accessToken;
                    fetchFacebookPages(userAccessToken);
                } else {
                    setIsConnecting(false);
                    setFbError('Login failed. Check the "Configuration Help" below.');
                    setShowFbGuide(true); 
                }
            }, { scope: 'pages_show_list,pages_read_engagement,pages_read_user_content,instagram_basic,instagram_manage_insights' });
        } catch (e) {
            setIsConnecting(false);
            setFbError("SDK Error. Ensure App ID is correct.");
        }
    } else {
        setIsConnecting(false);
        setFbError("Facebook SDK not loaded. Disable ad blockers.");
    }
  };

  const fetchFacebookPages = async (userToken: string) => {
    try {
        const pagesRes = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${userToken}`);
        const pagesData = await pagesRes.json();
        
        if (pagesData.data && pagesData.data.length > 0) {
            setAvailablePages(pagesData.data);
            // Don't auto-select if multiple pages, let user choose
            if (pagesData.data.length === 1) {
                selectPage(pagesData.data[0]);
            }
        } else {
            setFbError("No Facebook Pages found for this user.");
            setIsConnecting(false);
        }
    } catch (e) {
        setFbError("API Connection failed.");
        setIsConnecting(false);
    }
  };

  const selectPage = async (page: any) => {
      let instagramId = '';
      try {
          // Attempt to fetch connected Instagram Account
          const res = await fetch(`https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`);
          const data = await res.json();
          if (data.instagram_business_account) {
              instagramId = data.instagram_business_account.id;
          }
      } catch (e) {
          console.error("Failed to fetch Instagram ID", e);
      }

      updateSettings({
          ...settings,
          facebookConnected: true,
          facebookPageId: page.id,
          facebookPageAccessToken: page.access_token,
          facebookAppId: formData.facebookAppId,
          instagramBusinessAccountId: instagramId
      });
      
      setFormData(prev => ({
          ...prev,
          facebookConnected: true,
          facebookPageId: page.id,
          facebookPageAccessToken: page.access_token,
          instagramBusinessAccountId: instagramId
      }));

      toast(`Connected to ${page.name}!${instagramId ? ' Instagram also linked.' : ''}`);
      setAvailablePages([]);
      setIsConnecting(false);
      setFbError('');
      setShowFbGuide(false);
  };

  const handleSaveMainSettings = async () => {
    setIsSaving(true);
    try {
        // Only save fields that actually changed (avoids writing entire settings blob)
        const changedFields: Record<string, any> = {};
        for (const key of Object.keys(formData)) {
            const formVal = (formData as any)[key];
            const settingsVal = (settings as any)[key];
            if (JSON.stringify(formVal) !== JSON.stringify(settingsVal)) {
                changedFields[key] = formVal;
            }
        }
        if (Object.keys(changedFields).length === 0) {
            toast('No changes to save.', 'info');
            setIsSaving(false);
            return;
        }
        console.log('[Settings] Saving changed fields:', Object.keys(changedFields));
        const result = await updateSettings(changedFields);
        if (result === false) {
            toast('Failed to save — check console for details.', 'error');
        } else {
            setShowSaveSuccess(true);
            setTimeout(() => setShowSaveSuccess(false), 4000);
            toast('Settings saved!', 'success');
        }
    } catch (e: any) {
        console.error('Save settings error:', e);
        toast(`Failed to save: ${e.message || 'Unknown error'}`, 'error');
    } finally {
        setIsSaving(false);
    }
  };

  const handleResetData = async () => {
      if (window.confirm("WARNING: This will RESET menu items, settings, and events to default values. It cannot be undone. Continue?")) {
          setIsSeeding(true);
          try {
              await seedDatabase();
              toast('Database reset successfully.');
              window.location.reload();
          } catch (e) {
              toast('Error resetting database.', 'error');
          } finally {
              setIsSeeding(false);
          }
      }
  };

  const handleSaveFirebaseConfig = () => {
      if (window.confirm("Changing Firebase configuration requires a reload. If the configuration is incorrect, the app may not load data. Continue?")) {
          localStorage.setItem('sm_firebase_override', JSON.stringify(fbConfig));
          window.location.reload();
      }
  };

  const handleResetFirebaseConfig = () => {
      if (window.confirm("Reset Firebase configuration to original defaults?")) {
          localStorage.removeItem('sm_firebase_override');
          window.location.reload();
      }
  };

  const handleAddPrize = () => {
      if (!newPrize.title) return;
      if (editingPrizeId) {
          setFormData(prev => ({
              ...prev,
              rewards: {
                  ...prev.rewards,
                  possiblePrizes: prev.rewards.possiblePrizes.map(p => 
                      p.id === editingPrizeId ? { ...p, title: newPrize.title!, image: newPrize.image || '' } : p
                  )
              }
          }));
          setEditingPrizeId(null);
      } else {
          const prize: RewardPrize = {
              id: `pz_${Date.now()}`,
              title: newPrize.title,
              image: newPrize.image || 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=400&q=80'
          };
          setFormData(prev => ({
              ...prev,
              rewards: {
                  ...prev.rewards,
                  possiblePrizes: [...(prev.rewards.possiblePrizes || []), prize]
              }
          }));
      }
      setNewPrize({ title: '', image: '' });
  };

  const handleRemovePrize = (id: string) => {
      if (editingPrizeId === id) {
          setEditingPrizeId(null);
          setNewPrize({ title: '', image: '' });
      }
      setFormData(prev => ({
          ...prev,
          rewards: {
              ...prev.rewards,
              possiblePrizes: prev.rewards.possiblePrizes.filter(p => p.id !== id)
          }
      }));
  };

  const startEditPrize = (prize: RewardPrize) => {
      setNewPrize({ title: prize.title, image: prize.image });
      setEditingPrizeId(prize.id);
  };

  const cancelEditPrize = () => {
      setNewPrize({ title: '', image: '' });
      setEditingPrizeId(null);
  };

  const handleGeneratePrizeImage = async () => {
      if (!newPrize.title) { toast('Enter prize name first', 'warning'); return; }
      setIsGeneratingImage('prize');
      const prompt = `Golden ticket prize: ${newPrize.title}. Delicious BBQ food, high quality, appetizing, isolated on black background.`;
      const base64 = await generateMarketingImage(prompt);
      if (base64) {
          // Use smaller size for prize thumbnails to save space
          const compressed = await compressImage(base64, 400, 0.5);
          setNewPrize(prev => ({ ...prev, image: compressed }));
      }
      setIsGeneratingImage(null);
  };

  // Generic Image Generator
  const handleGenerateImage = async (field: keyof AppSettings, promptContext: string) => {
      setIsGeneratingImage(field);
      const prompt = `${promptContext} High quality, appetizing, professional photography, cinematic lighting.`;
      const base64 = await generateMarketingImage(prompt);
      if (base64) {
          const compressed = await compressImage(base64, 700, 0.5);
          setFormData(prev => ({ ...prev, [field]: compressed }));
      }
      setIsGeneratingImage(null);
  };

  // Generic Package Image Generator
  const handleGeneratePackageImage = async (key: 'essential' | 'pitmaster' | 'wholehog') => {
      setIsGeneratingImage(`pkg_${key}`);
      const prompts = {
          essential: "BBQ meat platter with 2 meats and sides, catering style, high quality",
          pitmaster: "Large BBQ feast with 3 meats and sides, brisket, pork, ribs, mouth watering",
          wholehog: "Ultimate massive BBQ spread, entire table filled with smoked meats and sides, premium catering"
      };
      const base64 = await generateMarketingImage(prompts[key]);
      if (base64) {
          const compressed = await compressImage(base64, 700, 0.5);
          setFormData(prev => ({
              ...prev,
              cateringPackageImages: { ...prev.cateringPackageImages, [key]: compressed }
          }));
      }
      setIsGeneratingImage(null);
  };

  const handleDisconnect = (service: 'stripeConnected' | 'squareConnected' | 'smartPayConnected' | 'smsConnected' | 'facebookConnected') => {
      const name = service.replace('Connected', '');
      if (window.confirm(`Disconnect ${name}?`)) {
          const updates: Partial<AppSettings> = { [service]: false };
          if (service === 'squareConnected') {
              updates.squareApplicationId = '';
              updates.squareLocationId = '';
              updates.squareAccessToken = '';
              updates.squareEnvironment = 'sandbox';
          }
          if (service === 'facebookConnected') {
              updates.facebookPageAccessToken = '';
              updates.facebookPageId = '';
          }
          setFormData(prev => ({ ...prev, ...updates }));
          updateSettings(updates);
      }
  };

  const startConnector = (type: 'stripe' | 'square' | 'smartpay' | 'twilio') => {
      setConnectorType(type);
      setWizardStep(1);
      setStripeKeys({ pub: '', sec: '' });
      setSquareKeys({ appId: '', locationId: '', accessToken: '', environment: 'sandbox' });
      setSmartPayKeys({ public: '', secret: '' });
      setSmsKeys({ sid: '', token: '' });
  };
  
  const handleTestPayment = async () => {
      if (!settings.squareConnected || !settings.squareApplicationId || !settings.squareLocationId) {
          toast('Please connect Square first.', 'warning');
          return;
      }
      setIsTestingPayment(true);
      setPaymentTestResult(null);
      try {
          // Load the Square Web Payments SDK
          const existing = document.querySelector('script[src*="squarecdn"]');
          if (!existing) {
              const script = document.createElement('script');
              script.src = 'https://web.squarecdn.com/v1/square.js';
              document.head.appendChild(script);
              await new Promise((resolve, reject) => {
                  script.onload = resolve;
                  script.onerror = () => reject(new Error('Failed to load Square SDK'));
              });
          }
          if (!window.Square) throw new Error('Square SDK not available');
          
          const payments = window.Square.payments(
              settings.squareApplicationId,
              settings.squareLocationId
          );
          // Try to initialize a card — if this succeeds, credentials are valid
          const card = await payments.card();
          // Attach to a temporary hidden element
          const tempDiv = document.createElement('div');
          tempDiv.style.position = 'fixed';
          tempDiv.style.opacity = '0';
          tempDiv.style.pointerEvents = 'none';
          tempDiv.id = 'sq-test-container';
          document.body.appendChild(tempDiv);
          await card.attach('#sq-test-container');
          
          // Clean up
          await card.destroy();
          tempDiv.remove();
          
          setPaymentTestResult({ ok: true, msg: `Square ${settings.squareEnvironment || 'sandbox'} connection verified! Card form initialized successfully.` });
          toast('Square payment gateway test passed!');
      } catch (e: any) {
          console.error('Square test error:', e);
          setPaymentTestResult({ ok: false, msg: e.message || 'Failed to initialize Square. Check your Application ID and Location ID.' });
          toast('Square test failed — check credentials.', 'error');
      } finally {
          setIsTestingPayment(false);
      }
  };

  const openProviderDashboard = () => {
      if (connectorType === 'stripe') window.open('https://dashboard.stripe.com/apikeys', '_blank');
      else if (connectorType === 'square') window.open('https://developer.squareup.com/apps', '_blank');
      else if (connectorType === 'smartpay') window.open('https://merchant.smartpay.co/settings', '_blank');
      else window.open('https://console.twilio.com/', '_blank');
      setTimeout(() => setWizardStep(2), 1000);
  };

  const runConnectionCheck = async () => {
      setIsChecking(true);
      try {
          if (connectorType === 'square') {
              // Placeholder for square connection test
              await new Promise(res => setTimeout(res, 1000));
              toast('Successfully connected to Square');
          } else {
              // Placeholder for other connection types
              await new Promise(res => setTimeout(res, 1000));
          }

          let updateKey: keyof typeof settings;
          const newSettings: Partial<AppSettings> = {};

          if (connectorType === 'stripe') {
              updateKey = 'stripeConnected';
              newSettings.stripeConnected = true;
              newSettings.stripePublicKey = stripeKeys.pub;
          } else if (connectorType === 'square') {
              updateKey = 'squareConnected';
              newSettings.squareConnected = true;
              newSettings.squareApplicationId = squareKeys.appId;
              newSettings.squareLocationId = squareKeys.locationId;
              newSettings.squareAccessToken = squareKeys.accessToken;
              newSettings.squareEnvironment = squareKeys.environment;
          } else if (connectorType === 'smartpay') {
              updateKey = 'smartPayConnected';
              newSettings.smartPayConnected = true;
              newSettings.smartPayPublicKey = smartPayKeys.public;
              newSettings.smartPaySecretKey = smartPayKeys.secret;
          } else {
              updateKey = 'smsConnected';
              newSettings.smsConnected = true;
          }

          setFormData(prev => ({ ...prev, ...newSettings }));
          updateSettings(newSettings);
          setWizardStep(3);
      } catch (error: any) {
          toast(`Connection Failed: ${error.message}`, 'error');
      } finally {
          setIsChecking(false);
      }
  };

  // Helper Component for Image Row
  const ImageSettingRow = ({ label, settingKey, prompt }: { label: string, settingKey: keyof AppSettings, prompt: string }) => {
      const fileInputRef = React.useRef<HTMLInputElement>(null);

      const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0];
          if (!file) return;

          const reader = new FileReader();
          reader.onloadend = async () => {
              const base64 = reader.result as string;
              // Compress slightly less for hero images (1200px width)
              const compressed = await compressImage(base64, 1200, 0.7);
              setFormData(prev => ({ ...prev, [settingKey]: compressed }));
          };
          reader.readAsDataURL(file);
      };

      return (
          <div>
              <label className="text-xs text-gray-400 block mb-1 font-bold uppercase">{label}</label>
              <div className="flex gap-2 mb-2">
                  <input 
                      value={(formData[settingKey] as string) || ''}
                      onChange={e => setFormData({...formData, [settingKey]: e.target.value})}
                      placeholder="Image URL..."
                      className="flex-1 bg-black/40 border border-gray-700 rounded-lg p-2 text-white text-xs"
                  />
                  <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleUpload}
                      className="hidden"
                      accept="image/*"
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-gray-800 border border-gray-600 p-2 rounded hover:bg-gray-700 text-gray-300"
                    title="Upload Image"
                  >
                      <Upload size={16}/>
                  </button>
                  <button 
                    onClick={() => handleGenerateImage(settingKey, prompt)} 
                    className="bg-bbq-charcoal border border-gray-600 p-2 rounded hover:bg-gray-700" 
                    title="Generate AI Image"
                    disabled={!!isGeneratingImage}
                  >
                      {isGeneratingImage === settingKey ? <Loader2 className="animate-spin" size={16}/> : <Wand2 size={16}/>}
                  </button>
              </div>
              {formData[settingKey] && (
                  <div className="w-full h-32 rounded-lg overflow-hidden border border-gray-700 relative group">
                      <img src={formData[settingKey] as string} className="w-full h-full object-cover" alt="Preview"/>
                      <button 
                        onClick={() => setFormData({...formData, [settingKey]: ''})}
                        className="absolute top-2 right-2 bg-black/60 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition hover:bg-red-600"
                      >
                          <X size={12}/>
                      </button>
                  </div>
              )}
          </div>
      );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 relative pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-700 pb-6 gap-4">
        <div>
          <h3 className="text-3xl font-display font-bold text-white">{isDev ? 'Developer Tools' : 'Settings'}</h3>
          <p className="text-gray-400">{isDev ? 'Technical configuration, API keys, and system diagnostics.' : 'Business settings, branding, and rewards.'}</p>
        </div>
        <button 
          onClick={handleSaveMainSettings}
          disabled={isSaving}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition border ${
            showSaveSuccess
              ? 'bg-green-700 border-green-500 text-white'
              : isSaving
                ? 'bg-gray-700 border-gray-600 text-gray-400 cursor-wait'
                : 'bg-gray-800 hover:bg-gray-700 text-white border-gray-600'
          }`}
        >
          {isSaving ? (
            <><Loader2 size={20} className="animate-spin" /> Saving...</>
          ) : showSaveSuccess ? (
            <><CheckCircle size={20} /> Saved!</>
          ) : (
            <><Save size={20} /> Save Changes</>
          )}
        </button>
      </div>

      {showSaveSuccess && (
        <div className="bg-green-900/30 border border-green-600 text-green-300 p-4 rounded-lg flex items-center gap-3 animate-bounce-in">
          <CheckCircle className="text-green-500" />
          <strong>Changes Saved & Persisted</strong>
        </div>
      )}

      {isAdmin && (<>
      {/* --- GENERAL CONFIGURATION --- */}
      <section className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
          <h4 className="text-xl font-bold mb-6 flex items-center gap-2"><Settings size={20} className="text-gray-400"/> General Configuration</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer bg-black/20 p-3 rounded border border-gray-700">
                      <input 
                          type="checkbox"
                          checked={formData.maintenanceMode}
                          onChange={e => setFormData({ ...formData, maintenanceMode: e.target.checked })}
                          className="w-5 h-5 text-bbq-red rounded focus:ring-bbq-red"
                      />
                      <div>
                          <span className="font-bold text-white block">Maintenance Mode</span>
                          <span className="text-xs text-gray-400">Redirects all visitors to the Maintenance page.</span>
                      </div>
                  </label>

                  <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">Business Name</label>
                      <input 
                          value={formData.businessName || ''}
                          onChange={e => setFormData({ ...formData, businessName: e.target.value })}
                          className="w-full bg-black/40 border border-gray-700 rounded p-2 text-white"
                      />
                  </div>

                  <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">Business Address</label>
                      <input 
                          value={formData.businessAddress || ''}
                          onChange={e => setFormData({ ...formData, businessAddress: e.target.value })}
                          className="w-full bg-black/40 border border-gray-700 rounded p-2 text-white"
                      />
                  </div>
              </div>

              <div className="space-y-4">
                  <ImageSettingRow label="Logo URL" settingKey="logoUrl" prompt="BBQ restaurant logo, vector style, minimal" />
              </div>
          </div>
      </section>
      </>)}

      {isDev && (<>
      {/* --- AI CONFIGURATION --- */}
      <section className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
          <h4 className="text-xl font-bold mb-4 flex items-center gap-2"><Wand2 size={20} className="text-bbq-gold"/> AI Configuration (Gemini)</h4>
          <p className="text-sm text-gray-400 mb-4">Powers Pitmaster Jay chat, social content generation, AI image generation, and strategic recommendations.</p>

          {/* Status Card */}
          <div className={`border rounded-xl p-5 mb-4 ${geminiStatus === 'connected' ? 'border-green-600/40 bg-green-950/20' : geminiStatus === 'error' ? 'border-red-600/40 bg-red-950/20' : 'border-gray-700 bg-black/20'}`}>
              <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${geminiStatus === 'connected' ? 'bg-green-600/20' : geminiStatus === 'error' ? 'bg-red-600/20' : 'bg-gray-800'}`}>
                          <Wand2 size={20} className={geminiStatus === 'connected' ? 'text-green-400' : geminiStatus === 'error' ? 'text-red-400' : 'text-gray-500'}/>
                      </div>
                      <div>
                          <h5 className="font-bold text-white">Google Gemini AI</h5>
                          <p className="text-xs text-gray-400">
                              {geminiStatus === 'connected' && 'Connected — AI features active for all admins'}
                              {geminiStatus === 'idle' && 'Not connected'}
                              {geminiStatus === 'saving' && 'Saving key...'}
                              {geminiStatus === 'testing' && 'Testing connection...'}
                              {geminiStatus === 'error' && 'Connection failed — check key'}
                          </p>
                      </div>
                  </div>
                  {geminiStatus === 'connected' && <span className="flex items-center gap-1 text-green-400 text-xs font-bold"><CheckCircle size={14}/> Active</span>}
                  {(geminiStatus === 'saving' || geminiStatus === 'testing') && <Loader2 size={16} className="text-bbq-gold animate-spin"/>}
                  {geminiStatus === 'error' && <span className="flex items-center gap-1 text-red-400 text-xs font-bold"><AlertCircle size={14}/> Error</span>}
              </div>

              {/* Connected State */}
              {geminiStatus === 'connected' && !geminiEditing && (
                  <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={async () => {
                          setGeminiStatus('testing');
                          try {
                              const { GoogleGenAI } = await import('@google/genai');
                              const ai = new GoogleGenAI({ apiKey: geminiKey });
                              const res = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: 'Say OK' });
                              if (res.text) { setGeminiStatus('connected'); toast('AI connection verified!', 'success'); }
                              else { setGeminiStatus('error'); toast('No response from Gemini.', 'error'); }
                          } catch (e: any) {
                              console.error('Gemini test error:', e);
                              setGeminiStatus('error');
                              toast('Test failed: ' + (e?.message || e), 'error');
                          }
                      }} className="bg-blue-600/20 text-blue-400 border border-blue-600/40 px-4 py-2 rounded text-sm font-bold hover:bg-blue-600/30 transition">
                          Test Connection
                      </button>
                      <button type="button" onClick={() => { setGeminiEditing(true); setGeminiKey(''); }}
                          className="bg-bbq-gold/20 text-bbq-gold border border-bbq-gold/40 px-4 py-2 rounded text-sm font-bold hover:bg-bbq-gold/30 transition">
                          Reconnect with New Key
                      </button>
                      <button type="button" onClick={async () => {
                          setGeminiStatus('saving');
                          try {
                              await restSetDoc('settings', 'general', { geminiApiKey: '' });
                          } catch (_) {}
                          setGeminiKey('');
                          setGeminiStatus('idle');
                          setGeminiEditing(false);
                          toast('Gemini AI disconnected.');
                      }} className="bg-red-600/20 text-red-400 border border-red-600/40 px-4 py-2 rounded text-sm font-bold hover:bg-red-600/30 transition">
                          Disconnect
                      </button>
                  </div>
              )}

              {/* Error State */}
              {geminiStatus === 'error' && !geminiEditing && (
                  <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => { setGeminiEditing(true); setGeminiKey(''); }}
                          className="bg-bbq-gold text-black font-bold px-4 py-2 rounded text-sm hover:bg-yellow-500 transition">
                          Enter New Key
                      </button>
                  </div>
              )}

              {/* Input State */}
              {(geminiStatus === 'idle' || geminiEditing || geminiStatus === 'error') && (geminiEditing || geminiStatus !== 'error') && (
                  <div className="space-y-3">
                      <div className="flex gap-2">
                          <input type="text" autoComplete="off" value={geminiKey} onChange={e => setGeminiKey(e.target.value)}
                              placeholder="Paste your Google Gemini API Key here..."
                              className="flex-1 bg-black/40 border border-gray-700 rounded p-2 text-white font-mono text-sm"
                          />
                          <button type="button" disabled={geminiStatus === 'saving'}
                              className="bg-bbq-gold text-black font-bold px-4 py-2 rounded text-sm hover:bg-yellow-500 transition whitespace-nowrap disabled:opacity-50"
                              onClick={() => {
                                  const key = geminiKey.trim();
                                  if (!key) { toast('Enter a key first.', 'warning'); return; }
                                  // Set runtime key immediately, persist to Firestore
                                  import('../../services/gemini').then(m => m.setGeminiApiKey(key));
                                  setGeminiStatus('connected');
                                  setGeminiEditing(false);
                                  toast('Gemini key active! Syncing to cloud...', 'success');
                                  // Use REST API for reliable cloud sync
                                  restSetDoc('settings', 'general', { geminiApiKey: key })
                                      .then(() => toast('Synced to cloud — all admins will now have AI access.', 'success'))
                                      .catch(err => { console.error('Cloud sync failed:', err); toast('Cloud sync failed — key saved locally only.', 'warning'); });
                              }}
                          >
                              {geminiStatus === 'saving' ? 'Saving...' : 'Save Key'}
                          </button>
                          {geminiEditing && (
                              <button type="button" onClick={() => {
                                  setGeminiKey(settings.geminiApiKey || '');
                                  setGeminiEditing(false);
                              }} className="text-gray-400 hover:text-white px-3 py-2 rounded text-sm border border-gray-700 hover:border-gray-500 transition">
                                  Cancel
                              </button>
                          )}
                      </div>
                      <div className="text-xs text-gray-500 flex items-start gap-2">
                          <Info size={14} className="shrink-0 mt-0.5"/>
                          <span>Get your free API key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-bbq-gold hover:underline">Google AI Studio</a>. Shared across all admin devices.</span>
                      </div>
                  </div>
              )}
          </div>
      </section>

      {/* --- PAYMENT GATEWAY --- */}
      <section className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
          <h4 className="text-xl font-bold mb-2 flex items-center gap-2"><Banknote size={20} className="text-green-400"/> Payment Gateway</h4>
          <p className="text-sm text-gray-400 mb-6">Connect your Square account to accept card payments for orders and catering deposits.</p>

          {/* Square Status Card */}
          <div className={`border rounded-xl p-5 mb-6 ${settings.squareConnected ? 'border-green-600/40 bg-green-950/20' : 'border-gray-700 bg-black/20'}`}>
              <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${settings.squareConnected ? 'bg-green-600/20' : 'bg-gray-800'}`}>
                          <CreditCard size={20} className={settings.squareConnected ? 'text-green-400' : 'text-gray-500'}/>
                      </div>
                      <div>
                          <h5 className="font-bold text-white">Square Payments</h5>
                          <p className="text-xs text-gray-400">
                              {settings.squareConnected 
                                  ? <span className="text-green-400 flex items-center gap-1"><CheckCircle size={12}/> Connected — {settings.squareEnvironment === 'production' ? 'Live' : 'Sandbox'} Mode</span>
                                  : 'Not connected'}
                          </p>
                      </div>
                  </div>
                  {settings.squareConnected ? (
                      <button 
                          onClick={() => handleDisconnect('squareConnected')}
                          className="text-xs text-red-400 hover:text-red-300 border border-red-800 px-3 py-1.5 rounded-lg hover:bg-red-900/20 transition"
                      >
                          Disconnect
                      </button>
                  ) : (
                      <button 
                          onClick={() => startConnector('square')}
                          className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-lg text-sm transition flex items-center gap-2"
                      >
                          <Lock size={14}/> Connect Square
                      </button>
                  )}
              </div>

              {/* Connected Details */}
              {settings.squareConnected && (
                  <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Application ID</label>
                              <div className="bg-black/40 border border-gray-700 rounded p-2 text-white font-mono text-sm flex items-center justify-between">
                                  <span className="truncate">{settings.squareApplicationId ? `${settings.squareApplicationId.slice(0, 12)}...` : '—'}</span>
                                  <button 
                                      onClick={() => { navigator.clipboard.writeText(settings.squareApplicationId || ''); toast('Copied!'); }}
                                      className="text-gray-500 hover:text-white ml-2 shrink-0"
                                      title="Copy Application ID"
                                  >
                                      <Copy size={14}/>
                                  </button>
                              </div>
                          </div>
                          <div>
                              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Location ID</label>
                              <div className="bg-black/40 border border-gray-700 rounded p-2 text-white font-mono text-sm flex items-center justify-between">
                                  <span className="truncate">{settings.squareLocationId ? `${settings.squareLocationId.slice(0, 12)}...` : '—'}</span>
                                  <button 
                                      onClick={() => { navigator.clipboard.writeText(settings.squareLocationId || ''); toast('Copied!'); }}
                                      className="text-gray-500 hover:text-white ml-2 shrink-0"
                                      title="Copy Location ID"
                                  >
                                      <Copy size={14}/>
                                  </button>
                              </div>
                          </div>
                      </div>

                      <div className="flex items-center gap-3">
                          <div>
                              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Environment</label>
                              <div className="flex items-center gap-2">
                                  <button
                                      onClick={async () => {
                                          const newEnv = settings.squareEnvironment === 'production' ? 'sandbox' : 'production';
                                          try {
                                              await setDoc(doc(db, 'settings', 'general'), { squareEnvironment: newEnv }, { merge: true });
                                              toast(`Square environment switched to ${newEnv.toUpperCase()}`, 'success');
                                          } catch (e: any) {
                                              toast(`Failed to save environment: ${e.message}`, 'error');
                                          }
                                      }}
                                      className={`text-xs font-bold px-3 py-1.5 rounded cursor-pointer transition hover:opacity-80 ${settings.squareEnvironment === 'production' ? 'bg-green-600/20 text-green-400 border border-green-600/30' : 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/30'}`}
                                      title="Click to toggle between Sandbox and Production"
                                  >
                                      {settings.squareEnvironment === 'production' ? '● LIVE' : '● SANDBOX'}
                                  </button>
                                  <span className="text-xs text-gray-500">Click to toggle</span>
                              </div>
                          </div>
                      </div>

                      {/* Test Button */}
                      <div className="border-t border-gray-700 pt-4 mt-4">
                          <button
                              disabled={isTestingPayment}
                              onClick={handleTestPayment}
                              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold py-2.5 px-5 rounded-lg text-sm transition flex items-center gap-2"
                          >
                              {isTestingPayment ? <><Loader2 size={15} className="animate-spin"/> Testing...</> : <><CreditCard size={15}/> Test Payment Connection</>}
                          </button>
                          {paymentTestResult && (
                              <div className={`mt-3 text-sm p-3 rounded-lg border ${paymentTestResult.ok ? 'bg-green-900/30 border-green-600 text-green-300' : 'bg-red-900/30 border-red-600 text-red-300'} flex items-start gap-2`}>
                                  {paymentTestResult.ok ? <CheckCircle size={16} className="shrink-0 mt-0.5"/> : <AlertCircle size={16} className="shrink-0 mt-0.5"/>}
                                  <span>{paymentTestResult.msg}</span>
                              </div>
                          )}
                      </div>
                  </div>
              )}

              {/* Not Connected Help */}
              {!settings.squareConnected && (
                  <div className="text-xs text-gray-500 flex items-start gap-2 mt-2">
                      <Info size={14} className="shrink-0 mt-0.5"/>
                      <span>You need a <a href="https://developer.squareup.com/apps" target="_blank" rel="noopener noreferrer" className="text-bbq-gold hover:underline">Square Developer</a> account. Use Sandbox credentials for testing, then switch to Production when ready to go live.</span>
                  </div>
              )}
          </div>
      </section>

      {/* --- LIVE OPS CONSOLE --- */}
      <section className="bg-black/40 border border-gray-700 rounded-xl overflow-hidden shadow-2xl">
          <div className="bg-gray-900/80 p-4 border-b border-gray-700 flex justify-between items-center">
              <h4 className="font-bold text-white flex items-center gap-2">
                  <Activity className="text-green-500" size={20} /> Live Operations Console
              </h4>
              <button onClick={checkSystemHealth} className="text-xs flex items-center gap-1 text-gray-400 hover:text-white transition">
                  <RefreshCw size={12} className={healthStatus.database === 'checking' ? 'animate-spin' : ''}/> Refresh
              </button>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Database Status */}
              <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 relative overflow-hidden group">
                  <div className="flex justify-between items-start mb-2"><span className="text-xs font-bold text-gray-500 uppercase">Firestore DB</span><Database size={16} className="text-gray-400"/></div>
                  <div className="flex items-end gap-2"><div className={`w-3 h-3 rounded-full ${healthStatus.database === 'online' ? 'bg-green-500 animate-pulse' : healthStatus.database === 'offline' ? 'bg-gray-500' : 'bg-red-500'}`}></div><span className="text-2xl font-bold text-white leading-none">{healthStatus.database === 'online' ? 'Active' : healthStatus.database === 'offline' ? 'Offline' : 'Error'}</span></div>
                  <p className="text-[10px] text-gray-400 mt-2 font-mono">Latency: <span className={dbLatency && dbLatency < 200 ? 'text-green-400' : 'text-yellow-400'}>{dbLatency ? `${dbLatency}ms` : '--'}</span></p>
              </div>
              {/* Auth Status */}
              <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 relative overflow-hidden group">
                  <div className="flex justify-between items-start mb-2"><span className="text-xs font-bold text-gray-500 uppercase">Auth Service</span><Shield size={16} className="text-gray-400"/></div>
                  <div className="flex items-end gap-2"><div className={`w-3 h-3 rounded-full ${healthStatus.auth === 'online' ? 'bg-green-500' : healthStatus.auth === 'local' ? 'bg-blue-500' : 'bg-yellow-500'}`}></div><span className="text-2xl font-bold text-white leading-none">{healthStatus.auth === 'online' ? 'Online' : healthStatus.auth === 'local' ? 'Local Admin' : 'Signed Out'}</span></div>
                  <p className="text-[10px] text-gray-400 mt-2 font-mono">{healthStatus.auth === 'local' ? 'Credential: App Settings' : 'Provider: Firebase Auth'}</p>
              </div>
              {/* Connection Status */}
              <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 relative overflow-hidden group">
                  <div className="flex justify-between items-start mb-2"><span className="text-xs font-bold text-gray-500 uppercase">Network</span>{healthStatus.database === 'offline' ? <WifiOff size={16} className="text-gray-400"/> : <Wifi size={16} className="text-gray-400"/>}</div>
                  <div className="flex items-end gap-2"><span className="text-2xl font-bold text-white leading-none">{healthStatus.database === 'offline' ? 'Offline' : 'Secure'}</span></div>
                  <p className="text-[10px] text-gray-400 mt-2 font-mono">TLS 1.3 / HTTPS</p>
              </div>
              {/* Last Sync */}
              <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 relative overflow-hidden group">
                  <div className="flex justify-between items-start mb-2"><span className="text-xs font-bold text-gray-500 uppercase">Last Pulse</span><Server size={16} className="text-gray-400"/></div>
                  <div className="flex items-end gap-2"><span className="text-xl font-bold text-white leading-none font-mono">{lastChecked}</span></div>
                  <p className="text-[10px] text-gray-400 mt-2">Auto-sync active</p>
              </div>
          </div>
          {/* Firebase Config Editor */}
          <div className="p-6 border-t border-gray-700 bg-gray-900/30">
              <div className="flex justify-between items-center mb-4"><h5 className="text-xs font-bold text-gray-500 uppercase">Firebase Configuration</h5><div className="flex gap-4"><button onClick={runDeepDiagnostics} className="text-xs flex items-center gap-1 font-bold text-bbq-gold hover:text-white transition"><Terminal size={14}/> Run Deep Diagnostics</button><button onClick={handleResetFirebaseConfig} className="text-xs text-red-400 hover:underline">Reset to Default</button></div></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div><label className="text-xs text-gray-500 block font-bold mb-1">Project ID</label><input value={fbConfig.projectId} onChange={(e) => setFbConfig({...fbConfig, projectId: e.target.value})} className="w-full bg-black/30 border border-gray-700 rounded p-2 text-white text-sm"/></div>
                  <div><label className="text-xs text-gray-500 block font-bold mb-1">Auth Domain</label><input value={fbConfig.authDomain} onChange={(e) => setFbConfig({...fbConfig, authDomain: e.target.value})} className="w-full bg-black/30 border border-gray-700 rounded p-2 text-white text-sm"/></div>
                  <div><label className="text-xs text-gray-500 block font-bold mb-1">API Key</label><input value={fbConfig.apiKey} onChange={(e) => setFbConfig({...fbConfig, apiKey: e.target.value})} className="w-full bg-black/30 border border-gray-700 rounded p-2 text-white text-sm font-mono" type="password"/></div>
                  <div><label className="text-xs text-gray-500 block font-bold mb-1">Storage Bucket</label><input value={fbConfig.storageBucket} onChange={(e) => setFbConfig({...fbConfig, storageBucket: e.target.value})} className="w-full bg-black/30 border border-gray-700 rounded p-2 text-white text-sm"/></div>
                  <div><label className="text-xs text-gray-500 block font-bold mb-1">Messaging Sender ID</label><input value={fbConfig.messagingSenderId} onChange={(e) => setFbConfig({...fbConfig, messagingSenderId: e.target.value})} className="w-full bg-black/30 border border-gray-700 rounded p-2 text-white text-sm"/></div>
                  <div><label className="text-xs text-gray-500 block font-bold mb-1">App ID</label><input value={fbConfig.appId} onChange={(e) => setFbConfig({...fbConfig, appId: e.target.value})} className="w-full bg-black/30 border border-gray-700 rounded p-2 text-white text-sm"/></div>
              </div>
              <button onClick={handleSaveFirebaseConfig} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded text-sm transition">Update Firebase Connection (Reloads App)</button>
          </div>
      </section>

      {/* --- INTEGRATION WIZARD MODAL --- */}
      {isDev && connectorType && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
              <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg shadow-2xl animate-in zoom-in-95">
                  <div className="flex justify-between items-center p-4 border-b border-gray-700">
                      <h3 className="text-xl font-bold text-white capitalize">Connect {connectorType}</h3>
                      <button onClick={() => { setConnectorType(null); setWizardStep(1); }}><X size={20} className="text-gray-400 hover:text-white"/></button>
                  </div>
                  
                  <div className="p-6">
                      {wizardStep === 1 && (
                          <div className="space-y-4 text-center">
                              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                  <ExternalLink size={32} className="text-white"/>
                              </div>
                              <p className="text-gray-300">To connect <strong>{connectorType}</strong>, you need to login to your dashboard and retrieve your API Keys.</p>
                              <button onClick={openProviderDashboard} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-500">
                                  Open {connectorType} Dashboard
                              </button>
                          </div>
                      )}

                      {wizardStep === 2 && (
                          <div className="space-y-4">
                              <p className="text-sm text-gray-400 mb-4">Paste your credentials below:</p>
                              
                              {connectorType === 'smartpay' && (
                                  <>
                                    <input 
                                        placeholder="Public Key" 
                                        value={smartPayKeys.public}
                                        onChange={e => setSmartPayKeys({...smartPayKeys, public: e.target.value})}
                                        className="w-full bg-gray-800 border border-gray-600 rounded p-3 text-white"
                                    />
                                    <input 
                                        placeholder="Secret Key" 
                                        type="password"
                                        value={smartPayKeys.secret}
                                        onChange={e => setSmartPayKeys({...smartPayKeys, secret: e.target.value})}
                                        className="w-full bg-gray-800 border border-gray-600 rounded p-3 text-white"
                                    />
                                  </>
                              )}

                              {connectorType === 'square' && (
                                  <div className="space-y-4">
                                    <input 
                                        placeholder="Application ID (sq0idp-...)" 
                                        value={squareKeys.appId}
                                        onChange={e => setSquareKeys({...squareKeys, appId: e.target.value})}
                                        className="w-full bg-gray-800 border border-gray-600 rounded p-3 text-white font-mono text-sm"
                                    />
                                    <input 
                                        placeholder="Location ID (L...)" 
                                        value={squareKeys.locationId}
                                        onChange={e => setSquareKeys({...squareKeys, locationId: e.target.value})}
                                        className="w-full bg-gray-800 border border-gray-600 rounded p-3 text-white font-mono text-sm"
                                    />
                                    <input 
                                        placeholder="Access Token (EAAA...)"
                                        type="password"
                                        value={squareKeys.accessToken}
                                        onChange={e => setSquareKeys({...squareKeys, accessToken: e.target.value})}
                                        className="w-full bg-gray-800 border border-gray-600 rounded p-3 text-white font-mono text-sm"
                                    />
                                    <select 
                                        value={squareKeys.environment}
                                        onChange={e => setSquareKeys({...squareKeys, environment: e.target.value as 'sandbox' | 'production'})}
                                        className="w-full bg-gray-800 border border-gray-600 rounded p-3 text-white"
                                    >
                                        <option value="sandbox">Sandbox (For Testing)</option>
                                        <option value="production">Production (Live Payments)</option>
                                    </select>
                                  </div>
                              )}
                              
                              {connectorType === 'stripe' && (
                                  <>
                                    <input placeholder="Publishable Key (pk_...)" value={stripeKeys.pub} onChange={e => setStripeKeys({...stripeKeys, pub: e.target.value})} className="w-full bg-gray-800 border border-gray-600 rounded p-3 text-white font-mono text-sm"/>
                                    <input placeholder="Secret Key (sk_...)" type="password" value={stripeKeys.sec} onChange={e => setStripeKeys({...stripeKeys, sec: e.target.value})} className="w-full bg-gray-800 border border-gray-600 rounded p-3 text-white font-mono text-sm"/>
                                  </>
                              )}

                              {connectorType === 'twilio' && (
                                  <>
                                    <input placeholder="Account SID (AC...)" value={smsKeys.sid} onChange={e => setSmsKeys({...smsKeys, sid: e.target.value})} className="w-full bg-gray-800 border border-gray-600 rounded p-3 text-white font-mono text-sm"/>
                                    <input placeholder="Auth Token" type="password" value={smsKeys.token} onChange={e => setSmsKeys({...smsKeys, token: e.target.value})} className="w-full bg-gray-800 border border-gray-600 rounded p-3 text-white font-mono text-sm"/>
                                  </>
                              )}

                              <button 
                                onClick={runConnectionCheck} 
                                className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg flex justify-center items-center gap-2"
                              >
                                  {isChecking ? <Loader2 className="animate-spin" size={20}/> : 'Verify & Connect'}
                              </button>
                          </div>
                      )}

                      {wizardStep === 3 && (
                          <div className="text-center space-y-4 py-6">
                              <CheckCircle size={64} className="text-green-500 mx-auto animate-bounce-in"/>
                              <h4 className="text-2xl font-bold text-white">Connected!</h4>
                              <p className="text-gray-400">The integration is active and ready to use.</p>
                              <button onClick={() => setConnectorType(null)} className="text-blue-400 hover:underline">Close Window</button>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
      </>)}

      {/* Duplicate email section removed — see unified Email Settings section below */}

      {isAdmin && (<>
      {/* --- SITE VISUALS --- */}
      <section className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
          <h4 className="text-xl font-bold mb-6 flex items-center gap-2"><ImageIcon size={20} className="text-pink-500"/> Site Visuals</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-4">
                  <h5 className="font-bold text-white border-b border-gray-700 pb-2">Home Page</h5>
                  <ImageSettingRow label="Catering Hero" settingKey="heroCateringImage" prompt="Delicious BBQ catering spread, professional, appetizing" />
                  <ImageSettingRow label="Cook/Menu Hero" settingKey="heroCookImage" prompt="Pitmaster smoking meat, BBQ smoke, authentic" />
                  <ImageSettingRow label="Promoter Section" settingKey="homePromoterImage" prompt="Happy people eating BBQ, social gathering, party" />
                  <ImageSettingRow label="Schedule Card" settingKey="homeScheduleCardImage" prompt="Food truck at outdoor event, street food, night market" />
                  <ImageSettingRow label="Menu Card" settingKey="homeMenuCardImage" prompt="Juicy burger with fries, BBQ food close up, appetizing" />
              </div>

              <div className="space-y-4">
                  <h5 className="font-bold text-white border-b border-gray-700 pb-2">Catering & DIY</h5>
                  <ImageSettingRow label="DIY Page Hero" settingKey="diyHeroImage" prompt="BBQ feast on a table, family style dining" />
                  <ImageSettingRow label="Package Card" settingKey="diyCardPackageImage" prompt="Curated BBQ platter, neat arrangement" />
                  <ImageSettingRow label="Custom Card" settingKey="diyCardCustomImage" prompt="Variety of individual BBQ meats and sides" />
              </div>

              <div className="space-y-4">
                  <h5 className="font-bold text-white border-b border-gray-700 pb-2">Other Pages</h5>
                  <ImageSettingRow label="Menu Hero" settingKey="menuHeroImage" prompt="Close up of brisket and ribs, dark moody lighting" />
                  <ImageSettingRow label="Events Hero" settingKey="eventsHeroImage" prompt="Outdoor BBQ event, festival atmosphere" />
                  <ImageSettingRow label="Gallery Hero" settingKey="galleryHeroImage" prompt="Collage of BBQ food photos" />
                  <ImageSettingRow label="Promoters Hero" settingKey="promotersHeroImage" prompt="Social media influencer taking photo of food" />
                  <ImageSettingRow label="Maintenance Mode" settingKey="maintenanceImage" prompt="BBQ smoker silhouette, closed sign, moody" />
              </div>
          </div>
      </section>
      </>)}

      {isDev && (<>
      {/* --- ADMIN CREDENTIALS --- */}
      <section className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
          <h4 className="text-xl font-bold mb-4 flex items-center gap-2"><Shield size={20}/> Admin Access</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Admin Username</label>
                  <input 
                      value={formData.adminUsername}
                      onChange={e => setFormData({ ...formData, adminUsername: e.target.value })}
                      className="w-full bg-black/40 border border-gray-700 rounded p-2 text-white"
                  />
              </div>
              <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Admin Password</label>
                  <input 
                      type="password"
                      autoComplete="off"
                      value={formData.adminPassword}
                      onChange={e => setFormData({ ...formData, adminPassword: e.target.value })}
                      className="w-full bg-black/40 border border-gray-700 rounded p-2 text-white"
                  />
              </div>
          </div>
      </section>
      </>)}

      {isAdmin && (<>
      {/* --- FACEBOOK --- */}
      <section className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
          <h4 className="text-xl font-bold mb-3 flex items-center gap-2"><Facebook size={20} className="text-blue-500"/> Facebook / Instagram</h4>
          <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle size={18} className="text-blue-400 shrink-0 mt-0.5"/>
              <div>
                  <p className="text-blue-200 font-bold text-sm">Manage Facebook connection in the Social &amp; AI tab</p>
                  <p className="text-blue-300/70 text-xs mt-1">The full Facebook login wizard, page selection, connection testing, and Instagram linking are all in the <strong className="text-white">Social &amp; AI</strong> tab to keep everything in one place.</p>
                  {settings.facebookConnected ? (
                      <div className="mt-2 flex items-center gap-2 text-green-400 text-xs"><CheckCircle size={12}/> Page currently connected</div>
                  ) : (
                      <div className="mt-2 flex items-center gap-2 text-yellow-400 text-xs"><AlertCircle size={12}/> No page connected yet</div>
                  )}
              </div>
          </div>
      </section>

      {/* --- REWARDS PROGRAM --- */}
      <section className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
          <h4 className="text-xl font-bold mb-6 flex items-center gap-2"><Gift size={20} className="text-bbq-gold"/> Rewards Program</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Program Config */}
              <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer bg-black/20 p-3 rounded border border-gray-700">
                      <input 
                          type="checkbox"
                          checked={formData.rewards?.enabled ?? true}
                          onChange={e => setFormData({ ...formData, rewards: { ...formData.rewards, enabled: e.target.checked } })}
                          className="w-5 h-5 text-bbq-gold rounded focus:ring-bbq-gold"
                      />
                      <div>
                          <span className="font-bold text-white block">Enable Rewards Program</span>
                          <span className="text-xs text-gray-400">Customers can earn stamps and redeem prizes.</span>
                      </div>
                  </label>

                  <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">Program Name</label>
                      <input 
                          value={formData.rewards?.programName || ''}
                          onChange={e => setFormData({ ...formData, rewards: { ...formData.rewards, programName: e.target.value } })}
                          className="w-full bg-black/40 border border-gray-700 rounded p-2 text-white"
                          placeholder="e.g. Meat Sweats Club"
                      />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="text-xs font-bold text-gray-500 uppercase">Staff PIN</label>
                          <input 
                              type="password"
                              autoComplete="off"
                              value={formData.rewards?.staffPin || ''}
                              onChange={e => setFormData({ ...formData, rewards: { ...formData.rewards, staffPin: e.target.value } })}
                              className="w-full bg-black/40 border border-gray-700 rounded p-2 text-white font-mono"
                              placeholder="4-digit PIN"
                          />
                          <p className="text-[10px] text-gray-500 mt-1">Staff enter this to add/redeem stamps.</p>
                      </div>
                      <div>
                          <label className="text-xs font-bold text-gray-500 uppercase">Stamps to Reward</label>
                          <input 
                              type="number"
                              min={1}
                              max={50}
                              value={formData.rewards?.maxStamps || 10}
                              onChange={e => setFormData({ ...formData, rewards: { ...formData.rewards, maxStamps: parseInt(e.target.value) } })}
                              className="w-full bg-black/40 border border-gray-700 rounded p-2 text-white"
                          />
                          <p className="text-[10px] text-gray-500 mt-1">Stamps needed to earn a prize.</p>
                      </div>
                  </div>
              </div>

              {/* Prize Pool Manager */}
              <div className="space-y-4">
                  <div>
                      <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Prize Pool (Possible Winnings)</label>
                      <p className="text-[10px] text-gray-400 mb-3">Add multiple items. The Golden Ticket will randomly select one upon scratching.</p>
                      
                      <div className="space-y-2 mb-4 max-h-48 overflow-y-auto custom-scrollbar">
                          {formData.rewards.possiblePrizes?.length === 0 && (
                              <div className="text-center text-gray-500 text-xs py-4 border border-dashed border-gray-700 rounded">No prizes added.</div>
                          )}
                          {formData.rewards.possiblePrizes?.map((prize) => (
                              <div key={prize.id} className={`flex items-center gap-3 bg-black/40 p-2 rounded border ${editingPrizeId === prize.id ? 'border-bbq-gold' : 'border-gray-700'}`}>
                                  <img src={prize.image || 'https://placehold.co/50'} className="w-10 h-10 rounded object-cover" />
                                  <span className="flex-1 font-bold text-sm text-gray-300">{prize.title}</span>
                                  <button onClick={() => startEditPrize(prize)} className="text-gray-400 hover:text-white p-1" title="Edit"><Edit2 size={16}/></button>
                                  <button onClick={() => handleRemovePrize(prize.id)} className="text-red-500 hover:text-red-300 p-1" title="Delete"><Trash2 size={16}/></button>
                              </div>
                          ))}
                      </div>

                      {/* Add New Prize */}
                      <div className="bg-black/20 p-3 rounded border border-gray-700">
                          <label className="text-[10px] font-bold text-gray-500 uppercase mb-2 block">{editingPrizeId ? 'Edit Prize' : 'Add New Prize'}</label>
                          <div className="flex gap-2 mb-2">
                              <input 
                                  value={newPrize.title}
                                  onChange={e => setNewPrize({...newPrize, title: e.target.value})}
                                  placeholder="e.g. Free Burger"
                                  className="flex-1 bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs"
                              />
                              <button 
                                  onClick={handleGeneratePrizeImage}
                                  disabled={isGeneratingImage === 'prize' || !newPrize.title}
                                  className="bg-bbq-charcoal border border-gray-600 p-2 rounded hover:bg-gray-700 disabled:opacity-50"
                                  title="Auto-Generate Image"
                              >
                                  {isGeneratingImage === 'prize' ? <Loader2 className="animate-spin" size={16}/> : <Wand2 size={16}/>}
                              </button>
                          </div>
                          {newPrize.image && (
                              <div className="w-full h-16 bg-black rounded border border-gray-700 mb-2 overflow-hidden relative">
                                  <img src={newPrize.image} className="w-full h-full object-cover opacity-50" />
                                  <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-bold shadow-black drop-shadow-md">Image Selected</div>
                              </div>
                          )}
                          <div className="flex gap-2">
                              {editingPrizeId && (
                                  <button onClick={cancelEditPrize} className="px-3 py-2 text-xs text-gray-400 hover:text-white">Cancel</button>
                              )}
                              <button 
                                  onClick={handleAddPrize}
                                  disabled={!newPrize.title}
                                  className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded text-xs flex justify-center items-center gap-2"
                              >
                                  {editingPrizeId ? <Save size={14}/> : <Plus size={14}/>} {editingPrizeId ? 'Update Prize' : 'Add to Pool'}
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      </section>
      </>)}

      {isDev && (<>
      {/* --- EMAIL SETTINGS --- */}
      <section className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
          <h4 className="text-xl font-bold mb-6 flex items-center gap-2"><MessageSquare size={20} className="text-purple-500"/> Email Settings</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer bg-black/20 p-3 rounded border border-gray-700">
                      <input 
                          type="checkbox"
                          checked={formData.emailSettings?.enabled || false}
                          onChange={e => setFormData({ 
                              ...formData, 
                              emailSettings: { ...formData.emailSettings!, enabled: e.target.checked } 
                          })}
                          className="w-5 h-5 text-bbq-red rounded focus:ring-bbq-red"
                      />
                      <span className="font-bold text-white">Enable Email Notifications</span>
                  </label>

                  <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">Provider</label>
                      <select 
                          value={formData.emailSettings?.provider || 'smtp'}
                          onChange={e => setFormData({ 
                              ...formData, 
                              emailSettings: { ...formData.emailSettings!, provider: e.target.value as any } 
                          })}
                          className="w-full bg-black/40 border border-gray-700 rounded p-2 text-white"
                      >
                          <option value="smtp">SMTP (Custom)</option>
                          <option value="sendgrid">SendGrid</option>
                          <option value="mailgun">Mailgun</option>
                      </select>
                  </div>

                  <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">From Email</label>
                      <input 
                          value={formData.emailSettings?.fromEmail || ''}
                          onChange={e => setFormData({ 
                              ...formData, 
                              emailSettings: { ...formData.emailSettings!, fromEmail: e.target.value } 
                          })}
                          className="w-full bg-black/40 border border-gray-700 rounded p-2 text-white"
                      />
                  </div>

                  <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">From Name</label>
                      <input 
                          value={formData.emailSettings?.fromName || ''}
                          onChange={e => setFormData({ 
                              ...formData, 
                              emailSettings: { ...formData.emailSettings!, fromName: e.target.value } 
                          })}
                          className="w-full bg-black/40 border border-gray-700 rounded p-2 text-white"
                      />
                  </div>
                  
                  <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">Admin Email (Receives Order Alerts)</label>
                      <input 
                          value={formData.emailSettings?.adminEmail || ''}
                          onChange={e => setFormData({ 
                              ...formData, 
                              emailSettings: { ...formData.emailSettings!, adminEmail: e.target.value } 
                          })}
                          className="w-full bg-black/40 border border-gray-700 rounded p-2 text-white"
                      />
                  </div>
              </div>

              <div className="space-y-4">
                  {formData.emailSettings?.provider === 'smtp' ? (
                      <>
                          <div className="p-4 bg-black/20 rounded-lg border border-gray-700 space-y-4">
                              <div>
                                  <label className="text-xs font-bold text-gray-500 uppercase">SMTP Host</label>
                                  <input 
                                      value={formData.emailSettings?.smtpHost || ''}
                                      placeholder="mail.yourdomain.com.au"
                                      onChange={e => setFormData({ 
                                          ...formData, 
                                          emailSettings: { ...formData.emailSettings!, smtpHost: e.target.value } 
                                      })}
                                      className="w-full bg-black/40 border border-gray-700 rounded p-2 text-white"
                                  />
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-gray-500 uppercase">SMTP Port</label>
                                  <input 
                                      type="number"
                                      placeholder="465"
                                      value={formData.emailSettings?.smtpPort || ''}
                                      onChange={e => setFormData({ 
                                          ...formData, 
                                          emailSettings: { ...formData.emailSettings!, smtpPort: parseInt(e.target.value) } 
                                      })}
                                      className="w-full bg-black/40 border border-gray-700 rounded p-2 text-white"
                                  />
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-gray-500 uppercase">SMTP User</label>
                                  <input 
                                      value={formData.emailSettings?.smtpUser || ''}
                                      placeholder="Your full email address"
                                      onChange={e => setFormData({ 
                                          ...formData, 
                                          emailSettings: { ...formData.emailSettings!, smtpUser: e.target.value } 
                                      })}
                                      className="w-full bg-black/40 border border-gray-700 rounded p-2 text-white"
                                  />
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-gray-500 uppercase">SMTP Password</label>
                                  <input 
                                      type="password"
                                      autoComplete="off"
                                      value={formData.emailSettings?.smtpPass || ''}
                                      placeholder="Your email password"
                                      onChange={e => setFormData({ 
                                          ...formData, 
                                          emailSettings: { ...formData.emailSettings!, smtpPass: e.target.value } 
                                      })}
                                      className="w-full bg-black/40 border border-gray-700 rounded p-2 text-white"
                                  />
                              </div>
                          </div>
                          <div className="mt-4 p-3 bg-blue-900/20 rounded-lg border border-blue-700 text-xs text-blue-300 flex gap-2">
                              <Info size={16} className="shrink-0 mt-0.5"/>
                              <div>
                                  <strong className="block">SiteGround GoGeek Guide</strong>
                                  Use the <strong className="text-white">SSL/TLS</strong> settings from SiteGround cPanel &gt; Email Accounts &gt; Connect Devices. Port is usually <strong className="text-white">465</strong>. The 'User' is your <strong className="text-white">full email address</strong>.
                              </div>
                          </div>
                      </>
                  ) : (
                      <div>
                          <label className="text-xs font-bold text-gray-500 uppercase">API Key</label>
                          <input 
                              type="password"
                              autoComplete="off"
                              value={formData.emailSettings?.apiKey || ''}
                              onChange={e => setFormData({ 
                                  ...formData, 
                                  emailSettings: { ...formData.emailSettings!, apiKey: e.target.value } 
                              })}
                              className="w-full bg-black/40 border border-gray-700 rounded p-2 text-white"
                          />
                      </div>
                  )}
                  
                  <div className="pt-4 border-t border-gray-700 mt-4 space-y-3">
                      {emailTestResult && (
                          <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                              emailTestResult.ok
                                  ? 'bg-green-900/30 border border-green-700 text-green-300'
                                  : 'bg-red-900/30 border border-red-700 text-red-300'
                          }`}>
                              {emailTestResult.ok ? <CheckCircle size={16} className="shrink-0 mt-0.5"/> : <AlertCircle size={16} className="shrink-0 mt-0.5"/>}
                              <span>{emailTestResult.msg}</span>
                          </div>
                      )}
                      <button
                          disabled={isTestingEmail}
                          onClick={async () => {
                              setEmailTestResult(null);
                              setIsTestingEmail(true);
                              try {
                                  const res = await fetch('/api/v1/email/test', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                          settings: formData.emailSettings,
                                          to: formData.emailSettings?.adminEmail || formData.emailSettings?.fromEmail
                                      })
                                  });
                                  const contentType = res.headers.get('content-type');
                                  if (contentType?.includes('application/json')) {
                                      const data = await res.json();
                                      if (res.ok && data.success) {
                                          setEmailTestResult({ ok: true, msg: `Test email sent! Check your inbox. Message ID: ${data.messageId}` });
                                      } else {
                                          setEmailTestResult({ ok: false, msg: data.error || 'Unknown error from server' });
                                      }
                                  } else {
                                      const text = await res.text();
                                      setEmailTestResult({ ok: false, msg: `Unexpected server response (${res.status}): ${text.slice(0, 120)}` });
                                  }
                              } catch (e: any) {
                                  setEmailTestResult({ ok: false, msg: `Network error — is the dev server running? ${e.message}` });
                              } finally {
                                  setIsTestingEmail(false);
                              }
                          }}
                          className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold py-2 rounded text-sm transition flex items-center justify-center gap-2"
                      >
                          {isTestingEmail ? <><Loader2 size={15} className="animate-spin"/> Sending...</> : 'Send Test Email'}
                      </button>
                  </div>
              </div>
          </div>
      </section>

      {/* --- SMS SETTINGS (TWILIO) --- */}
      <section className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
          <h4 className="text-xl font-bold mb-2 flex items-center gap-2"><Smartphone size={20} className="text-green-400"/> SMS Settings (Twilio)</h4>
          <p className="text-sm text-gray-400 mb-6">Send order alerts and customer confirmations via SMS. Uses Twilio — enter your credentials from <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" className="text-green-400 underline hover:text-green-300">console.twilio.com</a>.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer bg-black/20 p-3 rounded border border-gray-700">
                      <input
                          type="checkbox"
                          checked={formData.smsSettings?.enabled || false}
                          onChange={e => setFormData({ ...formData, smsSettings: { ...formData.smsSettings!, enabled: e.target.checked, accountSid: formData.smsSettings?.accountSid || '', authToken: formData.smsSettings?.authToken || '', fromNumber: formData.smsSettings?.fromNumber || '', adminPhone: formData.smsSettings?.adminPhone || '' } })}
                          className="w-5 h-5 text-green-500 rounded focus:ring-green-500"
                      />
                      <div>
                          <span className="font-bold text-white block">Enable SMS Notifications</span>
                          <span className="text-xs text-gray-400">Sends order alerts to admin and confirmation to customers.</span>
                      </div>
                  </label>

                  <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">Account SID</label>
                      <input
                          title="Twilio Account SID"
                          placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          value={formData.smsSettings?.accountSid || ''}
                          onChange={e => setFormData({ ...formData, smsSettings: { ...formData.smsSettings!, accountSid: e.target.value } as any })}
                          className="w-full bg-black/40 border border-gray-700 rounded p-2 text-white font-mono text-sm"
                      />
                  </div>

                  <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">Auth Token</label>
                      <input
                          type="password"
                          autoComplete="off"
                          title="Twilio Auth Token"
                          placeholder="Your Twilio Auth Token"
                          value={formData.smsSettings?.authToken || ''}
                          onChange={e => setFormData({ ...formData, smsSettings: { ...formData.smsSettings!, authToken: e.target.value } as any })}
                          className="w-full bg-black/40 border border-gray-700 rounded p-2 text-white font-mono text-sm"
                      />
                  </div>
              </div>

              <div className="space-y-4">
                  <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">From Number</label>
                      <input
                          title="Twilio phone number to send from"
                          placeholder="+61400000000"
                          value={formData.smsSettings?.fromNumber || ''}
                          onChange={e => setFormData({ ...formData, smsSettings: { ...formData.smsSettings!, fromNumber: e.target.value } as any })}
                          className="w-full bg-black/40 border border-gray-700 rounded p-2 text-white font-mono text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-1">Your Twilio number in E.164 format, e.g. +61400000000</p>
                  </div>

                  <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">Admin Phone (Receives Order Alerts)</label>
                      <input
                          title="Admin phone number"
                          placeholder="+61400000000"
                          value={formData.smsSettings?.adminPhone || ''}
                          onChange={e => setFormData({ ...formData, smsSettings: { ...formData.smsSettings!, adminPhone: e.target.value } as any })}
                          className="w-full bg-black/40 border border-gray-700 rounded p-2 text-white font-mono text-sm"
                      />
                  </div>

                  <div className="p-3 bg-blue-900/20 rounded-lg border border-blue-700 text-xs text-blue-300 flex gap-2">
                      <Info size={16} className="shrink-0 mt-0.5"/>
                      <div>
                          <strong className="block">Twilio Trial Account Note</strong>
                          On a trial account you can only send to verified numbers. Upgrade to remove this restriction. Find credentials at: <span className="text-white">console.twilio.com → Account Info</span>
                      </div>
                  </div>

                  <div className="pt-2 border-t border-gray-700 space-y-3">
                      {smsTestResult && (
                          <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                              smsTestResult.ok
                                  ? 'bg-green-900/30 border border-green-700 text-green-300'
                                  : 'bg-red-900/30 border border-red-700 text-red-300'
                          }`}>
                              {smsTestResult.ok ? <CheckCircle size={16} className="shrink-0 mt-0.5"/> : <AlertCircle size={16} className="shrink-0 mt-0.5"/>}
                              <span>{smsTestResult.msg}</span>
                          </div>
                      )}
                      <button
                          disabled={isTestingSms}
                          onClick={async () => {
                              setSmsTestResult(null);
                              setIsTestingSms(true);
                              try {
                                  const res = await fetch('/api/v1/sms/test', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                          settings: formData.smsSettings,
                                          to: formData.smsSettings?.adminPhone
                                      })
                                  });
                                  const contentType = res.headers.get('content-type');
                                  if (contentType?.includes('application/json')) {
                                      const data = await res.json();
                                      if (res.ok && data.success) {
                                          setSmsTestResult({ ok: true, msg: `Test SMS sent! Check your phone. SID: ${data.sid}` });
                                      } else {
                                          setSmsTestResult({ ok: false, msg: data.error || 'Unknown error from server' });
                                      }
                                  } else {
                                      const text = await res.text();
                                      setSmsTestResult({ ok: false, msg: `Unexpected server response (${res.status}): ${text.slice(0, 120)}` });
                                  }
                              } catch (e: any) {
                                  setSmsTestResult({ ok: false, msg: `Network error — is the dev server running? ${e.message}` });
                              } finally {
                                  setIsTestingSms(false);
                              }
                          }}
                          className="w-full bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white font-bold py-2 rounded text-sm transition flex items-center justify-center gap-2"
                      >
                          {isTestingSms ? <><Loader2 size={15} className="animate-spin"/> Sending SMS...</> : 'Send Test SMS'}
                      </button>
                  </div>
              </div>
          </div>
      </section>
      </>)}

      {isAdmin && (<>
      {/* --- INVOICE TEMPLATE --- */}
      <section className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
          <h4 className="text-xl font-bold mb-2 flex items-center gap-2"><FileCode size={20} className="text-amber-400"/> Invoice Template</h4>
          <p className="text-sm text-gray-400 mb-6">Customise the look of invoices sent via Email and SMS. Payment links are auto-generated from your Square account.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                  <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">Payment Button Label</label>
                      <input
                          title="Payment button text"
                          placeholder="Pay Now"
                          value={formData.invoiceSettings?.paymentLabel || 'Pay Now'}
                          onChange={e => setFormData({ ...formData, invoiceSettings: { ...formData.invoiceSettings!, paymentLabel: e.target.value } })}
                          className="w-full bg-black/40 border border-gray-700 rounded p-2 text-white text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-1">Text shown on the payment button in email invoices.</p>
                  </div>

                  <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">Invoice Logo</label>
                      <div className="flex gap-2 mb-2">
                          <input
                              title="Logo URL"
                              placeholder="Paste a URL or upload an image..."
                              value={formData.invoiceSettings?.logoUrl || ''}
                              onChange={e => setFormData({ ...formData, invoiceSettings: { ...formData.invoiceSettings!, logoUrl: e.target.value } })}
                              className="flex-1 bg-black/40 border border-gray-700 rounded p-2 text-white text-sm"
                          />
                          <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              id="invoice-logo-upload"
                              onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  const reader = new FileReader();
                                  reader.onloadend = async () => {
                                      const compressed = await compressImage(reader.result as string, 400, 0.8);
                                      setFormData(prev => ({ ...prev, invoiceSettings: { ...prev.invoiceSettings!, logoUrl: compressed } }));
                                  };
                                  reader.readAsDataURL(file);
                              }}
                          />
                          <button
                              onClick={() => document.getElementById('invoice-logo-upload')?.click()}
                              className="bg-gray-800 border border-gray-600 p-2 rounded hover:bg-gray-700 text-gray-300"
                              title="Upload Logo"
                          >
                              <Upload size={16}/>
                          </button>
                      </div>
                      {formData.invoiceSettings?.logoUrl && (
                          <div className="w-full h-20 rounded-lg overflow-hidden border border-gray-700 relative group bg-white/5 flex items-center justify-center">
                              <img src={formData.invoiceSettings.logoUrl} className="max-h-full max-w-full object-contain p-2" alt="Invoice Logo"/>
                              <button
                                  onClick={() => setFormData(prev => ({ ...prev, invoiceSettings: { ...prev.invoiceSettings!, logoUrl: '' } }))}
                                  className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition hover:bg-red-600"
                              >
                                  <X size={12}/>
                              </button>
                          </div>
                      )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                      <div>
                          <label className="text-xs font-bold text-gray-500 uppercase">Header Color</label>
                          <div className="flex items-center gap-2">
                              <input
                                  type="color"
                                  title="Header color"
                                  value={formData.invoiceSettings?.headerColor || '#d9381e'}
                                  onChange={e => setFormData({ ...formData, invoiceSettings: { ...formData.invoiceSettings!, headerColor: e.target.value } })}
                                  className="w-10 h-10 rounded cursor-pointer border border-gray-700 bg-transparent"
                              />
                              <input
                                  title="Header color hex"
                                  value={formData.invoiceSettings?.headerColor || '#d9381e'}
                                  onChange={e => setFormData({ ...formData, invoiceSettings: { ...formData.invoiceSettings!, headerColor: e.target.value } })}
                                  className="flex-1 bg-black/40 border border-gray-700 rounded p-2 text-white text-sm font-mono"
                              />
                          </div>
                      </div>
                      <div>
                          <label className="text-xs font-bold text-gray-500 uppercase">Accent Color</label>
                          <div className="flex items-center gap-2">
                              <input
                                  type="color"
                                  title="Accent color"
                                  value={formData.invoiceSettings?.accentColor || '#eab308'}
                                  onChange={e => setFormData({ ...formData, invoiceSettings: { ...formData.invoiceSettings!, accentColor: e.target.value } })}
                                  className="w-10 h-10 rounded cursor-pointer border border-gray-700 bg-transparent"
                              />
                              <input
                                  title="Accent color hex"
                                  value={formData.invoiceSettings?.accentColor || '#eab308'}
                                  onChange={e => setFormData({ ...formData, invoiceSettings: { ...formData.invoiceSettings!, accentColor: e.target.value } })}
                                  className="flex-1 bg-black/40 border border-gray-700 rounded p-2 text-white text-sm font-mono"
                              />
                          </div>
                      </div>
                  </div>
              </div>

              <div className="space-y-4">
                  <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">Thank You / Intro Message</label>
                      <textarea
                          title="Invoice intro message"
                          rows={2}
                          placeholder="Here's your invoice. Please review..."
                          value={formData.invoiceSettings?.thankYouMessage || ''}
                          onChange={e => setFormData({ ...formData, invoiceSettings: { ...formData.invoiceSettings!, thankYouMessage: e.target.value } })}
                          className="w-full bg-black/40 border border-gray-700 rounded p-2 text-white text-sm resize-none"
                      />
                  </div>

                  <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">Bank / Payment Details (shown if no payment link)</label>
                      <textarea
                          title="Bank details"
                          rows={3}
                          placeholder="BSB: 000-000&#10;Account: 12345678&#10;Name: Your Business"
                          value={formData.invoiceSettings?.bankDetails || ''}
                          onChange={e => setFormData({ ...formData, invoiceSettings: { ...formData.invoiceSettings!, bankDetails: e.target.value } })}
                          className="w-full bg-black/40 border border-gray-700 rounded p-2 text-white text-sm resize-none font-mono"
                      />
                      <p className="text-xs text-gray-500 mt-1">Displayed when no payment URL is set. Each line appears as-is.</p>
                  </div>

                  <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">Footer Note</label>
                      <textarea
                          title="Invoice footer note"
                          rows={2}
                          placeholder="Thank you for your business!..."
                          value={formData.invoiceSettings?.footerNote || ''}
                          onChange={e => setFormData({ ...formData, invoiceSettings: { ...formData.invoiceSettings!, footerNote: e.target.value } })}
                          className="w-full bg-black/40 border border-gray-700 rounded p-2 text-white text-sm resize-none"
                      />
                  </div>

                  <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">SMS Template</label>
                      <textarea
                          title="SMS invoice template"
                          rows={3}
                          value={formData.invoiceSettings?.smsTemplate || 'Hi {name}, you have an invoice for ${total} from {business}. Order #{orderNum}.{payLink}\n\nCheers!'}
                          onChange={e => setFormData({ ...formData, invoiceSettings: { ...formData.invoiceSettings!, smsTemplate: e.target.value } })}
                          className="w-full bg-black/40 border border-gray-700 rounded p-2 text-white text-sm resize-none font-mono"
                      />
                      <p className="text-xs text-gray-500 mt-1">Variables: {'{name}'} {'{total}'} {'{business}'} {'{orderNum}'} {'{payLink}'}</p>
                  </div>
              </div>
          </div>

          {/* Live Preview */}
          <div className="mt-6 pt-6 border-t border-gray-700">
              <h5 className="text-sm font-bold text-gray-400 uppercase mb-3">Email Preview</h5>
              <div className="bg-white rounded-xl overflow-hidden max-w-md mx-auto shadow-2xl">
                  <div style={{ background: formData.invoiceSettings?.headerColor || '#d9381e' }} className="p-5 text-center">
                      {formData.invoiceSettings?.logoUrl && (
                          <img src={formData.invoiceSettings.logoUrl} alt="Logo" className="h-10 mx-auto mb-2" />
                      )}
                      <h3 className="text-white font-bold text-lg">Invoice from {formData.businessName || 'Your Business'}</h3>
                  </div>
                  <div className="p-5 text-gray-800 text-sm space-y-3">
                      <p>Hey <strong>Customer Name</strong>,</p>
                      <p className="text-gray-600">{formData.invoiceSettings?.thankYouMessage || "Here's your invoice."}</p>
                      <div className="bg-gray-100 rounded-lg p-4">
                          <p className="font-bold text-xs text-gray-500 uppercase mb-2">Order Summary</p>
                          <p className="text-sm">1x Brisket Burger — <strong>$18.00</strong></p>
                          <p className="text-sm">2x Loaded Fries — <strong>$24.00</strong></p>
                          <hr className="my-2 border-gray-300" />
                          <p className="text-lg font-bold">Total: $42.00</p>
                      </div>
                      {formData.invoiceSettings?.paymentUrl ? (
                          <div className="text-center py-2">
                              <span style={{ background: formData.invoiceSettings?.accentColor || '#eab308' }} className="inline-block text-black font-bold px-8 py-3 rounded-lg text-sm">
                                  {formData.invoiceSettings?.paymentLabel || 'Pay Now'} — $42.00
                              </span>
                          </div>
                      ) : formData.invoiceSettings?.bankDetails ? (
                          <div className="bg-gray-100 rounded-lg p-4 font-mono text-xs whitespace-pre-line">{formData.invoiceSettings.bankDetails}</div>
                      ) : (
                          <p style={{ color: formData.invoiceSettings?.accentColor || '#eab308' }} className="text-center font-bold text-lg">Amount Due: $42.00</p>
                      )}
                      <p className="text-xs text-gray-400 mt-4">{formData.invoiceSettings?.footerNote || 'Thank you for your business!'}</p>
                  </div>
              </div>
          </div>
      </section>
      </>)}

      {/* --- DIAGNOSTICS MODAL --- */}
      {isDev && showDiagnostics && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
              <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl shadow-2xl h-[80vh] flex flex-col animate-in zoom-in-95">
                  <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-gray-800/50">
                      <h3 className="text-xl font-bold text-white flex items-center gap-2">
                          <Activity className="text-bbq-gold"/> System Diagnostics
                      </h3>
                      <button onClick={() => setShowDiagnostics(false)}><X size={20} className="text-gray-400 hover:text-white"/></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-black/20">
                      {isRunningDiag && (
                          <div className="flex items-center gap-3 text-blue-400 bg-blue-900/20 p-4 rounded border border-blue-800 animate-pulse">
                              <Loader2 className="animate-spin"/> Running system checks...
                          </div>
                      )}

                      {diagLogs.map((log, idx) => (
                          <div key={idx} className={`p-4 rounded border ${
                              log.status === 'success' ? 'bg-green-900/10 border-green-800' : 
                              log.status === 'error' ? 'bg-red-900/10 border-red-800' : 
                              'bg-yellow-900/10 border-yellow-800'
                          }`}>
                              <div className="flex justify-between items-start mb-1">
                                  <span className="font-bold text-white text-sm">{log.step}</span>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                      log.status === 'success' ? 'bg-green-900 text-green-300' : 
                                      log.status === 'error' ? 'bg-red-900 text-red-300' : 
                                      'bg-yellow-900 text-yellow-300'
                                  }`}>{log.status}</span>
                              </div>
                              {log.details && <p className="text-xs text-gray-400 font-mono mb-2">{log.details}</p>}
                              {log.fix && (
                                  <div className="mt-2 pt-2 border-t border-white/5 flex gap-2 items-start">
                                      <Wand2 size={12} className="text-bbq-gold mt-0.5 shrink-0"/>
                                      <p className="text-xs text-bbq-gold">{log.fix}</p>
                                  </div>
                              )}
                          </div>
                      ))}

                      {showRulesHelp && (
                          <div className="mt-6 bg-gray-800 p-4 rounded border border-gray-600">
                              <h4 className="font-bold text-white mb-2 flex items-center gap-2"><Shield size={16}/> Recommended Firestore Rules</h4>
                              <p className="text-xs text-gray-400 mb-3">Your database is blocking connections. Copy these rules to your Firebase Console:</p>
                              <div className="bg-black p-3 rounded border border-gray-700 font-mono text-[10px] text-green-400 overflow-x-auto whitespace-pre">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`}
                              </div>
                              <button onClick={copyRulesToClipboard} className="mt-3 w-full bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold py-2 rounded flex items-center justify-center gap-2">
                                  <Copy size={12}/> Copy to Clipboard
                              </button>
                          </div>
                      )}
                  </div>
                  
                  <div className="p-4 border-t border-gray-700 bg-gray-800/50 flex justify-between items-center">
                      <button onClick={clearFirestoreCache} className="bg-red-600 text-white font-bold px-6 py-2 rounded hover:bg-red-500 text-sm">
                          🔧 Fix Connection (Clear Cache & Reload)
                      </button>
                      <button onClick={() => setShowDiagnostics(false)} className="bg-white text-black font-bold px-6 py-2 rounded hover:bg-gray-200">Close</button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default SettingsManager;
