// Complete idempotent PostgreSQL migration for VIDALORE SOCIAL
// Games Center & Role-Based Admin Dashboard.
// Note: Execute in Supabase / Lovable Cloud SQL Editor to provision all extended tables & RPCs.

export const GAMES_AND_ADMIN_MIGRATION_SQL = `-- ============================================================================
-- VIDALORE SOCIAL: ADVANCED GAMES CENTER & ROLE-BASED ADMIN DASHBOARD
-- Idempotent, additive, RLS-hardened PostgreSQL migration
-- ============================================================================

BEGIN;

-- 1. EXTEND app_role ENUM WITH super_admin (must run outside transaction if PG < 12; PG 15+ supports inside)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.app_role'::regtype
      AND enumlabel = 'super_admin'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'super_admin';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. ROLE HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_any_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text IN ('super_admin', 'admin', 'moderator')
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_admin_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (
      SELECT role::text
      FROM public.user_roles
      WHERE user_id = auth.uid()
      ORDER BY CASE role::text
        WHEN 'super_admin' THEN 1
        WHEN 'admin' THEN 2
        WHEN 'moderator' THEN 3
        ELSE 4
      END
      LIMIT 1
    ),
    'user'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_any_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_admin_role() TO authenticated;

-- Update user_roles & admin_audit_logs & content_reports policies to support super_admin & moderator
DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
CREATE POLICY "Users read own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_any_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins read audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins read audit logs"
  ON public.admin_audit_logs FOR SELECT TO authenticated
  USING (public.is_any_admin(auth.uid()));

DROP POLICY IF EXISTS "Users read own reports or admins read all" ON public.content_reports;
CREATE POLICY "Users read own reports or admins read all"
  ON public.content_reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.is_any_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins update reports" ON public.content_reports;
CREATE POLICY "Admins update reports"
  ON public.content_reports FOR UPDATE TO authenticated
  USING (public.is_any_admin(auth.uid()))
  WITH CHECK (public.is_any_admin(auth.uid()));

ALTER TABLE public.content_reports DROP CONSTRAINT IF EXISTS content_reports_target_type_valid;
ALTER TABLE public.content_reports
  ADD CONSTRAINT content_reports_target_type_valid
  CHECK (target_type IN ('post', 'comment', 'profile', 'reel', 'meme'));

-- 3. USER GOVERNANCE TABLE (suspend / ban / verified status)
CREATE TABLE IF NOT EXISTS public.user_governance (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  account_status text NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'banned')),
  is_verified boolean NOT NULL DEFAULT false,
  reason text,
  suspended_until timestamptz,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_governance TO authenticated;
GRANT ALL ON public.user_governance TO service_role;
ALTER TABLE public.user_governance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read governance badges" ON public.user_governance;
CREATE POLICY "Authenticated users read governance badges"
  ON public.user_governance FOR SELECT TO authenticated
  USING (true);

-- 4. GAMES CATALOG & QUESTIONS & ROOMS & SESSIONS
CREATE TABLE IF NOT EXISTS public.games_catalog (
  slug text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  xp_reward integer NOT NULL DEFAULT 50 CHECK (xp_reward BETWEEN 0 AND 2000),
  points_reward integer NOT NULL DEFAULT 15 CHECK (points_reward BETWEEN 0 AND 500),
  min_players integer NOT NULL DEFAULT 1,
  max_players integer NOT NULL DEFAULT 8,
  play_count integer NOT NULL DEFAULT 0,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.games_catalog TO authenticated;
GRANT ALL ON public.games_catalog TO service_role;
ALTER TABLE public.games_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read games catalog" ON public.games_catalog;
CREATE POLICY "Authenticated users read games catalog"
  ON public.games_catalog FOR SELECT TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS public.game_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_slug text NOT NULL REFERENCES public.games_catalog(slug) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'General',
  difficulty text NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  prompt text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answer text,
  hint text,
  clue_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS game_questions_slug_idx ON public.game_questions (game_slug, is_active);
GRANT SELECT ON public.game_questions TO authenticated;
GRANT ALL ON public.game_questions TO service_role;
ALTER TABLE public.game_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read active questions" ON public.game_questions;
CREATE POLICY "Authenticated users read active questions"
  ON public.game_questions FOR SELECT TO authenticated
  USING (is_active = true OR public.is_any_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.game_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code text NOT NULL UNIQUE,
  game_slug text NOT NULL REFERENCES public.games_catalog(slug) ON DELETE CASCADE,
  host_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'finished')),
  current_round integer NOT NULL DEFAULT 1,
  total_rounds integer NOT NULL DEFAULT 5,
  round_ends_at timestamptz,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  winner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS game_rooms_status_idx ON public.game_rooms (status, visibility, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.game_rooms TO authenticated;
GRANT ALL ON public.game_rooms TO service_role;
ALTER TABLE public.game_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view public or joined rooms" ON public.game_rooms;
CREATE POLICY "Users view public or joined rooms"
  ON public.game_rooms FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users create own rooms" ON public.game_rooms;
CREATE POLICY "Users create own rooms"
  ON public.game_rooms FOR INSERT TO authenticated
  WITH CHECK (host_id = auth.uid());

DROP POLICY IF EXISTS "Host or players update active room" ON public.game_rooms;
CREATE POLICY "Host or players update active room"
  ON public.game_rooms FOR UPDATE TO authenticated
  USING (
    host_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.game_room_players p
      WHERE p.room_id = id AND p.user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS public.game_room_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.game_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0,
  is_ready boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'left')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_room_players TO authenticated;
GRANT ALL ON public.game_room_players TO service_role;
ALTER TABLE public.game_room_players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read room players" ON public.game_room_players;
CREATE POLICY "Authenticated users read room players"
  ON public.game_room_players FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users join rooms as self" ON public.game_room_players;
CREATE POLICY "Users join rooms as self"
  ON public.game_room_players FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own player row" ON public.game_room_players;
CREATE POLICY "Users update own player row"
  ON public.game_room_players FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users leave room" ON public.game_room_players;
CREATE POLICY "Users leave room"
  ON public.game_room_players FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.game_rooms(id) ON DELETE SET NULL,
  game_slug text NOT NULL REFERENCES public.games_catalog(slug) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'solo' CHECK (mode IN ('solo', 'ai', 'multiplayer')),
  result text NOT NULL DEFAULT 'completed' CHECK (result IN ('win', 'loss', 'draw', 'completed')),
  score integer NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100000),
  xp_earned integer NOT NULL DEFAULT 0,
  points_earned integer NOT NULL DEFAULT 0,
  duration_seconds integer NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS game_sessions_user_idx ON public.game_sessions (user_id, created_at DESC);
GRANT SELECT ON public.game_sessions TO authenticated;
GRANT ALL ON public.game_sessions TO service_role;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read game sessions" ON public.game_sessions;
CREATE POLICY "Authenticated users read game sessions"
  ON public.game_sessions FOR SELECT TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS public.user_game_stats (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  xp integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  total_points_earned integer NOT NULL DEFAULT 0,
  games_played integer NOT NULL DEFAULT 0,
  games_won integer NOT NULL DEFAULT 0,
  current_streak integer NOT NULL DEFAULT 0,
  best_streak integer NOT NULL DEFAULT 0,
  last_played_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_game_stats TO authenticated;
GRANT ALL ON public.user_game_stats TO service_role;
ALTER TABLE public.user_game_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read leaderboard stats" ON public.user_game_stats;
CREATE POLICY "Authenticated users read leaderboard stats"
  ON public.user_game_stats FOR SELECT TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS public.meme_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.game_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  template_id text NOT NULL,
  top_text text NOT NULL DEFAULT '',
  bottom_text text NOT NULL DEFAULT '',
  image_url text,
  votes_count integer NOT NULL DEFAULT 0,
  is_removed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.meme_submissions TO authenticated;
GRANT ALL ON public.meme_submissions TO service_role;
ALTER TABLE public.meme_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users view active memes" ON public.meme_submissions;
CREATE POLICY "Authenticated users view active memes"
  ON public.meme_submissions FOR SELECT TO authenticated
  USING (is_removed = false OR public.is_any_admin(auth.uid()));

DROP POLICY IF EXISTS "Users submit own memes" ON public.meme_submissions;
CREATE POLICY "Users submit own memes"
  ON public.meme_submissions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.meme_votes (
  submission_id uuid NOT NULL REFERENCES public.meme_submissions(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (submission_id, voter_id)
);

GRANT SELECT, INSERT, DELETE ON public.meme_votes TO authenticated;
GRANT ALL ON public.meme_votes TO service_role;
ALTER TABLE public.meme_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users view meme votes" ON public.meme_votes;
CREATE POLICY "Authenticated users view meme votes"
  ON public.meme_votes FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users vote on others memes" ON public.meme_votes;
CREATE POLICY "Users vote on others memes"
  ON public.meme_votes FOR INSERT TO authenticated
  WITH CHECK (voter_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.daily_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_date date NOT NULL DEFAULT CURRENT_DATE,
  game_slug text NOT NULL REFERENCES public.games_catalog(slug) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  target_score integer NOT NULL DEFAULT 100,
  reward_xp integer NOT NULL DEFAULT 80,
  reward_points integer NOT NULL DEFAULT 25,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.daily_challenges TO authenticated;
GRANT ALL ON public.daily_challenges TO service_role;
ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users view daily challenges" ON public.daily_challenges;
CREATE POLICY "Authenticated users view daily challenges"
  ON public.daily_challenges FOR SELECT TO authenticated
  USING (is_active = true OR public.is_any_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.user_daily_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES public.daily_challenges(id) ON DELETE CASCADE,
  progress integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  reward_claimed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  UNIQUE (user_id, challenge_id)
);

GRANT SELECT ON public.user_daily_challenges TO authenticated;
GRANT ALL ON public.user_daily_challenges TO service_role;
ALTER TABLE public.user_daily_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own daily challenge progress" ON public.user_daily_challenges;
CREATE POLICY "Users view own daily challenge progress"
  ON public.user_daily_challenges FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 5. SEED GAMES CATALOG, REWARD SETTINGS & ACHIEVEMENTS
INSERT INTO public.games_catalog (slug, title, description, category, is_enabled, is_featured, xp_reward, points_reward, min_players, max_players) VALUES
  ('quiz-battle', 'Quiz Battle', 'Timed multi-round trivia showdown with speed bonuses.', 'Trivia', true, true, 60, 20, 1, 8),
  ('truth-or-dare', 'Truth or Dare', 'Multiplayer party prompts with turn rotation and crowd scoring.', 'Party', true, true, 40, 10, 2, 10),
  ('would-you-rather', 'Would You Rather', 'Two tough choices. Vote live and compare room consensus.', 'Party', true, false, 35, 10, 1, 12),
  ('word-challenge', 'Word Challenge', 'Word scramble, spelling sprints, and 5-letter word puzzles.', 'Word & Puzzle', true, true, 55, 15, 1, 6),
  ('emoji-challenge', 'Emoji Challenge', 'Decode movies, phrases, and pop culture from emoji clues.', 'Trivia', true, false, 50, 15, 1, 8),
  ('tic-tac-toe', 'Tic-Tac-Toe', 'Classic strategy vs smart AI bot or real-time friend duel.', 'Strategy', true, false, 45, 15, 1, 2),
  ('rock-paper-scissors', 'Rock Paper Scissors', 'Simultaneous Best-of-5 showdown against friends or CPU.', 'Strategy', true, false, 40, 12, 1, 2),
  ('meme-challenge', 'Meme Challenge', 'Craft punchlines on templates and vote for the funniest drop.', 'Creative', true, true, 65, 20, 1, 12),
  ('music-guessing', 'Music Guessing', 'Guess hit tracks from lyric snippets, rhythm clues & hints.', 'Trivia', true, false, 55, 15, 1, 8),
  ('daily-challenges', 'Daily Challenges', 'Complete daily missions to unlock streak XP and bonus points.', 'Daily', true, true, 80, 25, 1, 1)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.reward_settings (reason, amount, label, is_active) VALUES
  ('game_play', 10, 'Completed a game session', true),
  ('game_win', 20, 'Won a game match', true),
  ('daily_challenge', 25, 'Completed a Daily Challenge', true)
ON CONFLICT (reason) DO NOTHING;

INSERT INTO public.achievements (code, name, description, icon, points, is_active) VALUES
  ('first_game_win', 'First Victory', 'Won your first match in the Games Center', 'trophy', 25, true),
  ('quiz_master', 'Quiz Master', 'Scored 400+ points in Quiz Battle', 'brain', 40, true),
  ('streak_5', 'Unstoppable Streak', 'Reached a 5-game win streak', 'flame', 50, true),
  ('meme_lord', 'Comedy Gold', 'Submitted a meme in Meme Challenge', 'laugh', 20, true)
ON CONFLICT (code) DO NOTHING;

-- 6. SERVER-AUTHORITATIVE GAME RPCs (ANTI-CHEAT VALIDATED)
CREATE OR REPLACE FUNCTION public.submit_game_session(
  p_game_slug text,
  p_mode text,
  p_result text,
  p_raw_score integer,
  p_duration_seconds integer DEFAULT 30,
  p_room_id uuid DEFAULT NULL,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_game public.games_catalog%ROWTYPE;
  v_safe_score integer;
  v_xp integer;
  v_points integer := 0;
  v_won boolean := (p_result = 'win');
  v_new_xp integer;
  v_new_level integer;
  v_new_streak integer;
  v_recent_count integer;
  v_session_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_game FROM public.games_catalog WHERE slug = p_game_slug;
  IF NOT FOUND OR NOT v_game.is_enabled THEN
    RAISE EXCEPTION 'This game is currently unavailable';
  END IF;

  -- Rate-limit anti-cheat: max 12 rewarded submissions per 10 minutes
  SELECT count(*) INTO v_recent_count
  FROM public.game_sessions
  WHERE user_id = v_uid AND created_at > now() - interval '10 minutes';

  IF v_recent_count >= 12 THEN
    RAISE EXCEPTION 'Too many rapid game submissions. Please take a short breather.';
  END IF;

  -- Clamp score & duration to plausible server bounds
  v_safe_score := LEAST(GREATEST(COALESCE(p_raw_score, 0), 0), 5000);
  v_xp := v_game.xp_reward;
  IF v_won THEN
    v_xp := v_xp + LEAST(ROUND(v_safe_score * 0.05)::integer, 50);
  ELSIF p_result = 'loss' THEN
    v_xp := GREATEST(ROUND(v_xp * 0.45)::integer, 10);
  END IF;

  INSERT INTO public.game_sessions (
    room_id, game_slug, user_id, mode, result, score, xp_earned, points_earned, duration_seconds, details
  ) VALUES (
    p_room_id, p_game_slug, v_uid, p_mode, p_result, v_safe_score, v_xp, 0, GREATEST(COALESCE(p_duration_seconds, 1), 1), COALESCE(p_details, '{}'::jsonb)
  ) RETURNING id INTO v_session_id;

  -- Award VIDA points cleanly
  IF v_won THEN
    v_points := public.award_points(v_uid, 'game_win', v_session_id::text);
  ELSE
    v_points := public.award_points(v_uid, 'game_play', v_session_id::text);
  END IF;

  UPDATE public.game_sessions SET points_earned = v_points WHERE id = v_session_id;
  UPDATE public.games_catalog SET play_count = play_count + 1 WHERE slug = p_game_slug;

  -- Update user_game_stats
  INSERT INTO public.user_game_stats (user_id, xp, level, total_points_earned, games_played, games_won, current_streak, best_streak, last_played_at)
  VALUES (
    v_uid,
    v_xp,
    GREATEST(1, FLOOR(SQRT(v_xp / 100.0))::integer + 1),
    v_points,
    1,
    CASE WHEN v_won THEN 1 ELSE 0 END,
    CASE WHEN v_won THEN 1 ELSE 0 END,
    CASE WHEN v_won THEN 1 ELSE 0 END,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    xp = public.user_game_stats.xp + v_xp,
    level = GREATEST(1, FLOOR(SQRT((public.user_game_stats.xp + v_xp) / 100.0))::integer + 1),
    total_points_earned = public.user_game_stats.total_points_earned + v_points,
    games_played = public.user_game_stats.games_played + 1,
    games_won = public.user_game_stats.games_won + CASE WHEN v_won THEN 1 ELSE 0 END,
    current_streak = CASE WHEN v_won THEN public.user_game_stats.current_streak + 1 ELSE 0 END,
    best_streak = GREATEST(
      public.user_game_stats.best_streak,
      CASE WHEN v_won THEN public.user_game_stats.current_streak + 1 ELSE public.user_game_stats.best_streak END
    ),
    last_played_at = now(),
    updated_at = now()
  RETURNING xp, level, current_streak INTO v_new_xp, v_new_level, v_new_streak;

  IF v_won THEN
    PERFORM public.grant_achievement(v_uid, 'first_game_win');
  END IF;
  IF p_game_slug = 'quiz-battle' AND v_safe_score >= 400 THEN
    PERFORM public.grant_achievement(v_uid, 'quiz_master');
  END IF;
  IF v_new_streak >= 5 THEN
    PERFORM public.grant_achievement(v_uid, 'streak_5');
  END IF;

  RETURN jsonb_build_object(
    'session_id', v_session_id,
    'xp_earned', v_xp,
    'points_earned', v_points,
    'total_xp', v_new_xp,
    'level', v_new_level,
    'current_streak', v_new_streak
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_game_session(text, text, text, integer, integer, uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.vote_meme_submission(p_submission_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_new_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT user_id INTO v_owner FROM public.meme_submissions WHERE id = p_submission_id AND is_removed = false;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Meme submission not found';
  END IF;
  IF v_owner = v_uid THEN
    RAISE EXCEPTION 'You cannot vote for your own meme';
  END IF;

  INSERT INTO public.meme_votes (submission_id, voter_id)
  VALUES (p_submission_id, v_uid)
  ON CONFLICT DO NOTHING;

  UPDATE public.meme_submissions
  SET votes_count = (SELECT count(*) FROM public.meme_votes WHERE submission_id = p_submission_id)
  WHERE id = p_submission_id
  RETURNING votes_count INTO v_new_count;

  RETURN v_new_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.vote_meme_submission(uuid) TO authenticated;

-- 7. ADMIN SECURITY RPCs (RBAC ENFORCED + AUDIT LOGGED)
CREATE OR REPLACE FUNCTION public.admin_set_user_governance(
  p_target_user_id uuid,
  p_account_status text,
  p_is_verified boolean,
  p_reason text DEFAULT NULL,
  p_suspended_until timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_role text := public.get_my_admin_role();
BEGIN
  IF v_actor_role NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Admin or Super Admin privileges required';
  END IF;
  IF p_target_user_id = v_actor AND p_account_status <> 'active' THEN
    RAISE EXCEPTION 'You cannot suspend or ban your own account';
  END IF;
  IF public.is_super_admin(p_target_user_id) AND v_actor_role <> 'super_admin' THEN
    RAISE EXCEPTION 'Only a Super Admin can modify another Super Admin';
  END IF;

  INSERT INTO public.user_governance (user_id, account_status, is_verified, reason, suspended_until, updated_by, updated_at)
  VALUES (p_target_user_id, p_account_status, p_is_verified, p_reason, p_suspended_until, v_actor, now())
  ON CONFLICT (user_id) DO UPDATE SET
    account_status = EXCLUDED.account_status,
    is_verified = EXCLUDED.is_verified,
    reason = EXCLUDED.reason,
    suspended_until = EXCLUDED.suspended_until,
    updated_by = v_actor,
    updated_at = now();

  INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id, details)
  VALUES (
    v_actor,
    'user_governance_updated',
    'profile',
    p_target_user_id::text,
    jsonb_build_object('account_status', p_account_status, 'is_verified', p_is_verified, 'reason', p_reason)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_user_governance(uuid, text, boolean, text, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  p_target_user_id uuid,
  p_new_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF NOT public.is_super_admin(v_actor) THEN
    RAISE EXCEPTION 'Super Admin privileges required to manage roles';
  END IF;
  IF p_target_user_id = v_actor THEN
    RAISE EXCEPTION 'You cannot modify your own role';
  END IF;
  IF p_new_role NOT IN ('super_admin', 'admin', 'moderator', 'user') THEN
    RAISE EXCEPTION 'Invalid role specified';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = p_target_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (p_target_user_id, p_new_role::public.app_role);

  INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id, details)
  VALUES (v_actor, 'user_role_updated', 'profile', p_target_user_id::text, jsonb_build_object('new_role', p_new_role));
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_content(
  p_target_type text,
  p_target_id uuid,
  p_reason text DEFAULT 'Violation of community guidelines'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF NOT public.is_any_admin(v_actor) THEN
    RAISE EXCEPTION 'Moderator or Admin privileges required';
  END IF;

  IF p_target_type = 'post' THEN
    DELETE FROM public.posts WHERE id = p_target_id;
  ELSIF p_target_type = 'reel' THEN
    DELETE FROM public.reels WHERE id = p_target_id;
  ELSIF p_target_type = 'post_comment' THEN
    DELETE FROM public.post_comments WHERE id = p_target_id;
  ELSIF p_target_type = 'reel_comment' THEN
    DELETE FROM public.reel_comments WHERE id = p_target_id;
  ELSIF p_target_type = 'meme' THEN
    UPDATE public.meme_submissions SET is_removed = true WHERE id = p_target_id;
  ELSE
    RAISE EXCEPTION 'Unsupported target content type: %', p_target_type;
  END IF;

  INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id, details)
  VALUES (v_actor, 'content_removed', p_target_type, p_target_id::text, jsonb_build_object('reason', p_reason));
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_content(text, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_upsert_game_config(
  p_slug text,
  p_is_enabled boolean,
  p_is_featured boolean,
  p_category text,
  p_xp_reward integer,
  p_points_reward integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text := public.get_my_admin_role();
BEGIN
  IF v_role NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  UPDATE public.games_catalog
  SET
    is_enabled = p_is_enabled,
    is_featured = p_is_featured,
    category = p_category,
    xp_reward = LEAST(GREATEST(p_xp_reward, 0), 2000),
    points_reward = LEAST(GREATEST(p_points_reward, 0), 500),
    updated_at = now()
  WHERE slug = p_slug;

  INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id, details)
  VALUES (v_actor, 'game_config_updated', 'game', p_slug, jsonb_build_object('is_enabled', p_is_enabled, 'xp_reward', p_xp_reward, 'points_reward', p_points_reward));
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_upsert_game_config(text, boolean, boolean, text, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_upsert_game_question(
  p_id uuid,
  p_game_slug text,
  p_category text,
  p_difficulty text,
  p_prompt text,
  p_options jsonb,
  p_correct_answer text,
  p_hint text,
  p_is_active boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text := public.get_my_admin_role();
  v_id uuid;
BEGIN
  IF v_role NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.game_questions (game_slug, category, difficulty, prompt, options, correct_answer, hint, is_active, created_by)
    VALUES (p_game_slug, p_category, p_difficulty, p_prompt, p_options, p_correct_answer, p_hint, p_is_active, v_actor)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.game_questions
    SET game_slug = p_game_slug, category = p_category, difficulty = p_difficulty, prompt = p_prompt, options = p_options, correct_answer = p_correct_answer, hint = p_hint, is_active = p_is_active
    WHERE id = p_id
    RETURNING id INTO v_id;
  END IF;

  INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id, details)
  VALUES (v_actor, 'game_question_saved', 'game_question', v_id::text, jsonb_build_object('game_slug', p_game_slug));

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_upsert_game_question(uuid, text, text, text, text, jsonb, text, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_game_question(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text := public.get_my_admin_role();
BEGIN
  IF v_role NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;
  DELETE FROM public.game_questions WHERE id = p_id;
  INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id)
  VALUES (v_actor, 'game_question_deleted', 'game_question', p_id::text);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_game_question(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_reward_setting(
  p_reason text,
  p_amount integer,
  p_label text,
  p_is_active boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text := public.get_my_admin_role();
BEGIN
  IF v_role NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  UPDATE public.reward_settings
  SET amount = LEAST(GREATEST(p_amount, 0), 10000), label = p_label, is_active = p_is_active, updated_at = now()
  WHERE reason = p_reason;

  INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id, details)
  VALUES (v_actor, 'reward_setting_updated', 'reward_setting', p_reason, jsonb_build_object('amount', p_amount, 'is_active', p_is_active));
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_reward_setting(text, integer, text, boolean) TO authenticated;

COMMIT;
`;
