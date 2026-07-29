-- Migration: Fix Admin Profile Updates
-- Adds policy to allow admins to update any profile's is_blocked status (or any other field)
-- Also ensures explicit base table grants to authenticated role.

-- 1. Create Policy
CREATE POLICY "Admins can update profiles"
    ON public.profiles
    FOR UPDATE
    USING (public.has_role(auth.uid(), 'admin'));

-- 2. Explicit base table permissions for authenticated users (which includes admins)
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, UPDATE ON public.profiles TO service_role;
