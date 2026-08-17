"""
CourseVerse Telegram Premium UserBot Auto-Uploader & Formatter Service
Runs locally in background using @CourseVerseHere Telegram Premium MTProto Session.
Preserves 100% of Animated Telegram Premium Custom Emojis and Mathematical Bold Fonts.
"""

import asyncio
import json
import logging
import os
import re
import sys
import urllib.request
import urllib.parse
from pyrogram import Client, filters, enums, types

# Setup Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("CourseVerseUploader")

# Configuration
API_ID = 32974135
API_HASH = "ca1558b1b02b76e2875cb03ed9f5311e"
SESSION_PATH = "C:/Users/adity/Documents/antigravity/noble-meitner/userbot"

INCOMING_CHANNEL_ID = -1002811299812
STORAGE_CHANNEL_ID = -1004345664449

SUPABASE_URL = "https://xajntlcmkvucwlgmxufr.supabase.co"
SUPABASE_KEY = "sb_publishable_dLTX4EcpLJ2OmECckH0rzA_1CD3jXl7"

# Exact Telegram Premium Animated Custom Emoji IDs
EMOJI_STAR = 6298821774423361023      # Glowing Purple Star / Candle
EMOJI_DIVIDER = 5323536337607861508   # Glowing Yellow Decorative Divider
EMOJI_VERIFIED = 6219532735359223977  # Golden Shield Verified Badge
EMOJI_VAULT = 6296577138615125756     # Animated Target Vault Icon

DM_LINK = "https://t.me/CourseVerseHere"
VAULT_LINK = "https://t.me/+FZIshSGq54FkYzg1"

app = Client(SESSION_PATH, api_id=API_ID, api_hash=API_HASH)

def utf16_len(s: str) -> int:
    return len(s.encode('utf-16-le')) // 2

def supabase_get(endpoint: str, params: dict = None):
    try:
        url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
        if params:
            url += "?" + urllib.parse.urlencode(params)
        req = urllib.request.Request(url, headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}"
        })
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        logger.error(f"Supabase GET error ({endpoint}): {e}")
        return None

def supabase_post(endpoint: str, data: dict):
    try:
        url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
        req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates"
        })
        with urllib.request.urlopen(req, timeout=10) as resp:
            return True
    except Exception as e:
        logger.error(f"Supabase POST error ({endpoint}): {e}")
        return False

def build_caption_with_exact_entities(header_line: str, title_line: str):
    line1 = f"{header_line}\n" if header_line else ""
    star = "⭐️"
    line2_title = f"{title_line}\n"
    divider_char = "➗"
    divider_14 = divider_char * 14
    line3 = f"{divider_14}\n"
    dm_prefix = "Dm "
    dm_link_text = "●─CourseVerse™ </>"
    verified = "✔️"
    dm_suffix = " For more\n"
    line5 = f"{divider_14}\n"
    vault_icon = "✅"
    vault_prefix = " Explore Our Course Valut – "
    vault_link_text = "Check it Out"

    full_text = (
        f"{line1}"
        f"{star}{line2_title}"
        f"{line3}"
        f"{dm_prefix}{dm_link_text}{verified}{dm_suffix}"
        f"{line5}"
        f"{vault_icon}{vault_prefix}{vault_link_text}"
    )

    entities = []

    # 1. Star custom emoji
    offset = utf16_len(line1)
    entities.append(types.MessageEntity(
        type=enums.MessageEntityType.CUSTOM_EMOJI,
        offset=offset,
        length=utf16_len(star),
        custom_emoji_id=EMOJI_STAR
    ))
    offset += utf16_len(star)

    # 2. Bold title
    entities.append(types.MessageEntity(
        type=enums.MessageEntityType.BOLD,
        offset=offset,
        length=utf16_len(line2_title.rstrip('\n')),
    ))
    offset += utf16_len(line2_title)

    # 3. Divider line 1 custom emojis (14 items)
    for _ in range(14):
        entities.append(types.MessageEntity(
            type=enums.MessageEntityType.CUSTOM_EMOJI,
            offset=offset,
            length=utf16_len(divider_char),
            custom_emoji_id=EMOJI_DIVIDER
        ))
        offset += utf16_len(divider_char)
    offset += utf16_len("\n")

    # 4. DM prefix
    offset += utf16_len(dm_prefix)

    # 5. DM Link
    entities.append(types.MessageEntity(
        type=enums.MessageEntityType.TEXT_LINK,
        offset=offset,
        length=utf16_len(dm_link_text),
        url=DM_LINK
    ))
    offset += utf16_len(dm_link_text)

    # 6. Verified badge custom emoji
    entities.append(types.MessageEntity(
        type=enums.MessageEntityType.CUSTOM_EMOJI,
        offset=offset,
        length=utf16_len(verified),
        custom_emoji_id=EMOJI_VERIFIED
    ))
    offset += utf16_len(verified) + utf16_len(dm_suffix)

    # 7. Divider line 2 custom emojis (14 items)
    for _ in range(14):
        entities.append(types.MessageEntity(
            type=enums.MessageEntityType.CUSTOM_EMOJI,
            offset=offset,
            length=utf16_len(divider_char),
            custom_emoji_id=EMOJI_DIVIDER
        ))
        offset += utf16_len(divider_char)
    offset += utf16_len("\n")

    # 8. Vault icon custom emoji
    entities.append(types.MessageEntity(
        type=enums.MessageEntityType.CUSTOM_EMOJI,
        offset=offset,
        length=utf16_len(vault_icon),
        custom_emoji_id=EMOJI_VAULT
    ))
    offset += utf16_len(vault_icon) + utf16_len(vault_prefix)

    # 9. Vault Link + Bold
    entities.append(types.MessageEntity(
        type=enums.MessageEntityType.TEXT_LINK,
        offset=offset,
        length=utf16_len(vault_link_text),
        url=VAULT_LINK
    ))
    entities.append(types.MessageEntity(
        type=enums.MessageEntityType.BOLD,
        offset=offset,
        length=utf16_len(vault_link_text),
    ))

    return full_text, entities


