import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const BOT2_USERNAME = (process.env.BOT2_USERNAME || 'CourseVerseofficialbot').replace(/^@/, '').replace(/^t\.me\//, '');

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid or expired authentication session' });
    }

    let courseId = null;
    if (req.body && req.body.course_id) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(req.body.course_id)) {
        courseId = req.body.course_id;
      }
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const insertPayload: any = {
      user_id: user.id,
      status: 'issued',
      expires_at: expiresAt
    };
    if (courseId) {
      insertPayload.course_id = courseId;
    }

    const { data: linkToken, error: insertError } = await supabase
      .from('telegram_link_tokens')
      .insert(insertPayload)
      .select('id')
      .single();

    if (insertError || !linkToken) {
      console.error('[generate-link-token] insert error:', insertError);
      return res.status(500).json({ error: 'Failed to generate link token' });
    }

    const botUrl = `https://t.me/${BOT2_USERNAME}?start=link_${linkToken.id}`;

    return res.status(200).json({
      success: true,
      token_id: linkToken.id,
      course_id: courseId,
      expires_at: expiresAt,
      url: botUrl
    });

  } catch (error: any) {
    console.error('[generate-link-token] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
