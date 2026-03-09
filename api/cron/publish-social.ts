// Vercel Cron Function: auto-publish scheduled social posts to Facebook & Instagram
// Schedule: every hour (see vercel.json). Requires:
//   FIREBASE_SERVICE_ACCOUNT_KEY — Firebase service account JSON (stringified)
//   CRON_SECRET                  — Random secret to verify Vercel is the caller

import * as admin from 'firebase-admin';

function getAdminDb() {
  if (admin.apps.length > 0) return admin.firestore(admin.app());
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!key) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY env var not set');
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(key)), projectId: 'street-meatz-bbq' });
  return admin.firestore();
}

function buildCaption(content: string, hashtags: string[]): string {
  const tags = (hashtags || []).map(t => (t.startsWith('#') ? t : `#${t}`)).join(' ');
  return tags ? `${content}\n\n${tags}` : content;
}

async function publishFacebook(pageId: string, token: string, caption: string, imageUrl?: string): Promise<string> {
  if (imageUrl) {
    const res = await fetch(`https://graph.facebook.com/v18.0/${pageId}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: imageUrl, caption, access_token: token }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.id;
  }
  const res = await fetch(`https://graph.facebook.com/v18.0/${pageId}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: caption, access_token: token }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.id;
}

async function publishInstagram(igUserId: string, token: string, caption: string, imageUrl: string): Promise<string> {
  // Step 1: Create media container
  const containerRes = await fetch(`https://graph.facebook.com/v18.0/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: imageUrl, caption, access_token: token }),
  });
  const container = await containerRes.json();
  if (container.error) throw new Error(container.error.message);

  // Step 2: Publish the container
  const publishRes = await fetch(`https://graph.facebook.com/v18.0/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: container.id, access_token: token }),
  });
  const published = await publishRes.json();
  if (published.error) throw new Error(published.error.message);
  return published.id;
}

export default async function handler(req: any, res: any) {
  // Vercel passes Authorization header for cron jobs when CRON_SECRET is set
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers['authorization'];
    if (auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const db = getAdminDb();

    // Read Facebook credentials from Firestore settings
    const settingsSnap = await db.collection('settings').doc('general').get();
    const settings = settingsSnap.data() || {};

    const pageToken: string = settings.facebookPageAccessToken || '';
    const pageId: string = settings.facebookPageId || '';
    const igUserId: string = settings.instagramBusinessAccountId || '';
    const fbConnected: boolean = !!settings.facebookConnected;

    if (!fbConnected || !pageToken || !pageId) {
      return res.json({ skipped: true, reason: 'Facebook not connected or credentials missing in Settings' });
    }

    const now = new Date();

    // Fetch all Scheduled posts — filter for due ones in code (Firestore inequality + equality on different fields not supported without composite index)
    const snapshot = await db.collection('social_posts').where('status', '==', 'Scheduled').get();
    const duePosts = snapshot.docs.filter(doc => new Date(doc.data().scheduledFor) <= now);

    if (duePosts.length === 0) {
      return res.json({ published: 0, message: 'No posts due at this time' });
    }

    const results: any[] = [];

    for (const postDoc of duePosts) {
      const post = postDoc.data();
      const caption = buildCaption(post.content || '', post.hashtags || []);
      // Only use image if it's a public HTTPS URL (base64 data URLs can't be used by Graph API)
      const imageUrl = typeof post.image === 'string' && post.image.startsWith('https://') ? post.image : undefined;

      let platformPostId: string | null = null;
      let skipReason: string | null = null;

      try {
        if (post.platform === 'Facebook') {
          platformPostId = await publishFacebook(pageId, pageToken, caption, imageUrl);
        } else if (post.platform === 'Instagram') {
          if (!igUserId) {
            skipReason = 'Instagram Business Account ID not configured in Settings';
          } else if (!imageUrl) {
            skipReason = 'Instagram requires a public image URL — AI-generated base64 images need to be uploaded to Firebase Storage first';
          } else {
            platformPostId = await publishInstagram(igUserId, pageToken, caption, imageUrl);
          }
        }

        await postDoc.ref.update({
          status: skipReason ? 'Failed' : 'Posted',
          publishedAt: now.toISOString(),
          platformPostId: platformPostId || null,
          publishError: skipReason || null,
        });

        results.push({ id: postDoc.id, platform: post.platform, status: skipReason ? 'Failed' : 'Posted', reason: skipReason });
        console.log(`[Cron] ${skipReason ? 'SKIPPED' : 'PUBLISHED'} ${post.platform} post ${postDoc.id}${skipReason ? ': ' + skipReason : ''}`);
      } catch (e: any) {
        console.error(`[Cron] Failed to publish ${postDoc.id}:`, e.message);
        await postDoc.ref.update({ status: 'Failed', publishError: e.message });
        results.push({ id: postDoc.id, platform: post.platform, status: 'Failed', error: e.message });
      }
    }

    const publishedCount = results.filter(r => r.status === 'Posted').length;
    console.log(`[Cron] Done: ${publishedCount}/${duePosts.length} posts published`);
    return res.json({ published: publishedCount, total: duePosts.length, results });

  } catch (error: any) {
    console.error('[Cron] publish-social fatal error:', error);
    return res.status(500).json({ error: error.message });
  }
}
