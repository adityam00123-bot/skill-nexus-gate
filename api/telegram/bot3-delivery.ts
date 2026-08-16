import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://xajntlcmkvucwlgmxufr.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_dLTX4EcpLJ2OmECckH0rzA_1CD3jXl7';
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const BOT3_TELEGRAM_TOKEN = process.env.BOT3_TELEGRAM_TOKEN || '8846789448:AAF77fj8Tl5FVK1tTzDaLjk4DSOgpt0X5U4';
const BOT2_USERNAME = (process.env.BOT2_USERNAME || 'CourseVerseofficialbot').replace(/^@/, '').replace(/^t\.me\//, '');
const STORAGE_CHANNEL_ID = process.env.STORAGE_CHANNEL_ID || '-1004345664449';
const WEBSITE_COURSE_URL_BASE = process.env.WEBSITE_COURSE_URL_BASE || 'https://courseverse-beta.vercel.app/courses';
const AUTO_DELETE_HOURS = parseInt(process.env.AUTO_DELETE_HOURS || '46', 10);
const UNIFIED_ERROR_MESSAGE = `❌ You haven't purchased this course.\n\n🛒 Purchase now: ${WEBSITE_COURSE_URL_BASE}`;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function buildDeliveryClosingMessage(courseTitle: string, lectureCount: number): string {
  return `✅ ${courseTitle} delivered — ${lectureCount} items.\n\n` +
    `⏳ For security, these files auto-remove from this chat in ${AUTO_DELETE_HOURS} hours. Forwarding, saving, and downloading are disabled the whole time, so just revisit them here whenever you want to watch.\n\n` +
    `📚 Want it again after they're gone? Open @${BOT2_USERNAME} anytime and tap this course for a fresh copy.\n\n` +
    `Happy learning! 🚀`;
}

function extractCourseTitleFromCaption(caption: string, courseNum: number): string {
  if (!caption) return `Course #${courseNum}`;

  const lines = caption
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  for (const line of lines) {
    if (/^[➗\-=_\*#~\.:\s]+$/.test(line)) continue;
    if (/^(dm|contact|explore|check|http|t\.me|@)/i.test(line)) continue;

    let clean = line.replace(/^#\s*\d+\s*[-:.]*\s*/i, '').trim();
    clean = clean.replace(/^[⭐️★✨🔹🔸▫️▪️\d.\-:) (\s]+/u, '').trim();
    clean = clean.replace(/[➗\-=_\s]+$/g, '').trim();

    if (clean.length >= 3) {
      return clean;
    }
  }

  return `Course #${courseNum}`;
}

async function getTelegramPhotoUrl(token: string, photoArray: any[], courseNum: number): Promise<string | null> {
  try {
    if (!photoArray || photoArray.length === 0) return null;

    const photoObj = photoArray[photoArray.length - 1];
    if (!photoObj || !photoObj.file_id) return null;

    const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${photoObj.file_id}`);
    const fileData = await fileRes.json();

    if (!fileData.ok || !fileData.result?.file_path) return null;

    const filePath = fileData.result.file_path;
    const directTgUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;

    const imgRes = await fetch(directTgUrl);
    if (!imgRes.ok) return null;

    const imgBuffer = await imgRes.arrayBuffer();
    const fileName = `course_${courseNum}_${Date.now()}.jpg`;

    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from('course-thumbnails')
      .upload(fileName, imgBuffer, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (!uploadErr && uploadData) {
      const { data: urlData } = supabase.storage.from('course-thumbnails').getPublicUrl(fileName);
      if (urlData?.publicUrl) return urlData.publicUrl;
    }

    return null;
  } catch (err) {
    console.error('[bot3-delivery] getTelegramPhotoUrl error:', err);
    return null;
  }
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

async function copyTelegramMessagesBatch(token: string, toChatId: number | string, fromChatId: number | string, messageIds: number[]) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/copyMessages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: toChatId,
        from_chat_id: fromChatId,
        message_ids: messageIds,
        protect_content: true
      })
    });
    const data = await res.json();
    if (data.ok && Array.isArray(data.result)) {
      return data.result.map((item: any) => item.message_id);
    }
    console.warn('copyMessages batch fallback:', data);
    return [];
  } catch (err) {
    console.error('copyTelegramMessagesBatch error:', err);
    return [];
  }
}

async function copyTelegramMessageSingle(token: string, toChatId: number | string, fromChatId: number | string, messageId: number | string) {
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

    // 1. Channel Posts (Ingestion & Auto-Course / Thumbnail Sync)
    if (update.channel_post || update.edited_channel_post) {
      const post = update.channel_post || update.edited_channel_post;

      try {
        const caption = (post.caption || post.text || '').trim();
        const headerMatch = caption.match(/#\s*(\d+)/);

        if (headerMatch) {
          const courseNum = parseInt(headerMatch[1], 10);
          const cleanTitle = extractCourseTitleFromCaption(caption, courseNum);

          let { data: course } = await supabase
            .from('courses')
            .select('id, title, course_number, thumbnail_url')
            .eq('course_number', courseNum)
            .eq('is_deleted', false)
            .maybeSingle();

          let uploadedThumbnailUrl: string | null = null;
          if (post.photo) {
            uploadedThumbnailUrl = await getTelegramPhotoUrl(BOT3_TELEGRAM_TOKEN, post.photo, courseNum);
          }

          if (!course) {
            // Auto-create course if it does not exist yet
            const { data: createdCourse, error: createErr } = await supabase
              .from('courses')
              .insert({
                course_number: courseNum,
                title: cleanTitle || `Course #${courseNum}`,
                thumbnail_url: uploadedThumbnailUrl || null,
                price: 499,
                original_price: 1999,
                is_published: true,
                is_deleted: false,
                total_lectures: 0,
                total_materials: 0,
                duration_hours: 0,
                level: 'All Levels',
                language: 'Hindi / English',
                created_at: new Date().toISOString()
              })
              .select('id, title, course_number, thumbnail_url')
              .single();

            if (createdCourse) {
              course = createdCourse;
              console.log(`[bot3-delivery] Auto-created course #${courseNum}: "${cleanTitle}"`);
            } else {
              console.error(`[bot3-delivery] Error creating course #${courseNum}:`, createErr);
            }
          } else {
            // Update existing course thumbnail & title
            const updateFields: any = {};
            if (uploadedThumbnailUrl) updateFields.thumbnail_url = uploadedThumbnailUrl;
            if (cleanTitle && (!course.title || course.title.startsWith('Course #'))) {
              updateFields.title = cleanTitle;
            }
            if (Object.keys(updateFields).length > 0) {
              await supabase.from('courses').update(updateFields).eq('id', course.id);
            }
          }

          if (course) {
            // Re-upload support: Clean old video logs and reset stats so only the new batch is counted!
            await supabase
              .from('course_video_log')
              .delete()
              .eq('course_id', course.id);

            await supabase
              .from('courses')
              .update({ total_lectures: 0, total_materials: 0, duration_hours: 0 })
              .eq('id', course.id);

            await supabase
              .from('telegram_ingestion_state')
              .upsert({
                id: 1,
                current_course_id: course.id,
                current_course_number: courseNum,
                updated_at: new Date().toISOString()
              }, { onConflict: 'id' });

            const hasMedia = !!(post.photo || post.video || post.document);
            if (hasMedia) {
              const channelId = post.chat?.id ? post.chat.id.toString() : STORAGE_CHANNEL_ID;
              const messageId = post.message_id.toString();
              const { fileType, duration } = detectFileType(post);

              await supabase
                .from('course_video_log')
                .upsert({
                  course_id: course.id,
                  channel_id: channelId,
                  telegram_message_id: messageId,
                  duration_seconds: duration,
                  file_type: post.photo ? 'photo' : fileType,
                  posted_at: new Date(post.date * 1000).toISOString()
                }, { onConflict: 'channel_id, telegram_message_id' });
            }
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

                const total_lectures = videoItems.length > 0 ? videoItems.length : (allItems.filter(i => i.file_type !== 'sticker').length || 1);
                const total_materials = videoItems.length > 0 ? materialItems.length : 0;

                const totalDurationSecs = allItems.reduce((sum, v) => sum + (v.duration_seconds || 0), 0);
                const duration_hours = Math.round((totalDurationSecs / 3600) * 10) / 10;

                await supabase
                  .from('courses')
                  .update({ total_lectures, total_materials, duration_hours })
                  .eq('id', courseId);
              }
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

        // If user typed raw /start or invalid token
        if (!token || !UUID_REGEX.test(token)) {
          await sendTelegramMessage(
            BOT3_TELEGRAM_TOKEN,
            chatId,
            `👋 **Welcome to CourseVerse Delivery Bot!**\n\n📚 To view and receive your purchased courses, please open @${BOT2_USERNAME} and tap on any course.`,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '📚 Open My Courses', url: `https://t.me/${BOT2_USERNAME}` }]
                ]
              }
            }
          );
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

        if (tokenData.status === 'delivered') {
          await sendTelegramMessage(
            BOT3_TELEGRAM_TOKEN,
            chatId,
            `✅ **This course batch was already delivered!**\n\n📚 Need a fresh copy? Open @${BOT2_USERNAME} anytime and tap the course again.`,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '📚 Open My Courses', url: `https://t.me/${BOT2_USERNAME}` }]
                ]
              }
            }
          );
          return res.status(200).json({ status: 'ok' });
        }

        if (tokenData.status !== 'issued') {
          await sendTelegramMessage(BOT3_TELEGRAM_TOKEN, chatId, UNIFIED_ERROR_MESSAGE);
          return res.status(200).json({ status: 'ok' });
        }

        const isExpired = new Date() > new Date(tokenData.expires_at);
        if (isExpired) {
          await supabase.from('telegram_delivery_tokens').update({ status: 'expired' }).eq('id', token);
          await sendTelegramMessage(
            BOT3_TELEGRAM_TOKEN,
            chatId,
            `⏳ This delivery link has expired.\n\n📚 Please open @${BOT2_USERNAME} to generate a fresh delivery.`,
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '📚 Open My Courses', url: `https://t.me/${BOT2_USERNAME}` }]
                ]
              }
            }
          );
          return res.status(200).json({ status: 'ok' });
        }

        if (senderTgId && tokenData.telegram_id && String(senderTgId) !== String(tokenData.telegram_id)) {
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

        // DELIVER CONTENT WITH ACCURATE SEQUENCE SORTING
        const { data: rawLectures } = await supabase
          .from('course_video_log')
          .select('id, channel_id, telegram_message_id, posted_at, file_type')
          .eq('course_id', tokenData.course_id);

        const lectureList = (rawLectures || []).sort((a: any, b: any) => {
          const idA = Number(a.telegram_message_id) || 0;
          const idB = Number(b.telegram_message_id) || 0;
          return idA - idB;
        });

        if (lectureList.length === 0) {
          await sendTelegramMessage(
            BOT3_TELEGRAM_TOKEN,
            chatId,
            `⚠️ No materials uploaded yet for this course. Please contact support if you need assistance.`
          );
          return res.status(200).json({ status: 'ok' });
        }

        const fromChannel = lectureList[0].channel_id || STORAGE_CHANNEL_ID;
        const msgIds = lectureList.map((l: any) => Number(l.telegram_message_id));

        const deliveredRows: any[] = [];
        const batchSize = 100;
        let deliveredCount = 0;

        for (let i = 0; i < msgIds.length; i += batchSize) {
          const chunk = msgIds.slice(i, i + batchSize);
          const sentIds = await copyTelegramMessagesBatch(
            BOT3_TELEGRAM_TOKEN,
            chatId,
            fromChannel,
            chunk
          );

          if (sentIds && sentIds.length > 0) {
            deliveredCount += sentIds.length;
            sentIds.forEach((sId: number) => {
              deliveredRows.push({
                telegram_chat_id: chatId,
                telegram_message_id: sId,
                course_id: tokenData.course_id,
                sent_at: new Date().toISOString()
              });
            });
          } else {
            const results = await Promise.all(chunk.map((mId: number) => 
              copyTelegramMessageSingle(BOT3_TELEGRAM_TOKEN, chatId, fromChannel, mId)
            ));
            results.forEach((r: any) => {
              if (r && r.ok && r.result) {
                deliveredCount++;
                deliveredRows.push({
                  telegram_chat_id: chatId,
                  telegram_message_id: r.result.message_id,
                  course_id: tokenData.course_id,
                  sent_at: new Date().toISOString()
                });
              }
            });
          }
        }

        if (deliveredRows.length > 0) {
          await supabase.from('telegram_delivered_messages').insert(deliveredRows);
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
    console.error('[bot3-delivery] Fatal Error:', error);
  }

  return res.status(200).json({ status: 'ok' });
}
