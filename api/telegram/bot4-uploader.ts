import { createClient } from '@supabase/supabase-js';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram/tl/index.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://xajntlcmkvucwlgmxufr.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_dLTX4EcpLJ2OmECckH0rzA_1CD3jXl7';
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const BOT4_TELEGRAM_TOKEN = process.env.BOT4_TELEGRAM_TOKEN || '8247628510:AAGgqvD_yXqU_BRPmJ335V8GhWaWFW8770E';
const BOT4_USERNAME = 'CourseVerseUploaderbot';

const API_ID = 32974135;
const API_HASH = 'ca1558b1b02b76e2875cb03ed9f5311e';
const DEFAULT_SESSION_STRING = '1BVtsOKUBu51U/A3CXlulezoTmtuxaz6KO/LIAv8hAT7FzfwVK1D+ozY+7sGw4sZmstaWsVcKw5RZRs3jurdOA/PD3k0M+BOnJdcE2676QDnmO0nTfQ5eYtIkS7+ZwwAgy7PMYTcX+Yyf6xrEw2btTs7ZHjzTt01ytlDcinKhsO/G0ftzjTdkz6aAPeX/oxM2fMDNyy/BOcaADkRmqo5C3wdu47JA0iKRV+QbeNrhFf3z0qaM4SfNypIqikIM7avoQ6hBpvb0BNPv3yg0/A/T+MAJ32qkJKgYashpigSBkm0lqlr7tWtODL6baQjJNDppygxMeUnerhTvCs8CFHfTn5cP9V9rewY=';
const SESSION_STRING = process.env.TELEGRAM_STRING_SESSION || DEFAULT_SESSION_STRING;

const DEFAULT_INCOMING_CHANNEL = '-1002811299812';
const DEFAULT_OUTGOING_CHANNEL = process.env.STORAGE_CHANNEL_ID || '-1004345664449';
const DEFAULT_DM_LINK = 'https://t.me/CourseVerseHere';
const DEFAULT_VAULT_LINK = 'https://t.me/+FZIshSGq54FkYzg1';

// Custom Emoji Document IDs (BigInt)
const EMOJI_STAR = BigInt('6298821774423361023');
const EMOJI_DIVIDER = BigInt('5323536337607861508');
const EMOJI_VERIFIED = BigInt('6219532735359223977');
const EMOJI_VAULT = BigInt('6296577138615125756');

function utf16Len(s: string): number {
  let len = 0;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    len += code > 0xffff ? 2 : 1;
  }
  return len;
}

function buildCaptionWithEntities(headerLine: string, titleLine: string, dmLink: string, vaultLink: string) {
  const line1 = headerLine ? `${headerLine}\n` : '';
  const star = '⭐️';
  const line2_title = `${titleLine}\n`;
  const divChar = '➗';
  const line3 = divChar.repeat(14) + '\n';
  const dmPrefix = 'Dm ';
  const dmLinkText = '●─CourseVerse™ </>';
  const verified = '✔️';
  const dmSuffix = ' For more\n';
  const line5 = divChar.repeat(14) + '\n';
  const vaultIcon = '✅';
  const vaultPrefix = ' Explore Our Course Valut – ';
  const vaultLinkText = 'Check it Out';

  const fullText = line1 + star + line2_title + line3 + dmPrefix + dmLinkText + verified + dmSuffix + line5 + vaultIcon + vaultPrefix + vaultLinkText;

  const entities: any[] = [];
  let offset = utf16Len(line1);

  // 1. Star custom emoji
  entities.push(new Api.MessageEntityCustomEmoji({
    offset,
    length: utf16Len(star),
    documentId: EMOJI_STAR
  }));
  offset += utf16Len(star);

  // 2. Bold title
  entities.push(new Api.MessageEntityBold({
    offset,
    length: utf16Len(line2_title.trimEnd())
  }));
  offset += utf16Len(line2_title);

  // 3. Dividers line 1 (14 items)
  for (let i = 0; i < 14; i++) {
    entities.push(new Api.MessageEntityCustomEmoji({
      offset,
      length: utf16Len(divChar),
      documentId: EMOJI_DIVIDER
    }));
    offset += utf16Len(divChar);
  }
  offset += utf16Len('\n');

  // 4. DM Prefix
  offset += utf16Len(dmPrefix);

  // 5. DM Link
  entities.push(new Api.MessageEntityTextUrl({
    offset,
    length: utf16Len(dmLinkText),
    url: dmLink
  }));
  offset += utf16Len(dmLinkText);

  // 6. Verified badge
  entities.push(new Api.MessageEntityCustomEmoji({
    offset,
    length: utf16Len(verified),
    documentId: EMOJI_VERIFIED
  }));
  offset += utf16Len(verified) + utf16Len(dmSuffix);

  // 7. Dividers line 2 (14 items)
  for (let i = 0; i < 14; i++) {
    entities.push(new Api.MessageEntityCustomEmoji({
      offset,
      length: utf16Len(divChar),
      documentId: EMOJI_DIVIDER
    }));
    offset += utf16Len(divChar);
  }
  offset += utf16Len('\n');

  // 8. Vault Icon
  entities.push(new Api.MessageEntityCustomEmoji({
    offset,
    length: utf16Len(vaultIcon),
    documentId: EMOJI_VAULT
  }));
  offset += utf16Len(vaultIcon) + utf16Len(vaultPrefix);

  // 9. Vault Link + Bold
  entities.push(new Api.MessageEntityTextUrl({
    offset,
    length: utf16Len(vaultLinkText),
    url: vaultLink
  }));
  entities.push(new Api.MessageEntityBold({
    offset,
    length: utf16Len(vaultLinkText)
  }));

  return { fullText, entities };
}

