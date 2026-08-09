-- Create an RPC to allow a user to delete their own auth record
-- This is needed to enforce strict Login vs Signup separation for OAuth providers

CREATE OR REPLACE FUNCTION delete_current_user()
RETURNS void AS $$
BEGIN
  -- Only allow deleting the currently authenticated user
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
