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
      // Graceful return if no channel is configured
      return res.status(200).json({ success: true, telegram_channel_id: null });
    }

    const chatId = course.telegram_channel_id;
    
    // 2. Check if user already has an invite or has joined
    const { data: existingAccess } = await supabase
      .from('telegram_access')
      .select('*')
      .eq('user_id', user_id)
      .eq('course_id', course_id)
      .order('created_at', { ascending: false })
      .limit(1);
      
    if (existingAccess && existingAccess.length > 0) {
      const access = existingAccess[0];
      if (access.link_used) {
        return res.status(200).json({ 
          success: true, 
          telegram_channel_id: chatId,
          already_joined: true
        });
      }
      
      // If it's not used and not expired, return it
      if (new Date(access.expires_at).getTime() > Date.now()) {
        return res.status(200).json({ 
          success: true, 
          telegram_channel_id: chatId,
          invite_link: access.invite_link,
          expires_at: access.expires_at
        });
      }
    }

    // Calculate expiry (10 minutes from now, in seconds for Telegram API)
    const expiresInMs = 10 * 60 * 1000;
    const expireDateSeconds = Math.floor((Date.now() + expiresInMs) / 1000);
    const expiresAtIso = new Date(Date.now() + expiresInMs).toISOString();

    // 3. Call Telegram API to generate a one-time invite link
    let inviteLink = null;
    try {
      const tgResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/createChatInviteLink`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          member_limit: 1, // One-time use
          expire_date: expireDateSeconds,
        }),
      });

      const tgData = await tgResponse.json();
      
      if (tgData.ok && tgData.result && tgData.result.invite_link) {
        inviteLink = tgData.result.invite_link;
      } else {
        console.error("Telegram API Error:", tgData);
        // We do not throw here to allow the purchase to succeed gracefully without breaking
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
    // Return graceful fallback so checkout isn't completely broken by this API
    return res.status(200).json({ success: false, error: 'Failed to generate invite link safely' });
  }
}
