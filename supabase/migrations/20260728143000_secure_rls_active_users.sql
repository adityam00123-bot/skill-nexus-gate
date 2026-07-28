-- Migration to ensure blocked or deleted users cannot perform mutating actions

-- 1. Create a helper function to check if the current user is active (exists and not blocked)
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND is_blocked = false
  );
$$;

-- 2. Update policies for subscriptions
DROP POLICY IF EXISTS "Users can insert own subscription" ON public.subscriptions;
CREATE POLICY "Users can insert own subscription" ON public.subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_active_user());

DROP POLICY IF EXISTS "Users can update own subscription" ON public.subscriptions;
CREATE POLICY "Users can update own subscription" ON public.subscriptions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.is_active_user());

-- 3. Update policies for reseller_applications
DROP POLICY IF EXISTS "Users can insert own applications" ON public.reseller_applications;
CREATE POLICY "Users can insert own applications" ON public.reseller_applications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_active_user());

-- 4. Update policies for purchases
DROP POLICY IF EXISTS "Users can insert own purchases" ON public.purchases;
CREATE POLICY "Users can insert own purchases" ON public.purchases
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_active_user());

-- 5. Update policies for wallet_transactions
DROP POLICY IF EXISTS "Users can insert own wallet transactions" ON public.wallet_transactions;
CREATE POLICY "Users can insert own wallet transactions" ON public.wallet_transactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_active_user());

-- 6. Update policies for cv_coin_transactions
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.cv_coin_transactions;
CREATE POLICY "Users can insert own transactions" ON public.cv_coin_transactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_active_user());

-- 7. Update policies for exchange_requests
DROP POLICY IF EXISTS "Users can insert own exchange requests" ON public.exchange_requests;
CREATE POLICY "Users can insert own exchange requests" ON public.exchange_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_active_user());

DROP POLICY IF EXISTS "Users can update own exchange requests" ON public.exchange_requests;
CREATE POLICY "Users can update own exchange requests" ON public.exchange_requests
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.is_active_user());

-- 8. Update policies for sell_requests
DROP POLICY IF EXISTS "Users can insert own sell requests" ON public.sell_requests;
CREATE POLICY "Users can insert own sell requests" ON public.sell_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_active_user());

DROP POLICY IF EXISTS "Users can update own sell requests" ON public.sell_requests;
CREATE POLICY "Users can update own sell requests" ON public.sell_requests
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.is_active_user());

-- 9. Update policies for reviews
DROP POLICY IF EXISTS "Users can insert own reviews" ON public.reviews;
CREATE POLICY "Users can insert own reviews" ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_active_user());

DROP POLICY IF EXISTS "Users can update own reviews" ON public.reviews;
CREATE POLICY "Users can update own reviews" ON public.reviews
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.is_active_user());

DROP POLICY IF EXISTS "Users can delete own reviews" ON public.reviews;
CREATE POLICY "Users can delete own reviews" ON public.reviews
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND public.is_active_user());
