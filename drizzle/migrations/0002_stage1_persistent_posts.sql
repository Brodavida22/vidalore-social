-- =====================================================================
-- Stage 1: Persistent social posts (additive only)
-- =====================================================================

-- ---------- Tables ----------
CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  mood text,
  location text,
  repost_of_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  repost_note text,
  likes_count integer NOT NULL DEFAULT 0,
  comments_count integer NOT NULL DEFAULT 0,
  saves_count integer NOT NULL DEFAULT 0,
  reposts_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT posts_content_length CHECK (char_length(content) <= 600),
  CONSTRAINT posts_tags_max CHECK (cardinality(tags) <= 3),
  CONSTRAINT posts_tags_text_length CHECK (char_length(array_to_string(tags, ',')) <= 120),
  CONSTRAINT posts_mood_length CHECK (mood IS NULL OR char_length(mood) BETWEEN 1 AND 40),
  CONSTRAINT posts_location_length CHECK (location IS NULL OR char_length(location) BETWEEN 1 AND 100),
  CONSTRAINT posts_repost_note_length CHECK (repost_note IS NULL OR char_length(repost_note) BETWEEN 1 AND 300),
  CONSTRAINT posts_repost_note_requires_repost CHECK (repost_note IS NULL OR repost_of_id IS NOT NULL),
  CONSTRAINT posts_not_self_repost CHECK (repost_of_id IS NULL OR repost_of_id <> id),
  CONSTRAINT posts_counts_nonnegative CHECK (likes_count >= 0 AND comments_count >= 0 AND saves_count >= 0 AND reposts_count >= 0)
);
CREATE INDEX posts_created_at_idx ON public.posts (created_at DESC);
CREATE INDEX posts_author_created_idx ON public.posts (author_id, created_at DESC);
CREATE INDEX posts_repost_of_idx ON public.posts (repost_of_id) WHERE repost_of_id IS NOT NULL;
CREATE UNIQUE INDEX posts_one_repost_per_user ON public.posts (author_id, repost_of_id) WHERE repost_of_id IS NOT NULL;
CREATE INDEX posts_tags_idx ON public.posts USING gin (tags);
CREATE INDEX posts_trending_idx ON public.posts (likes_count DESC, created_at DESC);

CREATE TABLE public.post_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  media_type text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint,
  position smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT post_media_type_valid CHECK (media_type IN ('image', 'video')),
  CONSTRAINT post_media_mime_valid CHECK (mime_type IN ('image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime')),
  CONSTRAINT post_media_type_matches_mime CHECK ((media_type = 'image') = (mime_type LIKE 'image/%')),
  CONSTRAINT post_media_size_valid CHECK (size_bytes IS NULL OR (size_bytes > 0 AND size_bytes <= 52428800)),
  CONSTRAINT post_media_position_valid CHECK (position BETWEEN 0 AND 3),
  CONSTRAINT post_media_post_position_unique UNIQUE (post_id, position)
);
CREATE INDEX post_media_post_idx ON public.post_media (post_id);

CREATE TABLE public.post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT post_likes_unique UNIQUE (post_id, user_id)
);
CREATE INDEX post_likes_user_idx ON public.post_likes (user_id);

CREATE TABLE public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id uuid,
  content text NOT NULL,
  likes_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT post_comments_content_length CHECK (char_length(btrim(content)) BETWEEN 1 AND 1000),
  CONSTRAINT post_comments_likes_nonnegative CHECK (likes_count >= 0),
  CONSTRAINT post_comments_not_self_parent CHECK (parent_id IS NULL OR parent_id <> id),
  CONSTRAINT post_comments_id_post_unique UNIQUE (id, post_id),
  -- A reply must belong to the same post as its parent comment
  CONSTRAINT post_comments_parent_same_post FOREIGN KEY (parent_id, post_id)
    REFERENCES public.post_comments (id, post_id) ON DELETE CASCADE
);
CREATE INDEX post_comments_post_created_idx ON public.post_comments (post_id, created_at);
CREATE INDEX post_comments_parent_idx ON public.post_comments (parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX post_comments_author_idx ON public.post_comments (author_id);

CREATE TABLE public.post_comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT post_comment_likes_unique UNIQUE (comment_id, user_id)
);
CREATE INDEX post_comment_likes_user_idx ON public.post_comment_likes (user_id);

