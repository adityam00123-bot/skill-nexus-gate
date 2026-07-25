import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = req.body;
    const { order_id, txn_id, status, amount, pay_amount, utr, customer_mobile, remark, remark_array, create_at, environment } = payload;
    
    if (!order_id || !status) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Ignore test webhooks in production
    if (environment === 'test' && process.env.ZAPUPI_API_KEY !== 'PLACEHOLDER_KEY') {
      console.log('Ignoring test webhook in production environment:', payload);
      return res.status(200).json({ status: 'ok' });
    }

    if (status === 'Success' || status === 'success') {
      // Find the transaction
      const { data: tx, error: txError } = await supabase
        .from('wallet_transactions')
        .select('id, user_id, amount, status')
        .eq('gateway_order_id', order_id)
        .single();

      if (txError || !tx) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      // Only process if it's still pending
      if (tx.status === 'pending') {
        // Call the RPC to atomically update balance and transaction status
        const { data: rpcResult, error: rpcError } = await supabase.rpc('add_wallet_balance', {
          p_user_id: tx.user_id,
          p_amount: tx.amount,
          p_order_id: order_id
        });

        if (rpcError) {
          console.error('RPC Error:', rpcError);
          return res.status(500).json({ error: 'Failed to process wallet top-up' });
        }
      }
    } else if (status === 'Failed' || status === 'failed') {
      await supabase
        .from('wallet_transactions')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('gateway_order_id', order_id)
        .eq('status', 'pending');
    }

    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
