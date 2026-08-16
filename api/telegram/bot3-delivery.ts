import {
  supabase,
  BOT3_TELEGRAM_TOKEN,
  STORAGE_CHANNEL_ID,
  UNIFIED_ERROR_MESSAGE,
  buildDeliveryClosingMessage,
  verifyUserLiveAccess,
  sendTelegramMessage,
  copyTelegramMessage
} from './_utils';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Telegram expects a fast 200 response
  try {
    let update = req.body;
    if (typeof update === 'string') {
      try {
        update = JSON.parse(update);
      } catch (e: any) {
        console.error('[bot3-delivery] Failed to parse JSON body:', e.message);
        return res.status(200).json({ status: 'ok' });
      }
    }

    if (!update) {
      return res.status(200).json({ status: 'ok' });
    }

    // =========================================================================
    // PART 2: STORAGE-CHANNEL INGESTION (channel_post / edited_channel_post)
    // =========================================================================
    if (update.channel_post || update.edited_channel_post) {
      const post = update.channel_post || update.edited_channel_post;
      console.log(`[bot3-delivery] Processing channel post ${post.message_id} in channel ${post.chat?.id}`);

      try {
        const caption = (post.caption || post.text || '').trim();
        const headerMatch = caption.match(/^#(\d+)/);

        if (headerMatch) {
          // A) Numbered course header post (e.g. "#1042 Full Stack Course")
          const courseNum = parseInt(headerMatch[1], 10);
          console.log(`[bot3-delivery] Header matched with course_number: ${courseNum}`);

          const { data: course, error: courseErr } = await supabase
            .from('courses')
            .select('id, title, course_number')
            .eq('course_number', courseNum)
            .eq('is_deleted', false)
            .maybeSingle();

          if (courseErr) {
            console.error(`[bot3-delivery] DB error finding course_number ${courseNum}:`, courseErr);
          }

          if (course) {
            console.log(`[bot3-delivery] Course found: ${course.id} (${course.title}). Updating ingestion state.`);
            const { error: stateErr } = await supabase
              .from('telegram_ingestion_state')
              .upsert({
                id: 1,
                current_course_id: course.id,
                current_course_number: courseNum,
                updated_at: new Date().toISOString()
              }, { onConflict: 'id' });

            if (stateErr) {
              console.error('[bot3-delivery] Error updating telegram_ingestion_state:', stateErr);
            }
          } else {
            console.warn(`[bot3-delivery] Course #${courseNum} not found in DB. Logging unmatched upload.`);
            await supabase.from('telegram_unmatched_uploads').insert({
              raw_caption: caption,
              telegram_message_id: post.message_id,
              reason: 'course_number_not_in_db',
              created_at: new Date().toISOString(),
              resolved: false
            });
          }
        } else {
          // B) Lecture file or course content (video, document, sticker, audio, animation, photo, etc.)
          const isContent = !!(post.video || post.document || post.audio || post.animation || post.video_note || post.photo || post.sticker || post.text);

          if (isContent) {
            console.log(`[bot3-delivery] Course content received (type: ${post.sticker ? 'sticker' : post.video ? 'video' : 'media'}). Checking active ingestion state.`);
            const { data: state, error: stateErr } = await supabase
              .from('telegram_ingestion_state')
              .select('current_course_id, current_course_number')
              .eq('id', 1)
              .maybeSingle();

            if (stateErr) {
              console.error('[bot3-delivery] Error reading ingestion state:', stateErr);
            }

            if (state && state.current_course_id) {
              const courseId = state.current_course_id;
              const channelId = post.chat?.id ? post.chat.id.toString() : STORAGE_CHANNEL_ID;
              const messageId = post.message_id.toString();
              const durationSeconds = post.video?.duration || post.audio?.duration || 0;

              console.log(`[bot3-delivery] Linking message ${messageId} to course ${courseId}`);

              const { error: logErr } = await supabase
                .from('course_video_log')
                .upsert({
                  course_id: courseId,
                  channel_id: channelId,
                  telegram_message_id: messageId,
                  duration_seconds: durationSeconds,
                  posted_at: new Date(post.date * 1000).toISOString()
                }, { onConflict: 'channel_id, telegram_message_id' });

              if (logErr) {
                console.error('[bot3-delivery] Error inserting into course_video_log:', logErr);
              } else {
                // Recompute and update course statistics
                const { data: allVideos } = await supabase
                  .from('course_video_log')
                  .select('duration_seconds')
                  .eq('course_id', courseId);

                if (allVideos) {
                  const total_lectures = allVideos.length;
                  const totalDurationSecs = allVideos.reduce((sum, v) => sum + (v.duration_seconds || 0), 0);
                  const duration_hours = Math.round((totalDurationSecs / 3600) * 10) / 10;

                  await supabase
                    .from('courses')
                    .update({ total_lectures, duration_hours })
                    .eq('id', courseId);

                  console.log(`[bot3-delivery] Updated course ${courseId} -> total_lectures: ${total_lectures}, duration_hours: ${duration_hours}`);
                }
              }
            } else {
              console.warn('[bot3-delivery] No active course context in ingestion state. Logging unmatched upload.');
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
      } catch (ingestErr: any) {
        console.error('[bot3-delivery] Uncaught error during ingestion:', ingestErr);
      }

      return res.status(200).json({ status: 'ok' });
    }

    // =========================================================================
    // PART 3: CONTENT DELIVERY (/start <token> in DM)
    // =========================================================================
    if (update.message) {
      const msg = update.message;
      const text = (msg.text || '').trim();
      const chatId = msg.chat?.id;
      const senderTgId = msg.from?.id;

      if (text.startsWith('/start')) {
        const token = text.replace(/^\/start\s*/, '').trim();

        // 1. Look up token in telegram_delivery_tokens
        if (!token) {
          await sendTelegramMessage(BOT3_TELEGRAM_TOKEN, chatId, UNIFIED_ERROR_MESSAGE);
          return res.status(200).json({ status: 'ok' });
        }

        const { data: tokenData, error: tokenErr } = await supabase
          .from('telegram_delivery_tokens')
          .select('id, user_id, telegram_id, course_id, status, expires_at')
          .eq('id', token)
          .maybeSingle();

        if (tokenErr || !tokenData) {
          console.warn(`[bot3-delivery] Token not found: "${token}"`);
          await sendTelegramMessage(BOT3_TELEGRAM_TOKEN, chatId, UNIFIED_ERROR_MESSAGE);
          return res.status(200).json({ status: 'ok' });
        }

        // 2a. Status validation
        if (tokenData.status !== 'issued') {
          console.warn(`[bot3-delivery] Token already processed. Status: ${tokenData.status}`);
          if (tokenData.status === 'issued') {
            await supabase
              .from('telegram_delivery_tokens')
              .update({ status: 'already_used' })
              .eq('id', token);
          }
          await sendTelegramMessage(BOT3_TELEGRAM_TOKEN, chatId, UNIFIED_ERROR_MESSAGE);
          return res.status(200).json({ status: 'ok' });
        }

        // 2b. Expiration validation
        const isExpired = new Date() > new Date(tokenData.expires_at);
        if (isExpired) {
          console.warn(`[bot3-delivery] Token expired at ${tokenData.expires_at}`);
          await supabase
            .from('telegram_delivery_tokens')
            .update({ status: 'expired' })
            .eq('id', token);
          await sendTelegramMessage(BOT3_TELEGRAM_TOKEN, chatId, UNIFIED_ERROR_MESSAGE);
          return res.status(200).json({ status: 'ok' });
        }

        // 2c. Sender Telegram ID mismatch validation
        if (BigInt(senderTgId) !== BigInt(tokenData.telegram_id)) {
          console.warn(`[bot3-delivery] Sender mismatch. Expected ${tokenData.telegram_id}, got ${senderTgId}`);
          await supabase
            .from('telegram_delivery_tokens')
            .update({ status: 'rejected_mismatch' })
            .eq('id', token);
          await sendTelegramMessage(BOT3_TELEGRAM_TOKEN, chatId, UNIFIED_ERROR_MESSAGE);
          return res.status(200).json({ status: 'ok' });
        }

        // 2d. Live re-check in Supabase for valid access
        const accessCheck = await verifyUserLiveAccess(tokenData.user_id, tokenData.course_id);
        if (!accessCheck.hasAccess) {
          console.warn(`[bot3-delivery] Live access check failed for user ${tokenData.user_id}, course ${tokenData.course_id}: ${accessCheck.reason}`);
          await supabase
            .from('telegram_delivery_tokens')
            .update({ status: 'rejected_no_purchase' })
            .eq('id', token);
          await sendTelegramMessage(BOT3_TELEGRAM_TOKEN, chatId, UNIFIED_ERROR_MESSAGE);
          return res.status(200).json({ status: 'ok' });
        }

        // 3. ALL CHECKS PASSED: Fetch and deliver lecture videos
        console.log(`[bot3-delivery] Delivering course ${tokenData.course_id} to chat ${chatId}`);

        const { data: lectures, error: lecErr } = await supabase
          .from('course_video_log')
          .select('id, channel_id, telegram_message_id, posted_at')
          .eq('course_id', tokenData.course_id)
          .order('posted_at', { ascending: true })
          .order('telegram_message_id', { ascending: true });

        if (lecErr) {
          console.error('[bot3-delivery] Error fetching lectures:', lecErr);
        }

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
            const deliveredMsgId = copyRes.result.message_id;

            // Log delivered message for scheduled auto-delete
            await supabase.from('telegram_delivered_messages').insert({
              telegram_chat_id: chatId,
              telegram_message_id: deliveredMsgId,
              course_id: tokenData.course_id,
              sent_at: new Date().toISOString()
            });
          } else {
            console.error(`[bot3-delivery] Failed to copy message ${lec.telegram_message_id}:`, copyRes);
          }
        }

        // Mark token as delivered
        await supabase
          .from('telegram_delivery_tokens')
          .update({
            status: 'delivered',
            consumed_at: new Date().toISOString()
          })
          .eq('id', token);

        // Send required closing message
        const closingMsg = buildDeliveryClosingMessage(
          accessCheck.courseTitle || 'Course',
          deliveredCount
        );
        await sendTelegramMessage(BOT3_TELEGRAM_TOKEN, chatId, closingMsg);

        console.log(`[bot3-delivery] Successfully delivered ${deliveredCount} lectures to chat ${chatId}`);
        return res.status(200).json({ status: 'ok' });
      }
    }
  } catch (error: any) {
    console.error(`[bot3-delivery] Webhook handler error: ${error?.message || 'Unknown'}`, error?.stack);
  }

  return res.status(200).json({ status: 'ok' });
}
