import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const BOT3_TELEGRAM_TOKEN = process.env.BOT3_TELEGRAM_TOKEN || '8846789448:AAF77fj8Tl5FVK1tTzDaLjk4DSOgpt0X5U4';
const BOT2_USERNAME = (process.env.BOT2_USERNAME || 'CourseVerseofficialbot').replace(/^@/, '').replace(/^t\.me\//, '');
const STORAGE_CHANNEL_ID = process.env.STORAGE_CHANNEL_ID || '-1004345664449';
const WEBSITE_COURSE_URL_BASE = process.env.WEBSITE_COURSE_URL_BASE || 'https://courseverse-beta.vercel.app/courses';
const AUTO_DELETE_HOURS = parseInt(process.env.AUTO_DELETE_HOURS || '46', 10);
const UNIFIED_ERROR_MESSAGE = `❌ You haven't purchased this course.\n\n🛒 Purchase now: ${WEBSITE_COURSE_URL_BASE}`;

function buildDeliveryClosingMessage(courseTitle: string, lectureCount: number): string {
  return `✅ ${courseTitle} delivered — ${lectureCount} items.\n\n` +
    `⏳ For security, these files auto-remove from this chat in ${AUTO_DELETE_HOURS} hours. Forwarding, saving, and downloading are disabled the whole time, so just revisit them here whenever you want to watch.\n\n` +
    `📚 Want it again after they're gone? Open @${BOT2_USERNAME} anytime and tap this course for a fresh copy.\n\n` +
    `Happy learning! 🚀`;
}

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

async function copyTelegramMessage(token: string, toChatId: number | string, fromChatId: number | string, messageId: number | string) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/copyMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: toChatId,
        from_chat_id: fromChatId,
        message_id: Number(messageId),
        protect_content: true
      })
    });
    return await res.json();
  } catch (err) {
    console.error(`copyTelegramMessage error:`, err);
    return { ok: false, error: err };
  }
}

async function verifyUserLiveAccess(userId: string, courseId: string): Promise<{ hasAccess: boolean; courseTitle?: string }> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, is_blocked')
      .eq('id', userId)
      .maybeSingle();

    if (!profile || profile.is_blocked) return { hasAccess: false };

    const { data: course } = await supabase
      .from('courses')
      .select('id, title, is_deleted')
      .eq('id', courseId)
      .maybeSingle();

    if (!course || course.is_deleted) return { hasAccess: false };

    const nowIso = new Date().toISOString();
    const { data: activeSub } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .or(`end_date.is.null,end_date.gt.${nowIso}`)
      .limit(1)
      .maybeSingle();

    if (activeSub) return { hasAccess: true, courseTitle: course.title };

    const { data: purchase } = await supabase
      .from('purchases')
      .select('id')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .or('is_deleted.is.null,is_deleted.eq.false')
      .limit(1)
      .maybeSingle();

    if (purchase) return { hasAccess: true, courseTitle: course.title };

    return { hasAccess: false };
  } catch {
    return { hasAccess: false };
  }
}

