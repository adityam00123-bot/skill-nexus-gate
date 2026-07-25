import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user_id, course_id } = req.body;

    if (!user_id || !course_id) {
      return res.status(400).json({ error: 'Missing user_id or course_id' });
    }

    // 1. Get course to find telegram_channel_id
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('telegram_channel_id')
      .eq('id', course_id)
      .single();

    if (courseError || !course || !course.telegram_channel_id) {
      return res.status(200).json({ success: true, telegram_channel_id: null });
    }

    const chatId = course.telegram_channel_id;

    // Helper: fetch persistent access link for this channel
    const fetchPersistentLink = async () => {
      const { data } = await supabase
        .from('telegram_bot_channels')
        .select('persistent_access_link')
        .eq('channel_id', chatId)
        .maybeSingle();
      return data?.persistent_access_link || null;
    };
    
    // 2. Check ALL existing access rows for this user+course (not just most recent)
    const { data: allAccess } = await supabase
      .from('telegram_access')
      .select('*')
      .eq('user_id', user_id)
      .eq('course_id', course_id)
      .order('created_at', { ascending: false });

    if (allAccess && allAccess.length > 0) {
      // Case A: User has already joined via any link
      const usedLink = allAccess.find(a => a.link_used);
      if (usedLink) {
        console.log(`[generate-invite] Case A: already_joined for user=${user_id} course=${course_id}`);
        const persistentLink = await fetchPersistentLink();
        return res.status(200).json({ 
          success: true, 
          telegram_channel_id: chatId,
          already_joined: true,
          persistent_access_link: persistentLink
        });
      }
      
      // Case B: An unused link that hasn't expired yet — reuse it
      const validLink = allAccess.find(a => !a.link_used && new Date(a.expires_at).getTime() > Date.now());
      if (validLink) {
        console.log(`[generate-invite] Case B: returning EXISTING link for user=${user_id} course=${course_id}, expires_at=${validLink.expires_at}`);
        return res.status(200).json({ 
          success: true, 
          telegram_channel_id: chatId,
          invite_link: validLink.invite_link,
          expires_at: validLink.expires_at
        });
      }

      // Case C: All existing links are expired and unused.
      // Revoke them on Telegram to prevent leaked access, then generate a fresh one.
      console.log(`[generate-invite] Case C: all ${allAccess.length} links expired for user=${user_id} course=${course_id}, revoking and generating new`);
      for (const expired of allAccess.filter(a => !a.link_used)) {
        try {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/revokeChatInviteLink`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, invite_link: expired.invite_link })
          });
        } catch (_) { /* best-effort revocation */ }
      }
    }

    // 3. Generate a new one-time invite link (first time, or previous expired)
    console.log(`[generate-invite] Generating NEW link for user=${user_id} course=${course_id}`);
    const expiresInMs = 10 * 60 * 1000;
    const expireDateSeconds = Math.floor((Date.now() + expiresInMs) / 1000);
    const expiresAtIso = new Date(Date.now() + expiresInMs).toISOString();

    let inviteLink = null;
    try {
      const tgResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/createChatInviteLink`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          member_limit: 1,
          expire_date: expireDateSeconds,
        }),
      });

      const tgData = await tgResponse.json();
      
      if (tgData.ok && tgData.result && tgData.result.invite_link) {
        inviteLink = tgData.result.invite_link;
      } else {
        console.error("Telegram API Error:", tgData);
      }
    } catch (tgApiError) {
      console.error("Failed to call Telegram API:", tgApiError);
    }

    // 4. Save to database if we got a link
    if (inviteLink) {
      const { error: insertError } = await supabase
        .from('telegram_access')
        .insert({
          user_id,
          course_id,
          invite_link: inviteLink,
          telegram_channel_id: chatId,
          link_used: false,
          expires_at: expiresAtIso
        });
        
      if (insertError) {
        console.error("Failed to save telegram access:", insertError);
      }
    }

    return res.status(200).json({ 
      success: true, 
      telegram_channel_id: chatId,
      invite_link: inviteLink,
      expires_at: expiresAtIso
    });

  } catch (error: any) {
    console.error("Telegram generate-invite error:", error);
    return res.status(200).json({ success: false, error: 'Failed to generate invite link safely' });
  }
}
