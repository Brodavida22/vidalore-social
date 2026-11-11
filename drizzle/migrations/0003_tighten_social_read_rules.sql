-- Helper: has _blocker blocked _blocked (one direction)
CREATE OR REPLACE FUNCTION public.has_blocked(_blocker uuid, _blocked uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_blocks WHERE blocker_id = _blocker AND blocked_id = _blocked)
$$;

-- Helper: can the caller view a reel
CREATE OR REPLACE FUNCTION public.can_view_reel(_reel_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.reels r
    WHERE r.id = _reel_id
      AND (r.creator_id = auth.uid()
           OR (public.can_view_author_posts(r.creator_id) AND NOT public.is_blocked(auth.uid(), r.creator_id)))
  )
$$;

-- Helper: can the caller read a reel video file
CREATE OR REPLACE FUNCTION public.can_view_reel_object(_name text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.reels r
    WHERE r.video_url = _name
      AND (r.creator_id = auth.uid()
           OR (public.can_view_author_posts(r.creator_id) AND NOT public.is_blocked(auth.uid(), r.creator_id)))
  )
$$;

-- Helper: can the caller read a story media file (matches the stories read rule)
CREATE OR REPLACE FUNCTION public.can_view_story_object(_name text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.stories s
    WHERE s.media_url = _name
      AND (s.user_id = auth.uid() OR s.expires_at > now())
  )
$$;

REVOKE EXECUTE ON FUNCTION public.has_blocked(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_view_reel(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_view_reel_object(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_view_story_object(text) FROM anon;

-- profiles: hidden from people the profile owner has blocked
DROP POLICY IF EXISTS "Signed-in users read profiles" ON public.profiles;
CREATE POLICY "Signed-in users read profiles unless blocked by owner"
ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR NOT public.has_blocked(id, auth.uid()));

-- follows: own rows, or rows where neither person has blocked the viewer
DROP POLICY IF EXISTS "Authenticated users can view follows" ON public.follows;
CREATE POLICY "Users view follows unless blocked"
ON public.follows FOR SELECT TO authenticated
USING (
  auth.uid() = follower_id
  OR auth.uid() = following_id
  OR (NOT public.has_blocked(follower_id, auth.uid()) AND NOT public.has_blocked(following_id, auth.uid()))
);

-- user_achievements: own, or visible profile owners not blocked
DROP POLICY IF EXISTS "Signed-in users read achievements earned" ON public.user_achievements;
CREATE POLICY "Users read own or visible earned achievements"
ON public.user_achievements FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR (public.can_view_author_posts(user_id) AND NOT public.is_blocked(auth.uid(), user_id))
);

-- achievements catalog: active ones, ones you earned, or admins
DROP POLICY IF EXISTS "Signed-in users read achievements" ON public.achievements;
CREATE POLICY "Users read active or earned achievements"
ON public.achievements FOR SELECT TO authenticated
USING (
  is_active
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.achievement_id = achievements.id AND ua.user_id = auth.uid())
);

-- reward settings: active ones, or admins
DROP POLICY IF EXISTS "Signed-in users read rewards" ON public.reward_settings;
CREATE POLICY "Users read active rewards"
ON public.reward_settings FOR SELECT TO authenticated
USING (is_active OR public.has_role(auth.uid(), 'admin'));

-- reels: own, or from visible creators not blocked
DROP POLICY IF EXISTS "Authenticated users read reels" ON public.reels;
CREATE POLICY "Users read own or visible reels"
ON public.reels FOR SELECT TO authenticated
USING (
  creator_id = auth.uid()
  OR (public.can_view_author_posts(creator_id) AND NOT public.is_blocked(auth.uid(), creator_id))
);

-- reel comments: own, or on visible reels from non-blocked authors
DROP POLICY IF EXISTS "Authenticated users read reel comments" ON public.reel_comments;
CREATE POLICY "Users read comments on visible reels"
ON public.reel_comments FOR SELECT TO authenticated
USING (
  author_id = auth.uid()
  OR (public.can_view_reel(reel_id) AND NOT public.is_blocked(auth.uid(), author_id))
);

-- storage: profile media readable only by its owner (others use links the owner created)
DROP POLICY IF EXISTS "Signed-in users view profile media" ON storage.objects;
CREATE POLICY "Users view own profile media"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'profile-media' AND (storage.foldername(name))[1] = (auth.uid())::text);

-- storage: reel and story files readable by owner or viewers of the matching reel/story
DROP POLICY IF EXISTS "Public read reel and story media" ON storage.objects;
CREATE POLICY "Users view own or visible reel videos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'reel-videos'
  AND ((storage.foldername(name))[1] = (auth.uid())::text OR public.can_view_reel_object(name))
);
CREATE POLICY "Users view own or active story media"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'story-media'
  AND ((storage.foldername(name))[1] = (auth.uid())::text OR public.can_view_story_object(name))
);