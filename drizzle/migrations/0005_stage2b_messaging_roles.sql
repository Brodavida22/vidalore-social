-- =====================================================================
-- VIDALORE SOCIAL
-- Stage 2B: Messaging System Roles & Permissions Migration
-- Additive migration: Support 'owner', 'admin', 'moderator', and 'member'
-- in conversation_members.role and update security helper functions.
-- =====================================================================

BEGIN;

-- 1. Relax role check constraint to support 'owner', 'admin', 'moderator', 'member'
ALTER TABLE public.conversation_members 
  DROP CONSTRAINT IF EXISTS conversation_members_role_check;

ALTER TABLE public.conversation_members 
  ADD CONSTRAINT conversation_members_role_check 
  CHECK (role IN ('owner', 'admin', 'moderator', 'member'));

-- 2. Update is_conversation_admin function to recognize 'owner' and 'admin' roles,
-- and conversation creator as admin
CREATE OR REPLACE FUNCTION public.is_conversation_admin(p_conv_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = p_conv_id AND user_id = p_user_id AND role IN ('owner', 'admin')
  ) OR EXISTS (
    SELECT 1 FROM public.conversations
    WHERE id = p_conv_id AND created_by = p_user_id
  );
$$;

-- 3. Add is_conversation_moderator helper function
CREATE OR REPLACE FUNCTION public.is_conversation_moderator(p_conv_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = p_conv_id AND user_id = p_user_id AND role IN ('owner', 'admin', 'moderator')
  ) OR EXISTS (
    SELECT 1 FROM public.conversations
    WHERE id = p_conv_id AND created_by = p_user_id
  );
$$;

-- 4. Add is_conversation_owner helper function
CREATE OR REPLACE FUNCTION public.is_conversation_owner(p_conv_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = p_conv_id AND user_id = p_user_id AND role = 'owner'
  ) OR EXISTS (
    SELECT 1 FROM public.conversations
    WHERE id = p_conv_id AND created_by = p_user_id
  );
$$;

COMMIT;
