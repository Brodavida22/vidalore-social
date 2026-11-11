-- ============================================================================
-- VIDALORE SOCIAL: Reel Likes, Comments, Saves, Shares & Stories RLS + Triggers
-- Additive, safe, rerunnable migration
-- ============================================================================

-- 1. Ensure reel_likes has primary/unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reel_likes_pkey' OR conname = 'reel_likes_reel_id_user_id_key'
  ) THEN
    ALTER TABLE public.reel_likes ADD CONSTRAINT reel_likes_reel_id_user_id_key UNIQUE (reel_id, user_id);
  END IF;
END $$;

-- 2. Ensure reel_saves has primary/unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reel_saves_pkey' OR conname = 'reel_saves_reel_id_user_id_key'
  ) THEN
    ALTER TABLE public.reel_saves ADD CONSTRAINT reel_saves_reel_id_user_id_key UNIQUE (reel_id, user_id);
  END IF;
END $$;

-- 3. Ensure reel_comment_likes has primary/unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reel_comment_likes_pkey' OR conname = 'reel_comment_likes_comment_id_user_id_key'
  ) THEN
    ALTER TABLE public.reel_comment_likes ADD CONSTRAINT reel_comment_likes_comment_id_user_id_key UNIQUE (comment_id, user_id);
  END IF;
END $$;

-- 4. Enable RLS on all reel social tables
ALTER TABLE public.reel_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_saves ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for reel_likes
DROP POLICY IF EXISTS "Authenticated users view reel likes" ON public.reel_likes;
CREATE POLICY "Authenticated users view reel likes"
ON public.reel_likes FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Users can like reels" ON public.reel_likes;
CREATE POLICY "Users can like reels"
ON public.reel_likes FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can unlike reels" ON public.reel_likes;
CREATE POLICY "Users can unlike reels"
ON public.reel_likes FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- 6. RLS Policies for reel_saves
DROP POLICY IF EXISTS "Users view own saved reels" ON public.reel_saves;
CREATE POLICY "Users view own saved reels"
ON public.reel_saves FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can save reels" ON public.reel_saves;
CREATE POLICY "Users can save reels"
ON public.reel_saves FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can unsave reels" ON public.reel_saves;
CREATE POLICY "Users can unsave reels"
ON public.reel_saves FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- 7. RLS Policies for reel_comments
DROP POLICY IF EXISTS "Users can insert comments on visible reels" ON public.reel_comments;
CREATE POLICY "Users can insert comments on visible reels"
ON public.reel_comments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Users can delete own reel comments" ON public.reel_comments;
CREATE POLICY "Users can delete own reel comments"
ON public.reel_comments FOR DELETE TO authenticated
USING (auth.uid() = author_id);

-- 8. RLS Policies for reel_comment_likes
DROP POLICY IF EXISTS "Authenticated users view reel comment reactions" ON public.reel_comment_likes;
CREATE POLICY "Authenticated users view reel comment reactions"
ON public.reel_comment_likes FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Users can react to reel comments" ON public.reel_comment_likes;
CREATE POLICY "Users can react to reel comments"
ON public.reel_comment_likes FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove reaction to reel comments" ON public.reel_comment_likes;
CREATE POLICY "Users can remove reaction to reel comments"
ON public.reel_comment_likes FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- 9. Trigger functions to maintain reel counts automatically
CREATE OR REPLACE FUNCTION public.handle_reel_like_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reels
    SET likes_count = COALESCE(likes_count, 0) + 1
    WHERE id = NEW.reel_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reels
    SET likes_count = GREATEST(COALESCE(likes_count, 0) - 1, 0)
    WHERE id = OLD.reel_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_reel_likes_count ON public.reel_likes;
CREATE TRIGGER trg_reel_likes_count
AFTER INSERT OR DELETE ON public.reel_likes
FOR EACH ROW EXECUTE FUNCTION public.handle_reel_like_change();

CREATE OR REPLACE FUNCTION public.handle_reel_comment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reels
    SET comments_count = COALESCE(comments_count, 0) + 1
    WHERE id = NEW.reel_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reels
    SET comments_count = GREATEST(COALESCE(comments_count, 0) - 1, 0)
    WHERE id = OLD.reel_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_reel_comments_count ON public.reel_comments;
CREATE TRIGGER trg_reel_comments_count
AFTER INSERT OR DELETE ON public.reel_comments
FOR EACH ROW EXECUTE FUNCTION public.handle_reel_comment_change();

CREATE OR REPLACE FUNCTION public.handle_reel_save_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reels
    SET saves_count = COALESCE(saves_count, 0) + 1
    WHERE id = NEW.reel_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reels
    SET saves_count = GREATEST(COALESCE(saves_count, 0) - 1, 0)
    WHERE id = OLD.reel_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_reel_saves_count ON public.reel_saves;
CREATE TRIGGER trg_reel_saves_count
AFTER INSERT OR DELETE ON public.reel_saves
FOR EACH ROW EXECUTE FUNCTION public.handle_reel_save_change();

CREATE OR REPLACE FUNCTION public.handle_reel_comment_like_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reel_comments
    SET reactions_count = COALESCE(reactions_count, 0) + 1
    WHERE id = NEW.comment_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reel_comments
    SET reactions_count = GREATEST(COALESCE(reactions_count, 0) - 1, 0)
    WHERE id = OLD.comment_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_reel_comment_likes_count ON public.reel_comment_likes;
CREATE TRIGGER trg_reel_comment_likes_count
AFTER INSERT OR DELETE ON public.reel_comment_likes
FOR EACH ROW EXECUTE FUNCTION public.handle_reel_comment_like_change();

-- 10. RPC function for incrementing share counts securely
CREATE OR REPLACE FUNCTION public.increment_reel_shares(target_reel_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.reels
  SET shares_count = COALESCE(shares_count, 0) + 1
  WHERE id = target_reel_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_reel_shares(uuid) TO authenticated;

-- 11. Ensure security functions can be executed by authenticated and anon roles
-- so that evaluating RLS policies (e.g. reels and reel_comments) never fails with 42501
DO $$
BEGIN
  GRANT EXECUTE ON FUNCTION public.is_blocked(uuid, uuid) TO authenticated, anon;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  GRANT EXECUTE ON FUNCTION public.has_blocked(uuid, uuid) TO authenticated, anon;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  GRANT EXECUTE ON FUNCTION public.can_view_reel(uuid) TO authenticated, anon;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 12. Stories deletion policy allowing authors to delete their own stories
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'stories' AND policyname = 'Users can delete own stories'
  ) THEN
    CREATE POLICY "Users can delete own stories"
    ON public.stories FOR DELETE TO authenticated
    USING (auth.uid() = user_id);
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;


