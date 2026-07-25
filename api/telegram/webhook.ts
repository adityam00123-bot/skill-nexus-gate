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
  } catch (error) {
    console.error("Telegram webhook processing error:", error);
  }

  // Always return 200 OK to Telegram to prevent retries
  return res.status(200).json({ status: "ok" });
}