CREATE TABLE public.post_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT post_saves_unique UNIQUE (post_id, user_id)
);
CREATE INDEX post_saves_user_created_idx ON public.post_saves (user_id, created_at DESC);

-- ---------- Grants (new tables only; counters and ownership columns are not client-writable) ----------
REVOKE ALL ON public.posts, public.post_media, public.post_likes, public.post_comments,
  public.post_comment_likes, public.post_saves FROM anon, authenticated;

GRANT SELECT, DELETE ON public.posts TO authenticated;
GRANT INSERT (author_id, content, tags, mood, location, repost_of_id, repost_note) ON public.posts TO authenticated;
GRANT UPDATE (content, tags, mood, location, repost_note) ON public.posts TO authenticated;

GRANT SELECT, INSERT, DELETE ON public.post_media TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.post_likes TO authenticated;

GRANT SELECT, DELETE ON public.post_comments TO authenticated;
GRANT INSERT (post_id, author_id, parent_id, content) ON public.post_comments TO authenticated;
GRANT UPDATE (content) ON public.post_comments TO authenticated;

GRANT SELECT, INSERT, DELETE ON public.post_comment_likes TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.post_saves TO authenticated;

GRANT ALL ON public.posts, public.post_media, public.post_likes, public.post_comments,
  public.post_comment_likes, public.post_saves TO service_role;

-- ---------- Visibility helpers ----------
-- Posts follow the profile privacy setting: public accounts are visible to all
-- signed-in members; private accounts only to themselves and their followers.
CREATE OR REPLACE FUNCTION public.can_view_author_posts(_author_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    _author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _author_id AND NOT p.is_private)
    OR EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = auth.uid() AND f.following_id = _author_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.can_view_post(_post_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.posts p WHERE p.id = _post_id AND public.can_view_author_posts(p.author_id))
$$;

CREATE OR REPLACE FUNCTION public.owns_post_folder(_post_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id::text = _post_id AND p.author_id = auth.uid() AND p.repost_of_id IS NULL
  )
$$;

CREATE OR REPLACE FUNCTION public.can_view_post_media_object(_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.post_media m JOIN public.posts p ON p.id = m.post_id
    WHERE m.storage_path = _name AND public.can_view_author_posts(p.author_id)
  )
$$;

