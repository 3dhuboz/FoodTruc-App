/**
 * AI service — routes through OpenRouter API.
 * Replaces direct Google GenAI SDK calls.
 * All functions maintain the same interface for backward compatibility.
 */

let _runtimeKey = '';
export const setGeminiApiKey = (key: string) => { _runtimeKey = key; };

const getApiKey = () => {
  if (_runtimeKey) return _runtimeKey;
  return (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OPENROUTER_API_KEY) || '';
};

const MODEL = 'google/gemini-2.5-flash-preview';

async function openRouterChat(
  systemPrompt: string,
  userPrompt: string,
  options?: { json?: boolean; history?: { role: string; content: string }[] }
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API Key missing. Please configure in Admin > Settings.');

  const messages: any[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  if (options?.history) messages.push(...options.history);
  messages.push({ role: 'user', content: userPrompt });

  const body: any = { model: MODEL, messages };
  if (options?.json) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 401) throw new Error('Invalid API Key. Please check your OpenRouter key in Admin > Settings.');
    throw new Error(`AI Error (${res.status}): ${errText.substring(0, 120)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

function parseJsonSafe(text: string, fallback: any): any {
  try {
    // Strip markdown fences if present
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return fallback;
  }
}

// ─── Public API (same interface as before) ───────────────────

export const generateSocialPost = async (topic: string, platform: 'Facebook' | 'Instagram') => {
  try {
    const text = await openRouterChat(
      'You are an expert social media manager for a mobile food truck business. Return valid JSON only.',
      `Write a catchy, engaging ${platform} post about: "${topic}". Include emojis. Return JSON with "content" (the post text) and "hashtags" (array of strings).`,
      { json: true }
    );
    return parseJsonSafe(text, { content: 'Error generating content.', hashtags: [] });
  } catch (error: any) {
    return { content: error.message || 'AI Error', hashtags: [] };
  }
};

export const generateMarketingImage = async (prompt: string): Promise<string | null> => {
  // OpenRouter doesn't do image generation directly.
  // Return null — image generation should go through a dedicated service (FAL.ai, etc.)
  console.warn('[AI] Image generation requires a dedicated image API (FAL.ai, etc.)');
  return null;
};

export const analyzePostTimes = async () => {
  try {
    return await openRouterChat(
      '',
      'What are the best times to post on Instagram and Facebook for a food business in Australia? Give a concise bulleted list of 3 best slots for the upcoming week.'
    );
  } catch {
    return 'Could not analyze times.';
  }
};

export const generateEventPromotion = async (title: string, location: string, time: string) => {
  try {
    const text = await openRouterChat(
      'You promote food truck events. Return valid JSON only.',
      `Write a short, exciting promotional description for a food truck pop-up event.\nEvent: ${title}\nLocation: ${location}\nTime: ${time}\n\nReturn JSON with:\n- description: (max 2 sentences, engaging)\n- tags: (array of 5 trending hashtags for food/events)`,
      { json: true }
    );
    return parseJsonSafe(text, { description: '', tags: [] });
  } catch {
    return { description: 'Error generating content.', tags: [] };
  }
};

export const generateSocialRecommendations = async (stats: any) => {
  try {
    return await openRouterChat(
      'You are a social media strategist for a food truck business.',
      `Analyze these monthly performance stats:\n- Followers: ${stats.followers}\n- Reach: ${stats.reach}\n- Engagement: ${stats.engagement}%\n- Posts: ${stats.postsLast30Days}\n\nProvide 3 specific, high-impact recommendations. Format as a concise bulleted list.`
    );
  } catch {
    return 'Unable to analyze stats at this time.';
  }
};

export const generateCateringDescription = async (pkgName: string, items: { meats: number; sides: number }) => {
  try {
    return await openRouterChat(
      '',
      `Write a mouth-watering, professional description for a BBQ catering package named "${pkgName}". It includes ${items.meats} meat choices and ${items.sides} side dishes. Target: corporate events, weddings. Tone: premium. Max 2 sentences.`
    );
  } catch {
    return '';
  }
};

export interface SmartScheduledPost {
  platform: 'Instagram' | 'Facebook';
  scheduledFor: string;
  topic: string;
  content: string;
  hashtags: string[];
  imagePrompt: string;
  reasoning: string;
  pillar: string;
}

export const generateSmartSchedule = async (context: {
  stats: { followers: number; engagement: number; reach: number; postsLast30Days: number };
  cookDays: { date: string; location: string; title: string }[];
  menuItems: { name: string; category: string; price: number }[];
  postsToGenerate?: number;
  existingPosts?: { platform: string; scheduledFor: string; status: string }[];
  startDate?: string;
  intent?: 'fresh' | 'saturate' | 'fill_gaps';
}): Promise<{ posts: SmartScheduledPost[]; strategy: string }> => {
  const start = context.startDate ? new Date(context.startDate + 'T00:00:00') : new Date();
  const windowEnd = new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);

  try {
    const res = await fetch('/api/v1/ai/smart-schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...context, now: start.toISOString(), windowEnd: windowEnd.toISOString() }),
    });
    const data = await res.json();
    if (!res.ok) return { posts: [], strategy: `Error: ${data.error || res.statusText}` };
    return { posts: data.posts || [], strategy: data.strategy || '' };
  } catch (error: any) {
    return { posts: [], strategy: `Error: ${error?.message || 'Network error'}` };
  }
};

export const askPitmasterAI = async (history: { role: 'user' | 'model'; text: string }[], newMessage: string) => {
  try {
    const mappedHistory = history.map(h => ({
      role: h.role === 'model' ? 'assistant' : 'user',
      content: h.text,
    }));

    return await openRouterChat(
      `You are 'Pitmaster Jay', the owner and head pitmaster of a mobile BBQ food truck.
Your expertise is Low & Slow American BBQ smoked over Australian Ironbark wood.
Be friendly, knowledgeable, and passionate. Use a bit of Aussie slang occasionally.
Key Temps: Brisket at ~203F. Pork at ~205F. Chicken at 165F.
If asked something unrelated to BBQ or food, politely steer back to food.
Keep answers concise and practical.`,
      newMessage,
      { history: mappedHistory }
    );
  } catch {
    return "The smoker is choked up (Error connecting to AI).";
  }
};
