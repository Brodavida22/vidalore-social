-- =====================================================================
-- Stage 2: Persistent notifications, content reports, and user blocks (additive only)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. User Blocks
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_blocks_not_self CHECK (blocker_id <> blocked_id),
  CONSTRAINT user_blocks_unique UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS user_blocks_blocker_idx ON public.user_blocks (blocker_id);
CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx ON public.user_blocks (blocked_id);

GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;
GRANT ALL ON public.user_blocks TO service_role;

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own blocklist" ON public.user_blocks FOR SELECT TO authenticated
  USING (blocker_id = auth.uid());

CREATE POLICY "Users block other users" ON public.user_blocks FOR INSERT TO authenticated
  WITH CHECK (blocker_id = auth.uid() AND blocked_id <> auth.uid());

CREATE POLICY "Users unblock other users" ON public.user_blocks FOR DELETE TO authenticated
  USING (blocker_id = auth.uid());

-- Helper: Check if two users have an active block in either direction
CREATE OR REPLACE FUNCTION public.is_blocked(_user_a uuid, _user_b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (blocker_id = _user_a AND blocked_id = _user_b)
       OR (blocker_id = _user_b AND blocked_id = _user_a)
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_blocked(uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2. Persistent Notifications
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.post_comments(id) ON DELETE CASCADE,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notifications_not_self CHECK (recipient_id <> actor_id),
  CONSTRAINT notifications_type_valid CHECK (
    type IN (
      'post_like',
      'post_comment',
      'comment_reply',
      'comment_like',
      'repost',
      'follow',
      'friend_request',
      'friend_accept'
    )
  )
);

CREATE INDEX IF NOT EXISTS notifications_recipient_created_idx ON public.notifications (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_recipient_unread_idx ON public.notifications (recipient_id, read_at) WHERE read_at IS NULL;

GRANT SELECT, DELETE ON public.notifications TO authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;
GRANT INSERT ON public.notifications TO authenticated, service_role;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());

CREATE POLICY "Users update own notification read status" ON public.notifications FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

CREATE POLICY "Users delete own notifications" ON public.notifications FOR DELETE TO authenticated
  USING (recipient_id = auth.uid());

-- Triggers to automatically generate notifications on social actions
CREATE OR REPLACE FUNCTION public.handle_post_like_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _author_id uuid;
BEGIN
  SELECT author_id INTO _author_id FROM public.posts WHERE id = NEW.post_id;
  IF _author_id IS NOT NULL AND _author_id <> NEW.user_id AND NOT public.is_blocked(_author_id, NEW.user_id) THEN
    INSERT INTO public.notifications (recipient_id, actor_id, type, post_id)
    VALUES (_author_id, NEW.user_id, 'post_like', NEW.post_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_post_like_notification ON public.post_likes;
CREATE TRIGGER trg_post_like_notification AFTER INSERT ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.handle_post_like_notification();

CREATE OR REPLACE FUNCTION public.handle_post_comment_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _post_author_id uuid;
  _parent_author_id uuid;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT author_id INTO _parent_author_id FROM public.post_comments WHERE id = NEW.parent_id;
    IF _parent_author_id IS NOT NULL AND _parent_author_id <> NEW.author_id AND NOT public.is_blocked(_parent_author_id, NEW.author_id) THEN
      INSERT INTO public.notifications (recipient_id, actor_id, type, post_id, comment_id)
      VALUES (_parent_author_id, NEW.author_id, 'comment_reply', NEW.post_id, NEW.id);
    END IF;
  ELSE
    SELECT author_id INTO _post_author_id FROM public.posts WHERE id = NEW.post_id;
    IF _post_author_id IS NOT NULL AND _post_author_id <> NEW.author_id AND NOT public.is_blocked(_post_author_id, NEW.author_id) THEN
      INSERT INTO public.notifications (recipient_id, actor_id, type, post_id, comment_id)
      VALUES (_post_author_id, NEW.author_id, 'post_comment', NEW.post_id, NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_post_comment_notification ON public.post_comments;
CREATE TRIGGER trg_post_comment_notification AFTER INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.handle_post_comment_notification();

CREATE OR REPLACE FUNCTION public.handle_comment_like_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _comment_author_id uuid;
  _post_id uuid;
BEGIN
  SELECT author_id, post_id INTO _comment_author_id, _post_id FROM public.post_comments WHERE id = NEW.comment_id;
  IF _comment_author_id IS NOT NULL AND _comment_author_id <> NEW.user_id AND NOT public.is_blocked(_comment_author_id, NEW.user_id) THEN
    INSERT INTO public.notifications (recipient_id, actor_id, type, post_id, comment_id)
    VALUES (_comment_author_id, NEW.user_id, 'comment_like', _post_id, NEW.comment_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_comment_like_notification ON public.post_comment_likes;
CREATE TRIGGER trg_comment_like_notification AFTER INSERT ON public.post_comment_likes
  FOR EACH ROW EXECUTE FUNCTION public.handle_comment_like_notification();

CREATE OR REPLACE FUNCTION public.handle_repost_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _orig_author_id uuid;
BEGIN
  IF NEW.repost_of_id IS NOT NULL THEN
    SELECT author_id INTO _orig_author_id FROM public.posts WHERE id = NEW.repost_of_id;
    IF _orig_author_id IS NOT NULL AND _orig_author_id <> NEW.author_id AND NOT public.is_blocked(_orig_author_id, NEW.author_id) THEN
      INSERT INTO public.notifications (recipient_id, actor_id, type, post_id)
      VALUES (_orig_author_id, NEW.author_id, 'repost', NEW.repost_of_id);
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_repost_notification ON public.posts;
CREATE TRIGGER trg_repost_notification AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.handle_repost_notification();

CREATE OR REPLACE FUNCTION public.handle_follow_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.following_id <> NEW.follower_id AND NOT public.is_blocked(NEW.following_id, NEW.follower_id) THEN
    INSERT INTO public.notifications (recipient_id, actor_id, type)
    VALUES (NEW.following_id, NEW.follower_id, 'follow');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_follow_notification ON public.follows;
CREATE TRIGGER trg_follow_notification AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.handle_follow_notification();

CREATE OR REPLACE FUNCTION public.handle_friend_request_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.recipient_id <> NEW.requester_id AND NOT public.is_blocked(NEW.recipient_id, NEW.requester_id) THEN
      INSERT INTO public.notifications (recipient_id, actor_id, type)
      VALUES (NEW.recipient_id, NEW.requester_id, 'friend_request');
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'accepted' AND OLD.status <> 'accepted' THEN
      IF NEW.requester_id <> auth.uid() AND NOT public.is_blocked(NEW.requester_id, auth.uid()) THEN
        INSERT INTO public.notifications (recipient_id, actor_id, type)
        VALUES (NEW.requester_id, auth.uid(), 'friend_accept');
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_friend_request_notification ON public.friend_requests;
CREATE TRIGGER trg_friend_request_notification AFTER INSERT OR UPDATE OF status ON public.friend_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_friend_request_notification();

-- ---------------------------------------------------------------------
-- 3. Content Reporting System
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type text NOT NULL,
  target_id text NOT NULL,
  post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  comment_id uuid REFERENCES public.post_comments(id) ON DELETE SET NULL,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_reports_target_type_valid CHECK (target_type IN ('post', 'comment', 'profile')),
  CONSTRAINT content_reports_status_valid CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  CONSTRAINT content_reports_reason_len CHECK (char_length(btrim(reason)) BETWEEN 2 AND 120),
  CONSTRAINT content_reports_description_len CHECK (description IS NULL OR char_length(description) <= 1000)
);

CREATE INDEX IF NOT EXISTS content_reports_status_idx ON public.content_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS content_reports_reporter_idx ON public.content_reports (reporter_id);
CREATE INDEX IF NOT EXISTS content_reports_target_idx ON public.content_reports (target_type, target_id);

GRANT SELECT, INSERT ON public.content_reports TO authenticated;
GRANT UPDATE (status, admin_notes, resolved_by, resolved_at) ON public.content_reports TO authenticated;
GRANT ALL ON public.content_reports TO service_role;

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own reports or admins read all" ON public.content_reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users create reports as themselves" ON public.content_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "Admins update reports" ON public.content_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER content_reports_touch BEFORE UPDATE ON public.content_reports
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
