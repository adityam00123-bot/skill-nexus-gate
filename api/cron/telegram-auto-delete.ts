import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const BOT3_TELEGRAM_TOKEN = process.env.BOT3_TELEGRAM_TOKEN || '8846789448:AAF77fj8Tl5FVK1tTzDaLjk4DSOgpt0X5U4';
const AUTO_DELETE_HOURS = parseInt(process.env.AUTO_DELETE_HOURS || '46', 10);

async function deleteTelegramMessage(token: string, chatId: number | string, messageId: number | string) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: Number(messageId)
      })
    });
    return await res.json();
  } catch (err) {
    console.error(`deleteTelegramMessage error (chat: ${chatId}, msg: ${messageId}):`, err);
    return { ok: false, error: err };
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${cronSecret}` && req.headers['x-vercel-cron'] !== '1') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const hours = AUTO_DELETE_HOURS || 46;
    const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const { data: messages, error: queryError } = await supabase
      .from('telegram_delivered_messages')
      .select('id, telegram_chat_id, telegram_message_id, course_id, sent_at')
      .is('deleted_at', null)
      .lt('sent_at', cutoffDate)
      .order('sent_at', { ascending: true })
      .limit(100);

    if (queryError) {
      return res.status(500).json({ error: 'Failed to query delivered messages' });
    }

    const messageList = messages || [];
    let successCount = 0;
    let failedCount = 0;

    for (const msg of messageList) {
      try {
        const tgRes = await deleteTelegramMessage(
          BOT3_TELEGRAM_TOKEN,
          msg.telegram_chat_id,
          msg.telegram_message_id
        );

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
          failedCount++;
        }
      } catch (itemErr) {
        failedCount++;
      }
    }

    return res.status(200).json({
      success: true,
      cutoff: cutoffDate,
      processed: messageList.length,
      deleted: successCount,
      failed: failedCount
    });

  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
