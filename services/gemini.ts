
import { GoogleGenAI, Type } from "@google/genai";

// Module-level key that AppContext sets from Firestore — works in incognito/new devices
let _runtimeKey = '';
export const setGeminiApiKey = (key: string) => { _runtimeKey = key; };

const getApiKey = () => {
  // 1. Runtime key set by AppContext from Firestore (works on any device)
  if (_runtimeKey) return _runtimeKey;
  // 2. Build-time env var fallback
  return (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) || '';
};

// Lazy initialization to allow runtime key updates
const getAI = () => {
  const key = getApiKey();
  if (!key) return null;
  return new GoogleGenAI({ apiKey: key });
};

export const generateSocialPost = async (topic: string, platform: 'Facebook' | 'Instagram') => {
  const ai = getAI();
  if (!ai) return { content: "API Key missing. Please configure in Admin > Settings.", hashtags: [] };

  try {
    const prompt = `
      You are an expert social media manager for "Your Business", a mobile BBQ catering business.
      Write a catchy, engaging ${platform} post about: "${topic}".
      Include emojis appropriate for BBQ.
      Return JSON format with "content" (the post text) and "hashtags" (array of strings).
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            content: { type: Type.STRING },
            hashtags: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }
      }
    });

    return response.text ? JSON.parse(response.text) : { content: "Error generating content.", hashtags: [] };
  } catch (error: any) {
    console.error("Gemini Text Error:", error);
    const msg = error?.message || error?.statusText || String(error);
    if (msg.includes('API_KEY_INVALID') || msg.includes('401')) {
      return { content: "Invalid API Key. Please check your Gemini key in Admin > Settings.", hashtags: [] };
    }
    return { content: `AI Error: ${msg.substring(0, 120)}`, hashtags: [] };
  }
};

export const generateMarketingImage = async (prompt: string): Promise<string | null> => {
  const ai = getAI();
  if (!ai) return null;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { text: `A delicious, professional food photography style image of BBQ food: ${prompt}. High quality, appetizing, cinematic lighting.` }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Gemini Image Error:", error);
    return null;
  }
};

export const analyzePostTimes = async () => {
  const ai = getAI();
  if (!ai) return "API Key missing.";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: "What are the best times to post on Instagram and Facebook for a food business in Australia? Give a concise bulleted list of 3 best slots for the upcoming week."
    });
    return response.text;
  } catch (error) {
    return "Could not analyze times.";
  }
};

export const generateEventPromotion = async (title: string, location: string, time: string) => {
  const ai = getAI();
  if (!ai) return { description: "API Key missing.", tags: [] };

  try {
    const prompt = `
      Write a short, exciting promotional description for a BBQ pop-up event.
      Event: ${title}
      Location: ${location}
      Time: ${time}
      
      Return JSON with:
      - description: (max 2 sentences, engaging)
      - tags: (array of 5 trending hashtags for food/events)
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });

    return response.text ? JSON.parse(response.text) : { description: "", tags: [] };
  } catch (error) {
    console.error("Gemini Event Error:", error);
    return { description: "Error generating content.", tags: [] };
  }
};

export const generateSocialRecommendations = async (stats: any) => {
  const ai = getAI();
  if (!ai) return "API Key missing.";

  try {
    const prompt = `
      You are a social media strategist for "Your Business".
      Analyze these monthly performance stats:
      - Total Followers: ${stats.followers}
      - Monthly Reach: ${stats.reach}
      - Engagement Rate: ${stats.engagement}%
      - Posts Count: ${stats.postsLast30Days}

      Provide 3 specific, high-impact recommendations to improve brand awareness and food truck sales.
      Focus on content types, timing, or community interaction.
      Format as a concise bulleted list.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "No recommendations generated.";
  } catch (error) {
    console.error("Gemini Recs Error:", error);
    return "Unable to analyze stats at this time.";
  }
};

export const generateCateringDescription = async (pkgName: string, items: {meats: number, sides: number}) => {
  const ai = getAI();
  if (!ai) return "API Key missing.";

  try {
    const prompt = `
      Write a mouth-watering, professional description for a BBQ catering package named "${pkgName}".
      It includes ${items.meats} meat choices and ${items.sides} side dishes.
      Target audience: Corporate events, weddings, and large parties.
      Tone: Premium, abundant, delicious.
      Max length: 2 sentences.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "";
  } catch (error) {
    console.error("Gemini Desc Error:", error);
    return "";
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
      body: JSON.stringify({
        ...context,
        now: start.toISOString(),
        windowEnd: windowEnd.toISOString(),
      }),
    });
    const data = await res.json();
    if (!res.ok) return { posts: [], strategy: `Error: ${data.error || res.statusText}` };
    return { posts: data.posts || [], strategy: data.strategy || '' };
  } catch (error: any) {
    const msg = error?.message || 'Network error — is the dev server running?';
    console.error('Smart Schedule Error:', msg);
    return { posts: [], strategy: `Error: ${msg}` };
  }
};

export const askPitmasterAI = async (history: {role: 'user' | 'model', text: string}[], newMessage: string) => {
    const ai = getAI();
    if (!ai) return "System Offline: API Key Missing.";

    try {
        const chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: `You are 'Pitmaster Jay', the owner and head pitmaster of "Your Business". 
                Your expertise is Low & Slow American BBQ smoked over Australian Ironbark wood.
                
                Persona Guidelines:
                1. You are Jay. Speak in the first person ("I", "me", "my smoker").
                2. Be friendly, knowledgeable, and passionate. Use a bit of Aussie slang occasionally (e.g., "G'day", "Mate", "Ripper").
                3. You prefer temperatures in Fahrenheit (as per BBQ tradition) but convert if asked.
                4. Key Temps: Brisket pulls at ~203F. Pork at ~205F. Chicken at 165F.
                5. Wood: You SWEAR by seasoned Ironbark for the best heat and flavor.
                6. If asked something unrelated to BBQ, meat, or Your Business, politely steer the conversation back to food or say you're busy checking the fire.
                7. Keep answers concise and practical.
                `
            },
            history: history.map(h => ({
                role: h.role,
                parts: [{ text: h.text }]
            }))
        });

        const response = await chat.sendMessage({ message: newMessage });
        return response.text || "I'm checking the smoker, try again in a second.";
    } catch (error) {
        console.error("Pitmaster AI Error:", error);
        return "The smoker is choked up (Error connecting to AI).";
    }
};
