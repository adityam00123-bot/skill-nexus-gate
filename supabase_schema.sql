-- ============================================================================
-- CourseVerse (Skill Nexus Gate) — Complete Supabase PostgreSQL Schema
-- ============================================================================
-- Reconstructed from codebase analysis on 2026-07-13
-- Run this in a fresh Supabase project's SQL Editor.
--
-- Tables (18):
--   profiles, courses, course_sections, course_lectures, categories,
--   cart, wishlist, purchases, reviews, subscriptions, subscription_history,
--   subscription_plans (legacy), notifications, contact_messages,
--   cv_coin_balances, cv_coin_transactions, referrals, exchange_requests,
--   sell_requests, reseller_applications, reseller_sales, user_roles,
--   platform_settings
--
-- Also creates:
--   • Enum: app_role
--   • Function: has_role()
--   • Function + Trigger: handle_new_user()
--   • RLS policies for every table
--   • Storage buckets: avatars, exchange-screenshots, course-thumbnails
-- ============================================================================


-- ============================================================================
-- 0. EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";       -- for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- fallback uuid generation


-- ============================================================================
-- 1. CUSTOM ENUM
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================================
-- 2. TABLES
-- ============================================================================

-- ---------- profiles ----------
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text,
  email       text,
  avatar_url  text,
  is_blocked  boolean     DEFAULT false,
  telegram_username text,
  upi_id      text,
  paytm_number text,
  bank_account text,
  bank_ifsc   text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;


