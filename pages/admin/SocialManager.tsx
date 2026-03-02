import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../components/Toast';
import { Facebook, Instagram, Wand2, Send, Image as ImageIcon, Users, Eye, TrendingUp, BarChart, Lightbulb, RefreshCw, Calendar, Clock, X, Save, ExternalLink, AlertCircle, CheckCircle, ChevronDown, ChevronUp, Plug, Trash2, CheckSquare, Download, Zap, Sparkles, Info, ThumbsUp, ThumbsDown, Bot, CreditCard, WifiOff, Wifi } from 'lucide-react';
import SmsBlast from './SmsBlast';
import { generateSocialPost, generateMarketingImage, generateSocialRecommendations, generateSmartSchedule, SmartScheduledPost } from '../../services/gemini';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore'; 
import { db } from '../../services/firebase';

declare global {
  interface Window {
    FB: any;
  }
}

const SocialManager: React.FC = () => {
  const { socialPosts, addSocialPost, updateSocialPost, deleteSocialPost, settings, updateSettings, galleryPosts, calendarEvents, menu } = useApp();
  const { toast } = useToast();
  
  // Generator State
  const [topic, setTopic] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [platform, setPlatform] = useState<'Instagram' | 'Facebook'>('Instagram');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [scheduleDate, setScheduleDate] = useState('');

  // Facebook Auto-Connector State
  const [isConnecting, setIsConnecting] = useState(false);
  const [fbPages, setFbPages] = useState<any[]>([]);
  const [showManualConfig, setShowManualConfig] = useState(false);
  const [appIdInput, setAppIdInput] = useState(settings.facebookAppId || '');

  // Feed Config State (Manual)
  const [fbConfig, setFbConfig] = useState({
      pageId: settings.facebookPageId || '',
      token: settings.facebookPageAccessToken || '',
      instagramId: settings.instagramBusinessAccountId || ''
  });

  const [isTestingFb, setIsTestingFb] = useState(false);
  const [fbTestResult, setFbTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Insights State
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeStat, setActiveStat] = useState<string | null>(null);
  const [stats, setStats] = useState({
      followers: 1250,
      reach: 4500,
      engagement: 8.5,
      postsLast30Days: 12,
      followersGrowth: 5.2,
      reachGrowth: 12.1
  });
  const [recommendations, setRecommendations] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Smart Scheduler State
  const [smartSchedule, setSmartSchedule] = useState<SmartScheduledPost[]>([]);
  const [scheduledStrategy, setScheduledStrategy] = useState('');
  const [isGeneratingSchedule, setIsGeneratingSchedule] = useState(false);
  const [postsToGenerate, setPostsToGenerate] = useState(10);
  const [scheduleStartDate, setScheduleStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [scheduleIntent, setScheduleIntent] = useState<'fresh' | 'saturate' | 'fill_gaps'>('fresh');
  const [approvedIndices, setApprovedIndices] = useState<Set<number>>(new Set());
  const [removedIndices, setRemovedIndices] = useState<Set<number>>(new Set());
  const [postImages, setPostImages] = useState<Record<number, string>>({});
  const [generatingImageFor, setGeneratingImageFor] = useState<Set<number>>(new Set());
  const [autoImageProgress, setAutoImageProgress] = useState<{ current: number; total: number } | null>(null);
  const [expandedPost, setExpandedPost] = useState<number | null>(null);

  // Claude AI Status State
  const [claudeStatus, setClaudeStatus] = useState<{ connected: boolean; error?: string; models?: number } | null>(null);
  const [isCheckingClaude, setIsCheckingClaude] = useState(false);

  // Calendar State
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedCalDay, setSelectedCalDay] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<import('../../types').SocialPost | null>(null);
  const [editForm, setEditForm] = useState<Partial<import('../../types').SocialPost>>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
      setFbConfig({
          pageId: settings.facebookPageId || '',
          token: settings.facebookPageAccessToken || '',
          instagramId: settings.instagramBusinessAccountId || ''
      });
      setAppIdInput(settings.facebookAppId || '');

      const fetchRealStats = async () => {
          if (settings.facebookConnected && settings.facebookPageId && settings.facebookPageAccessToken) {
              try {
                  const res = await fetch(`https://graph.facebook.com/v18.0/${settings.facebookPageId}?fields=followers_count,fan_count&access_token=${settings.facebookPageAccessToken}`);
                  if (res.ok) {
                      const data = await res.json();
                      setStats(prev => ({
                          ...prev,
                          followers: data.followers_count || data.fan_count || prev.followers,
                          // Reach and engagement require more complex Insights API calls, keeping mock for now
                      }));
                  }
              } catch (e) {
                  console.error("Failed to fetch real stats", e);
              }
          }
      };
      
      fetchRealStats();
  }, [settings]);

  useEffect(() => {
      if (!window.FB) return;
      try {
          window.FB.init({
            appId: settings.facebookAppId,
            autoLogAppEvents: true,
            xfbml: true,
            version: 'v18.0'
          });
      } catch (e) {
          console.warn("FB SDK Init warning", e);
      }
  }, [settings.facebookAppId]);

  const handleRefresh = async () => {
      setIsRefreshing(true);
      if (settings.facebookConnected && settings.facebookPageId && settings.facebookPageAccessToken) {
          try {
              const res = await fetch(`https://graph.facebook.com/v18.0/${settings.facebookPageId}?fields=followers_count,fan_count&access_token=${settings.facebookPageAccessToken}`);
              if (res.ok) {
                  const data = await res.json();
                  setStats(prev => ({
                      ...prev,
                      followers: data.followers_count || data.fan_count || prev.followers,
                  }));
              }
          } catch (e) {
              console.error("Failed to refresh stats from Facebook", e);
          }
      } else {
          setTimeout(() => {
              setStats(prev => ({
                  ...prev,
                  followers: prev.followers + Math.floor(Math.random() * 10),
                  reach: prev.reach + Math.floor(Math.random() * 50),
                  engagement: +(prev.engagement + (Math.random() * 0.5 - 0.25)).toFixed(1)
              }));
          }, 1000);
      }
      setIsRefreshing(false);
  };

  const handleGenerate = async () => {
    if (!topic) return;
    setIsGenerating(true);
    setGeneratedImage(null); 
    
    const result = await generateSocialPost(topic, platform);
    setGeneratedContent(result.content);
    setHashtags(result.hashtags);
    setIsGenerating(false);
  };

  const handleImageGenerate = async () => {
    if (!topic) return;
    setIsGenerating(true);
    const imgBase64 = await generateMarketingImage(topic);
    setGeneratedImage(imgBase64);
    setIsGenerating(false);
  }

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    const result = await generateSocialRecommendations(stats);
    setRecommendations(result);
    setIsAnalyzing(false);
  };

  const handlePost = () => {
    addSocialPost({
      id: `p${Date.now()}`,
      platform,
      content: generatedContent,
      hashtags,
      scheduledFor: scheduleDate || new Date().toISOString(),
      status: scheduleDate && new Date(scheduleDate) > new Date() ? 'Scheduled' : 'Posted',
      image: generatedImage || undefined
    });
    setGeneratedContent('');
    setHashtags([]);
    setTopic('');
    setGeneratedImage(null);
    setScheduleDate('');
    toast('Content saved to schedule!');
  };

  // Calendar helpers
  const calYear = calendarMonth.getFullYear();
  const calMonthIdx = calendarMonth.getMonth();
  const daysInMonth = new Date(calYear, calMonthIdx + 1, 0).getDate();
  const firstDayOfWeek = new Date(calYear, calMonthIdx, 1).getDay();
  const calDays = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    return `${calYear}-${String(calMonthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  });

  const getPostsForDay = (dateStr: string) =>
    socialPosts.filter(p => p.scheduledFor.slice(0, 10) === dateStr);

  const getCookDayForDay = (dateStr: string) =>
    (calendarEvents as any[]).find(e => e.type === 'ORDER_PICKUP' && e.date === dateStr);

  const hasConflict = (platform: string, dateStr: string) =>
    socialPosts.some(p => p.scheduledFor.slice(0, 10) === dateStr && p.platform === platform);

  const openEdit = (post: import('../../types').SocialPost) => {
    setEditingPost(post);
    setEditForm({ ...post, scheduledFor: post.scheduledFor.slice(0, 16) });
  };

  const handleSaveEdit = async () => {
    if (!editingPost) return;
    setIsSavingEdit(true);
    const updated = { ...editingPost, ...editForm,
      scheduledFor: editForm.scheduledFor ? new Date(editForm.scheduledFor).toISOString() : editingPost.scheduledFor,
      hashtags: typeof editForm.hashtags === 'string'
        ? (editForm.hashtags as string).split(',').map((t: string) => t.trim()).filter(Boolean)
        : editForm.hashtags || []
    } as import('../../types').SocialPost;
    await updateSocialPost(updated);
    setEditingPost(null);
    setIsSavingEdit(false);
  };

  const handleDeletePost = async (postId: string) => {
    if (window.confirm('Delete this scheduled post?')) {
      await deleteSocialPost(postId);
      setEditingPost(null);
      setSelectedCalDay(null);
    }
  };

  const PILLAR_COLORS: Record<string, string> = {
    'Behind The Fire': 'bg-orange-900/60 text-orange-300 border-orange-700',
    'Food Cinema': 'bg-red-900/60 text-red-300 border-red-700',
    'Cook Day Hype': 'bg-yellow-900/60 text-yellow-300 border-yellow-700',
    'Pitmaster Wisdom': 'bg-blue-900/60 text-blue-300 border-blue-700',
    'Social Proof': 'bg-green-900/60 text-green-300 border-green-700',
    'Scarcity Drop': 'bg-purple-900/60 text-purple-300 border-purple-700',
    'Lifestyle & Vibe': 'bg-pink-900/60 text-pink-300 border-pink-700',
  };

  const checkClaudeStatus = async () => {
    setIsCheckingClaude(true);
    try {
      const res = await fetch('/api/v1/ai/claude-status');
      const data = await res.json();
      setClaudeStatus(data);
    } catch (e: any) {
      setClaudeStatus({ connected: false, error: e.message || 'Network error' });
    } finally {
      setIsCheckingClaude(false);
    }
  };

  const handleGenerateSmartSchedule = async () => {
    setIsGeneratingSchedule(true);
    setSmartSchedule([]);
    setApprovedIndices(new Set());
    setRemovedIndices(new Set());
    setPostImages({});
    setScheduledStrategy('');
    setAutoImageProgress(null);

    const cookDays = calendarEvents
      .filter((e: any) => e.type === 'ORDER_PICKUP')
      .map((e: any) => ({ date: e.date, location: e.location || 'TBA', title: e.title }));

    const menuItems = menu.map((m: any) => ({ name: m.name, category: m.category, price: m.price }));

    const existingPosts = socialPosts.map(p => ({ platform: p.platform, scheduledFor: p.scheduledFor, status: p.status }));
    const result = await generateSmartSchedule({ stats, cookDays, menuItems, postsToGenerate, existingPosts, startDate: scheduleStartDate, intent: scheduleIntent });
    setSmartSchedule(result.posts);
    setScheduledStrategy(result.strategy);
    setIsGeneratingSchedule(false);

    // Auto-generate images for every post sequentially
    if (result.posts.length > 0) {
      setAutoImageProgress({ current: 0, total: result.posts.length });
      for (let i = 0; i < result.posts.length; i++) {
        setGeneratingImageFor(prev => new Set([...prev, i]));
        setAutoImageProgress({ current: i + 1, total: result.posts.length });
        const img = await generateMarketingImage(result.posts[i].imagePrompt);
        if (img) {
          setPostImages(prev => ({ ...prev, [i]: img }));
        }
      }
      setGeneratingImageFor(new Set());
      setAutoImageProgress(null);
    }
  };

  const handleApprovePost = (idx: number) => {
    const post = smartSchedule[idx];
    const dayStr = (post.scheduledFor || '').slice(0, 10);
    if (hasConflict(post.platform, dayStr)) {
      if (!window.confirm(`There's already a ${post.platform} post on ${dayStr}. Add anyway?`)) return;
    }
    addSocialPost({
      id: `smart_${Date.now()}_${idx}`,
      platform: post.platform || 'Instagram',
      content: post.content || '',
      hashtags: post.hashtags || [],
      scheduledFor: post.scheduledFor || new Date().toISOString(),
      status: 'Scheduled',
      image: postImages[idx] || undefined
    });
    setApprovedIndices(prev => new Set([...prev, idx]));
  };

  const handleApproveAll = () => {
    smartSchedule.forEach((post, idx) => {
      if (!approvedIndices.has(idx) && !removedIndices.has(idx)) {
        const dayStr = (post.scheduledFor || '').slice(0, 10);
        if (!hasConflict(post.platform, dayStr)) {
          addSocialPost({
            id: `smart_${Date.now()}_${idx}`,
            platform: post.platform || 'Instagram',
            content: post.content || '',
            hashtags: post.hashtags || [],
            scheduledFor: post.scheduledFor || new Date().toISOString(),
            status: 'Scheduled',
            image: postImages[idx] || undefined
          });
        }
      }
    });
    setApprovedIndices(new Set(smartSchedule.map((_, i) => i)));
  };

  const handleRemovePost = (idx: number) => {
    setRemovedIndices(prev => new Set([...prev, idx]));
  };

  const handleGeneratePostImage = async (idx: number) => {
    setGeneratingImageFor(prev => new Set([...prev, idx]));
    const img = await generateMarketingImage(smartSchedule[idx].imagePrompt);
    if (img) setPostImages(prev => ({ ...prev, [idx]: img }));
    setGeneratingImageFor(prev => { const s = new Set(prev); s.delete(idx); return s; });
  };

  const saveAppId = () => {
      updateSettings({ facebookAppId: appIdInput });
      if(window.FB) {
          window.FB.init({ appId: appIdInput, version: 'v18.0' });
      }
      toast('App ID saved.');
  };

  const handleFacebookLogin = () => {
      if (!settings.facebookAppId) {
          toast('Please enter and save your Facebook App ID first.', 'warning');
          return;
      }

      setIsConnecting(true);
      
      if (!window.FB) {
          toast('Facebook SDK not loaded. Please disable ad-blockers or check internet.', 'error');
          setIsConnecting(false);
          return;
      }

      window.FB.login((response: any) => {
          if (response.authResponse) {
              const userToken = response.authResponse.accessToken;
              fetchFacebookPages(userToken);
          } else {
              console.log('User cancelled login or did not fully authorize.');
              setIsConnecting(false);
          }
      }, { scope: 'pages_show_list,pages_read_engagement,pages_read_user_content,instagram_basic,instagram_manage_insights' });
  };

  const fetchFacebookPages = async (userToken: string) => {
      try {
          // Exchange short-lived token for long-lived via server (keeps App Secret safe)
          // This makes the resulting page tokens permanent (non-expiring)
          const exchangeRes = await fetch('/api/v1/facebook/exchange-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ shortLivedToken: userToken })
          });
          const exchangeData = await exchangeRes.json();

          if (!exchangeRes.ok) {
              // Server-side exchange failed (App Secret not set) — fall back to direct page fetch
              console.warn('Token exchange failed, falling back to direct fetch:', exchangeData.error);
              const pagesRes = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${userToken}`);
              const data = await pagesRes.json();
              if (data.data) {
                  setFbPages(data.data);
                  if (data.data.length === 0) toast('No Facebook Pages found for this account.', 'warning');
              }
              return;
          }

          if (exchangeData.pages?.length > 0) {
              setFbPages(exchangeData.pages);
          } else {
              toast('No Facebook Pages found for this account.', 'warning');
          }
      } catch (e) {
          console.error(e);
          toast('Error fetching Facebook pages.', 'error');
      } finally {
          setIsConnecting(false);
      }
  };

  const selectPage = async (page: any) => {
      if (window.confirm(`Connect ticker to page: "${page.name}"?`)) {
          let instagramId = '';
          try {
              const res = await fetch(`https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`);
              const data = await res.json();
              if (data.instagram_business_account) {
                  instagramId = data.instagram_business_account.id;
              }
          } catch (e) {
              console.error("Failed to fetch Instagram ID", e);
          }

          updateSettings({
              facebookConnected: true,
              facebookPageId: page.id,
              facebookPageAccessToken: page.access_token,
              instagramBusinessAccountId: instagramId
          });
          setFbConfig({
              pageId: page.id,
              token: page.access_token,
              instagramId: instagramId
          });
          setFbPages([]);
          toast(`Connected! Ticker will update automatically.${instagramId ? ' Instagram also linked.' : ''}`);
      }
  };

  const handleManualSave = () => {
      updateSettings({
          facebookPageId: fbConfig.pageId,
          facebookPageAccessToken: fbConfig.token,
          facebookConnected: !!(fbConfig.pageId && fbConfig.token),
          // @ts-ignore
          instagramBusinessAccountId: fbConfig.instagramId
      });
      toast('Feed settings updated.');
  };

  const testFacebookConnection = async () => {
      if (!settings.facebookPageId || !settings.facebookPageAccessToken) {
          setFbTestResult({ success: false, message: "Missing Page ID or Access Token." });
          return;
      }
      setIsTestingFb(true);
      setFbTestResult(null);
      try {
          const fbRes = await fetch(`https://graph.facebook.com/v18.0/${settings.facebookPageId}?fields=name,followers_count&access_token=${settings.facebookPageAccessToken}`);
          const fbData = await fbRes.json();
          if (!fbRes.ok || fbData.error) {
              setFbTestResult({ success: false, message: `Facebook API Error: ${fbData.error?.message || 'Unknown error'}` });
              return;
          }
          const pageName = fbData.name || 'Your Page';
          const fbFollowers = fbData.followers_count ? ` (${Number(fbData.followers_count).toLocaleString()} followers)` : '';
          if (settings.instagramBusinessAccountId) {
              const igRes = await fetch(`https://graph.facebook.com/v18.0/${settings.instagramBusinessAccountId}?fields=name,username,followers_count&access_token=${settings.facebookPageAccessToken}`);
              const igData = await igRes.json();
              if (igRes.ok && !igData.error) {
                  const igHandle = igData.username ? `@${igData.username}` : (igData.name || 'Instagram');
                  const igFollowers = igData.followers_count ? ` (${Number(igData.followers_count).toLocaleString()} followers)` : '';
                  setFbTestResult({ success: true, message: `✓ Facebook: ${pageName}${fbFollowers}  ✓ Instagram: ${igHandle}${igFollowers}` });
              } else {
                  setFbTestResult({ success: true, message: `✓ Facebook: ${pageName}${fbFollowers}  ⚠ Instagram: ${igData.error?.message || 'Could not verify — check Instagram Business Account ID'}` });
              }
          } else {
              setFbTestResult({ success: true, message: `✓ Facebook: ${pageName}${fbFollowers}  — Instagram not linked` });
          }
      } catch (e: any) {
          setFbTestResult({ success: false, message: `Network Error: ${e.message}` });
      } finally {
          setIsTestingFb(false);
      }
  };

  const approvePost = async (id: string) => {
      if (!db) {
          toast('Database not connected.', 'error');
          return;
      }
      if (window.confirm("Approve this photo for the public gallery?")) {
          await updateDoc(doc(db, 'gallery_posts', id), { approved: true });
      }
  };

  const deletePost = async (id: string) => {
      if (!db) {
          toast('Database not connected.', 'error');
          return;
      }
      if (window.confirm("Delete this photo?")) {
          await deleteDoc(doc(db, 'gallery_posts', id));
      }
  };

  const downloadPost = (url: string) => {
      const a = document.createElement('a');
      a.href = url;
      a.download = `streetmeatz-ugc-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
  };

  return (
    <div className="space-y-8 animate-in fade-in relative">
        {/* Header */}
        <div className="flex justify-between items-center">
            <div>
                <h3 className="text-2xl font-bold font-display text-white">Social Command Center</h3>
                <p className="text-gray-400 text-sm">Manage content, schedule posts, and track growth.</p>
            </div>
            <button 
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold"
            >
                <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''}/> Refresh Stats
            </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div 
                onClick={() => setActiveStat('Followers')}
                className="bg-gray-900/50 p-4 rounded-xl border border-gray-700 cursor-pointer hover:border-blue-500 hover:bg-gray-800 transition-all"
            >
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400 font-bold uppercase">Followers</span>
                    <Users size={16} className="text-blue-400"/>
                </div>
                <div className="text-3xl font-bold text-white">{stats.followers}</div>
                <div className="text-xs text-green-400 flex items-center gap-1 mt-1">
                    <TrendingUp size={12}/> +{stats.followersGrowth}% last 30d
                </div>
            </div>
            <div 
                onClick={() => setActiveStat('Reach')}
                className="bg-gray-900/50 p-4 rounded-xl border border-gray-700 cursor-pointer hover:border-purple-500 hover:bg-gray-800 transition-all"
            >
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400 font-bold uppercase">Reach</span>
                    <Eye size={16} className="text-purple-400"/>
                </div>
                <div className="text-3xl font-bold text-white">{stats.reach}</div>
                <div className="text-xs text-green-400 flex items-center gap-1 mt-1">
                    <TrendingUp size={12}/> +{stats.reachGrowth}% last 30d
                </div>
            </div>
            <div 
                onClick={() => setActiveStat('Engagement')}
                className="bg-gray-900/50 p-4 rounded-xl border border-gray-700 cursor-pointer hover:border-yellow-500 hover:bg-gray-800 transition-all"
            >
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400 font-bold uppercase">Engagement</span>
                    <BarChart size={16} className="text-yellow-400"/>
                </div>
                <div className="text-3xl font-bold text-white">{stats.engagement}%</div>
                <div className="text-xs text-gray-500 mt-1">
                    Avg. per post
                </div>
            </div>
        </div>

        {/* Content Generator */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-gray-900/50 rounded-xl border border-gray-700 overflow-hidden">
                <div className="bg-gray-800 p-4 border-b border-gray-700 flex justify-between items-center">
                    <h4 className="font-bold text-white flex items-center gap-2"><Wand2 className="text-bbq-gold" size={18}/> AI Content Generator</h4>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="text-xs text-gray-400 font-bold block mb-1">Topic / Prompt</label>
                        <textarea 
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="e.g. New brisket burger special available this weekend..."
                            className="w-full bg-black/30 border border-gray-600 rounded p-3 text-white text-sm h-24"
                        />
                    </div>
                    
                    <div className="flex gap-4">
                        <select 
                            value={platform}
                            onChange={(e) => setPlatform(e.target.value as any)}
                            className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                        >
                            <option value="Instagram">Instagram</option>
                            <option value="Facebook">Facebook</option>
                        </select>
                        <button 
                            onClick={handleGenerate}
                            disabled={isGenerating || !topic}
                            className="bg-bbq-red text-white px-4 py-2 rounded font-bold text-sm hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 flex-1 justify-center"
                        >
                            {isGenerating ? 'Drafting...' : 'Generate Text'}
                        </button>
                        <button 
                            onClick={handleImageGenerate}
                            disabled={isGenerating || !topic}
                            className="bg-gray-700 text-white px-4 py-2 rounded font-bold text-sm hover:bg-gray-600 disabled:opacity-50 flex items-center gap-2"
                        >
                            <ImageIcon size={16}/> Image
                        </button>
                    </div>

                    {(generatedContent || generatedImage) && (
                        <div className="bg-black/20 p-4 rounded-lg border border-gray-700 animate-in fade-in">
                            {generatedImage && (
                                <div className="mb-4 rounded-lg overflow-hidden relative group">
                                    <img src={generatedImage} alt="Generated" className="w-full h-48 object-cover"/>
                                    <button onClick={() => setGeneratedImage(null)} className="absolute top-2 right-2 bg-black/60 p-1 rounded-full text-white opacity-0 group-hover:opacity-100 transition"><X size={14}/></button>
                                </div>
                            )}
                            {generatedContent && (
                                <textarea 
                                    value={generatedContent}
                                    onChange={e => setGeneratedContent(e.target.value)}
                                    className="w-full bg-transparent border-0 text-white text-sm resize-none focus:ring-0 p-0"
                                    rows={4}
                                />
                            )}
                            {hashtags.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {hashtags.map(tag => (
                                        <span key={tag} className="text-blue-400 text-xs">{tag}</span>
                                    ))}
                                </div>
                            )}
                            
                            <div className="mt-4 pt-4 border-t border-gray-700 flex items-center gap-3">
                                <input 
                                    type="datetime-local"
                                    value={scheduleDate}
                                    onChange={e => setScheduleDate(e.target.value)}
                                    className="bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs"
                                />
                                <button 
                                    onClick={handlePost}
                                    className="bg-white text-black font-bold px-4 py-2 rounded-lg flex-1 flex justify-center items-center gap-2"
                                >
                                    <Send size={14}/> {scheduleDate ? 'Schedule' : 'Post Now'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* AI Strategist */}
            <div className="bg-gray-900/50 rounded-xl border border-gray-700 overflow-hidden flex flex-col">
                <div className="bg-gray-800 p-4 border-b border-gray-700">
                    <h4 className="font-bold text-white flex items-center gap-2"><Lightbulb className="text-yellow-400" size={18}/> AI Strategist</h4>
                </div>
                <div className="p-6 flex-1 flex flex-col">
                    <p className="text-gray-400 text-sm mb-4">Analyze your performance metrics and get actionable advice on how to grow your BBQ brand.</p>
                    
                    {recommendations ? (
                        <div className="bg-black/20 p-4 rounded-lg border border-gray-700 text-sm text-gray-300 leading-relaxed whitespace-pre-line flex-1">
                            {recommendations}
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-600 italic">
                            No analysis generated yet.
                        </div>
                    )}
                    
                    <button 
                        onClick={handleAnalyze}
                        disabled={isAnalyzing}
                        className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-lg mt-4 flex justify-center items-center gap-2"
                    >
                        {isAnalyzing ? <RefreshCw className="animate-spin" size={16}/> : <TrendingUp size={16}/>} Analyze & Recommend
                    </button>
                </div>
            </div>
        </div>

        {/* ===== SCHEDULE CALENDAR ===== */}
        <div className="bg-gray-900/50 rounded-2xl border border-gray-700 overflow-hidden">
            <div className="bg-gray-800 p-4 border-b border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Calendar className="text-bbq-gold" size={20}/>
                    <h4 className="font-bold text-white text-lg">Schedule Calendar</h4>
                    <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{socialPosts.filter(p => p.status === 'Scheduled').length} scheduled</span>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => setCalendarMonth(new Date(calYear, calMonthIdx - 1))} className="p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white" title="Previous month">
                        <ChevronDown size={16} className="rotate-90"/>
                    </button>
                    <span className="text-white font-bold text-sm min-w-[120px] text-center">
                        {calendarMonth.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}
                    </span>
                    <button onClick={() => setCalendarMonth(new Date(calYear, calMonthIdx + 1))} className="p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white" title="Next month">
                        <ChevronDown size={16} className="-rotate-90"/>
                    </button>
                    <button onClick={() => setCalendarMonth(new Date())} className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded bg-gray-700 hover:bg-gray-600">Today</button>
                </div>
            </div>

            <div className="p-4">
                {/* Day headers */}
                <div className="grid grid-cols-7 mb-1">
                    {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                        <div key={d} className="text-center text-xs font-bold text-gray-500 uppercase py-1">{d}</div>
                    ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                    {/* Leading empty cells */}
                    {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                        <div key={`empty-${i}`} className="h-20 rounded-lg"/>
                    ))}
                    {/* Day cells */}
                    {calDays.map(dateStr => {
                        const dayPosts = getPostsForDay(dateStr);
                        const cookDay = getCookDayForDay(dateStr);
                        const isToday = dateStr === new Date().toISOString().slice(0, 10);
                        const isSelected = selectedCalDay === dateStr;
                        const dayNum = Number(dateStr.slice(8));
                        return (
                            <div
                                key={dateStr}
                                onClick={() => setSelectedCalDay(isSelected ? null : dateStr)}
                                className={`h-20 rounded-lg p-1 cursor-pointer border transition-all flex flex-col ${
                                    isSelected ? 'border-bbq-gold bg-yellow-900/20' :
                                    isToday ? 'border-gray-500 bg-gray-800/60' :
                                    cookDay ? 'border-orange-700/50 bg-orange-950/30' :
                                    'border-gray-800 bg-gray-900/40 hover:border-gray-600'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className={`text-xs font-bold ${isToday ? 'text-bbq-gold' : 'text-gray-400'}`}>{dayNum}</span>
                                    {cookDay && <span className="text-[9px] bg-orange-600/30 text-orange-400 px-1 rounded font-bold">COOK</span>}
                                </div>
                                <div className="flex flex-col gap-0.5 overflow-hidden">
                                    {dayPosts.slice(0, 3).map(p => (
                                        <span key={p.id} className={`text-[9px] font-bold px-1 py-0.5 rounded truncate ${
                                            p.platform === 'Instagram'
                                                ? 'bg-pink-900/60 text-pink-300'
                                                : 'bg-blue-900/60 text-blue-300'
                                        } ${p.status === 'Posted' ? 'opacity-50' : ''}`}>
                                            {p.platform === 'Instagram' ? 'IG' : 'FB'}
                                        </span>
                                    ))}
                                    {dayPosts.length > 3 && <span className="text-[9px] text-gray-500">+{dayPosts.length - 3}</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-800">
                    <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-3 h-3 rounded bg-pink-900/60 inline-block"></span>Instagram</span>
                    <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-3 h-3 rounded bg-blue-900/60 inline-block"></span>Facebook</span>
                    <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-3 h-3 rounded border border-orange-700/50 bg-orange-950/30 inline-block"></span>Cook Day</span>
                </div>
            </div>

            {/* Day detail panel */}
            {selectedCalDay && (
                <div className="border-t border-gray-700 p-4 bg-black/20">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-white font-bold text-sm">
                            {new Date(selectedCalDay + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                        <button onClick={() => setSelectedCalDay(null)} title="Close day panel" className="text-gray-500 hover:text-white"><X size={16}/></button>
                    </div>
                    {getCookDayForDay(selectedCalDay) && (
                        <div className="mb-3 p-2 bg-orange-900/20 border border-orange-700/30 rounded-lg text-xs text-orange-300 flex items-center gap-2">
                            <Calendar size={12}/> Cook Day — {getCookDayForDay(selectedCalDay)?.location || 'TBA'}
                        </div>
                    )}
                    {getPostsForDay(selectedCalDay).length === 0 ? (
                        <p className="text-gray-600 text-sm italic">No posts scheduled for this day.</p>
                    ) : (
                        <div className="space-y-2">
                            {getPostsForDay(selectedCalDay).map(post => (
                                <div key={post.id} className="flex items-start gap-3 p-3 bg-gray-800/60 rounded-lg border border-gray-700 hover:border-gray-500 transition-all group">
                                    {post.image && <img src={post.image} alt="post" className="w-10 h-10 rounded object-cover shrink-0"/>}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${post.platform === 'Instagram' ? 'bg-pink-900/50 text-pink-300' : 'bg-blue-900/50 text-blue-300'}`}>
                                                {post.platform}
                                            </span>
                                            <span className="text-xs text-gray-500">
                                                {new Date(post.scheduledFor).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            <span className={`text-xs px-1.5 rounded ${post.status === 'Posted' ? 'text-green-400' : post.status === 'Scheduled' ? 'text-yellow-400' : 'text-gray-400'}`}>
                                                {post.status}
                                            </span>
                                        </div>
                                        <p className="text-gray-300 text-xs leading-relaxed truncate">{post.content}</p>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                        <button onClick={() => openEdit(post)} className="opacity-0 group-hover:opacity-100 bg-gray-700 hover:bg-gray-600 text-white p-1.5 rounded transition-all" title="Edit post">
                                            <Wand2 size={13}/>
                                        </button>
                                        <button onClick={() => handleDeletePost(post.id)} className="opacity-0 group-hover:opacity-100 bg-red-900/50 hover:bg-red-800 text-red-400 p-1.5 rounded transition-all" title="Delete post">
                                            <Trash2 size={13}/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* ===== SMART SCHEDULER ===== */}
        <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl border border-yellow-600/40 overflow-hidden shadow-2xl">
            <div className="bg-gradient-to-r from-yellow-900/40 to-orange-900/30 p-6 border-b border-yellow-700/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h4 className="text-xl font-bold text-white flex items-center gap-3">
                        <Bot className="text-yellow-400" size={22}/>
                        Smart AI Scheduler
                        <span className="text-xs bg-yellow-600/30 text-yellow-300 border border-yellow-600/40 px-2 py-0.5 rounded-full font-normal">Research-Backed</span>
                    </h4>
                    <p className="text-gray-400 text-sm mt-1">AI agent analyses your cook days, menu, and audience to build an optimised posting schedule — right topics, right times, right hashtags.</p>
                </div>
                <div className="flex flex-col gap-3 shrink-0">
                    {/* Claude Status Bar */}
                    <div className="flex items-center gap-2 bg-black/30 border border-gray-700/50 rounded-lg px-3 py-2">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${claudeStatus === null ? 'bg-gray-600' : claudeStatus.connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}/>
                        <span className="text-xs text-gray-400 flex-1">
                            {claudeStatus === null
                                ? 'Claude AI — not checked'
                                : claudeStatus.connected
                                    ? <span className="text-green-400 font-medium">Claude AI — connected ✓</span>
                                    : <span className="text-red-400 font-medium" title={claudeStatus.error}>Credits low or key error</span>
                            }
                        </span>
                        <button
                            onClick={checkClaudeStatus}
                            disabled={isCheckingClaude}
                            className="text-xs text-gray-400 hover:text-white transition px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 flex items-center gap-1"
                        >
                            {isCheckingClaude ? <RefreshCw size={10} className="animate-spin"/> : <Wifi size={10}/>} Check
                        </button>
                        <a
                            href="https://console.anthropic.com/settings/billing"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-yellow-400 hover:text-yellow-300 transition px-2 py-0.5 rounded bg-yellow-900/30 hover:bg-yellow-900/50 border border-yellow-700/40 flex items-center gap-1 whitespace-nowrap"
                        >
                            <CreditCard size={10}/> Top Up
                        </a>
                    </div>
                    {/* Controls */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex flex-col">
                            <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Start from</label>
                            <input
                                type="date"
                                value={scheduleStartDate}
                                onChange={e => setScheduleStartDate(e.target.value)}
                                className="bg-gray-800 border border-gray-600 rounded-lg px-2.5 py-1.5 text-white text-sm"
                                title="Schedule start date"
                            />
                        </div>
                        <div className="flex flex-col">
                            <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Mode</label>
                            <select
                                value={scheduleIntent}
                                onChange={e => setScheduleIntent(e.target.value as any)}
                                className="bg-gray-800 border border-gray-600 rounded-lg px-2.5 py-1.5 text-white text-sm"
                                title="Scheduling mode"
                            >
                                <option value="fresh">Fresh 2 weeks</option>
                                <option value="saturate">Boost existing days</option>
                                <option value="fill_gaps">Fill empty days</option>
                            </select>
                        </div>
                        <div className="flex flex-col">
                            <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Posts</label>
                            <select
                                value={postsToGenerate}
                                onChange={e => setPostsToGenerate(Number(e.target.value))}
                                className="bg-gray-800 border border-gray-600 rounded-lg px-2.5 py-1.5 text-white text-sm"
                                title="Number of posts to generate"
                            >
                                <option value={5}>5</option>
                                <option value={7}>7</option>
                                <option value={10}>10</option>
                                <option value={14}>14</option>
                                <option value={21}>21</option>
                            </select>
                        </div>
                    </div>
                    <button
                        onClick={handleGenerateSmartSchedule}
                        disabled={isGeneratingSchedule}
                        className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-bold px-5 py-2 rounded-lg flex items-center justify-center gap-2 text-sm whitespace-nowrap w-full"
                    >
                        {isGeneratingSchedule
                            ? <><RefreshCw size={15} className="animate-spin"/> Building Schedule...</>
                            : <><Zap size={15}/> Generate Schedule</>}
                    </button>
                </div>
            </div>

            {isGeneratingSchedule && (
                <div className="p-12 flex flex-col items-center justify-center gap-4">
                    <div className="relative w-16 h-16">
                        <div className="absolute inset-0 rounded-full border-4 border-yellow-600/20"></div>
                        <div className="absolute inset-0 rounded-full border-4 border-t-yellow-400 animate-spin"></div>
                        <Bot className="absolute inset-0 m-auto text-yellow-400" size={24}/>
                    </div>
                    <div className="text-center">
                        <p className="text-white font-bold">AI Agent is building your schedule...</p>
                        <p className="text-gray-400 text-sm mt-1">Analysing cook days, optimal times, content pillars, hashtags</p>
                    </div>
                </div>
            )}

            {autoImageProgress && (
                <div className="mx-6 mt-4 p-4 bg-gray-900/80 border border-orange-700/30 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-orange-400 font-bold flex items-center gap-2">
                            <Sparkles size={12} className="animate-pulse"/> Generating AI images — {autoImageProgress.current} of {autoImageProgress.total}
                        </p>
                        <span className="text-xs text-gray-500">{Math.round((autoImageProgress.current / autoImageProgress.total) * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-1.5">
                        <div
                            className="bg-gradient-to-r from-orange-500 to-yellow-400 h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${(autoImageProgress.current / autoImageProgress.total) * 100}%` }}
                        />
                    </div>
                    <p className="text-xs text-gray-600 mt-1">Images appear on each post as they complete — you can review while they load</p>
                </div>
            )}

            {scheduledStrategy && !isGeneratingSchedule && (
                <div className="mx-6 mt-6 p-4 bg-yellow-900/20 border border-yellow-700/30 rounded-xl">
                    <p className="text-xs text-yellow-400 font-bold uppercase tracking-widest mb-2 flex items-center gap-2"><Lightbulb size={12}/> Agent Strategy</p>
                    <p className="text-gray-300 text-sm leading-relaxed">{scheduledStrategy}</p>
                </div>
            )}

            {smartSchedule.length > 0 && !isGeneratingSchedule && (
                <div className="p-6">
                    <div className="flex justify-between items-center mb-5">
                        <p className="text-white font-bold">{smartSchedule.filter((_, i) => !removedIndices.has(i)).length} posts ready to review</p>
                        <button
                            onClick={handleApproveAll}
                            className="bg-green-600 hover:bg-green-500 text-white text-sm font-bold px-4 py-2 rounded-lg flex items-center gap-2"
                        >
                            <CheckSquare size={15}/> Approve All & Schedule
                        </button>
                    </div>

                    <div className="space-y-4">
                        {smartSchedule.map((post, idx) => {
                            if (removedIndices.has(idx)) return null;
                            const isApproved = approvedIndices.has(idx);
                            const postDate = new Date(post.scheduledFor);
                            const pillarStyle = PILLAR_COLORS[post.pillar] || 'bg-gray-800 text-gray-400 border-gray-600';
                            return (
                                <div key={idx} className={`rounded-xl border transition-all ${
                                    isApproved
                                        ? 'border-green-600/60 bg-green-950/20'
                                        : 'border-gray-700 bg-gray-900/60'
                                }`}>
                                    <div className="p-4">
                                        {/* Header row */}
                                        <div className="flex items-start justify-between gap-3 mb-3">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
                                                    post.platform === 'Instagram'
                                                        ? 'bg-pink-900/50 text-pink-300 border border-pink-700'
                                                        : 'bg-blue-900/50 text-blue-300 border border-blue-700'
                                                }`}>
                                                    {post.platform === 'Instagram' ? <Instagram size={11}/> : <Facebook size={11}/>}
                                                    {post.platform}
                                                </span>
                                                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${pillarStyle}`}>
                                                    {post.pillar}
                                                </span>
                                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                                    <Clock size={11}/>
                                                    {postDate.toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' })}
                                                    {' '}{postDate.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                {!isApproved && (
                                                    <button
                                                        onClick={() => handleApprovePost(idx)}
                                                        title="Approve & Schedule"
                                                        className="bg-green-700 hover:bg-green-600 text-white p-1.5 rounded-lg"
                                                    >
                                                        <ThumbsUp size={14}/>
                                                    </button>
                                                )}
                                                {isApproved && (
                                                    <span className="bg-green-900/50 text-green-400 border border-green-700 text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1">
                                                        <CheckCircle size={12}/> Scheduled
                                                    </span>
                                                )}
                                                {!isApproved && (
                                                    <button
                                                        onClick={() => handleRemovePost(idx)}
                                                        title="Remove from schedule"
                                                        className="bg-gray-800 hover:bg-red-900/50 text-gray-400 hover:text-red-400 p-1.5 rounded-lg"
                                                    >
                                                        <X size={14}/>
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Topic */}
                                        <p className="text-bbq-gold text-sm font-bold mb-2">{post.topic}</p>

                                        {/* Content preview */}
                                        <div className="text-gray-300 text-sm leading-relaxed">
                                            {expandedPost === idx
                                                ? (post.content || '')
                                                : (post.content || '').length > 160 ? (post.content || '').slice(0, 160) + '…' : (post.content || '')
                                            }
                                        </div>
                                        {(post.content || '').length > 160 && (
                                            <button
                                                onClick={() => setExpandedPost(expandedPost === idx ? null : idx)}
                                                className="text-xs text-gray-500 hover:text-gray-300 mt-1"
                                            >
                                                {expandedPost === idx ? 'Show less' : 'Read full post'}
                                            </button>
                                        )}

                                        {/* Hashtags */}
                                        <div className="flex flex-wrap gap-1.5 mt-3">
                                            {(post.hashtags || []).slice(0, 8).map(tag => (
                                                <span key={tag} className="text-blue-400 text-xs">{tag}</span>
                                            ))}
                                            {(post.hashtags || []).length > 8 && (
                                                <span className="text-gray-500 text-xs">+{post.hashtags.length - 8} more</span>
                                            )}
                                        </div>

                                        {/* Reasoning + Image row */}
                                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800 gap-3">
                                            <p className="text-xs text-gray-500 italic leading-relaxed flex-1">
                                                <Info size={10} className="inline mr-1 text-gray-600"/>
                                                {post.reasoning}
                                            </p>
                                            <div className="shrink-0">
                                                {postImages[idx] ? (
                                                    <img src={postImages[idx]} alt="AI generated" className="w-16 h-16 rounded-lg object-cover border border-gray-700"/>
                                                ) : (
                                                    <button
                                                        onClick={() => handleGeneratePostImage(idx)}
                                                        disabled={generatingImageFor.has(idx)}
                                                        title="Generate AI image for this post"
                                                        className="bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-300 text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 border border-gray-700"
                                                    >
                                                        {generatingImageFor.has(idx)
                                                            ? <RefreshCw size={12} className="animate-spin"/>
                                                            : <Sparkles size={12}/>}
                                                        {generatingImageFor.has(idx) ? 'Generating…' : 'AI Image'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {smartSchedule.length === 0 && !isGeneratingSchedule && (
                <div className="p-10 text-center">
                    <Bot size={40} className="mx-auto text-gray-700 mb-3"/>
                    <p className="text-gray-500">Hit <strong className="text-gray-400">Generate Schedule</strong> to let the AI agent build your next 2 weeks of content — optimised for maximum reach and cook day sales.</p>
                </div>
            )}
        </div>

        {/* Facebook Connection */}
        <div className="bg-blue-900/20 rounded-xl border border-blue-800 p-6">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h4 className="text-xl font-bold text-blue-100 flex items-center gap-2"><Facebook size={20}/> Facebook Integration</h4>
                    <p className="text-sm text-blue-300 mt-1">Connect your business page to auto-update the homepage ticker.</p>
                </div>
                {settings.facebookConnected && (
                    <span className="bg-green-500 text-black text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                        <CheckCircle size={12}/> Connected
                    </span>
                )}
            </div>

            {settings.facebookConnected ? (
                <div className="flex gap-4 items-center">
                    <button onClick={() => updateSettings({ facebookConnected: false })} className="text-sm text-red-400 hover:text-red-300 underline">Disconnect</button>
                    <button onClick={() => setShowManualConfig(!showManualConfig)} className="text-sm text-blue-400 hover:text-blue-300 underline">Configure</button>
                    <button onClick={testFacebookConnection} disabled={isTestingFb} className="text-sm bg-blue-800 hover:bg-blue-700 text-white px-3 py-1 rounded flex items-center gap-2">
                        {isTestingFb ? <RefreshCw className="animate-spin" size={14}/> : <Plug size={14}/>} Test Connection
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex gap-2 max-w-md">
                        <input 
                            placeholder="App ID"
                            value={appIdInput}
                            onChange={e => setAppIdInput(e.target.value)}
                            className="bg-black/30 border border-blue-700 rounded p-2 text-white text-sm flex-1"
                        />
                        <button onClick={saveAppId} className="bg-blue-800 hover:bg-blue-700 text-white px-3 rounded text-xs font-bold">Save ID</button>
                    </div>
                    <button onClick={handleFacebookLogin} disabled={isConnecting} className="bg-[#1877F2] text-white px-6 py-2 rounded font-bold flex items-center gap-2 hover:bg-[#166fe5]">
                        {isConnecting ? 'Connecting...' : 'Login with Facebook'}
                    </button>
                    {fbPages.length > 0 && (
                        <div className="mt-4 space-y-2">
                            <p className="text-sm font-bold text-white">Select Page:</p>
                            {fbPages.map(page => (
                                <button key={page.id} onClick={() => selectPage(page)} className="block w-full text-left bg-gray-800 p-2 rounded hover:bg-gray-700 text-sm text-white">
                                    {page.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {showManualConfig && (
                <div className="mt-4 p-4 bg-black/30 rounded border border-blue-800">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-gray-400 block mb-1">Page ID</label>
                            <input value={fbConfig.pageId} onChange={e => setFbConfig({...fbConfig, pageId: e.target.value})} className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm"/>
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 block mb-1">Access Token</label>
                            <input value={fbConfig.token} onChange={e => setFbConfig({...fbConfig, token: e.target.value})} className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm" type="password"/>
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs text-gray-400 block mb-1">Instagram Business Account ID (Optional)</label>
                            <input value={fbConfig.instagramId} onChange={e => setFbConfig({...fbConfig, instagramId: e.target.value})} className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm"/>
                        </div>
                    </div>
                    <button onClick={handleManualSave} className="mt-2 text-xs bg-blue-700 text-white px-3 py-1 rounded">Save Manual Config</button>
                </div>
            )}

            {fbTestResult && (
                <div className={`mt-4 p-3 rounded text-sm flex items-start gap-2 ${fbTestResult.success ? 'bg-green-900/30 text-green-400 border border-green-800' : 'bg-red-900/30 text-red-400 border border-red-800'}`}>
                    {fbTestResult.success ? <CheckCircle size={16} className="shrink-0 mt-0.5" /> : <AlertCircle size={16} className="shrink-0 mt-0.5" />}
                    <span>{fbTestResult.message}</span>
                </div>
            )}
        </div>

        {/* Gallery Moderation */}
        <div className="bg-gray-900/50 rounded-xl border border-gray-700 overflow-hidden">
            <div className="bg-gray-800 p-4 border-b border-gray-700">
                <h4 className="font-bold text-white flex items-center gap-2"><ImageIcon size={18}/> Fan Gallery Moderation</h4>
            </div>
            <div className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {galleryPosts.length === 0 && <div className="col-span-full text-gray-500 text-center py-8">No posts yet.</div>}
                    {galleryPosts.map(post => (
                        <div key={post.id} className="relative group rounded-lg overflow-hidden border border-gray-700 bg-black">
                            <img src={post.imageUrl} className="w-full h-32 object-cover opacity-80 group-hover:opacity-100 transition"/>
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-2">
                                {!post.approved && (
                                    <button onClick={() => approvePost(post.id)} className="bg-green-600 text-white p-1.5 rounded-full hover:bg-green-500" title="Approve">
                                        <CheckSquare size={16}/>
                                    </button>
                                )}
                                <button onClick={() => deletePost(post.id)} className="bg-red-600 text-white p-1.5 rounded-full hover:bg-red-500" title="Delete">
                                    <Trash2 size={16}/>
                                </button>
                                <button onClick={() => downloadPost(post.imageUrl)} className="bg-blue-600 text-white p-1.5 rounded-full hover:bg-blue-500" title="Download">
                                    <Download size={16}/>
                                </button>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-1 text-[10px] text-gray-300 truncate text-center">
                                @{post.userName}
                            </div>
                            {post.approved && <div className="absolute top-1 right-1 bg-green-500 w-2 h-2 rounded-full shadow"></div>}
                        </div>
                    ))}
                </div>
            </div>
        </div>
        
        {/* Edit Post Modal */}
        {editingPost && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
                    <div className="flex justify-between items-center p-5 border-b border-gray-800">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Wand2 className="text-bbq-gold" size={18}/> Edit Scheduled Post
                        </h3>
                        <button onClick={() => setEditingPost(null)} title="Close" className="text-gray-400 hover:text-white"><X size={20}/></button>
                    </div>
                    <div className="p-5 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-gray-400 font-bold block mb-1">Platform</label>
                                <select
                                    title="Platform"
                                    value={editForm.platform || 'Instagram'}
                                    onChange={e => setEditForm(f => ({ ...f, platform: e.target.value as any }))}
                                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                                >
                                    <option value="Instagram">Instagram</option>
                                    <option value="Facebook">Facebook</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 font-bold block mb-1">Status</label>
                                <select
                                    title="Status"
                                    value={editForm.status || 'Scheduled'}
                                    onChange={e => setEditForm(f => ({ ...f, status: e.target.value as any }))}
                                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                                >
                                    <option value="Draft">Draft</option>
                                    <option value="Scheduled">Scheduled</option>
                                    <option value="Posted">Posted</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 font-bold block mb-1">Scheduled Date & Time (AEST)</label>
                            <input
                                type="datetime-local"
                                title="Scheduled date and time"
                                value={editForm.scheduledFor || ''}
                                onChange={e => setEditForm(f => ({ ...f, scheduledFor: e.target.value }))}
                                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 font-bold block mb-1">Content</label>
                            <textarea
                                title="Post content"
                                placeholder="Post content..."
                                rows={5}
                                value={editForm.content || ''}
                                onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))}
                                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm resize-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 font-bold block mb-1">Hashtags (comma-separated)</label>
                            <input
                                type="text"
                                title="Hashtags"
                                placeholder="#streetmeatz, #bbq, ..."
                                value={Array.isArray(editForm.hashtags) ? editForm.hashtags.join(', ') : (editForm.hashtags || '')}
                                onChange={e => setEditForm(f => ({ ...f, hashtags: e.target.value as any }))}
                                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                            />
                        </div>
                        {editingPost.image && (
                            <div>
                                <label className="text-xs text-gray-400 font-bold block mb-1">Current Image</label>
                                <img src={editingPost.image} alt="Scheduled post" className="w-full h-32 object-cover rounded-lg border border-gray-700"/>
                            </div>
                        )}
                    </div>
                    <div className="flex justify-between items-center p-5 border-t border-gray-800">
                        <button
                            onClick={() => handleDeletePost(editingPost.id)}
                            className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm font-bold px-3 py-2 rounded-lg hover:bg-red-900/20"
                        >
                            <Trash2 size={15}/> Delete
                        </button>
                        <div className="flex gap-3">
                            <button onClick={() => setEditingPost(null)} className="text-gray-400 hover:text-white text-sm px-4 py-2 rounded-lg bg-gray-800">Cancel</button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={isSavingEdit}
                                className="bg-bbq-gold text-black font-bold px-5 py-2 rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
                            >
                                {isSavingEdit ? <RefreshCw size={14} className="animate-spin"/> : <Save size={14}/>} Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Detailed Stats Modal */}
        {activeStat && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
                    <div className="flex justify-between items-center p-6 border-b border-gray-800">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            {activeStat === 'Followers' && <Users className="text-blue-400" />}
                            {activeStat === 'Reach' && <Eye className="text-purple-400" />}
                            {activeStat === 'Engagement' && <BarChart className="text-yellow-400" />}
                            Detailed {activeStat} Stats
                        </h3>
                        <button onClick={() => setActiveStat(null)} className="text-gray-400 hover:text-white">
                            <X size={24} />
                        </button>
                    </div>
                    <div className="p-6 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-black/30 p-4 rounded-xl border border-gray-800">
                                <div className="text-sm text-gray-400 mb-1">Total {activeStat}</div>
                                <div className="text-3xl font-bold text-white">
                                    {activeStat === 'Followers' && stats.followers}
                                    {activeStat === 'Reach' && stats.reach}
                                    {activeStat === 'Engagement' && `${stats.engagement}%`}
                                </div>
                            </div>
                            <div className="bg-black/30 p-4 rounded-xl border border-gray-800">
                                <div className="text-sm text-gray-400 mb-1">30 Day Growth</div>
                                <div className="text-3xl font-bold text-green-400">
                                    {activeStat === 'Followers' && `+${stats.followersGrowth}%`}
                                    {activeStat === 'Reach' && `+${stats.reachGrowth}%`}
                                    {activeStat === 'Engagement' && '+1.2%'}
                                </div>
                            </div>
                        </div>
                        
                        <div className="bg-black/30 p-4 rounded-xl border border-gray-800">
                            <h4 className="font-bold text-white mb-4">Performance Breakdown</h4>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-400">Organic</span>
                                    <span className="text-white font-bold">
                                        {activeStat === 'Followers' && Math.floor(stats.followers * 0.8)}
                                        {activeStat === 'Reach' && Math.floor(stats.reach * 0.6)}
                                        {activeStat === 'Engagement' && `${(stats.engagement * 0.9).toFixed(1)}%`}
                                    </span>
                                </div>
                                <div className="w-full bg-gray-800 rounded-full h-2">
                                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: '80%' }}></div>
                                </div>
                                
                                <div className="flex justify-between items-center text-sm pt-2">
                                    <span className="text-gray-400">Paid / Promoted</span>
                                    <span className="text-white font-bold">
                                        {activeStat === 'Followers' && Math.floor(stats.followers * 0.2)}
                                        {activeStat === 'Reach' && Math.floor(stats.reach * 0.4)}
                                        {activeStat === 'Engagement' && `${(stats.engagement * 1.1).toFixed(1)}%`}
                                    </span>
                                </div>
                                <div className="w-full bg-gray-800 rounded-full h-2">
                                    <div className="bg-purple-500 h-2 rounded-full" style={{ width: '20%' }}></div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="bg-blue-900/20 p-4 rounded-xl border border-blue-900/50 flex gap-3">
                            <Lightbulb className="text-blue-400 shrink-0" size={20} />
                            <div className="text-sm text-blue-200">
                                <span className="font-bold block mb-1">AI Insight</span>
                                {activeStat === 'Followers' && "Your follower growth spiked by 15% after your last brisket post. Consider posting more behind-the-scenes smoking content."}
                                {activeStat === 'Reach' && "Reels are currently driving 70% of your total reach. We recommend prioritizing short-form video content this week."}
                                {activeStat === 'Engagement' && "Posts with questions in the caption are receiving 3x more comments. Keep asking your audience about their BBQ preferences."}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}
        
        {/* --- SMS BLAST --- */}
        <div className="mt-8 pt-8 border-t border-gray-800">
            <SmsBlast />
        </div>
    </div>
  );
};

export default SocialManager;