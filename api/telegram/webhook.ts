import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Telegram expects a fast 200 response
  try {
    // === STEP 1: Parse body (handle string vs object) ===
    let update = req.body;
    console.log(`[webhook] STEP 1 - typeof req.body: ${typeof update}`);
    
    if (typeof update === 'string') {
      try {
        update = JSON.parse(update);
        console.log(`[webhook] STEP 1 - Parsed string body to object`);
      } catch (e) {
        console.error(`[webhook] STEP 1 - Failed to parse string body:`, e);
        return res.status(200).json({ status: "ok" });
      }
    }
    
    const topLevelKeys = Object.keys(update || {});
    console.log(`[webhook] STEP 2 - Top-level keys: [${topLevelKeys.join(', ')}]`);
    console.log(`[webhook] STEP 2 - RAW UPDATE:`, JSON.stringify(update));
    console.log(`[webhook] STEP 3 - update.chat_member exists: ${!!update.chat_member}, type: ${typeof update.chat_member}`);
    
    // Check if this is a chat_member update where someone joined
    if (update.chat_member) {
      const chatMember = update.chat_member;
      const inviteLinkObj = chatMember.invite_link;
      const oldStatus = chatMember.old_chat_member?.status;
      const newStatus = chatMember.new_chat_member?.status;

      console.log(`[webhook] STEP 4 - chat_member branch ENTERED: oldStatus=${oldStatus}, newStatus=${newStatus}`);
      console.log(`[webhook] STEP 4 - invite_link object:`, JSON.stringify(inviteLinkObj));

      // Ensure they actually joined and it used an invite link
      if (inviteLinkObj && inviteLinkObj.invite_link && (newStatus === 'member' || newStatus === 'administrator')) {
        const link = inviteLinkObj.invite_link;
        const tgUser = chatMember.new_chat_member?.user;
        const tgUserId = tgUser?.id;
        const tgUsername = tgUser?.username || tgUser?.first_name || 'Unknown';

        console.log(`[webhook] STEP 5 - Attempting DB update: invite_link="${link}", tgUserId=${tgUserId}, tgUsername="${tgUsername}"`);

        // Mark the link as used in the database
        const { data: updateData, error: updateError, count } = await supabase
          .from('telegram_access')
          .update({ 
            link_used: true,
            joined_at: new Date().toISOString(),
            joined_telegram_user_id: tgUserId,
            joined_telegram_username: tgUsername
          })
          .eq('invite_link', link)
          .eq('link_used', false)
          .select();

        console.log(`[webhook] STEP 6 - DB update result: matched=${count}, data=${JSON.stringify(updateData)}, error=${JSON.stringify(updateError)}`);

        // If no match found, try a broader search to diagnose
        if (!updateData || updateData.length === 0) {
          const { data: allRows } = await supabase
            .from('telegram_access')
            .select('invite_link, link_used')
            .order('created_at', { ascending: false })
            .limit(5);
          console.log(`[webhook] STEP 7 - DEBUG Last 5 telegram_access rows:`, JSON.stringify(allRows));
        }
      } else {
        console.log(`[webhook] STEP 4b - chat_member SKIPPED inner condition: inviteLinkObj=${!!inviteLinkObj}, inviteLinkObj.invite_link=${inviteLinkObj?.invite_link}, newStatus=${newStatus}`);
      }
    } else {
      console.log(`[webhook] STEP 3b - chat_member branch NOT entered. Checking other update types...`);
    }

    // Check if the bot itself was added to a new channel/group
    if (update.my_chat_member) {
      const myChatMember = update.my_chat_member;
      const newStatus = myChatMember.new_chat_member?.status;
      const chat = myChatMember.chat;

      // When added as admin or member
      if (newStatus === 'administrator' || newStatus === 'member') {
        const channelId = chat.id.toString();
        const channelTitle = chat.title || 'Unknown Channel';

        let persistentLink = null;
        if (newStatus === 'administrator') {
          // Generate a persistent link if the bot was added as an admin
          const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
          if (TELEGRAM_BOT_TOKEN) {
            try {
              const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/createChatInviteLink`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: channelId,
                  creates_join_request: true
                })
              });
              const tgData = await tgRes.json();
              if (tgData.ok && tgData.result.invite_link) {
                persistentLink = tgData.result.invite_link;
              }
            } catch (err) {
              console.error("Failed to generate persistent link:", err);
            }
          }
        }

        // Upsert the channel info
        const payload: any = {
          channel_id: channelId,
          channel_title: channelTitle,
          detected_at: new Date().toISOString()
        };
        if (persistentLink) {
          payload.persistent_access_link = persistentLink;
        }

        const { error } = await supabase
          .from('telegram_bot_channels')
          .upsert(payload, { onConflict: 'channel_id' });

        if (error) {
          console.error("Failed to insert/update telegram bot channel:", error);
        }
      }
    }

    if (update.chat_join_request) {
      const joinReq = update.chat_join_request;
      const chatId = joinReq.chat.id;
      const userId = joinReq.from.id;
      const username = joinReq.from.username || null;
      
      const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
      if (TELEGRAM_BOT_TOKEN) {
        // Decline the request
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/declineChatJoinRequest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            user_id: userId
          })
        });

        // Log it
        await supabase.from('telegram_join_requests').insert({
          channel_id: chatId.toString(),
          telegram_user_id: userId,
          telegram_username: username,
          timestamp: new Date().toISOString()
        });
      }
    }
  } catch (error) {
    console.error("Telegram webhook processing error:", error);
  }

  // Always return 200 OK to Telegram to prevent retries
  return res.status(200).json({ status: "ok" });
}