-- ---------- courses ----------
CREATE TABLE IF NOT EXISTS public.courses (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title               text        NOT NULL,
  description         text,
  short_description   text,
  category            text[],
  subcategory         text[],
  tags                text[],
  price               numeric,
  original_price      numeric,
  is_free             boolean     DEFAULT false,
  is_featured         boolean     DEFAULT false,
  is_published        boolean     DEFAULT false,
  is_deleted          boolean     DEFAULT false,
  level               text,                       -- 'Beginner', 'Intermediate', 'Advanced'
  language            text,
  duration_hours      numeric,
  total_lectures      integer,
  total_students      integer     DEFAULT 0,
  total_reviews       integer     DEFAULT 0,
  rating              numeric,
  thumbnail_url       text,
  telegram_link       text,
  instructor_name     text,
  instructor_bio      text,
  requirements        text[],
  what_you_learn      text[],
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;


-- ---------- course_sections ----------
-- Referenced in CourseDetail.tsx via nested select with course_lectures
CREATE TABLE IF NOT EXISTS public.course_sections (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   uuid        NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  order_index integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.course_sections ENABLE ROW LEVEL SECURITY;


-- ---------- course_lectures ----------
-- Nested inside course_sections via Supabase relationship
CREATE TABLE IF NOT EXISTS public.course_lectures (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id  uuid        NOT NULL REFERENCES public.course_sections(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  duration    text,                                -- e.g. '12:30'
  order_index integer     NOT NULL DEFAULT 0,
  is_preview  boolean     DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.course_lectures ENABLE ROW LEVEL SECURITY;


-- ---------- categories ----------
CREATE TABLE IF NOT EXISTS public.categories (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  icon        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;


-- ---------- cart ----------
CREATE TABLE IF NOT EXISTS public.cart (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id   text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);

ALTER TABLE public.cart ENABLE ROW LEVEL SECURITY;


-- ---------- wishlist ----------
CREATE TABLE IF NOT EXISTS public.wishlist (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id   text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);

ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;


-- ---------- purchases ----------
CREATE TABLE IF NOT EXISTS public.purchases (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL,
  course_id   text        NOT NULL,
  price_paid  numeric     NOT NULL,
  is_deleted  boolean     DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;


-- ---------- reviews ----------
CREATE TABLE IF NOT EXISTS public.reviews (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL,
  course_id   text        NOT NULL,
  rating      integer     NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment     text        NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;


-- ---------- subscriptions ----------
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_name   text        NOT NULL,                -- 'Monthly', 'Yearly', 'Lifetime'
  course_id   uuid,                                 -- NULL for platform-wide subscriptions
  status      text        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'cancelled', 'expired')),
  start_date  timestamptz NOT NULL DEFAULT now(),
  end_date    timestamptz NOT NULL,                 -- NULL-ish for Lifetime (code sends null)
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;


-- ---------- subscription_history ----------
-- Tracks subscription lifecycle events (subscribe, cancel, extend, reduce, reactivate)
CREATE TABLE IF NOT EXISTS public.subscription_history (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_name     text        NOT NULL,              -- 'Monthly', 'Yearly'
  action        text        NOT NULL,              -- 'subscribed', 'cancelled', 'reactivated', 'extended', 'reduced'
  days_changed  integer     DEFAULT 0,
  amount        numeric,                            -- nullable (null on cancel/reactivate)
  created_at    timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_subscription_history_user_id
  ON public.subscription_history (user_id);

ALTER TABLE public.subscription_history ENABLE ROW LEVEL SECURITY;


-- ---------- subscription_plans (legacy — referenced in early types.ts) ----------
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL,
  description   text,
  price         numeric     NOT NULL,
  yearly_price  numeric,
  features      jsonb,
  is_active     boolean     NOT NULL DEFAULT true,
  max_courses   integer,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;


-- ---------- notifications ----------
CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  icon        text        NOT NULL DEFAULT 'bell',
  title       text        NOT NULL,
  message     text        NOT NULL,
  is_read     boolean     NOT NULL DEFAULT false,
  link        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;


-- ---------- contact_messages ----------
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  email       text        NOT NULL,
  subject     text        NOT NULL,
  message     text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;


-- ---------- cv_coin_balances ----------
CREATE TABLE IF NOT EXISTS public.cv_coin_balances (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL UNIQUE,
  balance     integer     NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cv_coin_balances ENABLE ROW LEVEL SECURITY;


-- ---------- cv_coin_transactions ----------
CREATE TABLE IF NOT EXISTS public.cv_coin_transactions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL,
  action      text        NOT NULL,                -- 'credit', 'debit', 'Discount Applied'
  coins       integer     NOT NULL,                -- positive for credit, negative for debit
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cv_coin_transactions ENABLE ROW LEVEL SECURITY;


-- ---------- referrals ----------
-- Referenced via supabase.from("referrals" as any) in CvCoinsAdmin
CREATE TABLE IF NOT EXISTS public.referrals (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  referral_code   text        NOT NULL UNIQUE,
  status          text        NOT NULL DEFAULT 'pending',  -- 'pending', 'completed'
  reward_amount   numeric     DEFAULT 10,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;


-- ---------- exchange_requests ----------
CREATE TABLE IF NOT EXISTS public.exchange_requests (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  offer_course_name         text        NOT NULL,
  offer_course_author       text        NOT NULL,
  offer_platform            text        NOT NULL DEFAULT 'Other',   -- 'Udemy', 'Telegram', 'Other'
  offer_course_link         text,
  offer_screenshot_url      text,
  want_course_name          text        NOT NULL,
  want_type                 text        NOT NULL DEFAULT 'specific', -- 'specific', 'any'
  status                    text        NOT NULL DEFAULT 'pending',  -- 'pending','approved','counter_offer','rejected','closed'
  admin_note                text,
  counter_offer_course_name text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exchange_requests ENABLE ROW LEVEL SECURITY;


-- ---------- sell_requests ----------
CREATE TABLE IF NOT EXISTS public.sell_requests (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_name       text        NOT NULL,
  course_author     text        NOT NULL,
  platform          text        NOT NULL DEFAULT 'Other',   -- 'Udemy', 'Telegram', 'Other'
  course_link       text,
  screenshot_url    text,
  expected_price    numeric     NOT NULL DEFAULT 0,
  admin_offer_price numeric,
  status            text        NOT NULL DEFAULT 'pending',  -- 'pending','approved','accepted','counter_offer','rejected','closed'
  admin_note        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sell_requests ENABLE ROW LEVEL SECURITY;


-- ---------- reseller_applications ----------
CREATE TABLE IF NOT EXISTS public.reseller_applications (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL,
  full_name           text        NOT NULL,
  email               text        NOT NULL,
  promotion_channels  text[]      NOT NULL DEFAULT '{}',
  promotion_strategy  text,
  status              text        NOT NULL DEFAULT 'pending',  -- 'pending', 'approved', 'rejected'
  admin_note          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- One application per user
CREATE UNIQUE INDEX IF NOT EXISTS reseller_applications_user_id_idx
  ON public.reseller_applications (user_id);

ALTER TABLE public.reseller_applications ENABLE ROW LEVEL SECURITY;


-- ---------- reseller_sales (legacy — from early migrations) ----------
CREATE TABLE IF NOT EXISTS public.reseller_sales (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id         uuid        NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  buyer_id          uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  sale_amount       numeric     NOT NULL,
  commission_amount numeric     NOT NULL,
  status            text        NOT NULL DEFAULT 'pending',
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reseller_sales ENABLE ROW LEVEL SECURITY;


-- ---------- user_roles ----------
CREATE TABLE IF NOT EXISTS public.user_roles (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        app_role    NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;


-- ---------- platform_settings ----------
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text        NOT NULL UNIQUE,
  value       text        NOT NULL,
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 3. FUNCTIONS
-- ============================================================================

-- ---------- has_role() — SECURITY DEFINER ----------
-- Used throughout RLS policies to check admin access
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$$;


-- ---------- handle_new_user() — Trigger function ----------
-- Auto-creates a profile row and cv_coin_balances row when a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email
  );

  INSERT INTO public.cv_coin_balances (user_id, balance)
  VALUES (new.id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
END;
$$;


-- ============================================================================
-- 4. TRIGGERS
-- ============================================================================

-- Auto-create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ============================================================================
-- 5. ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- ==================== profiles ====================
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Authenticated users can read all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admin read all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can delete own profile"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = id);


-- ==================== courses ====================
CREATE POLICY "Anyone can read published courses"
  ON public.courses FOR SELECT
  TO public
  USING (is_published = true);

CREATE POLICY "Admin full read courses"
  ON public.courses FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin insert courses"
  ON public.courses FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin update courses"
  ON public.courses FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin delete courses"
  ON public.courses FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));


-- ==================== course_sections ====================
CREATE POLICY "Anyone can read course sections"
  ON public.course_sections FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admin manage course sections"
  ON public.course_sections FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));


-- ==================== course_lectures ====================
CREATE POLICY "Anyone can read course lectures"
  ON public.course_lectures FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admin manage course lectures"
  ON public.course_lectures FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));


-- ==================== categories ====================
CREATE POLICY "Anyone can read categories"
  ON public.categories FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admin manage categories"
  ON public.categories FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));


-- ==================== cart ====================
CREATE POLICY "Users can read own cart"
  ON public.cart FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cart"
  ON public.cart FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own cart"
  ON public.cart FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admin read all cart"
  ON public.cart FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));


-- ==================== wishlist ====================
CREATE POLICY "Users can read own wishlist"
  ON public.wishlist FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wishlist"
  ON public.wishlist FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own wishlist"
  ON public.wishlist FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admin read all wishlist"
  ON public.wishlist FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));


-- ==================== purchases ====================
CREATE POLICY "Users can read own purchases"
  ON public.purchases FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own purchases"
  ON public.purchases FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Admin read all purchases"
  ON public.purchases FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin update purchases"
  ON public.purchases FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin delete purchases"
  ON public.purchases FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));