REVOKE EXECUTE ON FUNCTION public.can_view_author_posts(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_view_post(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.owns_post_folder(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_view_post_media_object(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_author_posts(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_post(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owns_post_folder(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_post_media_object(text) TO authenticated, service_role;

-- ---------- Integrity triggers ----------
-- Reposts always point at the root original and carry only an optional note.
CREATE OR REPLACE FUNCTION public.normalize_post()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _root uuid;
BEGIN
  IF NEW.repost_of_id IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      SELECT coalesce(p.repost_of_id, p.id) INTO _root FROM public.posts p WHERE p.id = NEW.repost_of_id;
      IF _root IS NULL THEN RAISE EXCEPTION 'Original post not found'; END IF;
      NEW.repost_of_id := _root;
    END IF;
    NEW.content := '';
    NEW.tags := '{}';
    NEW.mood := NULL;
    NEW.location := NULL;
    NEW.repost_note := nullif(btrim(coalesce(NEW.repost_note, '')), '');
  ELSE
    NEW.content := btrim(NEW.content);
    NEW.mood := nullif(btrim(coalesce(NEW.mood, '')), '');
    NEW.location := nullif(btrim(coalesce(NEW.location, '')), '');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER posts_normalize BEFORE INSERT OR UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.normalize_post();
CREATE TRIGGER posts_touch BEFORE UPDATE OF content, tags, mood, location, repost_note ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER post_comments_touch BEFORE UPDATE OF content ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- Counter triggers (counts are maintained only by the database) ----------
CREATE OR REPLACE FUNCTION public.update_post_like_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id; RETURN NEW;
  ELSE
    UPDATE public.posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id; RETURN OLD;
  END IF;
END $$;
CREATE TRIGGER post_like_counter AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_post_like_count();

CREATE OR REPLACE FUNCTION public.update_post_save_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET saves_count = saves_count + 1 WHERE id = NEW.post_id; RETURN NEW;
  ELSE
    UPDATE public.posts SET saves_count = GREATEST(saves_count - 1, 0) WHERE id = OLD.post_id; RETURN OLD;
  END IF;
END $$;
CREATE TRIGGER post_save_counter AFTER INSERT OR DELETE ON public.post_saves
  FOR EACH ROW EXECUTE FUNCTION public.update_post_save_count();

CREATE OR REPLACE FUNCTION public.update_post_comment_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id; RETURN NEW;
  ELSE
    UPDATE public.posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id; RETURN OLD;
  END IF;
END $$;
CREATE TRIGGER post_comment_counter AFTER INSERT OR DELETE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_post_comment_count();

CREATE OR REPLACE FUNCTION public.update_post_comment_like_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.post_comments SET likes_count = likes_count + 1 WHERE id = NEW.comment_id; RETURN NEW;
  ELSE
    UPDATE public.post_comments SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.comment_id; RETURN OLD;
  END IF;
END $$;
CREATE TRIGGER post_comment_like_counter AFTER INSERT OR DELETE ON public.post_comment_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_post_comment_like_count();

CREATE OR REPLACE FUNCTION public.update_post_repost_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.repost_of_id IS NOT NULL THEN
      UPDATE public.posts SET reposts_count = reposts_count + 1 WHERE id = NEW.repost_of_id;
    END IF;
    RETURN NEW;
  ELSE
    IF OLD.repost_of_id IS NOT NULL THEN
      UPDATE public.posts SET reposts_count = GREATEST(reposts_count - 1, 0) WHERE id = OLD.repost_of_id;
    END IF;
    RETURN OLD;
  END IF;
END $$;
CREATE TRIGGER post_repost_counter AFTER INSERT OR DELETE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.update_post_repost_count();

-- ---------- Row level security ----------
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_saves ENABLE ROW LEVEL SECURITY;

-- posts
CREATE POLICY "Members read visible posts" ON public.posts FOR SELECT TO authenticated
  USING (public.can_view_author_posts(author_id));
CREATE POLICY "Authors create own posts" ON public.posts FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND (repost_of_id IS NULL OR public.can_view_post(repost_of_id)));
CREATE POLICY "Authors edit own posts" ON public.posts FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY "Authors delete own posts" ON public.posts FOR DELETE TO authenticated
  USING (author_id = auth.uid());

-- post_media
CREATE POLICY "Members read media of visible posts" ON public.post_media FOR SELECT TO authenticated
  USING (public.can_view_post(post_id));
CREATE POLICY "Authors attach media to own posts" ON public.post_media FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND public.owns_post_folder(post_id::text)
    AND storage_path LIKE auth.uid()::text || '/' || post_id::text || '/%'
  );
CREATE POLICY "Authors remove own media" ON public.post_media FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- post_likes
CREATE POLICY "Users read own post likes" ON public.post_likes FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users like visible posts as themselves" ON public.post_likes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_view_post(post_id));
CREATE POLICY "Users remove own post likes" ON public.post_likes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- post_comments
CREATE POLICY "Members read comments on visible posts" ON public.post_comments FOR SELECT TO authenticated
  USING (public.can_view_post(post_id));
CREATE POLICY "Users comment as themselves on visible posts" ON public.post_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.can_view_post(post_id));
CREATE POLICY "Authors edit own comments" ON public.post_comments FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY "Authors delete own comments" ON public.post_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid());

-- post_comment_likes
CREATE POLICY "Users read own comment likes" ON public.post_comment_likes FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users like visible comments as themselves" ON public.post_comment_likes FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.post_comments c WHERE c.id = comment_id AND public.can_view_post(c.post_id))
  );
CREATE POLICY "Users remove own comment likes" ON public.post_comment_likes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- post_saves (private bookmarks)
CREATE POLICY "Users read own saves" ON public.post_saves FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users save visible posts for themselves" ON public.post_saves FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_view_post(post_id));
CREATE POLICY "Users remove own saves" ON public.post_saves FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ---------- Storage: private post-media bucket ----------
CREATE POLICY "Post media: read own or visible" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'post-media'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.can_view_post_media_object(name))
  );
CREATE POLICY "Post media: upload to own post folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'post-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.owns_post_folder((storage.foldername(name))[2])
    AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp','gif','mp4','webm','mov')
  );
CREATE POLICY "Post media: delete own files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'post-media' AND (storage.foldername(name))[1] = auth.uid()::text);
