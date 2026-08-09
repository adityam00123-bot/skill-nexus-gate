-- Fix 403 permission error on deleting deleted_users_archive records
-- Add DELETE policy for admins on the deleted_users_archive table
CREATE POLICY "Admins can delete deleted users archive"
  ON public.deleted_users_archive FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Grant DELETE permissions to authenticated users so the policy can be evaluated
GRANT DELETE ON public.deleted_users_archive TO authenticated;