-- ==================== reviews ====================
CREATE POLICY "Anyone can read reviews"
  ON public.reviews FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can insert own reviews"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own reviews"
  ON public.reviews FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own reviews"
  ON public.reviews FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id::text);


-- ==================== subscriptions ====================
CREATE POLICY "Users can read own subscription"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscription"
  ON public.subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription"
  ON public.subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admin read all subscriptions"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin update subscriptions"
  ON public.subscriptions FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));


-- ==================== subscription_history ====================
CREATE POLICY "Users can view their own subscription history"
  ON public.subscription_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscription history"
  ON public.subscription_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin read all subscription history"
  ON public.subscription_history FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin insert subscription history"
  ON public.subscription_history FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));


-- ==================== subscription_plans ====================
CREATE POLICY "Anyone can read active plans"
  ON public.subscription_plans FOR SELECT
  TO public
  USING (is_active = true);

CREATE POLICY "Admin manage subscription plans"
  ON public.subscription_plans FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));


-- ==================== notifications ====================
CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin read all notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin send notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));


-- ==================== contact_messages ====================
CREATE POLICY "Anyone can submit contact messages"
  ON public.contact_messages FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Authenticated can read contact messages"
  ON public.contact_messages FOR SELECT
  TO authenticated
  USING (true);


-- ==================== cv_coin_balances ====================
CREATE POLICY "Users can read own balance"
  ON public.cv_coin_balances FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own balance"
  ON public.cv_coin_balances FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own balance"
  ON public.cv_coin_balances FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Admin read all cv_balances"
  ON public.cv_coin_balances FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin update cv_balances"
  ON public.cv_coin_balances FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin insert cv_balances"
  ON public.cv_coin_balances FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));


