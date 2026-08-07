-- Create deleted_users_archive table for audit trail
CREATE TABLE IF NOT EXISTS public.deleted_users_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_user_id uuid NOT NULL,
  full_name text,
  email text,
  total_purchases integer DEFAULT 0,
  total_amount_spent numeric DEFAULT 0,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  deleted_by uuid  -- admin who performed the deletion
);

-- Grant permissions (per Supabase rules)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deleted_users_archive TO service_role;
GRANT SELECT ON public.deleted_users_archive TO authenticated;

-- Enable RLS
ALTER TABLE public.deleted_users_archive ENABLE ROW LEVEL SECURITY;

-- Only admins can read the archive
CREATE POLICY "Admins can read deleted users archive"
  ON public.deleted_users_archive FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
