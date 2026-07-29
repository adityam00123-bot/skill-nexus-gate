-- Migration: Create secure RPC for subscription purchases using wallet balance
-- Ensures atomic wallet deduction, history recording, and end_date updates.
-- Enforces idempotency via gateway_order_id.

CREATE OR REPLACE FUNCTION public.process_subscription_purchase(
  p_user_id uuid,
  p_plan_name text,
  p_idempotency_key text
) RETURNS json AS $$
DECLARE
  v_current_balance numeric;
  v_amount numeric;
  v_days_to_add integer;
  v_current_end_date timestamptz;
  v_new_end_date timestamptz;
  v_is_active boolean;
  v_sub_id uuid;
BEGIN
  -- 1. Check if user is active (not blocked)
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_user_id AND is_blocked = false
  ) INTO v_is_active;

  IF NOT v_is_active THEN
    RETURN json_build_object('success', false, 'error', 'User account is inactive or blocked');
  END IF;

  -- 2. Determine price and duration
  IF lower(p_plan_name) = 'yearly' THEN
    v_amount := 3999;
    v_days_to_add := 365;
  ELSIF lower(p_plan_name) = 'monthly' THEN
    v_amount := 499;
    v_days_to_add := 30;
  ELSE
    RETURN json_build_object('success', false, 'error', 'Invalid plan name');
  END IF;

  -- 3. Lock row and check wallet balance
  SELECT COALESCE(wallet_balance, 0) INTO v_current_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_current_balance < v_amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient wallet balance');
  END IF;

  -- 4. Deduct balance
  UPDATE public.profiles
  SET wallet_balance = wallet_balance - v_amount,
      updated_at = now()
  WHERE id = p_user_id;

  -- 5. Record debit transaction (provides idempotency via UNIQUE constraint on gateway_order_id)
  -- The unique constraint on gateway_order_id will throw an error if this RPC is called twice with the same key
  INSERT INTO public.wallet_transactions (user_id, amount, type, status, description, gateway_order_id)
  VALUES (p_user_id, v_amount, 'debit', 'completed', 'Subscription Purchase (' || p_plan_name || ')', p_idempotency_key);

  -- 6. Check existing subscription and calculate new end_date
  SELECT id, end_date INTO v_sub_id, v_current_end_date
  FROM public.subscriptions
  WHERE user_id = p_user_id AND status IN ('active', 'cancelled')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_current_end_date IS NOT NULL AND v_current_end_date > now() THEN
    v_new_end_date := v_current_end_date + (v_days_to_add || ' days')::interval;
  ELSE
    v_new_end_date := now() + (v_days_to_add || ' days')::interval;
  END IF;

  -- 7. Update or insert subscription
  IF v_sub_id IS NOT NULL THEN
    UPDATE public.subscriptions
    SET plan_name = p_plan_name,
        start_date = now(),
        end_date = v_new_end_date,
        status = 'active'
    WHERE id = v_sub_id;
  ELSE
    INSERT INTO public.subscriptions (user_id, plan_name, start_date, end_date, status)
    VALUES (p_user_id, p_plan_name, now(), v_new_end_date, 'active');
  END IF;

  -- 8. Record in subscription_history
  INSERT INTO public.subscription_history (user_id, plan_name, action, days_changed, amount, created_at)
  VALUES (p_user_id, p_plan_name, 'subscribed', v_days_to_add, v_amount, now());

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.process_subscription_purchase(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_subscription_purchase(uuid, text, text) TO service_role;
