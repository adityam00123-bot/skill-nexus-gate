-- Add wallet_balance to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wallet_balance numeric DEFAULT 0;

-- Create wallet_transactions table
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount              numeric     NOT NULL,
  type                text        NOT NULL CHECK (type IN ('credit', 'debit')),
  status              text        NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  payment_gateway     text,
  gateway_order_id    text        UNIQUE,
  description         text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for wallet_transactions
CREATE POLICY "Users can view their own wallet transactions"
  ON public.wallet_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert pending transactions"
  ON public.wallet_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- RPC for adding wallet balance atomically
CREATE OR REPLACE FUNCTION public.add_wallet_balance(
  p_user_id uuid,
  p_amount numeric,
  p_order_id text
) RETURNS boolean AS $$
BEGIN
  -- 1. Update wallet_transactions to completed
  UPDATE public.wallet_transactions
  SET status = 'completed', updated_at = now()
  WHERE gateway_order_id = p_order_id AND status = 'pending';

  -- If no row was updated, it means it's either already processed or doesn't exist.
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- 2. Increment wallet balance
  UPDATE public.profiles
  SET wallet_balance = COALESCE(wallet_balance, 0) + p_amount,
      updated_at = now()
  WHERE id = p_user_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC for processing a course purchase with wallet balance
CREATE OR REPLACE FUNCTION public.process_wallet_purchase(
  p_user_id uuid,
  p_amount numeric,
  p_course_ids text[]
) RETURNS json AS $$
DECLARE
  current_balance numeric;
  cid text;
BEGIN
  -- Lock row and check balance
  SELECT COALESCE(wallet_balance, 0) INTO current_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF current_balance < p_amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient wallet balance');
  END IF;

  -- Deduct balance
  UPDATE public.profiles
  SET wallet_balance = wallet_balance - p_amount,
      updated_at = now()
  WHERE id = p_user_id;

  -- Record debit transaction
  INSERT INTO public.wallet_transactions (user_id, amount, type, status, description, gateway_order_id)
  VALUES (p_user_id, p_amount, 'debit', 'completed', 'Course Purchase', 'purchase_' || gen_random_uuid());

  -- Insert purchases
  FOREACH cid IN ARRAY p_course_ids
  LOOP
    INSERT INTO public.purchases (user_id, course_id, price_paid)
    VALUES (p_user_id, cid, p_amount / COALESCE(array_length(p_course_ids, 1), 1));
  END LOOP;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
