import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user_id, course_id } = req.body;
    
    if (!user_id || !course_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`[verify-join] Checking: user_id=${user_id}, course_id=${course_id}`);

    const { data: access, error: queryError } = await supabase
      .from('telegram_access')
      .select('*')
      .eq('user_id', user_id)
      .eq('course_id', course_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log(`[verify-join] Query result: access=${JSON.stringify(access)}, error=${JSON.stringify(queryError)}`);

    if (access && access.link_used) {
      return res.status(200).json({ 
        success: true, 
        joined: true, 
        telegram_username: access.joined_telegram_username,
        telegram_user_id: access.joined_telegram_user_id
      });
    }

    return res.status(200).json({ 
      success: true, 
      joined: false 
    });
  } catch (error: any) {
    console.error("verify-join error:", error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
