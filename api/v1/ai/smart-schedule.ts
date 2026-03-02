import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'CLAUDE_API_KEY not configured on server.' });
  }

  try {
    const { stats, cookDays, menuItems, postsToGenerate = 10, existingPosts = [], now, windowEnd, intent = 'fresh' } = req.body;

    const cookDayContext = cookDays?.length > 0
      ? cookDays.map((d: any) => `${d.date} — ${d.title} at ${d.location}`).join('\n')
      : 'No upcoming cook days scheduled yet.';

    const menuContext = (menuItems || []).slice(0, 12).map((m: any) => `${m.name} ($${m.price})`).join(', ');

    const existingPostsContext = existingPosts.length > 0
      ? existingPosts.map((p: any) => `${(p.scheduledFor || '').slice(0, 10)} — ${p.platform} (${p.status})`).join('\n')
      : 'None yet.';

    const prompt = `You are a world-class social media strategist for "Your Business", a mobile low-and-slow BBQ business in Ipswich/Brisbane, QLD Australia. You specialise in authentic food brand storytelling that drives real sales.

=== BUSINESS CONTEXT ===
Your Business operates a pre-order model: customers pre-order from a fixed menu, the pitmaster smokes everything fresh on cook days, and customers pick up. It's limited, high-quality, community-driven.

Current performance: ${stats?.followers || 0} followers | ${stats?.engagement || 0}% engagement | ${stats?.reach || 0} monthly reach | ${stats?.postsLast30Days || 0} posts/30d

Upcoming Cook Days (these are your anchor events — build content around them):
${cookDayContext}

Menu highlights: ${menuContext}

=== INDUSTRY-PROVEN OPTIMAL TIMES FOR FOOD BRANDS IN AUSTRALIA (AEST) ===
INSTAGRAM best slots: Wed & Thu 11:00am-1:00pm, Fri 11:00am-1:00pm, Tue/Wed/Thu 7:00pm-9:00pm (highest food engagement), Sat 9:00am-11:00am (weekend browse)
FACEBOOK best slots: Wed-Thu 1:00pm-3:00pm, Fri 11:00am-2:00pm, Sun 12:00pm-2:00pm (family/event planning), Thu evening 7-8pm

AVOID: Monday mornings, any day before 9am, after 10pm

=== HIGH-CONVERTING CONTENT PILLARS FOR BBQ BRANDS ===
"Behind The Fire" — smoker setup, overnight cook, wood stacking, prep ritual (Mon/Tue — pre-cook hype)
"Food Cinema" — extreme close-up bark, smoke ring, pulled pork pull, glistening ribs (Tue/Wed/Thu peak)
"Cook Day Hype" — countdown posts 48hr/24hr/day-of with urgency and order CTA (always pre-cook day)
"Pitmaster Wisdom" — educational: why we rest brisket, wood choice, the science (Sat/Sun thought leader)
"Social Proof" — customer reactions, testimonials, thank-you shoutouts (mid-week trust builder)
"Scarcity Drop" — limited spots/items, sell-out warning, FOMO urgency (Thu/Fri for weekend demand)
"Lifestyle & Vibe" — BBQ culture, backyard scenes, fire + smoke aesthetic (Sun/Mon brand building)

=== ALREADY SCHEDULED POSTS (DO NOT DUPLICATE SAME PLATFORM ON SAME DAY) ===
${existingPostsContext}

=== ADMIN SCHEDULING INTENT ===
${intent === 'fresh' ? `FRESH SCHEDULE: Create a brand-new content plan for the next 2 weeks starting from ${now}. Spread posts evenly across the window. Avoid duplicating topics or platforms on days that already have posts.` : intent === 'saturate' ? `BOOST EXISTING DAYS: The admin wants MORE content saturation. Focus new posts on days that ALREADY have scheduled posts to increase posting frequency on those days. Add complementary content — e.g. if a day has an Instagram post, add a Facebook post, or add a different pillar. Double down on cook day hype with extra angles.` : `FILL GAPS: The admin wants to fill EMPTY days that don't have any posts yet. Look at the existing schedule and ONLY place new posts on days with zero content. Prioritise maintaining consistent daily presence.`}

=== YOUR TASK ===
Generate ${postsToGenerate} NEW posts scheduled between ${now} and ${windowEnd}.

STRATEGY RULES:
1. Anchor every cook day with a content arc: hype (2 days prior) → countdown (day before) → day-of post → sell-out/thank-you after
2. Never post two of the same pillar back-to-back
3. Alternate Instagram and Facebook naturally, but cook day CTA posts go on BOTH platforms
4. All scheduledFor times must be in ISO 8601 UTC format (convert from AEST = UTC+10)
5. CTAs must feel urgent and human, not robotic. Example: "Spots are going fast — jump on the pre-order now 🔥" NOT "Click the link to order"
6. Hashtags: mix hyper-local (#IpswichEats #BrisbaneFoodScene #SEQfoodie) with niche (#LowAndSlow #BBQAustralia #SmokeBBQ) and broad (#BBQ #Brisket #FoodPhotography). 8-15 tags per post.
7. imagePrompt must be a vivid professional food photography description suitable for AI image generation
8. reasoning must clearly explain: why this SPECIFIC time slot, and why this topic NOW in the schedule arc

Return ONLY a valid JSON object with this exact structure:
{
  "strategy": "brief overall strategy explanation",
  "posts": [
    {
      "platform": "Instagram" or "Facebook",
      "scheduledFor": "ISO 8601 UTC datetime string",
      "topic": "short topic label",
      "content": "full post caption text",
      "hashtags": ["array", "of", "hashtags"],
      "imagePrompt": "vivid photography description for image generation",
      "reasoning": "why this time and topic",
      "pillar": "one of the 7 content pillars"
    }
  ]
}`;

    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = message.content.find((c: any) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return res.status(500).json({ error: 'No text response from Claude.' });
    }

    const raw = textContent.text.trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: `Could not parse JSON from Claude response. Raw: ${raw.slice(0, 200)}` });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const safePosts = (parsed.posts || []).map((p: any) => ({
      platform: p.platform || 'Instagram',
      scheduledFor: p.scheduledFor || p.scheduled_for || new Date().toISOString(),
      topic: p.topic || '',
      content: p.content || '',
      hashtags: Array.isArray(p.hashtags) ? p.hashtags : [],
      imagePrompt: p.imagePrompt || p.image_prompt || '',
      reasoning: p.reasoning || '',
      pillar: p.pillar || '',
    }));
    res.json({ posts: safePosts, strategy: parsed.strategy || '' });
  } catch (error: any) {
    console.error('Claude smart schedule error:', error);
    res.status(500).json({ error: error.message || 'Unknown error' });
  }
}
