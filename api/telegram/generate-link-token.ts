import { supabase, BOT2_USERNAME } from './_utils';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Authenticate user from Authorization Header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid or expired authentication session' });
    }

    // 2. Generate a 30-minute link token in telegram_link_tokens
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const { data: linkToken, error: insertError } = await supabase
      .from('telegram_link_tokens')
      .insert({
        user_id: user.id,
        status: 'issued',
        expires_at: expiresAt
      })
      .select('id')
      .single();

    if (insertError || !linkToken) {
      console.error('[generate-link-token] DB insert error:', insertError);
      return res.status(500).json({ error: 'Failed to generate link token' });
    }

    const botUrl = `https://t.me/${BOT2_USERNAME}?start=link_${linkToken.id}`;

    return res.status(200).json({
      success: true,
      token_id: linkToken.id,
      expires_at: expiresAt,
      url: botUrl
    });

  } catch (error: any) {
    console.error('[generate-link-token] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
