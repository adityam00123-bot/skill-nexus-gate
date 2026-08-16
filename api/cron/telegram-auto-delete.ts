import {
  supabase,
  BOT3_TELEGRAM_TOKEN,
  AUTO_DELETE_HOURS,
  deleteTelegramMessage
} from '../telegram/_utils';

export default async function handler(req: any, res: any) {
  // Allow GET / POST (Vercel Cron makes GET requests)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Optional: Verify CRON_SECRET if configured in environment
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${cronSecret}` && req.headers['x-vercel-cron'] !== '1') {
      console.warn('[cron:auto-delete] Unauthorized cron trigger attempt');
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const hours = AUTO_DELETE_HOURS || 46;
    const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    console.log(`[cron:auto-delete] Starting auto-delete scan. Cutoff time (${hours}h ago): ${cutoffDate}`);

    // Query messages to delete (limit 100 per run to stay well within serverless timeouts)
    const { data: messages, error: queryError } = await supabase
      .from('telegram_delivered_messages')
      .select('id, telegram_chat_id, telegram_message_id, course_id, sent_at')
      .is('deleted_at', null)
      .lt('sent_at', cutoffDate)
      .order('sent_at', { ascending: true })
      .limit(100);

    if (queryError) {
      console.error('[cron:auto-delete] DB query error:', queryError);
      return res.status(500).json({ error: 'Failed to query delivered messages' });
    }

    const messageList = messages || [];
    console.log(`[cron:auto-delete] Found ${messageList.length} messages eligible for deletion`);

    let successCount = 0;
    let failedCount = 0;

    for (const msg of messageList) {
      try {
        const tgRes = await deleteTelegramMessage(
          BOT3_TELEGRAM_TOKEN,
          msg.telegram_chat_id,
          msg.telegram_message_id
        );

        // Check if deletion was successful OR if message was already removed/not found
        const isSuccess = tgRes && tgRes.ok;
        const description = (tgRes?.description || '').toLowerCase();
        const isAlreadyDeleted =
          description.includes('message to delete not found') ||
          description.includes('message can\'t be deleted') ||
          description.includes('chat not found') ||
          description.includes('bot was blocked');

        if (isSuccess || isAlreadyDeleted) {
          await supabase
            .from('telegram_delivered_messages')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', msg.id);

          successCount++;
        } else {
          console.error(`[cron:auto-delete] Telegram error deleting msg ${msg.telegram_message_id} in chat ${msg.telegram_chat_id}:`, tgRes);
          failedCount++;
        }
      } catch (itemErr) {
        console.error(`[cron:auto-delete] Exception deleting message row ${msg.id}:`, itemErr);
        failedCount++;
      }
    }

    console.log(`[cron:auto-delete] Completed run. Success/Processed: ${successCount}, Failed: ${failedCount}`);

    return res.status(200).json({
      success: true,
      cutoff: cutoffDate,
      processed: messageList.length,
      deleted: successCount,
      failed: failedCount
    });

  } catch (error: any) {
    console.error('[cron:auto-delete] Uncaught cron execution error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
