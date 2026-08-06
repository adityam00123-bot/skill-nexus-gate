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
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Check if admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!roleData || roleData.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { target_user_id, action } = req.body;
    if (!target_user_id || !['ban', 'unban'].includes(action)) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    // Get the user's telegram access records
    const { data: accessData } = await supabase
      .from('telegram_access')
      .select('joined_telegram_user_id, telegram_channel_id')
      .eq('user_id', target_user_id)
      .not('joined_telegram_user_id', 'is', null)
      .not('telegram_channel_id', 'is', null);

    if (!accessData || accessData.length === 0) {
      return res.status(200).json({ success: true, message: 'No joined telegram channels found for user' });
    }

    const endpoint = action === 'ban' ? 'banChatMember' : 'unbanChatMember';
    const results = [];
    
    // Use a Set to avoid redundant bans if user has multiple access records for the same channel
    const processed = new Set<string>();

    for (const access of accessData) {
      const chatId = access.telegram_channel_id;
      const tgUserId = access.joined_telegram_user_id;
      
      if (!chatId || !tgUserId) continue;
      
      const key = `${chatId}-${tgUserId}`;
      if (processed.has(key)) continue;
      processed.add(key);

      const payload: any = {
        chat_id: chatId,
        user_id: tgUserId
      };
      
      // Call Telegram API
      const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const tgData = await tgRes.json();
      results.push({ chat_id: chatId, success: tgData.ok, description: tgData.description });
    }

    return res.status(200).json({ success: true, results });

  } catch (error: any) {
    console.error('Error in ban-user:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
