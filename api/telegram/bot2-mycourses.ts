import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const BOT2_TELEGRAM_TOKEN = process.env.BOT2_TELEGRAM_TOKEN || '8657608725:AAGsU5XcLc7ZI3jkUJhkk_YnSeGNA4K6df8';
const BOT3_USERNAME = (process.env.BOT3_USERNAME || 'CourseVersedeliverybot').replace(/^@/, '').replace(/^t\.me\//, '');
const WEBSITE_COURSE_URL_BASE = process.env.WEBSITE_COURSE_URL_BASE || 'https://courseverse-beta.vercel.app/courses';
const WEBSITE_ACCOUNT_SETTINGS_URL = process.env.WEBSITE_ACCOUNT_SETTINGS_URL || 'https://courseverse-beta.vercel.app/settings';
const UNIFIED_ERROR_MESSAGE = `❌ You haven't purchased this course.\n\n🛒 Purchase now: ${WEBSITE_COURSE_URL_BASE}`;

const PAGE_SIZE = 5;

async function sendTelegramMessage(token: string, chatId: number | string, text: string, options: any = {}) {
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

async function editTelegramMessage(token: string, chatId: number | string, messageId: number, text: string, options: any = {}) {
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

async function answerCallbackQuery(token: string, callbackQueryId: string, text?: string, showAlert: boolean = false) {
  try {
    const payload: any = { callback_query_id: callbackQueryId };
    if (text) {
      payload.text = text;
      payload.show_alert = showAlert;
    }
    fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => {});
  } catch (err) {
    // Non-blocking
  }
}

async function verifyUserLiveAccess(userId: string, courseId: string): Promise<{ hasAccess: boolean; courseTitle?: string }> {
  try {
    const [profileRes, courseRes] = await Promise.all([
      supabase.from('profiles').select('id, is_blocked').eq('id', userId).maybeSingle(),
      supabase.from('courses').select('id, title, is_deleted').eq('id', courseId).maybeSingle()
    ]);

    if (!profileRes.data || profileRes.data.is_blocked) return { hasAccess: false };
    if (!courseRes.data || courseRes.data.is_deleted) return { hasAccess: false };

    const nowIso = new Date().toISOString();
    const [subRes, purchaseRes] = await Promise.all([
      supabase.from('subscriptions').select('id').eq('user_id', userId).eq('status', 'active').or(`end_date.is.null,end_date.gt.${nowIso}`).limit(1).maybeSingle(),
      supabase.from('purchases').select('id').eq('user_id', userId).eq('course_id', courseId).or('is_deleted.is.null,is_deleted.eq.false').limit(1).maybeSingle()
    ]);

    if (subRes.data || purchaseRes.data) return { hasAccess: true, courseTitle: courseRes.data.title };
    return { hasAccess: false };
  } catch {
    return { hasAccess: false };
  }
}

async function resolveUserProfile(tgUserId: number, tgUsername?: string) {
  // 1. By profiles.telegram_id
  const { data: byId } = await supabase
    .from('profiles')
    .select('id, full_name, is_blocked, telegram_id, telegram_username')
    .eq('telegram_id', tgUserId)
    .maybeSingle();

  if (byId) return byId;

  // 2. By telegram_access.joined_telegram_user_id
  const { data: accessRows } = await supabase
    .from('telegram_access')
    .select('user_id')
    .eq('joined_telegram_user_id', tgUserId)
    .limit(1);

  if (accessRows && accessRows.length > 0) {
    const { data: byAccess } = await supabase
      .from('profiles')
      .select('id, full_name, is_blocked, telegram_id, telegram_username')
      .eq('id', accessRows[0].user_id)
      .maybeSingle();

    if (byAccess) return byAccess;
  }

  // 3. By username match
  if (tgUsername) {
    const cleanUsername = tgUsername.replace(/^@/, '').trim();
    const { data: byUsername } = await supabase
      .from('profiles')
      .select('id, full_name, is_blocked, telegram_id, telegram_username')
      .ilike('telegram_username', cleanUsername)
      .maybeSingle();

    if (byUsername) return byUsername;
  }

  return null;
}

function getMainMenuMarkup() {
  return {
    inline_keyboard: [
      [{ text: '📚 My Courses', callback_data: 'menu_courses:0' }],
      [{ text: '💳 My Subscription', callback_data: 'menu_subscription' }],
      [{ text: '🌐 Open Website', url: WEBSITE_COURSE_URL_BASE }]
    ]
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let update = req.body;
    if (typeof update === 'string') {
      try {
        update = JSON.parse(update);
      } catch (e: any) {
        return res.status(200).json({ status: 'ok' });
      }
    }

    if (!update) {
      return res.status(200).json({ status: 'ok' });
    }

    // 1. Messages (/start)
    if (update.message) {
      const msg = update.message;
      const text = (msg.text || '').trim();
      const chatId = msg.chat?.id;
      const senderTgId = msg.from?.id;
      const senderUsername = msg.from?.username;

      if (text.startsWith('/start')) {
        const payload = text.replace(/^\/start\s*/, '').trim();

        // Variant B: /start link_<token>
        if (payload.startsWith('link_')) {
          const linkTokenId = payload.replace(/^link_/, '').trim();
          const { data: linkToken } = await supabase
            .from('telegram_link_tokens')
            .select('id, user_id, course_id, status, expires_at')
            .eq('id', linkTokenId)
            .maybeSingle();

          const isExpired = linkToken && new Date() > new Date(linkToken.expires_at);

          if (!linkToken || linkToken.status !== 'issued' || isExpired) {
            await sendTelegramMessage(
              BOT2_TELEGRAM_TOKEN,
              chatId,
              `⚠️ This connection link is invalid or expired. Generate a new one from your account settings:\n\n🔗 ${WEBSITE_ACCOUNT_SETTINGS_URL}`,
              {
                reply_markup: {
                  inline_keyboard: [
                    [{ text: '⚙️ Account Settings', url: WEBSITE_ACCOUNT_SETTINGS_URL }]
                  ]
                }
              }
            );
            return res.status(200).json({ status: 'ok' });
          }

          // If token has a specific course_id, bind it in telegram_access for this user
          if (linkToken.course_id) {
            await supabase
              .from('telegram_access')
              .upsert({
                user_id: linkToken.user_id,
                course_id: linkToken.course_id,
                joined_telegram_user_id: senderTgId,
                joined_telegram_username: senderUsername || null,
                updated_at: new Date().toISOString()
              }, { onConflict: 'user_id, course_id' });
          }

          // Update primary profile telegram info
          const updatePayload: any = { telegram_id: senderTgId };
          if (senderUsername) updatePayload.telegram_username = senderUsername;

          await Promise.all([
            supabase.from('profiles').update(updatePayload).eq('id', linkToken.user_id),
            supabase.from('telegram_link_tokens').update({ status: 'consumed', consumed_at: new Date().toISOString() }).eq('id', linkTokenId)
          ]);

          const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', linkToken.user_id).maybeSingle();
          const userName = profile?.full_name || 'Student';

          await sendTelegramMessage(
            BOT2_TELEGRAM_TOKEN,
            chatId,
            `✅ **Telegram connected to your CourseVerse account!**\n\n👋 Welcome, **${userName}**!\nManage your courses and learning dashboard below:`,
            {
              parse_mode: 'Markdown',
              reply_markup: getMainMenuMarkup()
            }
          );
          return res.status(200).json({ status: 'ok' });
        }

        // Variant A: /start (Regular open)
        const profile = await resolveUserProfile(senderTgId, senderUsername);

        if (!profile) {
          await sendTelegramMessage(
            BOT2_TELEGRAM_TOKEN,
            chatId,
            `Your Telegram isn't connected yet. Connect it from your account settings:\n\n${WEBSITE_ACCOUNT_SETTINGS_URL}`,
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🔗 Connect Telegram', url: WEBSITE_ACCOUNT_SETTINGS_URL }]
                ]
              }
            }
          );
          return res.status(200).json({ status: 'ok' });
        }

        if (profile.is_blocked) {
          await sendTelegramMessage(
            BOT2_TELEGRAM_TOKEN,
            chatId,
            `🚫 Your CourseVerse account is currently suspended. Please contact support.`
          );
          return res.status(200).json({ status: 'ok' });
        }

        const userName = profile.full_name || 'Student';
        await sendTelegramMessage(
          BOT2_TELEGRAM_TOKEN,
          chatId,
          `👋 Welcome, **${userName}**!\n\nManage your CourseVerse learning and access all your purchased courses below:`,
          {
            parse_mode: 'Markdown',
            reply_markup: getMainMenuMarkup()
          }
        );
        return res.status(200).json({ status: 'ok' });
      }
    }

    // 2. Callback Queries
    if (update.callback_query) {
      const cb = update.callback_query;
      const callbackData = cb.data || '';
      const chatId = cb.message?.chat?.id;
      const messageId = cb.message?.message_id;
      const senderTgId = cb.from?.id;
      const senderUsername = cb.from?.username;

      // ⚡ INSTANT SPINNER REMOVAL (Zero button lag)
      answerCallbackQuery(BOT2_TELEGRAM_TOKEN, cb.id);

      const profile = await resolveUserProfile(senderTgId, senderUsername);
      if (!profile || profile.is_blocked) {
        await sendTelegramMessage(
          BOT2_TELEGRAM_TOKEN,
          chatId,
          `Your Telegram isn't connected yet. Connect it from your account settings:\n\n${WEBSITE_ACCOUNT_SETTINGS_URL}`
        );
        return res.status(200).json({ status: 'ok' });
      }

      if (callbackData === 'menu_main') {
        const userName = profile.full_name || 'Student';
        await editTelegramMessage(
          BOT2_TELEGRAM_TOKEN,
          chatId,
          messageId,
          `👋 Welcome, **${userName}**!\n\nManage your CourseVerse learning and access all your purchased courses below:`,
          {
            parse_mode: 'Markdown',
            reply_markup: getMainMenuMarkup()
          }
        );
        return res.status(200).json({ status: 'ok' });
      }

      if (callbackData.startsWith('menu_courses:')) {
        const page = parseInt(callbackData.split(':')[1] || '0', 10);

        const nowIso = new Date().toISOString();
        const [purchaseRes, subRes, accessRes] = await Promise.all([
          supabase.from('purchases').select('course_id').eq('user_id', profile.id).or('is_deleted.is.null,is_deleted.eq.false'),
          supabase.from('subscriptions').select('id').eq('user_id', profile.id).eq('status', 'active').or(`end_date.is.null,end_date.gt.${nowIso}`).limit(1).maybeSingle(),
          supabase.from('telegram_access').select('course_id, joined_telegram_user_id').eq('user_id', profile.id)
        ]);

        const purchasedIds = new Set((purchaseRes.data || []).map((r: any) => r.course_id));
        let allUserCourses = Array.from(purchasedIds);

        if (subRes.data) {
          const { data: allPublished } = await supabase
            .from('courses')
            .select('id')
            .eq('is_deleted', false)
            .eq('is_published', true);

          (allPublished || []).forEach((c: any) => {
            if (!purchasedIds.has(c.id)) allUserCourses.push(c.id);
          });
        }

        const accessMap = new Map<string, number | null>();
        (accessRes.data || []).forEach((ar: any) => {
          accessMap.set(ar.course_id, ar.joined_telegram_user_id ? Number(ar.joined_telegram_user_id) : null);
        });

        const senderNumId = Number(senderTgId);
        const accessibleCourseIds = allUserCourses.filter((courseId) => {
          const boundTgId = accessMap.get(courseId);
          if (!boundTgId) return true;
          return boundTgId === senderNumId;
        });

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const validIds = accessibleCourseIds.filter((id) => uuidRegex.test(id));

        if (validIds.length === 0) {
          await editTelegramMessage(
            BOT2_TELEGRAM_TOKEN,
            chatId,
            messageId,
            'No courses found for this Telegram account.\n\nIf you linked other courses with a different Telegram account, open them from that respective account.',
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🛒 Purchase Now', url: WEBSITE_COURSE_URL_BASE }],
                  [{ text: '🏠 Main Menu', callback_data: 'menu_main' }]
                ]
              }
            }
          );
          return res.status(200).json({ status: 'ok' });
        }

        const { data: courses } = await supabase
          .from('courses')
          .select('id, title, course_number')
          .in('id', validIds)
          .eq('is_deleted', false)
          .order('course_number', { ascending: true });

        const courseList = courses || [];
        const totalPages = Math.ceil(courseList.length / PAGE_SIZE) || 1;
        const currentPage = Math.min(Math.max(0, page), totalPages - 1);
        const pageCourses = courseList.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

        const keyboardRows: any[] = [];
        pageCourses.forEach((c: any) => {
          const numPrefix = c.course_number ? `#${c.course_number} ` : '';
          const truncatedTitle = c.title.length > 32 ? `${c.title.slice(0, 30)}...` : c.title;
          keyboardRows.push([
            { text: `📖 ${numPrefix}${truncatedTitle}`, callback_data: `select_course:${c.id}` }
          ]);
        });

        const navRow: any[] = [];
        if (currentPage > 0) navRow.push({ text: '⬅️ Prev', callback_data: `menu_courses:${currentPage - 1}` });
        navRow.push({ text: `📄 ${currentPage + 1}/${totalPages}`, callback_data: `menu_courses:${currentPage}` });
        if (currentPage < totalPages - 1) navRow.push({ text: 'Next ➡️', callback_data: `menu_courses:${currentPage + 1}` });
        keyboardRows.push(navRow);
        keyboardRows.push([{ text: '🏠 Main Menu', callback_data: 'menu_main' }]);

        await editTelegramMessage(
          BOT2_TELEGRAM_TOKEN,
          chatId,
          messageId,
          `📚 **My Courses (${courseList.length})**\n\nSelect a course below to receive your lectures:`,
          {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboardRows }
          }
        );
        return res.status(200).json({ status: 'ok' });
      }

      if (callbackData.startsWith('select_course:')) {
        const courseId = callbackData.replace(/^select_course:/, '').trim();
        const accessCheck = await verifyUserLiveAccess(profile.id, courseId);

        if (!accessCheck.hasAccess) {
          await editTelegramMessage(
            BOT2_TELEGRAM_TOKEN,
            chatId,
            messageId,
            UNIFIED_ERROR_MESSAGE,
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🛒 Purchase Now', url: WEBSITE_COURSE_URL_BASE }],
                  [{ text: '📚 My Courses', callback_data: 'menu_courses:0' }]
                ]
              }
            }
          );
          return res.status(200).json({ status: 'ok' });
        }

        // Parallel update binding + issue token
        const [_, tokenRes] = await Promise.all([
          supabase.from('telegram_access').upsert({
            user_id: profile.id,
            course_id: courseId,
            joined_telegram_user_id: senderTgId,
            joined_telegram_username: senderUsername || null,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id, course_id' }),
          supabase.from('telegram_delivery_tokens').insert({
            user_id: profile.id,
            telegram_id: senderTgId,
            course_id: courseId,
            status: 'issued',
            expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
          }).select('id').single()
        ]);

        if (tokenRes.error || !tokenRes.data) {
          await sendTelegramMessage(BOT2_TELEGRAM_TOKEN, chatId, 'Failed to create access token. Please try again.');
          return res.status(200).json({ status: 'ok' });
        }

        const deliveryUrl = `https://t.me/${BOT3_USERNAME}?start=${tokenRes.data.id}`;
        const courseName = accessCheck.courseTitle || 'Course';

        await editTelegramMessage(
          BOT2_TELEGRAM_TOKEN,
          chatId,
          messageId,
          `📦 **${courseName}**\n\nYour single-use access pass is ready! Tap below to open the Delivery Bot and receive your lectures.\n\n⏳ *This link expires in 10 minutes.*`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '📥 Get Course', url: deliveryUrl }],
                [{ text: '🔙 Back to Courses', callback_data: 'menu_courses:0' }]
              ]
            }
          }
        );
        return res.status(200).json({ status: 'ok' });
      }

      if (callbackData === 'menu_subscription') {
        const nowIso = new Date().toISOString();
        const { data: activeSub } = await supabase
          .from('subscriptions')
          .select('plan_name, end_date')
          .eq('user_id', profile.id)
          .eq('status', 'active')
          .or(`end_date.is.null,end_date.gt.${nowIso}`)
          .limit(1)
          .maybeSingle();

        if (activeSub) {
          const expiryText = activeSub.end_date ? new Date(activeSub.end_date).toLocaleDateString() : 'Lifetime';
          await editTelegramMessage(
            BOT2_TELEGRAM_TOKEN,
            chatId,
            messageId,
            `💳 **My Subscription**\n\nPlan: **${activeSub.plan_name}**\nStatus: **Active** ✅\nValid Until: **${expiryText}**`,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '📚 My Courses', callback_data: 'menu_courses:0' }],
                  [{ text: '🏠 Main Menu', callback_data: 'menu_main' }]
                ]
              }
            }
          );
        } else {
          await editTelegramMessage(
            BOT2_TELEGRAM_TOKEN,
            chatId,
            messageId,
            `💳 **My Subscription**\n\nNo active subscription found. Subscribe to access the entire CourseVerse catalog:`,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🛒 Subscribe Now', url: 'https://courseverse-beta.vercel.app/subscribe' }],
                  [{ text: '🏠 Main Menu', callback_data: 'menu_main' }]
                ]
              }
            }
          );
        }
        return res.status(200).json({ status: 'ok' });
      }
    }
  } catch (error: any) {
    console.error('[bot2-mycourses] error:', error);
  }

  return res.status(200).json({ status: 'ok' });
}
