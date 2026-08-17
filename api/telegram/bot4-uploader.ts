import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://xajntlcmkvucwlgmxufr.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_dLTX4EcpLJ2OmECckH0rzA_1CD3jXl7';
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const BOT4_TELEGRAM_TOKEN = process.env.BOT4_TELEGRAM_TOKEN || '8247628510:AAGgqvD_yXqU_BRPmJ335V8GhWaWFW8770E';
const BOT4_USERNAME = 'CourseVerseUploaderbot';
const STORAGE_CHANNEL_ID = process.env.STORAGE_CHANNEL_ID || '-1004345664449';
const DM_LINK = 'https://t.me/CourseVerseHere';
const VAULT_LINK = 'https://t.me/+FZIshSGq54FkYzg1';

// Mathematical Bold Serif Unicode Converter
function toMathBold(text: string): string {
  if (!text) return '';
  return text.split('').map(char => {
    const code = char.charCodeAt(0);
    // A-Z
    if (code >= 65 && code <= 90) {
      return String.fromCodePoint(0x1D400 + (code - 65));
    }
    // a-z
    if (code >= 97 && code <= 122) {
      return String.fromCodePoint(0x1D41A + (code - 97));
    }
    // 0-9
    if (code >= 48 && code <= 57) {
      return String.fromCodePoint(0x1D7CE + (code - 48));
    }
    return char;
  }).join('');
}

