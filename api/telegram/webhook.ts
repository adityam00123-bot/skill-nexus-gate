import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Telegram expects a fast 200 response
  // We'll process asynchronously or quickly
  try {
    const update = req.body;
    
    // Check if this is a chat_member update where someone joined
    if (update.chat_member) {
      const chatMember = update.chat_member;
      const inviteLinkObj = chatMember.invite_link;
      const newStatus = chatMember.new_chat_member?.status;

      // Ensure they actually joined and it used an invite link
      if (inviteLinkObj && inviteLinkObj.invite_link && newStatus === 'member') {
        const link = inviteLinkObj.invite_link;

        // Mark the link as used in the database
        await supabase
          .from('telegram_access')
          .update({ 
            link_used: true,
            joined_at: new Date().toISOString()
          })
          .eq('invite_link', link)
          .eq('link_used', false);
      }
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

        // Upsert the channel info
        const { error } = await supabase
          .from('telegram_bot_channels')
          .upsert({
            channel_id: channelId,
            channel_title: channelTitle,
            detected_at: new Date().toISOString()
          }, { onConflict: 'channel_id' });

        if (error) {
          console.error("Failed to insert/update telegram bot channel:", error);
        }
      }
    }
  } catch (error) {
    console.error("Telegram webhook processing error:", error);
  }

  // Always return 200 OK to Telegram to prevent retries
  return res.status(200).json({ status: "ok" });
}
