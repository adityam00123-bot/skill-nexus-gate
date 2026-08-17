import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://xajntlcmkvucwlgmxufr.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_dLTX4EcpLJ2OmECckH0rzA_1CD3jXl7';
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const BOT4_TELEGRAM_TOKEN = process.env.BOT4_TELEGRAM_TOKEN || '8247628510:AAGgqvD_yXqU_BRPmJ335V8GhWaWFW8770E';
const BOT4_USERNAME = 'CourseVerseUploaderbot';

const DEFAULT_INCOMING_CHANNEL = '-1002811299812';
const DEFAULT_OUTGOING_CHANNEL = process.env.STORAGE_CHANNEL_ID || '-1004345664449';
const DEFAULT_DM_LINK = 'https://t.me/CourseVerseHere';
const DEFAULT_VAULT_LINK = 'https://t.me/+FZIshSGq54FkYzg1';

// Mathematical Bold Serif Unicode Converter
function toMathBold(text: string): string {
  if (!text) return '';
  return text.split('').map(char => {
    const code = char.charCodeAt(0);
    // A-Z: 0x41..0x5A -> 0x1D400..0x1D419
    if (code >= 65 && code <= 90) {
      return String.fromCodePoint(0x1D400 + (code - 65));
    }
    // a-z: 0x61..0x7A -> 0x1D41A..0x1D433
    if (code >= 97 && code <= 122) {
      return String.fromCodePoint(0x1D41A + (code - 97));
    }
    // 0-9: 0x30..0x39 -> 0x1D7CE..0x1D7D7
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

async function getSettings(): Promise<any> {
  try {
    const { data, error } = await supabase
      .from('uploader_bot_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (error || !data) {
      return {
        incoming_channel_id: DEFAULT_INCOMING_CHANNEL,
        outgoing_channel_id: DEFAULT_OUTGOING_CHANNEL,
        dm_link: DEFAULT_DM_LINK,
        vault_link: DEFAULT_VAULT_LINK,
        custom_emoji_star: '⭐️',
        custom_emoji_verified: '✔️',
        custom_emoji_vault: '🎯'
      };
    }
    return data;
  } catch {
    return {
      incoming_channel_id: DEFAULT_INCOMING_CHANNEL,
      outgoing_channel_id: DEFAULT_OUTGOING_CHANNEL,
      dm_link: DEFAULT_DM_LINK,
      vault_link: DEFAULT_VAULT_LINK,
      custom_emoji_star: '⭐️',
      custom_emoji_verified: '✔️',
      custom_emoji_vault: '🎯'
    };
  }
}

async function updateSettings(fields: any) {
  try {
    await supabase
      .from('uploader_bot_settings')
      .upsert({
        id: 1,
        ...fields,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
  } catch (err) {
    console.error('[bot4-uploader] updateSettings error:', err);
  }
}

function buildHeaderCaption(courseNum: number, fullFormatted: string, settings: any): string {
  const star = settings.custom_emoji_star || '⭐️';
  const verified = settings.custom_emoji_verified || '✔️';
  const vault = settings.custom_emoji_vault || '🎯';
  const dmLink = settings.dm_link || DEFAULT_DM_LINK;
  const vaultLink = settings.vault_link || DEFAULT_VAULT_LINK;

  if (settings.header_template) {
    return settings.header_template
      .replace(/{num}/g, String(courseNum))
      .replace(/{title}/g, fullFormatted)
      .replace(/{dm_link}/g, dmLink)
      .replace(/{vault_link}/g, vaultLink)
      .replace(/{star}/g, star)
      .replace(/{verified}/g, verified)
      .replace(/{vault}/g, vault);
  }

  return `#${courseNum}\n` +
    `${star} ${courseNum}. ${fullFormatted}\n` +
    `➗➗➗➗➗➗➗➗➗➗➗➗➗➗\n` +
    `Dm <a href="${dmLink}">●─<b>𝐂𝐨𝐮𝐫𝐬𝐞𝐕𝐞𝐫𝐬𝐞™</b> &lt;/&gt;</a> ${verified} For more\n` +
    `➗➗➗➗➗➗➗➗➗➗➗➗➗➗\n` +
    `${vault} Explore Our Course Vault – <a href="${vaultLink}">Check it Out</a>`;
}

function buildVideoCaption(index: number, shortBold: string, settings: any): string {
  const star = settings.custom_emoji_star || '⭐️';
  const verified = settings.custom_emoji_verified || '✔️';
  const vault = settings.custom_emoji_vault || '🎯';
  const dmLink = settings.dm_link || DEFAULT_DM_LINK;
  const vaultLink = settings.vault_link || DEFAULT_VAULT_LINK;

  if (settings.video_template) {
    return settings.video_template
      .replace(/{index}/g, String(index))
      .replace(/{short_bold}/g, shortBold)
      .replace(/{part_label}/g, `Part ${index}`)
      .replace(/{dm_link}/g, dmLink)
      .replace(/{vault_link}/g, vaultLink)
      .replace(/{star}/g, star)
      .replace(/{verified}/g, verified)
      .replace(/{vault}/g, vault);
  }

  return `${star} ${index}. ${shortBold} – Part ${index}\n` +
    `➗➗➗➗➗➗➗➗➗➗➗➗➗➗\n` +
    `Dm <a href="${dmLink}">●─<b>𝐂𝐨𝐮𝐫𝐬𝐞𝐕𝐞𝐫𝐬𝐞™</b> &lt;/&gt;</a> ${verified} For more\n` +
    `➗➗➗➗➗➗➗➗➗➗➗➗➗➗\n` +
    `${vault} Explore Our Course Vault – <a href="${vaultLink}">Check it Out</a>`;
}

function buildMaterialCaption(index: number, shortBold: string, isPdf: boolean, settings: any): string {
  const emoji = isPdf ? '📄' : '📦';
  const label = isPdf ? `PDF ${index}` : `Material ${index}`;
  const verified = settings.custom_emoji_verified || '✔️';
  const vault = settings.custom_emoji_vault || '🎯';
  const dmLink = settings.dm_link || DEFAULT_DM_LINK;
  const vaultLink = settings.vault_link || DEFAULT_VAULT_LINK;

  return `${emoji} ${index}. ${shortBold} – ${label}\n` +
    `➗➗➗➗➗➗➗➗➗➗➗➗➗➗\n` +
    `Dm <a href="${dmLink}">●─<b>𝐂𝐨𝐮𝐫𝐬𝐞𝐕𝐞𝐫𝐬𝐞™</b> &lt;/&gt;</a> ${verified} For more\n` +
    `➗➗➗➗➗➗➗➗➗➗➗➗➗➗\n` +
    `${vault} Explore Our Course Vault – <a href="${vaultLink}">Check it Out</a>`;
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

function getDashboardMessage(settings: any) {
  const star = settings.custom_emoji_star || '⭐️';
  const verified = settings.custom_emoji_verified || '✔️';
  const vault = settings.custom_emoji_vault || '🎯';

  return {
    text: `⚙️ <b>CourseVerse Uploader Control Panel</b>\n\n` +
      `📥 <b>Incoming Channel:</b> <code>${settings.incoming_channel_id || DEFAULT_INCOMING_CHANNEL}</code>\n` +
      `📤 <b>Outgoing Storage Channel:</b> <code>${settings.outgoing_channel_id || DEFAULT_OUTGOING_CHANNEL}</code>\n\n` +
      `🔗 <b>DM Link:</b> <code>${settings.dm_link || DEFAULT_DM_LINK}</code>\n` +
      `🎯 <b>Vault Link:</b> <code>${settings.vault_link || DEFAULT_VAULT_LINK}</code>\n` +
      `👑 <b>Active Emojis:</b> ${star} ${verified} ${vault}\n\n` +
      `🛡️ <i>DM messages are safe and will never post to storage automatically. Uploading happens only via your Incoming Channel.</i>`,
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📥 Set Incoming Channel', callback_data: 'cb_set_incoming' },
          { text: '📤 Set Outgoing Channel', callback_data: 'cb_set_outgoing' }
        ],
        [
          { text: '🖼️ Set Header Caption', callback_data: 'cb_set_header_tpl' },
          { text: '🎬 Set Video Caption', callback_data: 'cb_set_video_tpl' }
        ],
        [
          { text: '👑 Capture Premium Emojis', callback_data: 'cb_capture_emojis' },
          { text: '🔗 Set Links (DM/Vault)', callback_data: 'cb_set_links' }
        ],
        [
          { text: '🔄 Reset to Factory Default', callback_data: 'cb_reset_default' }
        ],
        [
          { text: '📢 Add Bot to Channel', url: `https://t.me/${BOT4_USERNAME}?startchannel=true&admin=post_messages+edit_messages+delete_messages` },
          { text: '👥 Add Bot to Group', url: `https://t.me/${BOT4_USERNAME}?startgroup=true` }
        ]
      ]
    }
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
      } catch {
        return res.status(200).json({ status: 'ok' });
      }
    }

    if (!update) {
      return res.status(200).json({ status: 'ok' });
    }

    const settings = await getSettings();

    // AUTO-CAPTURE CUSTOM EMOJIS FROM ANY INCOMING MESSAGE
    const rawMsg = update.message || update.channel_post || update.edited_channel_post;
    if (rawMsg) {
      const entities = rawMsg.caption_entities || rawMsg.entities || [];
      const customEmojiEntities = entities.filter((e: any) => e.type === 'custom_emoji' && e.custom_emoji_id);

      if (customEmojiEntities.length > 0) {
        const emojiUpdates: any = {};
        if (customEmojiEntities[0]) emojiUpdates.custom_emoji_star = `<tg-emoji emoji-id="${customEmojiEntities[0].custom_emoji_id}">⭐️</tg-emoji>`;
        if (customEmojiEntities[1]) emojiUpdates.custom_emoji_verified = `<tg-emoji emoji-id="${customEmojiEntities[1].custom_emoji_id}">✔️</tg-emoji>`;
        if (customEmojiEntities[2]) emojiUpdates.custom_emoji_vault = `<tg-emoji emoji-id="${customEmojiEntities[2].custom_emoji_id}">🎯</tg-emoji>`;

        if (Object.keys(emojiUpdates).length > 0) {
          await updateSettings(emojiUpdates);
          Object.assign(settings, emojiUpdates);
        }
      }
    }

    const incomingChannel = String(settings.incoming_channel_id || DEFAULT_INCOMING_CHANNEL);
    const outgoingChannel = String(settings.outgoing_channel_id || DEFAULT_OUTGOING_CHANNEL);

    // ==========================================
    // 1. INLINE KEYBOARD CALLBACKS (DM Dashboard)
    // ==========================================
    if (update.callback_query) {
      const cb = update.callback_query;
      const data = cb.data;
      const chatId = cb.message?.chat?.id;
      const messageId = cb.message?.message_id;

      // Immediate ack (< 30ms) for 0-lag UX
      await callTelegramApi('answerCallbackQuery', { callback_query_id: cb.id });

      if (data === 'cb_dashboard') {
        const dash = getDashboardMessage(settings);
        await callTelegramApi('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: dash.text,
          parse_mode: 'HTML',
          reply_markup: dash.reply_markup
        });
        await updateSettings({ awaiting_input: null });
        return res.status(200).json({ status: 'ok' });
      }

      if (data === 'cb_set_incoming') {
        await updateSettings({ awaiting_input: 'incoming_channel' });
        await callTelegramApi('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: `📥 <b>Set Incoming Channel</b>\n\n` +
            `Current: <code>${incomingChannel}</code>\n\n` +
            `👉 <b>Send the Channel ID</b> (e.g. <code>-1002811299812</code>) or forward any post from your upload channel into this chat.`,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: '⬅️ Back to Menu', callback_data: 'cb_dashboard' }]]
          }
        });
        return res.status(200).json({ status: 'ok' });
      }

      if (data === 'cb_set_outgoing') {
        await updateSettings({ awaiting_input: 'outgoing_channel' });
        await callTelegramApi('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: `📤 <b>Set Outgoing (Storage) Channel</b>\n\n` +
            `Current: <code>${outgoingChannel}</code>\n\n` +
            `👉 <b>Send the Storage Channel ID</b> (e.g. <code>-1004345664449</code>) or forward a post from that channel.`,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: '⬅️ Back to Menu', callback_data: 'cb_dashboard' }]]
          }
        });
        return res.status(200).json({ status: 'ok' });
      }

      if (data === 'cb_set_header_tpl') {
        await updateSettings({ awaiting_input: 'header_template' });
        await callTelegramApi('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: `🖼️ <b>Custom Header/Thumbnail Template</b>\n\n` +
            `<b>Available Placeholders:</b>\n` +
            `• <code>{num}</code> - Course Number\n` +
            `• <code>{title}</code> - Stylized Course Title\n` +
            `• <code>{dm_link}</code> - Dm link URL\n` +
            `• <code>{vault_link}</code> - Vault link URL\n` +
            `• <code>{star}</code> - Star icon / emoji\n\n` +
            `👉 <b>Send your new caption template text now:</b>`,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: '⬅️ Back to Menu', callback_data: 'cb_dashboard' }]]
          }
        });
        return res.status(200).json({ status: 'ok' });
      }

      if (data === 'cb_set_video_tpl') {
        await updateSettings({ awaiting_input: 'video_template' });
        await callTelegramApi('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: `🎬 <b>Custom Video/Lecture Template</b>\n\n` +
            `<b>Available Placeholders:</b>\n` +
            `• <code>{index}</code> - Lecture Number (1, 2, 3...)\n` +
            `• <code>{short_bold}</code> - Mathematical Bold Course Name\n` +
            `• <code>{part_label}</code> - Part 1, Part 2...\n` +
            `• <code>{dm_link}</code> - Dm link URL\n` +
            `• <code>{vault_link}</code> - Vault link URL\n\n` +
            `👉 <b>Send your new caption template text now:</b>`,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: '⬅️ Back to Menu', callback_data: 'cb_dashboard' }]]
          }
        });
        return res.status(200).json({ status: 'ok' });
      }

      if (data === 'cb_capture_emojis') {
        await updateSettings({ awaiting_input: 'custom_emojis' });
        await callTelegramApi('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: `👑 <b>Capture Premium Animated Emojis</b>\n\n` +
            `👉 <b>Send any message containing your Telegram Premium custom animated emojis</b> (e.g. your Star ⭐️, Verified badge ✔️, or Target icon 🎯).\n\n` +
            `The bot will automatically capture their <code>custom_emoji_id</code>s and activate them!`,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: '⬅️ Back to Menu', callback_data: 'cb_dashboard' }]]
          }
        });
        return res.status(200).json({ status: 'ok' });
      }

      if (data === 'cb_set_links') {
        await updateSettings({ awaiting_input: 'links' });
        await callTelegramApi('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: `🔗 <b>Set DM & Vault Links</b>\n\n` +
            `Current DM Link: <code>${settings.dm_link || DEFAULT_DM_LINK}</code>\n` +
            `Current Vault Link: <code>${settings.vault_link || DEFAULT_VAULT_LINK}</code>\n\n` +
            `👉 <b>Send in this format:</b>\n<code>dm=https://t.me/YourDmLink\nvault=https://t.me/YourVaultLink</code>`,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: '⬅️ Back to Menu', callback_data: 'cb_dashboard' }]]
          }
        });
        return res.status(200).json({ status: 'ok' });
      }

      if (data === 'cb_reset_default') {
        await updateSettings({
          incoming_channel_id: DEFAULT_INCOMING_CHANNEL,
          outgoing_channel_id: DEFAULT_OUTGOING_CHANNEL,
          header_template: null,
          video_template: null,
          material_template: null,
          custom_emoji_star: '⭐️',
          custom_emoji_verified: '✔️',
          custom_emoji_vault: '🎯',
          dm_link: DEFAULT_DM_LINK,
          vault_link: DEFAULT_VAULT_LINK,
          awaiting_input: null
        });

        const resetSettings = await getSettings();
        const dash = getDashboardMessage(resetSettings);
        await callTelegramApi('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: `✅ <b>Settings Reset to Factory Default Successfully!</b>\n\n` + dash.text,
          parse_mode: 'HTML',
          reply_markup: dash.reply_markup
        });
        return res.status(200).json({ status: 'ok' });
      }
    }

    // ==========================================
    // 2. DM ADMIN MESSAGES & INPUT PROCESSING
    // ==========================================
    if (update.message && update.message.chat?.type === 'private') {
      const msg = update.message;
      const chatId = msg.chat?.id;
      const text = (msg.text || '').trim();

      // /start or /menu in DM
      if (text.startsWith('/start') || text.startsWith('/menu') || text.startsWith('/settings')) {
        await updateSettings({ awaiting_input: null });
        const dash = getDashboardMessage(settings);
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: dash.text,
          parse_mode: 'HTML',
          reply_markup: dash.reply_markup
        });
        return res.status(200).json({ status: 'ok' });
      }

      // Handle Awaiting Input states
      if (settings.awaiting_input === 'incoming_channel') {
        let newId = text;
        if (msg.forward_from_chat?.id) {
          newId = String(msg.forward_from_chat.id);
        }
        if (!newId.startsWith('-100') && !newId.startsWith('-')) {
          newId = `-100${newId.replace(/^@/, '')}`;
        }

        await updateSettings({ incoming_channel_id: newId, awaiting_input: null });
        const updated = await getSettings();
        const dash = getDashboardMessage(updated);

        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `✅ <b>Incoming Channel Updated to:</b> <code>${newId}</code>\n\n` + dash.text,
          parse_mode: 'HTML',
          reply_markup: dash.reply_markup
        });
        return res.status(200).json({ status: 'ok' });
      }

      if (settings.awaiting_input === 'outgoing_channel') {
        let newId = text;
        if (msg.forward_from_chat?.id) {
          newId = String(msg.forward_from_chat.id);
        }
        if (!newId.startsWith('-100') && !newId.startsWith('-')) {
          newId = `-100${newId.replace(/^@/, '')}`;
        }

        await updateSettings({ outgoing_channel_id: newId, awaiting_input: null });
        const updated = await getSettings();
        const dash = getDashboardMessage(updated);

        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `✅ <b>Outgoing Storage Channel Updated to:</b> <code>${newId}</code>\n\n` + dash.text,
          parse_mode: 'HTML',
          reply_markup: dash.reply_markup
        });
        return res.status(200).json({ status: 'ok' });
      }

      if (settings.awaiting_input === 'custom_emojis') {
        const entities = msg.entities || msg.caption_entities || [];
        const customEntities = entities.filter((e: any) => e.type === 'custom_emoji');

        const updatePayload: any = { awaiting_input: null };
        if (customEntities.length > 0) {
          if (customEntities[0]) updatePayload.custom_emoji_star = `<tg-emoji emoji-id="${customEntities[0].custom_emoji_id}">⭐️</tg-emoji>`;
          if (customEntities[1]) updatePayload.custom_emoji_verified = `<tg-emoji emoji-id="${customEntities[1].custom_emoji_id}">✔️</tg-emoji>`;
          if (customEntities[2]) updatePayload.custom_emoji_vault = `<tg-emoji emoji-id="${customEntities[2].custom_emoji_id}">🎯</tg-emoji>`;
        }

        await updateSettings(updatePayload);
        const updated = await getSettings();
        const dash = getDashboardMessage(updated);

        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `✅ <b>Captured ${customEntities.length} Custom Premium Emojis!</b>\n\n` + dash.text,
          parse_mode: 'HTML',
          reply_markup: dash.reply_markup
        });
        return res.status(200).json({ status: 'ok' });
      }

      if (settings.awaiting_input === 'header_template') {
        await updateSettings({ header_template: text, awaiting_input: null });
        const updated = await getSettings();
        const dash = getDashboardMessage(updated);

        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `✅ <b>Header Caption Template Updated!</b>\n\n` + dash.text,
          parse_mode: 'HTML',
          reply_markup: dash.reply_markup
        });
        return res.status(200).json({ status: 'ok' });
      }

      if (settings.awaiting_input === 'video_template') {
        await updateSettings({ video_template: text, awaiting_input: null });
        const updated = await getSettings();
        const dash = getDashboardMessage(updated);

        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `✅ <b>Video Caption Template Updated!</b>\n\n` + dash.text,
          parse_mode: 'HTML',
          reply_markup: dash.reply_markup
        });
        return res.status(200).json({ status: 'ok' });
      }

      if (settings.awaiting_input === 'links') {
        const dmMatch = text.match(/dm\s*=\s*(https?:\/\/\S+)/i);
        const vaultMatch = text.match(/vault\s*=\s*(https?:\/\/\S+)/i);

        const linkPayload: any = { awaiting_input: null };
        if (dmMatch) linkPayload.dm_link = dmMatch[1].trim();
        if (vaultMatch) linkPayload.vault_link = vaultMatch[1].trim();

        await updateSettings(linkPayload);
        const updated = await getSettings();
        const dash = getDashboardMessage(updated);

        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `✅ <b>Links Updated Successfully!</b>\n\n` + dash.text,
          parse_mode: 'HTML',
          reply_markup: dash.reply_markup
        });
        return res.status(200).json({ status: 'ok' });
      }

      // Default DM safe response
      const dash = getDashboardMessage(settings);
      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: `ℹ️ <i>To upload courses, post in your Incoming Channel:</i> <code>${incomingChannel}</code>\n\n` + dash.text,
        parse_mode: 'HTML',
        reply_markup: dash.reply_markup
      });
      return res.status(200).json({ status: 'ok' });
    }

    // ==========================================
    // 3. INCOMING CHANNEL INGESTION & FORWARDING
    // ==========================================
    const channelPost = update.channel_post || update.edited_channel_post;
    if (!channelPost) {
      return res.status(200).json({ status: 'ok' });
    }

    const postChatId = String(channelPost.chat?.id || '');

    // Allow posts from configured incoming channel OR matching suffix (e.g. 2811299812)
    const isMatchingIncoming =
      postChatId === incomingChannel ||
      incomingChannel.includes(postChatId.replace(/^-100/, '')) ||
      postChatId.includes(incomingChannel.replace(/^-100/, ''));

    // Loop prevention: NEVER process posts coming from the Outgoing Storage Channel!
    if (!isMatchingIncoming || postChatId === outgoingChannel) {
      return res.status(200).json({ status: 'ok' });
    }

    const rawCaption = (channelPost.caption || channelPost.text || '').trim();
    const headerMatch = rawCaption.match(/#\s*(\d+)/);

    // ==========================================
    // 3A. Course Header Detection (#<num>)
    // ==========================================
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
        const lines = rawCaption.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        for (const line of lines) {
          if (!line.startsWith('#') && !line.includes('http') && line.length >= 3) {
            rawTitle = line;
            break;
          }
        }
      }

      if (!rawTitle) rawTitle = `Course #${courseNum}`;

      const { fullFormatted, shortBold } = formatCourseTitle(rawTitle);
      const headerCaption = buildHeaderCaption(courseNum, fullFormatted, settings);

      // Post formatted header to Storage Channel
      if (channelPost.photo && channelPost.photo.length > 0) {
        const photoId = channelPost.photo[channelPost.photo.length - 1].file_id;
        await callTelegramApi('sendPhoto', {
          chat_id: outgoingChannel,
          photo: photoId,
          caption: headerCaption,
          parse_mode: 'HTML'
        });
      } else if (channelPost.video) {
        await callTelegramApi('sendVideo', {
          chat_id: outgoingChannel,
          video: channelPost.video.file_id,
          caption: headerCaption,
          parse_mode: 'HTML'
        });
      } else if (channelPost.document) {
        await callTelegramApi('sendDocument', {
          chat_id: outgoingChannel,
          document: channelPost.document.file_id,
          caption: headerCaption,
          parse_mode: 'HTML'
        });
      } else {
        await callTelegramApi('sendMessage', {
          chat_id: outgoingChannel,
          text: headerCaption,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        });
      }

      // Update active ingestion state in Supabase
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

    // ==========================================
    // 3B. Content Upload (Videos, PDFs, Audios, Links)
    // ==========================================
    const { data: state } = await supabase
      .from('telegram_ingestion_state')
      .select('current_course_id, current_course_number')
      .eq('id', 1)
      .maybeSingle();

    if (!state || !state.current_course_id) {
      return res.status(200).json({ status: 'ok' });
    }

    const { data: activeCourse } = await supabase
      .from('courses')
      .select('id, title, course_number')
      .eq('id', state.current_course_id)
      .maybeSingle();

    const courseTitle = activeCourse?.title || `Course #${state.current_course_number || 1}`;
    const { shortBold } = formatCourseTitle(courseTitle);

    // Count existing items to compute sequential index
    const { data: loggedItems } = await supabase
      .from('course_video_log')
      .select('file_type')
      .eq('course_id', state.current_course_id);

    const videoCount = (loggedItems || []).filter((i: any) => i.file_type === 'video' || i.file_type === 'audio').length;
    const materialCount = (loggedItems || []).filter((i: any) => i.file_type === 'pdf' || i.file_type === 'archive' || i.file_type === 'material').length;

    // Video Upload (Completely STRIP old caption and replace with official template)
    if (channelPost.video) {
      const nextIndex = videoCount + 1;
      const videoCaption = buildVideoCaption(nextIndex, shortBold, settings);

      await callTelegramApi('sendVideo', {
        chat_id: outgoingChannel,
        video: channelPost.video.file_id,
        caption: videoCaption,
        parse_mode: 'HTML',
        supports_streaming: true
      });
      return res.status(200).json({ status: 'ok' });
    }

    // Audio / Voice Upload
    if (channelPost.audio || channelPost.voice) {
      const nextIndex = videoCount + 1;
      const audioId = channelPost.audio ? channelPost.audio.file_id : channelPost.voice.file_id;
      const audioCaption = buildVideoCaption(nextIndex, shortBold, settings);

      await callTelegramApi('sendAudio', {
        chat_id: outgoingChannel,
        audio: audioId,
        caption: audioCaption,
        parse_mode: 'HTML'
      });
      return res.status(200).json({ status: 'ok' });
    }

    // Document / PDF Upload
    if (channelPost.document) {
      const fileName = (channelPost.document.file_name || '').toLowerCase();
      const isPdf = fileName.endsWith('.pdf') || (channelPost.document.mime_type || '').includes('pdf');
      const nextIndex = materialCount + 1;
      const docCaption = buildMaterialCaption(nextIndex, shortBold, isPdf, settings);

      await callTelegramApi('sendDocument', {
        chat_id: outgoingChannel,
        document: channelPost.document.file_id,
        caption: docCaption,
        parse_mode: 'HTML'
      });
      return res.status(200).json({ status: 'ok' });
    }

    // Sticker Upload
    if (channelPost.sticker) {
      await callTelegramApi('sendSticker', {
        chat_id: outgoingChannel,
        sticker: channelPost.sticker.file_id
      });
      return res.status(200).json({ status: 'ok' });
    }

    // Text / Link Upload
    if (channelPost.text) {
      const nextIndex = materialCount + 1;
      const star = settings.custom_emoji_star || '⭐️';
      const dmLink = settings.dm_link || DEFAULT_DM_LINK;
      const vaultLink = settings.vault_link || DEFAULT_VAULT_LINK;
      const verified = settings.custom_emoji_verified || '✔️';
      const vault = settings.custom_emoji_vault || '🎯';

      const textMsg = `🔗 ${nextIndex}. ${shortBold} – Access Resource\n\n` +
        `${channelPost.text}\n\n` +
        `➗➗➗➗➗➗➗➗➗➗➗➗➗➗\n` +
        `Dm <a href="${dmLink}">●─<b>𝐂𝐨𝐮𝐫𝐬𝐞𝐕𝐞𝐫𝐬𝐞™</b> &lt;/&gt;</a> ${verified} For more\n` +
        `➗➗➗➗➗➗➗➗➗➗➗➗➗➗\n` +
        `${vault} Explore Our Course Vault – <a href="${vaultLink}">Check it Out</a>`;

      await callTelegramApi('sendMessage', {
        chat_id: outgoingChannel,
        text: textMsg,
        parse_mode: 'HTML',
        disable_web_page_preview: false
      });
      return res.status(200).json({ status: 'ok' });
    }

  } catch (error: any) {
    console.error('[bot4-uploader] Fatal Handler Error:', error);
  }

  return res.status(200).json({ status: 'ok' });
}