// Split title into Bold Author/Brand and Normal Description
function formatCourseTitle(rawTitle: string): { fullFormatted: string; shortBold: string } {
  if (!rawTitle) return { fullFormatted: 'Course', shortBold: 'Course' };

  let clean = rawTitle.trim();
  clean = clean.replace(/^#\s*\d+\s*[-:.]*\s*/i, '').trim();

  const dashIndex = clean.search(/\s+[-–—:]\s+/);
  if (dashIndex !== -1) {
    const part1 = clean.substring(0, dashIndex).trim();
    const part2 = clean.substring(dashIndex).replace(/^[\s\-–—:]+/, '').trim();
    const boldPart = toMathBold(part1);
    return {
      fullFormatted: `${boldPart} – ${part2}`,
      shortBold: boldPart
    };
  }

  const boldAll = toMathBold(clean);
  return {
    fullFormatted: boldAll,
    shortBold: boldAll
  };
}

function buildFooter(): string {
  return `\n➗➗➗➗➗➗➗➗➗➗➗➗➗➗\n` +
    `Dm <a href="${DM_LINK}">●─<b>𝐂𝐨𝐮𝐫𝐬𝐞𝐕𝐞𝐫𝐬𝐞™</b> &lt;/&gt;</a> ✔️ For more\n` +
    `➗➗➗➗➗➗➗➗➗➗➗➗➗➗\n` +
    `🎯 Explore Our Course Vault – <a href="${VAULT_LINK}">Check it Out</a>`;
}

async function callTelegramApi(method: string, payload: any) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT4_TELEGRAM_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (err) {
    console.error(`[bot4-uploader] ${method} error:`, err);
    return { ok: false, error: err };
  }
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
      } catch {
        return res.status(200).json({ status: 'ok' });
      }
    }

    if (!update || !update.message) {
      return res.status(200).json({ status: 'ok' });
    }

    const msg = update.message;
    const chatId = msg.chat?.id;
    const text = (msg.text || '').trim();
    const caption = (msg.caption || '').trim();
    const contentText = caption || text;

    // 1. /start command
    if (text.startsWith('/start')) {
      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: `🚀 <b>CourseVerse Auto-Uploader & Formatter Bot</b>\n\n` +
          `<b>How it works:</b>\n` +
          `1️⃣ <b>Course Poster:</b> Send a photo with caption <code>#&lt;number&gt;</code> (e.g. <code>#1507</code>).\n` +
          `   • The bot fetches the title from the website DB.\n` +
          `   • Formats it with mathematical bold font & links.\n` +
          `   • Posts the stylized poster directly to the Storage Channel!\n\n` +
          `2️⃣ <b>Lectures & Materials:</b> Send videos, PDFs, audios, or links.\n` +
          `   • The bot auto-numbers them (Part 1, Part 2... / PDF 1).\n` +
          `   • Appends the official CourseVerse footer links.\n` +
          `   • Posts them seamlessly to the Storage Channel!\n\n` +
          `⚠️ <i>Make sure @${BOT4_USERNAME} is added as an Admin in your Storage Channel with Post permissions.</i>`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📢 Add Bot to Channel', url: `https://t.me/${BOT4_USERNAME}?startchannel=true&admin=post_messages+edit_messages+delete_messages` },
              { text: '👥 Add Bot to Group', url: `https://t.me/${BOT4_USERNAME}?startgroup=true` }
            ]
          ]
        }
      });
      return res.status(200).json({ status: 'ok' });
    }

    // 2. Course Header Detection (#<num>)
    const headerMatch = contentText.match(/#\s*(\d+)/);
    if (headerMatch) {
      const courseNum = parseInt(headerMatch[1], 10);

      // Query database for course info
      let { data: course } = await supabase
        .from('courses')
        .select('id, title, course_number, thumbnail_url')
        .eq('course_number', courseNum)
        .eq('is_deleted', false)
        .maybeSingle();

      let rawTitle = course?.title || '';
      if (!rawTitle || rawTitle.startsWith('Course #')) {
        // Fallback: extract title from caption if available
        const lines = contentText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        for (const line of lines) {
          if (!line.startsWith('#') && !line.includes('http') && line.length >= 3) {
            rawTitle = line;
            break;
          }
        }
      }

      if (!rawTitle) rawTitle = `Course #${courseNum}`;

      const { fullFormatted, shortBold } = formatCourseTitle(rawTitle);

      const headerCaption = `#${courseNum}\n` +
        `⭐️ ${courseNum}. ${fullFormatted}\n` +
        buildFooter();

      let postResult: any = null;

      // Post to Storage Channel
      if (msg.photo && msg.photo.length > 0) {
        const photoId = msg.photo[msg.photo.length - 1].file_id;
        postResult = await callTelegramApi('sendPhoto', {
          chat_id: STORAGE_CHANNEL_ID,
          photo: photoId,
          caption: headerCaption,
          parse_mode: 'HTML'
        });
      } else if (msg.video) {
        postResult = await callTelegramApi('sendVideo', {
          chat_id: STORAGE_CHANNEL_ID,
          video: msg.video.file_id,
          caption: headerCaption,
          parse_mode: 'HTML'
        });
      } else if (msg.document) {
        postResult = await callTelegramApi('sendDocument', {
          chat_id: STORAGE_CHANNEL_ID,
          document: msg.document.file_id,
          caption: headerCaption,
          parse_mode: 'HTML'
        });
      } else {
        postResult = await callTelegramApi('sendMessage', {
          chat_id: STORAGE_CHANNEL_ID,
          text: headerCaption,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        });
      }

      // Update state
      if (course) {
        await supabase
          .from('telegram_ingestion_state')
          .upsert({
            id: 1,
            current_course_id: course.id,
            current_course_number: courseNum,
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });
      }

      if (postResult && postResult.ok) {
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `✅ <b>Course #${courseNum} Header Posted to Storage Channel!</b>\n\n` +
            `📌 <b>Title:</b> ${fullFormatted}\n\n` +
            `👉 <i>Now send lecture videos, PDFs, audios, or links — the bot will automatically format and post them with sequence numbers!</i>`,
          parse_mode: 'HTML'
        });
      } else {
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `⚠️ <b>Could not post to Storage Channel.</b>\n\n` +
            `Error: <code>${postResult?.description || JSON.stringify(postResult)}</code>\n\n` +
            `<i>Make sure @${BOT4_USERNAME} is an Admin in the channel with "Post Messages" permission.</i>`,
          parse_mode: 'HTML'
        });
      }

      return res.status(200).json({ status: 'ok' });
    }

    // 3. Content Upload (Videos, PDFs, Audios, Links, Stickers)
    // Fetch active course context
    const { data: state } = await supabase
      .from('telegram_ingestion_state')
      .select('current_course_id, current_course_number')
      .eq('id', 1)
      .maybeSingle();

    if (!state || !state.current_course_id) {
      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: `⚠️ <b>No Active Course Selected!</b>\n\nPlease first send a photo with <code>#&lt;course_number&gt;</code> (e.g. <code>#1507</code>) to start uploading a course.`,
        parse_mode: 'HTML'
      });
      return res.status(200).json({ status: 'ok' });
    }

    const { data: activeCourse } = await supabase
      .from('courses')
      .select('id, title, course_number')
      .eq('id', state.current_course_id)
      .maybeSingle();

    const rawTitle = activeCourse?.title || `Course #${state.current_course_number || 1}`;
    const { shortBold } = formatCourseTitle(rawTitle);

    // Count existing videos/materials to determine next sequence index
    const { data: loggedItems } = await supabase
      .from('course_video_log')
      .select('file_type')
      .eq('course_id', state.current_course_id);

    const videoCount = (loggedItems || []).filter((i: any) => i.file_type === 'video' || i.file_type === 'audio').length;
    const materialCount = (loggedItems || []).filter((i: any) => i.file_type === 'pdf' || i.file_type === 'archive' || i.file_type === 'material').length;

    // A. Video Upload
    if (msg.video) {
      const nextIndex = videoCount + 1;
      const videoCaption = `⭐️ ${nextIndex}. ${shortBold} – Part ${nextIndex}\n` + buildFooter();

      const result = await callTelegramApi('sendVideo', {
        chat_id: STORAGE_CHANNEL_ID,
        video: msg.video.file_id,
        caption: videoCaption,
        parse_mode: 'HTML',
        supports_streaming: true
      });

      if (result && result.ok) {
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `✅ <b>Posted:</b> ⭐️ ${nextIndex}. ${shortBold} – Part ${nextIndex}`,
          parse_mode: 'HTML'
        });
      }
      return res.status(200).json({ status: 'ok' });
    }

    // B. Audio / Voice Upload
    if (msg.audio || msg.voice) {
      const nextIndex = videoCount + 1;
      const audioId = msg.audio ? msg.audio.file_id : msg.voice.file_id;
      const audioCaption = `⭐️ ${nextIndex}. ${shortBold} – Audio ${nextIndex}\n` + buildFooter();

      const result = await callTelegramApi('sendAudio', {
        chat_id: STORAGE_CHANNEL_ID,
        audio: audioId,
        caption: audioCaption,
        parse_mode: 'HTML'
      });

      if (result && result.ok) {
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `✅ <b>Posted:</b> ⭐️ ${nextIndex}. ${shortBold} – Audio ${nextIndex}`,
          parse_mode: 'HTML'
        });
      }
      return res.status(200).json({ status: 'ok' });
    }

    // C. Document / PDF / Archive Upload
    if (msg.document) {
      const fileName = (msg.document.file_name || '').toLowerCase();
      const isPdf = fileName.endsWith('.pdf') || (msg.document.mime_type || '').includes('pdf');
      const nextIndex = materialCount + 1;

      const docLabel = isPdf ? `PDF ${nextIndex}` : `Material ${nextIndex}`;
      const docEmoji = isPdf ? `📄` : `📦`;
      const docCaption = `${docEmoji} ${nextIndex}. ${shortBold} – ${docLabel}\n` + buildFooter();

      const result = await callTelegramApi('sendDocument', {
        chat_id: STORAGE_CHANNEL_ID,
        document: msg.document.file_id,
        caption: docCaption,
        parse_mode: 'HTML'
      });

      if (result && result.ok) {
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `✅ <b>Posted:</b> ${docEmoji} ${nextIndex}. ${shortBold} – ${docLabel}`,
          parse_mode: 'HTML'
        });
      }
      return res.status(200).json({ status: 'ok' });
    }

    // D. Sticker Upload
    if (msg.sticker) {
      await callTelegramApi('sendSticker', {
        chat_id: STORAGE_CHANNEL_ID,
        sticker: msg.sticker.file_id
      });
      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: `✅ <b>Posted Sticker</b> to Storage Channel!`,
        parse_mode: 'HTML'
      });
      return res.status(200).json({ status: 'ok' });
    }

    // E. Link or Text Note Upload
    if (text) {
      const nextIndex = materialCount + 1;
      const textMessage = `🔗 ${nextIndex}. ${shortBold} – Access Resource\n\n` +
        `${text}\n` +
        buildFooter();

      const result = await callTelegramApi('sendMessage', {
        chat_id: STORAGE_CHANNEL_ID,
        text: textMessage,
        parse_mode: 'HTML',
        disable_web_page_preview: false
      });

      if (result && result.ok) {
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `✅ <b>Posted Link/Resource</b> to Storage Channel!`,
          parse_mode: 'HTML'
        });
      }
      return res.status(200).json({ status: 'ok' });
    }

  } catch (error: any) {
    console.error('[bot4-uploader] Error:', error);
  }

  return res.status(200).json({ status: 'ok' });
}
