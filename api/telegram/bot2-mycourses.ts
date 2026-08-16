import {
  supabase,
  BOT2_TELEGRAM_TOKEN,
  BOT3_USERNAME,
  WEBSITE_COURSE_URL_BASE,
  WEBSITE_ACCOUNT_SETTINGS_URL,
  UNIFIED_ERROR_MESSAGE,
  verifyUserLiveAccess,
  sendTelegramMessage,
  editTelegramMessage,
  answerCallbackQuery
} from './utils';

const PAGE_SIZE = 5;

/**
 * Resolves a Telegram sender against the CourseVerse `profiles` table.
 * Fallback order:
 *  1. profiles.telegram_id exact match
 *  2. profiles.telegram_username ILIKE sender's username (auto-saves telegram_id)
 *  3. historical telegram_access.joined_telegram_user_id (auto-saves telegram_id)
 */
async function resolveUserProfile(tgUserId: number, tgUsername?: string) {
  // 1. Check profiles.telegram_id
  const { data: byId } = await supabase
    .from('profiles')
    .select('id, full_name, email, is_blocked, telegram_id, telegram_username')
    .eq('telegram_id', tgUserId)
    .maybeSingle();

  if (byId) return byId;

  // 2. Check profiles.telegram_username if username is available
  if (tgUsername) {
    const cleanUsername = tgUsername.replace(/^@/, '').trim();
    const { data: byUsername } = await supabase
      .from('profiles')
      .select('id, full_name, email, is_blocked, telegram_id, telegram_username')
      .ilike('telegram_username', cleanUsername)
      .maybeSingle();

    if (byUsername) {
      console.log(`[bot2-mycourses] Matched user by username "${cleanUsername}". Linking telegram_id=${tgUserId}`);
      await supabase
        .from('profiles')
        .update({ telegram_id: tgUserId })
        .eq('id', byUsername.id);
      return { ...byUsername, telegram_id: tgUserId };
    }
  }

  // 3. Check historical telegram_access
  const { data: accessRow } = await supabase
    .from('telegram_access')
    .select('user_id')
    .eq('joined_telegram_user_id', tgUserId)
    .limit(1)
    .maybeSingle();

  if (accessRow && accessRow.user_id) {
    const { data: byAccess } = await supabase
      .from('profiles')
      .select('id, full_name, email, is_blocked, telegram_id, telegram_username')
      .eq('id', accessRow.user_id)
      .maybeSingle();

    if (byAccess) {
      console.log(`[bot2-mycourses] Matched user by historical telegram_access. Linking telegram_id=${tgUserId}`);
      await supabase
        .from('profiles')
        .update({ telegram_id: tgUserId })
        .eq('id', byAccess.id);
      return { ...byAccess, telegram_id: tgUserId };
    }
  }

  return null;
}