function detectFileType(post: any): { fileType: string; duration: number } {
  if (post.video) {
    return { fileType: 'video', duration: post.video.duration || 0 };
  }
  if (post.audio || post.voice) {
    return { fileType: 'audio', duration: post.audio?.duration || post.voice?.duration || 0 };
  }
  if (post.sticker) {
    return { fileType: 'sticker', duration: 0 };
  }
  if (post.document) {
    const fileName = (post.document.file_name || '').toLowerCase();
    const mimeType = (post.document.mime_type || '').toLowerCase();

    if (
      fileName.endsWith('.mp4') ||
      fileName.endsWith('.mkv') ||
      fileName.endsWith('.mov') ||
      fileName.endsWith('.avi') ||
      mimeType.startsWith('video/')
    ) {
      return { fileType: 'video', duration: 0 };
    }
    if (
      fileName.endsWith('.rar') ||
      fileName.endsWith('.zip') ||
      fileName.endsWith('.7z') ||
      fileName.endsWith('.tar') ||
      mimeType.includes('zip') ||
      mimeType.includes('rar')
    ) {
      return { fileType: 'archive', duration: 0 };
    }
    if (fileName.endsWith('.pdf') || mimeType.includes('pdf')) {
      return { fileType: 'pdf', duration: 0 };
    }
    return { fileType: 'material', duration: 0 };
  }
  if (post.photo) {
    return { fileType: 'photo', duration: 0 };
  }
  return { fileType: 'text', duration: 0 };
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

    // 1. Channel Posts (Ingestion)
    if (update.channel_post || update.edited_channel_post) {
      const post = update.channel_post || update.edited_channel_post;

      try {
        const caption = (post.caption || post.text || '').trim();
        const headerMatch = caption.match(/^#(\d+)/);

        if (headerMatch) {
          const courseNum = parseInt(headerMatch[1], 10);
          const { data: course } = await supabase
            .from('courses')
            .select('id, title, course_number')
            .eq('course_number', courseNum)
            .eq('is_deleted', false)
            .maybeSingle();

          if (course) {
            await supabase
              .from('telegram_ingestion_state')
              .upsert({
                id: 1,
                current_course_id: course.id,
                current_course_number: courseNum,
                updated_at: new Date().toISOString()
              }, { onConflict: 'id' });
          } else {
            await supabase.from('telegram_unmatched_uploads').insert({
              raw_caption: caption,
              telegram_message_id: post.message_id,
              reason: 'course_number_not_in_db',
              created_at: new Date().toISOString(),
              resolved: false
            });
          }
        } else {
          const isContent = !!(
            post.video || post.document || post.audio || post.voice ||
            post.animation || post.video_note || post.photo || post.sticker || post.text
          );

          if (isContent) {
            const { data: state } = await supabase
              .from('telegram_ingestion_state')
              .select('current_course_id')
              .eq('id', 1)
              .maybeSingle();

            if (state && state.current_course_id) {
              const courseId = state.current_course_id;
              const channelId = post.chat?.id ? post.chat.id.toString() : STORAGE_CHANNEL_ID;
              const messageId = post.message_id.toString();
              const { fileType, duration } = detectFileType(post);

              await supabase
                .from('course_video_log')
                .upsert({
                  course_id: courseId,
                  channel_id: channelId,
                  telegram_message_id: messageId,
                  duration_seconds: duration,
                  file_type: fileType,
                  posted_at: new Date(post.date * 1000).toISOString()
                }, { onConflict: 'channel_id, telegram_message_id' });

              const { data: allItems } = await supabase
                .from('course_video_log')
                .select('duration_seconds, file_type')
                .eq('course_id', courseId);

              if (allItems) {
                const videoItems = allItems.filter(i => i.file_type === 'video' || i.file_type === 'audio');
                const materialItems = allItems.filter(i => i.file_type === 'pdf' || i.file_type === 'archive' || i.file_type === 'material');

                // If course has only archives/files (no stream videos), total_lectures counts the resource packs
                const total_lectures = videoItems.length > 0 ? videoItems.length : (allItems.filter(i => i.file_type !== 'sticker').length || 1);
                const total_materials = videoItems.length > 0 ? materialItems.length : 0;

                const totalDurationSecs = allItems.reduce((sum, v) => sum + (v.duration_seconds || 0), 0);
                const duration_hours = Math.round((totalDurationSecs / 3600) * 10) / 10;

                await supabase
                  .from('courses')
                  .update({ total_lectures, total_materials, duration_hours })
                  .eq('id', courseId);
              }
            } else {
              await supabase.from('telegram_unmatched_uploads').insert({
                raw_caption: caption || null,
                telegram_message_id: post.message_id,
                reason: 'no_active_course_context',
                created_at: new Date().toISOString(),
                resolved: false
              });
            }
          }
        }
      } catch (ingestErr) {
        console.error('[bot3-delivery] Ingest error:', ingestErr);
      }

      return res.status(200).json({ status: 'ok' });
    }

    // 2. DM Message (/start <token>)
    if (update.message) {
      const msg = update.message;
      const text = (msg.text || '').trim();
      const chatId = msg.chat?.id;
      const senderTgId = msg.from?.id;

      if (text.startsWith('/start')) {
        const token = text.replace(/^\/start\s*/, '').trim();

        if (!token) {
          await sendTelegramMessage(BOT3_TELEGRAM_TOKEN, chatId, UNIFIED_ERROR_MESSAGE);
          return res.status(200).json({ status: 'ok' });
        }

        const { data: tokenData } = await supabase
          .from('telegram_delivery_tokens')
          .select('id, user_id, telegram_id, course_id, status, expires_at')
          .eq('id', token)
          .maybeSingle();

        if (!tokenData) {
          await sendTelegramMessage(BOT3_TELEGRAM_TOKEN, chatId, UNIFIED_ERROR_MESSAGE);
          return res.status(200).json({ status: 'ok' });
        }

        if (tokenData.status !== 'issued') {
          await sendTelegramMessage(BOT3_TELEGRAM_TOKEN, chatId, UNIFIED_ERROR_MESSAGE);
          return res.status(200).json({ status: 'ok' });
        }

        const isExpired = new Date() > new Date(tokenData.expires_at);
        if (isExpired) {
          await supabase.from('telegram_delivery_tokens').update({ status: 'expired' }).eq('id', token);
          await sendTelegramMessage(BOT3_TELEGRAM_TOKEN, chatId, UNIFIED_ERROR_MESSAGE);
          return res.status(200).json({ status: 'ok' });
        }

        if (BigInt(senderTgId) !== BigInt(tokenData.telegram_id)) {
          await supabase.from('telegram_delivery_tokens').update({ status: 'rejected_mismatch' }).eq('id', token);
          await sendTelegramMessage(BOT3_TELEGRAM_TOKEN, chatId, UNIFIED_ERROR_MESSAGE);
          return res.status(200).json({ status: 'ok' });
        }

        const accessCheck = await verifyUserLiveAccess(tokenData.user_id, tokenData.course_id);
        if (!accessCheck.hasAccess) {
          await supabase.from('telegram_delivery_tokens').update({ status: 'rejected_no_purchase' }).eq('id', token);
          await sendTelegramMessage(BOT3_TELEGRAM_TOKEN, chatId, UNIFIED_ERROR_MESSAGE);
          return res.status(200).json({ status: 'ok' });
        }

        // DELIVER CONTENT
        const { data: lectures } = await supabase
          .from('course_video_log')
          .select('id, channel_id, telegram_message_id, posted_at')
          .eq('course_id', tokenData.course_id)
          .order('posted_at', { ascending: true })
          .order('telegram_message_id', { ascending: true });

        const lectureList = lectures || [];
        let deliveredCount = 0;

        for (const lec of lectureList) {
          const fromChannel = lec.channel_id || STORAGE_CHANNEL_ID;
          const copyRes = await copyTelegramMessage(
            BOT3_TELEGRAM_TOKEN,
            chatId,
            fromChannel,
            lec.telegram_message_id
          );

          if (copyRes && copyRes.ok && copyRes.result) {
            deliveredCount++;
            await supabase.from('telegram_delivered_messages').insert({
              telegram_chat_id: chatId,
              telegram_message_id: copyRes.result.message_id,
              course_id: tokenData.course_id,
              sent_at: new Date().toISOString()
            });
          }
        }

        await supabase
          .from('telegram_delivery_tokens')
          .update({
            status: 'delivered',
            consumed_at: new Date().toISOString()
          })
          .eq('id', token);

        const closingMsg = buildDeliveryClosingMessage(
          accessCheck.courseTitle || 'Course',
          deliveredCount
        );
        await sendTelegramMessage(BOT3_TELEGRAM_TOKEN, chatId, closingMsg);

        return res.status(200).json({ status: 'ok' });
      }
    }
  } catch (error: any) {
    console.error('[bot3-delivery] Error:', error);
  }

  return res.status(200).json({ status: 'ok' });
}
