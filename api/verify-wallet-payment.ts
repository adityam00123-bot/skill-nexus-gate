import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { order_id } = req.query;

    if (!order_id) {
      return res.status(400).json({ error: 'Missing order_id' });
    }

    // In a real scenario with ZapUPI API, you might call ZapUPI to verify status
    // For now, we rely on the webhook to have updated the DB, so we just check the DB status.
    const { data: tx, error: txError } = await supabase
      .from('wallet_transactions')
      .select('status')
      .eq('gateway_order_id', order_id)
      .or(`id.eq.${order_id}`) // Fallback if order_id is the internal transaction ID
      .single();

    if (txError || !tx) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // If using placeholder/mock integration, simulate success if still pending
    if (tx.status === 'pending' && process.env.ZAPUPI_API_KEY === 'PLACEHOLDER_KEY') {
      // This is JUST for testing without a real ZapUPI key
      const { data: fullTx } = await supabase.from('wallet_transactions').select('*').eq('id', order_id).single();
      if (fullTx) {
        await supabase.rpc('add_wallet_balance', {
          p_user_id: fullTx.user_id,
          p_amount: fullTx.amount,
          p_order_id: fullTx.gateway_order_id || fullTx.id
        });
        return res.status(200).json({ status: 'completed' });
      }
    }

    return res.status(200).json({ status: tx.status });

  } catch (error) {
    console.error('Verify error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
