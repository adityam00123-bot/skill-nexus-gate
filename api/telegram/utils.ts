import { createClient } from '@supabase/supabase-js';

// Supabase Service Role Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Environment Configurations & Defaults
export const BOT2_TELEGRAM_TOKEN = process.env.BOT2_TELEGRAM_TOKEN || '';
export const BOT2_USERNAME = (process.env.BOT2_USERNAME || 'CourseVerseofficialbot').replace(/^@/, '').replace(/^t\.me\//, '');

export const BOT3_TELEGRAM_TOKEN = process.env.BOT3_TELEGRAM_TOKEN || '';
export const BOT3_USERNAME = (process.env.BOT3_USERNAME || 'CourseVersedeliverybot').replace(/^@/, '').replace(/^t\.me\//, '');

export const STORAGE_CHANNEL_ID = process.env.STORAGE_CHANNEL_ID || '-1004345664449';
export const WEBSITE_COURSE_URL_BASE = process.env.WEBSITE_COURSE_URL_BASE || 'https://courseverse-beta.vercel.app/courses';
export const WEBSITE_ACCOUNT_SETTINGS_URL = process.env.WEBSITE_ACCOUNT_SETTINGS_URL || 'https://courseverse-beta.vercel.app/settings';
export const AUTO_DELETE_HOURS = parseInt(process.env.AUTO_DELETE_HOURS || '46', 10);

/**
 * Unified Error Message used for all rejection scenarios
 * (Prevents leaking information about reason for denial)
 */
export const UNIFIED_ERROR_MESSAGE = `❌ You haven't purchased this course.\n\n🛒 Purchase now: ${WEBSITE_COURSE_URL_BASE}`;

/**
 * Constructs the exact delivery closing message
 */
export function buildDeliveryClosingMessage(courseTitle: string, lectureCount: number): string {
  return `✅ ${courseTitle} delivered — ${lectureCount} lectures.\n\n` +
    `⏳ For security, these files auto-remove from this chat in ${AUTO_DELETE_HOURS} hours. Forwarding, saving, and downloading are disabled the whole time, so just revisit them here whenever you want to watch.\n\n` +
    `📚 Want it again after they're gone? Open @${BOT2_USERNAME} anytime and tap this course for a fresh copy.\n\n` +
    `Happy learning! 🚀`;
}

/**
 * Live checks if a user has valid, active, non-blocked access to a course.
 */
export async function verifyUserLiveAccess(userId: string, courseId: string): Promise<{
  hasAccess: boolean;
  courseTitle?: string;
  courseNumber?: number;
  reason?: string;
}> {
  try {
    // 1. Verify user profile exists and is NOT blocked
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, is_blocked, full_name')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !profile) {
      return { hasAccess: false, reason: 'user_not_found' };
    }

    if (profile.is_blocked) {
      return { hasAccess: false, reason: 'user_blocked' };
    }

    // 2. Verify course exists and is NOT deleted
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, title, course_number, is_deleted')
      .eq('id', courseId)
      .maybeSingle();

    if (courseError || !course || course.is_deleted) {
      return { hasAccess: false, reason: 'course_not_found_or_deleted' };
    }

    // 3. Check for active platform-wide or course-specific subscription
    const nowIso = new Date().toISOString();
    const { data: activeSub, error: subError } = await supabase
      .from('subscriptions')
      .select('id, plan_name, end_date')
      .eq('user_id', userId)
      .eq('status', 'active')
      .or(`end_date.is.null,end_date.gt.${nowIso}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeSub) {
      return {
        hasAccess: true,
        courseTitle: course.title,
        courseNumber: course.course_number
      };
    }

    // 4. Check for direct purchase in purchases table
    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .select('id, is_deleted')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .or('is_deleted.is.null,is_deleted.eq.false')
      .limit(1)
      .maybeSingle();

    if (purchase) {
      return {
        hasAccess: true,
        courseTitle: course.title,
        courseNumber: course.course_number
      };
    }

    return { hasAccess: false, reason: 'no_purchase_or_sub' };
  } catch (err: any) {
    console.error('Error in verifyUserLiveAccess:', err);
    return { hasAccess: false, reason: err.message };
  }
}

/**
 * Telegram API Helpers
 */
export async function sendTelegramMessage(
  token: string,
  chatId: number | string,
  text: string,
  options: {
    parse_mode?: 'Markdown' | 'HTML';
    reply_markup?: any;
    disable_web_page_preview?: boolean;
  } = {}
) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: options.disable_web_page_preview ?? true,
        ...options
      })
    });
    return await res.json();
  } catch (err) {
    console.error(`sendTelegramMessage error (chatId: ${chatId}):`, err);
    return { ok: false, error: err };
  }
}

export async function editTelegramMessage(
  token: string,
  chatId: number | string,
  messageId: number,
  text: string,
  options: {
    parse_mode?: 'Markdown' | 'HTML';
    reply_markup?: any;
    disable_web_page_preview?: boolean;
  } = {}
) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        disable_web_page_preview: options.disable_web_page_preview ?? true,
        ...options
      })
    });
    return await res.json();
  } catch (err) {
    console.error(`editTelegramMessage error (chatId: ${chatId}, messageId: ${messageId}):`, err);
    return { ok: false, error: err };
  }
}

export async function answerCallbackQuery(
  token: string,
  callbackQueryId: string,
  text?: string,
  showAlert: boolean = false
) {
  try {
    const payload: any = { callback_query_id: callbackQueryId };
    if (text) {
      payload.text = text;
      payload.show_alert = showAlert;
    }
    const res = await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (err) {
    console.error('answerCallbackQuery error:', err);
    return { ok: false, error: err };
  }
}

/**
 * Copies a message from storage channel to a user DM.
 * CRITICAL: Mandatory `protect_content: true` on every single copy call!
 */
export async function copyTelegramMessage(
  token: string,
  toChatId: number | string,
  fromChatId: number | string,
  messageId: number | string
) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/copyMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: toChatId,
        from_chat_id: fromChatId,
        message_id: Number(messageId),
        protect_content: true // MANDATORY: Restricts saving/forwarding/downloading
      })
    });
    return await res.json();
  } catch (err) {
    console.error(`copyTelegramMessage error (from: ${fromChatId}, msg: ${messageId}, to: ${toChatId}):`, err);
    return { ok: false, error: err };
  }
}

export async function deleteTelegramMessage(
  token: string,
  chatId: number | string,
  messageId: number | string
) {
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
