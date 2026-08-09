-- Fix the foreign key to reference public.profiles instead of auth.users
-- This allows PostgREST to automatically infer the relationship for the frontend join

ALTER TABLE public.support_tickets 
  DROP CONSTRAINT IF EXISTS support_tickets_user_id_fkey;

ALTER TABLE public.support_tickets 
  ADD CONSTRAINT support_tickets_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
