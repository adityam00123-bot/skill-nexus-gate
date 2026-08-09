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
    // 1. Authenticate the requester
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // 2. Verify admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!roleData || roleData.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    const { target_user_id } = req.body;
    if (!target_user_id) {
      return res.status(400).json({ error: 'Missing target_user_id' });
    }

    // Prevent admins from deleting themselves
    if (target_user_id === user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // 3. Ban from all Telegram channels before deleting records
    const telegramResults: any[] = [];
    if (TELEGRAM_BOT_TOKEN) {
      const { data: accessData } = await supabase
        .from('telegram_access')
        .select('joined_telegram_user_id, telegram_channel_id')
        .eq('user_id', target_user_id)
        .not('joined_telegram_user_id', 'is', null)
        .not('telegram_channel_id', 'is', null);

      if (accessData && accessData.length > 0) {
        const processed = new Set<string>();

        for (const access of accessData) {
          const chatId = access.telegram_channel_id;
          const tgUserId = access.joined_telegram_user_id;
          if (!chatId || !tgUserId) continue;

          const key = `${chatId}-${tgUserId}`;
          if (processed.has(key)) continue;
          processed.add(key);

          try {
            const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/banChatMember`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: chatId, user_id: tgUserId })
            });
            const tgData = await tgRes.json();
            telegramResults.push({ chat_id: chatId, success: tgData.ok, description: tgData.description });

            // Immediately unban to remove from ban list (kick without permanent ban)
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/unbanChatMember`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: chatId, user_id: tgUserId, only_if_banned: true })
            });
          } catch (tgErr: any) {
            telegramResults.push({ chat_id: chatId, success: false, description: tgErr.message });
          }
        }
      }
    }

    // 4. Snapshot the user's key info into deleted_users_archive before cascade delete
    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', target_user_id)
      .maybeSingle();

    const { data: purchaseStats } = await supabase
      .from('purchases')
      .select('price_paid')
      .eq('user_id', target_user_id);

    const totalPurchases = purchaseStats?.length || 0;
    const totalAmountSpent = (purchaseStats || []).reduce((sum: number, p: any) => sum + (Number(p.price_paid) || 0), 0);

    await supabase.from('deleted_users_archive').insert({
      original_user_id: target_user_id,
      full_name: profileData?.full_name || null,
      email: profileData?.email || null,
      total_purchases: totalPurchases,
      total_amount_spent: totalAmountSpent,
      deleted_by: user.id
    });

    // 5. Delete the auth user (cascades to profiles and all related tables)
    const { error: deleteError } = await supabase.auth.admin.deleteUser(target_user_id);
    if (deleteError) {
      console.error('Error deleting auth user:', deleteError);
      return res.status(500).json({ error: `Failed to delete user: ${deleteError.message}` });
    }

    return res.status(200).json({
      success: true,
      message: 'User completely deleted',
      telegram_results: telegramResults
    });

  } catch (error: any) {
    console.error('Error in delete-user:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
