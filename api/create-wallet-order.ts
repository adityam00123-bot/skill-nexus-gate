import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ZAPUPI_API_KEY = process.env.ZAPUPI_API_KEY || 'PLACEHOLDER_KEY';

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, userId } = req.body;

    if (!amount || amount < 100 || amount > 50000) {
      return res.status(400).json({ error: 'Invalid amount. Must be between ₹100 and ₹50,000.' });
    }

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Missing user ID' });
    }

    // 1. Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 2. Create pending transaction in Supabase
    const { data: tx, error: txError } = await supabase
      .from('wallet_transactions')
      .insert({
        user_id: userId,
        amount: amount,
        type: 'credit',
        status: 'pending',
        payment_gateway: 'ZapUPI',
        description: `Wallet Top-up: ₹${amount}`,
      })
      .select()
      .single();

    if (txError || !tx) {
      console.error('Error creating transaction:', txError);
      return res.status(500).json({ error: 'Failed to create transaction' });
    }

    // 3. Call ZapUPI create-order API
    const zapUpiPayload = {
      zap_key: ZAPUPI_API_KEY,
      order_id: tx.id,
      amount: amount.toString(),
      customer_mobile: profile.telegram_username || "9999999999", // ZapUPI expects mobile, using dummy if not available
      remark: `WalletTopup|${userId}`,
      webhook_url: `https://courseverse-beta.vercel.app/api/zapupi-webhook`,
      success_url: `https://courseverse-beta.vercel.app/wallet?order_id=${tx.id}`,
      failed_url: `https://courseverse-beta.vercel.app/wallet?order_id=${tx.id}`,
      timeout_url: `https://courseverse-beta.vercel.app/wallet?order_id=${tx.id}`,
    };

    // If using placeholder key, simulate ZapUPI response
    if (ZAPUPI_API_KEY === 'PLACEHOLDER_KEY') {
      console.log('Simulating ZapUPI create order with payload:', zapUpiPayload);
      // Update transaction with fake gateway order ID
      const fakeGatewayOrderId = `ZAP_${Date.now()}`;
      await supabase
        .from('wallet_transactions')
        .update({ gateway_order_id: fakeGatewayOrderId })
        .eq('id', tx.id);

      return res.status(200).json({
        success: true,
        payment_url: `https://pay.zapupi.com/mock-checkout/${fakeGatewayOrderId}`,
        order_id: fakeGatewayOrderId,
        transaction_id: tx.id
      });
    }

    const zapRes = await fetch('https://pay.zapupi.com/api/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(zapUpiPayload)
    });

    const zapData = await zapRes.json();

    if (zapData.status !== 'success' && zapData.status !== 'Success') {
      console.error('ZapUPI error:', zapData);
      return res.status(500).json({ error: 'Failed to initialize payment gateway' });
    }

    // Update transaction with gateway order ID
    await supabase
      .from('wallet_transactions')
      .update({ gateway_order_id: zapData.order_id })
      .eq('id', tx.id);

    return res.status(200).json({
      success: true,
      payment_url: zapData.payment_url,
      order_id: zapData.order_id,
      transaction_id: tx.id
    });

  } catch (error) {
    console.error('Create order error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