async function sendViaGramJS(targetChatId: number | string, sourceChatId: number | string, messageId: number, captionText: string, entities: any[]) {
  const stringSession = new StringSession(SESSION_STRING);
  const client = new TelegramClient(stringSession, API_ID, API_HASH, {
    connectionRetries: 3,
    useWSS: false
  });

  await client.connect();

  try {
    const messages = await client.getMessages(sourceChatId, { ids: [messageId] });
    const msg = messages[0];

    if (msg && msg.media) {
      const result = await client.sendFile(targetChatId, {
        file: msg.media,
        caption: captionText,
        formattingEntities: entities
      });
      return result;
    } else {
      const result = await client.sendMessage(targetChatId, {
        message: captionText,
        formattingEntities: entities
      });
      return result;
    }
  } finally {
    await client.disconnect();
  }
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

    if (!update) {
      return res.status(200).json({ status: 'ok' });
    }

    const incomingChannel = DEFAULT_INCOMING_CHANNEL;
    const outgoingChannel = DEFAULT_OUTGOING_CHANNEL;

    // ==========================================
    // 1. INCOMING CHANNEL INGESTION & FORWARDING
    // ==========================================
    const channelPost = update.channel_post || update.edited_channel_post;
    if (channelPost) {
      const postChatId = String(channelPost.chat?.id || '');

      const isMatchingIncoming =
        postChatId === incomingChannel ||
        incomingChannel.includes(postChatId.replace(/^-100/, '')) ||
        postChatId.includes(incomingChannel.replace(/^-100/, ''));

      if (isMatchingIncoming && postChatId !== outgoingChannel) {
        const rawCaption = (channelPost.caption || channelPost.text || '').trim();
        const headerMatch = rawCaption.match(/#\s*(\d+)/);

        // A. Header Post (#<num>)
        if (headerMatch) {
          const courseNum = parseInt(headerMatch[1], 10);

          let { data: course } = await supabase
            .from('courses')
            .select('id, title, course_number')
            .eq('course_number', courseNum)
            .eq('is_deleted', false)
            .maybeSingle();

          let rawTitle = course?.title || '';
          if (!rawTitle || rawTitle.startsWith('Course #')) {
            const lines = rawCaption.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            for (const line of lines) {
              if (!line.startsWith('#') && !line.includes('http') && line.length >= 3) {
                rawTitle = line;
                break;
              }
            }
          }
          if (!rawTitle) rawTitle = `Course #${courseNum}`;

          const cleanTitle = rawTitle.replace(/^#\s*\d+\s*[-:.]*\s*/i, '').trim();

          const { fullText, entities } = buildCaptionWithEntities(
            `#${courseNum}`,
            `${courseNum}. ${cleanTitle}`,
            DEFAULT_DM_LINK,
            DEFAULT_VAULT_LINK
          );

          // Send via GramJS TypeScript with 100% Animated Telegram Premium Emojis
          await sendViaGramJS(
            outgoingChannel,
            channelPost.chat.id,
            channelPost.message_id,
            fullText,
            entities
          );

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

          return res.status(200).json({ status: 'ok' });
        }

        // B. Content Videos / PDFs / Audios
        const { data: state } = await supabase
          .from('telegram_ingestion_state')
          .select('current_course_id, current_course_number')
          .eq('id', 1)
          .maybeSingle();

        if (state && state.current_course_id) {
          const { data: activeCourse } = await supabase
            .from('courses')
            .select('id, title, course_number')
            .eq('id', state.current_course_id)
            .maybeSingle();

          const courseTitle = activeCourse?.title || `Course #${state.current_course_number || 1}`;
          let shortName = courseTitle.replace(/^#\s*\d+\s*[-:.]*\s*/i, '').trim();
          if (shortName.includes(' - ')) shortName = shortName.split(' - ')[0].trim();
          else if (shortName.includes(' – ')) shortName = shortName.split(' – ')[0].trim();

          const { data: loggedItems } = await supabase
            .from('course_video_log')
            .select('file_type')
            .eq('course_id', state.current_course_id);

          const videoCount = (loggedItems || []).filter((i: any) => i.file_type === 'video' || i.file_type === 'audio').length;
          const materialCount = (loggedItems || []).filter((i: any) => i.file_type === 'pdf' || i.file_type === 'archive' || i.file_type === 'material').length;

          if (channelPost.video || channelPost.audio || channelPost.voice) {
            const nextIndex = videoCount + 1;
            const { fullText, entities } = buildCaptionWithEntities(
              '',
              `${nextIndex}. ${shortName} – Part ${nextIndex}`,
              DEFAULT_DM_LINK,
              DEFAULT_VAULT_LINK
            );

            await sendViaGramJS(
              outgoingChannel,
              channelPost.chat.id,
              channelPost.message_id,
              fullText,
              entities
            );
            return res.status(200).json({ status: 'ok' });
          }

          if (channelPost.document) {
            const fileName = (channelPost.document.file_name || '').toLowerCase();
            const isPdf = fileName.endsWith('.pdf') || (channelPost.document.mime_type || '').includes('pdf');
            const nextIndex = materialCount + 1;
            const docLabel = isPdf ? `PDF ${nextIndex}` : `Material ${nextIndex}`;

            const { fullText, entities } = buildCaptionWithEntities(
              '',
              `${nextIndex}. ${shortName} – ${docLabel}`,
              DEFAULT_DM_LINK,
              DEFAULT_VAULT_LINK
            );

            await sendViaGramJS(
              outgoingChannel,
              channelPost.chat.id,
              channelPost.message_id,
              fullText,
              entities
            );
            return res.status(200).json({ status: 'ok' });
          }
        }
      }
    }

  } catch (error: any) {
    console.error('[bot4-uploader] Fatal Handler Error:', error);
  }

  return res.status(200).json({ status: 'ok' });
}