-- ==================== cv_coin_transactions ====================
CREATE POLICY "Users can read own transactions"
  ON public.cv_coin_transactions FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own transactions"
  ON public.cv_coin_transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Admin read all cv_transactions"
  ON public.cv_coin_transactions FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin insert cv_transactions"
  ON public.cv_coin_transactions FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin delete cv_transactions"
  ON public.cv_coin_transactions FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));


-- ==================== referrals ====================
CREATE POLICY "Users can read own referrals"
  ON public.referrals FOR SELECT
  TO authenticated
  USING (auth.uid() = referrer_id);

CREATE POLICY "Users can insert own referrals"
  ON public.referrals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = referrer_id);

CREATE POLICY "Admin read all referrals"
  ON public.referrals FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));


-- ==================== exchange_requests ====================
CREATE POLICY "Users can read own exchange requests"
  ON public.exchange_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own exchange requests"
  ON public.exchange_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own exchange requests"
  ON public.exchange_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admin read all exchange_reqs"
  ON public.exchange_requests FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin update exchange_reqs"
  ON public.exchange_requests FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin delete exchange_reqs"
  ON public.exchange_requests FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));


-- ==================== sell_requests ====================
CREATE POLICY "Users can read own sell requests"
  ON public.sell_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sell requests"
  ON public.sell_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sell requests"
  ON public.sell_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admin read all sell_reqs"
  ON public.sell_requests FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin update sell_reqs"
  ON public.sell_requests FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin delete sell_reqs"
  ON public.sell_requests FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));


-- ==================== reseller_applications ====================
CREATE POLICY "Users can read own applications"
  ON public.reseller_applications FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own applications"
  ON public.reseller_applications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Admin read all reseller_apps"
  ON public.reseller_applications FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin update reseller_apps"
  ON public.reseller_applications FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));


-- ==================== reseller_sales ====================
CREATE POLICY "Resellers can read own sales"
  ON public.reseller_sales FOR SELECT
  TO authenticated
  USING (auth.uid() = reseller_id);

CREATE POLICY "Admin read all reseller_sales"
  ON public.reseller_sales FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));


-- ==================== user_roles ====================
CREATE POLICY "Read own or admin reads all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin update roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));


-- ==================== platform_settings ====================
CREATE POLICY "Read settings"
  ON public.platform_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin insert settings"
  ON public.platform_settings FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin update settings"
  ON public.platform_settings FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));


-- ============================================================================
-- 6. STORAGE BUCKETS
-- ============================================================================

-- avatars bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Public read access for avatars"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');


-- exchange-screenshots bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('exchange-screenshots', 'exchange-screenshots', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload exchange screenshots"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'exchange-screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Anyone can view exchange screenshots"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'exchange-screenshots');


-- course-thumbnails bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-thumbnails', 'course-thumbnails', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admin upload course thumbnails"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'course-thumbnails'
    AND has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Public read course thumbnails"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'course-thumbnails');


-- ============================================================================
-- 7. SEED DATA — Platform Settings
-- ============================================================================
INSERT INTO public.platform_settings (key, value) VALUES
  ('site_name', 'CourseVerse'),
  ('site_description', 'Premium trading & investing courses'),
  ('maintenance_mode', 'false'),
  ('support_email', 'courseversehere@gmail.com'),
  ('telegram_support', ''),
  ('telegram_bot', ''),
  ('monthly_price', '499'),
  ('yearly_price', '3999'),
  ('referral_reward_pct', '20'),
  ('min_withdrawal', '100'),
  ('refund_policy', 'Refunds are available within 7 days of purchase.'),
  ('about_content', '')
ON CONFLICT (key) DO NOTHING;


-- ============================================================================
-- 8. REALTIME — Enable for notifications (used in NotificationContext)
-- ============================================================================
-- Supabase Dashboard > Database > Replication
-- Enable realtime for the "notifications" table so the client can subscribe
-- to INSERT events. This typically requires:
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;


-- ============================================================================
-- DONE
-- ============================================================================
-- After running this script:
--   1. Go to Authentication > Providers and enable Google OAuth
--   2. Set your site URL and redirect URLs
--   3. Add your first admin by inserting into user_roles:
--      INSERT INTO user_roles (user_id, role) VALUES ('<your-user-uuid>', 'admin');
--   4. Regenerate your types.ts if needed:
--      npx supabase gen types typescript --project-id <your-project-ref> > src/integrations/supabase/types.ts
-- ============================================================================
