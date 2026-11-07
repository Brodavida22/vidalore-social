CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text CHECK (char_length(display_name) <= 50),
  bio text CHECK (char_length(bio) <= 300),
  location text CHECK (char_length(location) <= 80),
  avatar_url text,
  cover_url text,
  points_balance integer NOT NULL DEFAULT 0,
  is_private boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (display_name, bio, location, avatar_url, cover_url, is_private) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner updates own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.private_profiles (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  email text,
  date_of_birth date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.private_profiles TO authenticated;
GRANT UPDATE (date_of_birth) ON public.private_profiles TO authenticated;
GRANT ALL ON public.private_profiles TO service_role;
ALTER TABLE public.private_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads private profile" ON public.private_profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Owner updates private profile" ON public.private_profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.reward_settings (
  reason text PRIMARY KEY CHECK (reason ~ '^[a-z_]{2,40}$'),
  amount integer NOT NULL CHECK (amount BETWEEN 0 AND 10000),
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reward_settings TO authenticated;
GRANT ALL ON public.reward_settings TO service_role;
ALTER TABLE public.reward_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read rewards" ON public.reward_settings FOR SELECT TO authenticated USING (true);
INSERT INTO public.reward_settings (reason, amount, label) VALUES
  ('signup', 100, 'Welcome to the Rose Garden'),
  ('profile_complete', 50, 'Profile completed');

CREATE TABLE public.points_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  reason text NOT NULL,
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX points_one_time_rewards ON public.points_transactions (user_id, reason) WHERE reason IN ('signup','profile_complete');
CREATE INDEX points_tx_user_created ON public.points_transactions (user_id, created_at DESC);
GRANT SELECT ON public.points_transactions TO authenticated;
GRANT ALL ON public.points_transactions TO service_role;
ALTER TABLE public.points_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own points history" ON public.points_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  icon text,
  points integer NOT NULL DEFAULT 0 CHECK (points BETWEEN 0 AND 10000),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.achievements TO authenticated;
GRANT ALL ON public.achievements TO service_role;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read achievements" ON public.achievements FOR SELECT TO authenticated USING (true);
INSERT INTO public.achievements (code, name, description, icon, points) VALUES
  ('first_bloom', 'First Bloom', 'Joined VIDALORE SOCIAL', 'sprout', 0),
  ('full_bloom', 'Full Bloom', 'Completed your profile', 'flower', 0);

CREATE TABLE public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, achievement_id)
);
GRANT SELECT ON public.user_achievements TO authenticated;
GRANT ALL ON public.user_achievements TO service_role;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read achievements earned" ON public.user_achievements FOR SELECT TO authenticated USING (true);

CREATE TABLE public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_audit_logs TO authenticated;
GRANT ALL ON public.admin_audit_logs TO service_role;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit logs" ON public.admin_audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- updated_at helper
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER private_profiles_touch BEFORE UPDATE ON public.private_profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- trusted points award (not callable by clients)
CREATE OR REPLACE FUNCTION public.award_points(_user_id uuid, _reason text, _reference text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _amount integer; _rows integer;
BEGIN
  SELECT amount INTO _amount FROM public.reward_settings WHERE reason = _reason AND is_active;
  IF _amount IS NULL OR _amount = 0 THEN RETURN 0; END IF;
  INSERT INTO public.points_transactions (user_id, amount, reason, reference)
  VALUES (_user_id, _amount, _reason, _reference)
  ON CONFLICT (user_id, reason) WHERE reason IN ('signup','profile_complete') DO NOTHING;
  GET DIAGNOSTICS _rows = ROW_COUNT;
  IF _rows = 0 THEN RETURN 0; END IF;
  UPDATE public.profiles SET points_balance = points_balance + _amount WHERE id = _user_id;
  RETURN _amount;
END $$;
REVOKE ALL ON FUNCTION public.award_points(uuid, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.grant_achievement(_user_id uuid, _code text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.user_achievements (user_id, achievement_id)
  SELECT _user_id, id FROM public.achievements WHERE code = _code AND is_active
  ON CONFLICT DO NOTHING
$$;
REVOKE ALL ON FUNCTION public.grant_achievement(uuid, text) FROM PUBLIC, anon, authenticated;

-- username availability (true/false only)
CREATE OR REPLACE FUNCTION public.is_username_available(_username text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT lower(_username) ~ '^[a-z0-9_]{3,20}$'
     AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE username = lower(_username))
$$;
GRANT EXECUTE ON FUNCTION public.is_username_available(text) TO anon, authenticated;

-- signup handler
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _username text;
BEGIN
  _username := lower(coalesce(NEW.raw_user_meta_data->>'username', ''));
  IF _username !~ '^[a-z0-9_]{3,20}$' OR EXISTS (SELECT 1 FROM public.profiles WHERE username = _username) THEN
    _username := 'rose_' || substr(replace(NEW.id::text, '-', ''), 1, 10);
  END IF;
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (NEW.id, _username, nullif(left(NEW.raw_user_meta_data->>'display_name', 50), ''));
  INSERT INTO public.private_profiles (id, email) VALUES (NEW.id, NEW.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  PERFORM public.award_points(NEW.id, 'signup');
  PERFORM public.grant_achievement(NEW.id, 'first_bloom');
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- profile completion reward
CREATE OR REPLACE FUNCTION public.check_profile_complete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(NEW.avatar_url,'') <> '' AND coalesce(trim(NEW.display_name),'') <> '' AND coalesce(trim(NEW.bio),'') <> '' THEN
    PERFORM public.award_points(NEW.id, 'profile_complete');
    PERFORM public.grant_achievement(NEW.id, 'full_bloom');
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER profiles_complete_check AFTER UPDATE OF avatar_url, display_name, bio ON public.profiles
FOR EACH ROW WHEN (pg_trigger_depth() < 1) EXECUTE FUNCTION public.check_profile_complete();

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_profile_complete() FROM PUBLIC, anon, authenticated;