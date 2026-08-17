import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export default async function handler(req: any, res: any) {
  // Allow GET or POST for ZapUPI health checks
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok', message: 'ZapUPI Webhook endpoint active' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let payload = req.body;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        console.warn('Failed to parse string payload as JSON:', payload);
      }
    }

    console.log('ZapUPI Webhook received payload:', payload);

    const { order_id, txn_id, status, amount, pay_amount, utr, customer_mobile, remark, remark_array, create_at, environment } = payload || {};
    
    if (!order_id || !status) {
      console.warn('ZapUPI Webhook missing order_id or status, returning 200 for health test:', payload);
      return res.status(200).json({ status: 'ok', message: 'Acknowledged' });
    }

    if (status === 'Success' || status === 'success') {
      // Find the transaction
      const { data: tx, error: txError } = await supabase
        .from('wallet_transactions')
        .select('id, user_id, amount, status')
        .eq('gateway_order_id', order_id)
        .single();

      if (txError || !tx) {
        console.warn(`Transaction not found for order_id: ${order_id}. Might be a test ping.`);
        return res.status(200).json({ status: 'ok', message: 'Transaction not found or test order acknowledged' });
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
          console.error('RPC Error while adding wallet balance:', rpcError);
          return res.status(500).json({ error: 'Failed to process wallet top-up' });
        }

        console.log(`Successfully credited wallet for user ${tx.user_id} with amount ₹${tx.amount} (Order: ${order_id})`);
      }
    } else if (status === 'Failed' || status === 'failed') {
      await supabase
        .from('wallet_transactions')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('gateway_order_id', order_id)
        .eq('status', 'pending');
      
      console.log(`Marked transaction failed for order: ${order_id}`);
    }

    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