@app.on_message(filters.chat(INCOMING_CHANNEL_ID))
async def handle_incoming_channel_post(client: Client, message: types.Message):
    try:
        raw_caption = (message.caption or message.text or "").strip()
        logger.info(f"Incoming post in upload channel (msg_id={message.id}): {raw_caption[:50]}...")

        # 1. Check for Course Header (#<num>)
        header_match = re.search(r"#\s*(\d+)", raw_caption)
        if header_match:
            course_num = int(header_match.group(1))
            logger.info(f"Detected Course Header #{course_num}")

            # Query database for course
            courses = supabase_get("courses", {
                "course_number": f"eq.{course_num}",
                "is_deleted": "eq.false",
                "select": "id,title,course_number"
            })

            raw_title = ""
            course_id = None
            if courses and len(courses) > 0:
                raw_title = courses[0].get("title") or ""
                course_id = courses[0].get("id")

            if not raw_title or raw_title.startswith("Course #"):
                lines = [l.strip() for l in raw_caption.split("\n") if l.strip()]
                for l in lines:
                    if not l.startswith("#") and "http" not in l and len(l) >= 3:
                        raw_title = l
                        break

            if not raw_title:
                raw_title = f"Course #{course_num}"

            # Clean raw title
            clean_title = re.sub(r"^#\s*\d+\s*[-:.]*\s*", "", raw_title, flags=re.IGNORECASE).strip()

            caption_text, caption_entities = build_caption_with_exact_entities(
                header_line=f"#{course_num}",
                title_line=f"{course_num}. {clean_title}"
            )

            # Post to Storage Channel
            if message.photo:
                sent = await client.send_photo(
                    chat_id=STORAGE_CHANNEL_ID,
                    photo=message.photo.file_id,
                    caption=caption_text,
                    caption_entities=caption_entities
                )
            elif message.video:
                sent = await client.send_video(
                    chat_id=STORAGE_CHANNEL_ID,
                    video=message.video.file_id,
                    caption=caption_text,
                    caption_entities=caption_entities
                )
            elif message.document:
                sent = await client.send_document(
                    chat_id=STORAGE_CHANNEL_ID,
                    document=message.document.file_id,
                    caption=caption_text,
                    caption_entities=caption_entities
                )
            else:
                sent = await client.send_message(
                    chat_id=STORAGE_CHANNEL_ID,
                    text=caption_text,
                    entities=caption_entities,
                    disable_web_page_preview=True
                )

            logger.info(f"✅ Posted Course #{course_num} Header with 100% Animated Premium Emojis (msg_id={sent.id})")

            # Update Supabase Ingestion State
            if course_id:
                supabase_post("telegram_ingestion_state", {
                    "id": 1,
                    "current_course_id": course_id,
                    "current_course_number": course_num,
                    "updated_at": "now()"
                })
            return

        # 2. Content Upload (Videos, PDFs, Audios, Links)
        # Fetch active course context
        state_rows = supabase_get("telegram_ingestion_state", {"id": "eq.1", "select": "current_course_id,current_course_number"})
        if not state_rows or not state_rows[0].get("current_course_id"):
            logger.warning("No active course context set in Supabase!")
            return

        active_course_id = state_rows[0].get("current_course_id")
        active_course_num = state_rows[0].get("current_course_number")

        course_rows = supabase_get("courses", {"id": f"eq.{active_course_id}", "select": "id,title,course_number"})
        course_title = course_rows[0].get("title") if course_rows else f"Course #{active_course_num}"
        clean_course_title = re.sub(r"^#\s*\d+\s*[-:.]*\s*", "", course_title, flags=re.IGNORECASE).strip()
        if " - " in clean_course_title:
            short_name = clean_course_title.split(" - ", 1)[0].strip()
        elif " – " in clean_course_title:
            short_name = clean_course_title.split(" – ", 1)[0].strip()
        else:
            short_name = clean_course_title

        # Count existing logged lectures
        logged_items = supabase_get("course_video_log", {"course_id": f"eq.{active_course_id}", "select": "file_type"}) or []
        video_count = len([i for i in logged_items if i.get("file_type") in ("video", "audio")])
        material_count = len([i for i in logged_items if i.get("file_type") in ("pdf", "archive", "material")])

        # A. Video Upload (Strip old caption, apply animated custom emojis)
        if message.video:
            next_idx = video_count + 1
            cap_text, cap_entities = build_caption_with_exact_entities(
                header_line="",
                title_line=f"{next_idx}. {short_name} – Part {next_idx}"
            )
            sent = await client.send_video(
                chat_id=STORAGE_CHANNEL_ID,
                video=message.video.file_id,
                caption=cap_text,
                caption_entities=cap_entities,
                supports_streaming=True
            )
            logger.info(f"✅ Posted Video Part {next_idx} with Animated Premium Emojis (msg_id={sent.id})")
            return

        # B. Audio Upload
        if message.audio or message.voice:
            next_idx = video_count + 1
            audio_id = message.audio.file_id if message.audio else message.voice.file_id
            cap_text, cap_entities = build_caption_with_exact_entities(
                header_line="",
                title_line=f"{next_idx}. {short_name} – Audio {next_idx}"
            )
            sent = await client.send_audio(
                chat_id=STORAGE_CHANNEL_ID,
                audio=audio_id,
                caption=cap_text,
                caption_entities=cap_entities
            )
            logger.info(f"✅ Posted Audio {next_idx} with Animated Premium Emojis (msg_id={sent.id})")
            return

        # C. Document / PDF Upload
        if message.document:
            file_name = (message.document.file_name or "").lower()
            is_pdf = file_name.endswith(".pdf") or "pdf" in (message.document.mime_type or "").lower()
            next_idx = material_count + 1
            doc_label = f"PDF {next_idx}" if is_pdf else f"Material {next_idx}"

            cap_text, cap_entities = build_caption_with_exact_entities(
                header_line="",
                title_line=f"{next_idx}. {short_name} – {doc_label}"
            )
            sent = await client.send_document(
                chat_id=STORAGE_CHANNEL_ID,
                document=message.document.file_id,
                caption=cap_text,
                caption_entities=cap_entities
            )
            logger.info(f"✅ Posted {doc_label} with Animated Premium Emojis (msg_id={sent.id})")
            return

        # D. Sticker Upload
        if message.sticker:
            sent = await client.send_sticker(
                chat_id=STORAGE_CHANNEL_ID,
                sticker=message.sticker.file_id
            )
            logger.info(f"✅ Posted Sticker to Storage Channel (msg_id={sent.id})")
            return

    except Exception as e:
        logger.error(f"Error handling message {message.id}: {e}", exc_info=True)


async def start_service():
    logger.info("Starting CourseVerse Telegram Premium UserBot Daemon...")
    await app.start()
    me = await app.get_me()
    logger.info(f"UserBot Active as: {me.first_name} (@{me.username}) [ID: {me.id}] | Premium: {me.is_premium}")
    logger.info(f"Listening to Incoming Upload Channel: {INCOMING_CHANNEL_ID}")
    logger.info(f"Posting to Storage Channel: {STORAGE_CHANNEL_ID}")
    logger.info("Ready! Waiting for course uploads...")

    # Keep alive forever
    while True:
        await asyncio.sleep(3600)

if __name__ == "__main__":
    try:
        asyncio.run(start_service())
    except (KeyboardInterrupt, SystemExit):
        logger.info("UserBot Daemon stopped.")