/**
 * Builds the Main Menu keyboard
 */
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
        console.error('[bot2-mycourses] Failed to parse JSON body:', e.message);
        return res.status(200).json({ status: 'ok' });
      }
    }

    if (!update) {
      return res.status(200).json({ status: 'ok' });
    }

    // =========================================================================
    // 1. HANDLE INCOMING MESSAGES (/start & /start link_<token>)
    // =========================================================================
    if (update.message) {
      const msg = update.message;
      const text = (msg.text || '').trim();
      const chatId = msg.chat?.id;
      const senderTgId = msg.from?.id;
      const senderUsername = msg.from?.username;

      if (text.startsWith('/start')) {
        const payload = text.replace(/^\/start\s*/, '').trim();

        // ---------------------------------------------------------------------
        // Variant B: /start link_<token> (Connecting account from website)
        // ---------------------------------------------------------------------
        if (payload.startsWith('link_')) {
          const linkTokenId = payload.replace(/^link_/, '').trim();
          console.log(`[bot2-mycourses] Processing account link token: ${linkTokenId}`);

          const { data: linkToken, error: linkErr } = await supabase
            .from('telegram_link_tokens')
            .select('id, user_id, status, expires_at')
            .eq('id', linkTokenId)
            .maybeSingle();

          const isExpired = linkToken && new Date() > new Date(linkToken.expires_at);

          if (linkErr || !linkToken || linkToken.status !== 'issued' || isExpired) {
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

          // Update profiles with this sender's Telegram ID
          const updatePayload: any = { telegram_id: senderTgId };
          if (senderUsername) {
            updatePayload.telegram_username = senderUsername;
          }

          await supabase
            .from('profiles')
            .update(updatePayload)
            .eq('id', linkToken.user_id);

          // Mark token as consumed
          await supabase
            .from('telegram_link_tokens')
            .update({
              status: 'consumed',
              consumed_at: new Date().toISOString()
            })
            .eq('id', linkTokenId);

          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', linkToken.user_id)
            .maybeSingle();

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

        // ---------------------------------------------------------------------
        // Variant A: /start (Regular open / dashboard)
        // ---------------------------------------------------------------------
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

    // =========================================================================
    // 2. HANDLE CALLBACK QUERIES (Inline buttons)
    // =========================================================================
    if (update.callback_query) {
      const cb = update.callback_query;
      const callbackData = cb.data || '';
      const chatId = cb.message?.chat?.id;
      const messageId = cb.message?.message_id;
      const senderTgId = cb.from?.id;
      const senderUsername = cb.from?.username;

      // Resolve user profile
      const profile = await resolveUserProfile(senderTgId, senderUsername);
      if (!profile || profile.is_blocked) {
        await answerCallbackQuery(BOT2_TELEGRAM_TOKEN, cb.id, 'Account not linked or suspended');
        await editTelegramMessage(
          BOT2_TELEGRAM_TOKEN,
          chatId,
          messageId,
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

      await answerCallbackQuery(BOT2_TELEGRAM_TOKEN, cb.id);

      // -----------------------------------------------------------------------
      // A) Main Menu
      // -----------------------------------------------------------------------
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

      // -----------------------------------------------------------------------
      // B) My Courses (Paginated)
      // -----------------------------------------------------------------------
      if (callbackData.startsWith('menu_courses:')) {
        const page = parseInt(callbackData.split(':')[1] || '0', 10);

        // Fetch purchased courses
        const { data: purchaseRows } = await supabase
          .from('purchases')
          .select('course_id')
          .eq('user_id', profile.id)
          .or('is_deleted.is.null,is_deleted.eq.false');

        const purchasedIds = new Set((purchaseRows || []).map((r: any) => r.course_id));

        // Check active subscription
        const nowIso = new Date().toISOString();
        const { data: activeSub } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('user_id', profile.id)
          .eq('status', 'active')
          .or(`end_date.is.null,end_date.gt.${nowIso}`)
          .maybeSingle();

        let accessibleCourseIds = Array.from(purchasedIds);

        if (activeSub) {
          const { data: allPublished } = await supabase
            .from('courses')
            .select('id')
            .eq('is_deleted', false)
            .eq('is_published', true);

          (allPublished || []).forEach((c: any) => {
            if (!purchasedIds.has(c.id)) {
              accessibleCourseIds.push(c.id);
            }
          });
        }

        // Validate UUIDs
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const validIds = accessibleCourseIds.filter((id) => uuidRegex.test(id));

        if (validIds.length === 0) {
          await editTelegramMessage(
            BOT2_TELEGRAM_TOKEN,
            chatId,
            messageId,
            'You haven\'t purchased any courses yet.',
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

        // Fetch course details
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

        // Course buttons
        pageCourses.forEach((c: any) => {
          const numPrefix = c.course_number ? `#${c.course_number} ` : '';
          const truncatedTitle = c.title.length > 32 ? `${c.title.slice(0, 30)}...` : c.title;
          keyboardRows.push([
            {
              text: `📖 ${numPrefix}${truncatedTitle}`,
              callback_data: `select_course:${c.id}`
            }
          ]);
        });

        // Pagination row
        const navRow: any[] = [];
        if (currentPage > 0) {
          navRow.push({ text: '⬅️ Prev', callback_data: `menu_courses:${currentPage - 1}` });
        }
        navRow.push({ text: `📄 ${currentPage + 1}/${totalPages}`, callback_data: `menu_courses:${currentPage}` });
        if (currentPage < totalPages - 1) {
          navRow.push({ text: 'Next ➡️', callback_data: `menu_courses:${currentPage + 1}` });
        }
        keyboardRows.push(navRow);

        // Bottom row
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

      // -----------------------------------------------------------------------
      // C) Select Course (Token generation & Bot 3 deep link)
      // -----------------------------------------------------------------------
      if (callbackData.startsWith('select_course:')) {
        const courseId = callbackData.replace(/^select_course:/, '').trim();

        // 1. Live re-verify access to course_id
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

        // 2. Generate 10-minute delivery token in telegram_delivery_tokens
        const { data: tokenRow, error: tokenErr } = await supabase
          .from('telegram_delivery_tokens')
          .insert({
            user_id: profile.id,
            telegram_id: senderTgId,
            course_id: courseId,
            status: 'issued',
            expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
          })
          .select('id')
          .single();

        if (tokenErr || !tokenRow) {
          console.error('[bot2-mycourses] Failed to create delivery token:', tokenErr);
          await answerCallbackQuery(BOT2_TELEGRAM_TOKEN, cb.id, 'Failed to create access token. Try again.', true);
          return res.status(200).json({ status: 'ok' });
        }

        const deliveryUrl = `https://t.me/${BOT3_USERNAME}?start=${tokenRow.id}`;
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

      // -----------------------------------------------------------------------
      // D) My Subscription
      // -----------------------------------------------------------------------
      if (callbackData === 'menu_subscription') {
        const nowIso = new Date().toISOString();
        const { data: activeSub } = await supabase
          .from('subscriptions')
          .select('plan_name, start_date, end_date, status')
          .eq('user_id', profile.id)
          .eq('status', 'active')
          .or(`end_date.is.null,end_date.gt.${nowIso}`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (activeSub) {
          let expiryText = 'Lifetime Access';
          if (activeSub.end_date) {
            const d = new Date(activeSub.end_date);
            expiryText = d.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            });
          }

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
    console.error(`[bot2-mycourses] Handler error: ${error?.message || 'Unknown'}`, error?.stack);
  }

  return res.status(200).json({ status: 'ok' });
}
