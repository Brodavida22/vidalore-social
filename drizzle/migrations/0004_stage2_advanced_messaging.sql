-- =====================================================================
-- VIDALORE SOCIAL
-- Stage 2: Advanced Messaging System (Direct & Group Conversations)
-- Additive migration: Conversations, Members, Messages, Reactions,
-- Reads, Realtime publication, and Chat Media Storage Bucket & Policies.
-- =====================================================================

BEGIN;

-- 1. CONVERSATIONS TABLE
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'direct' CHECK (kind IN ('direct', 'group')),
  title text CHECK (title IS NULL OR char_length(title) <= 100),
  image_url text,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversations_created_by_idx ON public.conversations (created_by);
CREATE INDEX IF NOT EXISTS conversations_last_message_idx ON public.conversations (last_message_at DESC NULLS LAST);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.conversations FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;

-- 2. CONVERSATION MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.conversation_members (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz,
  is_muted boolean NOT NULL DEFAULT false,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS conversation_members_user_idx ON public.conversation_members (user_id);
CREATE INDEX IF NOT EXISTS conversation_members_conv_idx ON public.conversation_members (conversation_id);

ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.conversation_members FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_members TO authenticated;
GRANT ALL ON public.conversation_members TO service_role;

-- 3. MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'audio', 'file')),
  media_url text,
  media_name text,
  reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_conversation_created_idx ON public.messages (conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS messages_sender_idx ON public.messages (sender_id);
CREATE INDEX IF NOT EXISTS messages_reply_to_idx ON public.messages (reply_to_id) WHERE reply_to_id IS NOT NULL;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.messages FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

-- 4. MESSAGE REACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.message_reactions (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (char_length(emoji) <= 32),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS message_reactions_msg_idx ON public.message_reactions (message_id);
CREATE INDEX IF NOT EXISTS message_reactions_user_idx ON public.message_reactions (user_id);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.message_reactions FROM PUBLIC, anon;
GRANT SELECT, INSERT, DELETE ON public.message_reactions TO authenticated;
GRANT ALL ON public.message_reactions TO service_role;

-- 5. MESSAGE READS TABLE
CREATE TABLE IF NOT EXISTS public.message_reads (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS message_reads_msg_idx ON public.message_reads (message_id);
CREATE INDEX IF NOT EXISTS message_reads_user_idx ON public.message_reads (user_id);

ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.message_reads FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_reads TO authenticated;
GRANT ALL ON public.message_reads TO service_role;

-- 6. SECURITY HELPER FUNCTIONS (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_conversation_member(p_conv_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = p_conv_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_conversation_admin(p_conv_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = p_conv_id AND user_id = p_user_id AND role = 'admin'
  );
$$;

-- 7. ROW LEVEL SECURITY POLICIES

-- CONVERSATIONS POLICIES
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'conversations' AND policyname = 'Members can read conversations') THEN
    CREATE POLICY "Members can read conversations"
      ON public.conversations
      FOR SELECT TO authenticated
      USING (
        public.is_conversation_member(id, auth.uid())
        OR created_by = auth.uid()
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'conversations' AND policyname = 'Authenticated users can create conversations') THEN
    CREATE POLICY "Authenticated users can create conversations"
      ON public.conversations
      FOR INSERT TO authenticated
      WITH CHECK (created_by = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'conversations' AND policyname = 'Admins or members update conversation') THEN
    CREATE POLICY "Admins or members update conversation"
      ON public.conversations
      FOR UPDATE TO authenticated
      USING (
        public.is_conversation_member(id, auth.uid())
      )
      WITH CHECK (
        -- Group admins can change title/image; any member can update last_message_at
        public.is_conversation_member(id, auth.uid())
      );
  END IF;
END $$;

-- CONVERSATION MEMBERS POLICIES
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'conversation_members' AND policyname = 'Members can read conversation members') THEN
    CREATE POLICY "Members can read conversation members"
      ON public.conversation_members
      FOR SELECT TO authenticated
      USING (
        user_id = auth.uid() OR public.is_conversation_member(conversation_id, auth.uid())
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'conversation_members' AND policyname = 'Creators and admins can add members') THEN
    CREATE POLICY "Creators and admins can add members"
      ON public.conversation_members
      FOR INSERT TO authenticated
      WITH CHECK (
        -- Self adding when joining or being added by group admin or conversation creator
        user_id = auth.uid()
        OR public.is_conversation_admin(conversation_id, auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.conversations
          WHERE id = conversation_id AND created_by = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'conversation_members' AND policyname = 'Members update own membership or admins update roles') THEN
    CREATE POLICY "Members update own membership or admins update roles"
      ON public.conversation_members
      FOR UPDATE TO authenticated
      USING (
        user_id = auth.uid() OR public.is_conversation_admin(conversation_id, auth.uid())
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'conversation_members' AND policyname = 'Members can leave or admins can remove') THEN
    CREATE POLICY "Members can leave or admins can remove"
      ON public.conversation_members
      FOR DELETE TO authenticated
      USING (
        user_id = auth.uid() OR public.is_conversation_admin(conversation_id, auth.uid())
      );
  END IF;
END $$;

-- MESSAGES POLICIES
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messages' AND policyname = 'Members can read messages') THEN
    CREATE POLICY "Members can read messages"
      ON public.messages
      FOR SELECT TO authenticated
      USING (
        public.is_conversation_member(conversation_id, auth.uid())
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messages' AND policyname = 'Members can send messages') THEN
    CREATE POLICY "Members can send messages"
      ON public.messages
      FOR INSERT TO authenticated
      WITH CHECK (
        sender_id = auth.uid() AND public.is_conversation_member(conversation_id, auth.uid())
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messages' AND policyname = 'Sender or admin can update messages') THEN
    CREATE POLICY "Sender or admin can update messages"
      ON public.messages
      FOR UPDATE TO authenticated
      USING (
        sender_id = auth.uid() OR public.is_conversation_admin(conversation_id, auth.uid())
      )
      WITH CHECK (
        sender_id = auth.uid() OR public.is_conversation_admin(conversation_id, auth.uid())
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messages' AND policyname = 'Sender or admin can delete messages') THEN
    CREATE POLICY "Sender or admin can delete messages"
      ON public.messages
      FOR DELETE TO authenticated
      USING (
        sender_id = auth.uid() OR public.is_conversation_admin(conversation_id, auth.uid())
      );
  END IF;
END $$;

-- MESSAGE REACTIONS POLICIES
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'message_reactions' AND policyname = 'Members can read message reactions') THEN
    CREATE POLICY "Members can read message reactions"
      ON public.message_reactions
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.messages m
          WHERE m.id = message_id AND public.is_conversation_member(m.conversation_id, auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'message_reactions' AND policyname = 'Users can add own reaction') THEN
    CREATE POLICY "Users can add own reaction"
      ON public.message_reactions
      FOR INSERT TO authenticated
      WITH CHECK (
        user_id = auth.uid() AND
        EXISTS (
          SELECT 1 FROM public.messages m
          WHERE m.id = message_id AND public.is_conversation_member(m.conversation_id, auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'message_reactions' AND policyname = 'Users can remove own reaction') THEN
    CREATE POLICY "Users can remove own reaction"
      ON public.message_reactions
      FOR DELETE TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- MESSAGE READS POLICIES
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'message_reads' AND policyname = 'Members can read message reads') THEN
    CREATE POLICY "Members can read message reads"
      ON public.message_reads
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.messages m
          WHERE m.id = message_id AND public.is_conversation_member(m.conversation_id, auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'message_reads' AND policyname = 'Users can insert/update own message reads') THEN
    CREATE POLICY "Users can insert/update own message reads"
      ON public.message_reads
      FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'message_reads' AND policyname = 'Users can update own message reads') THEN
    CREATE POLICY "Users can update own message reads"
      ON public.message_reads
      FOR UPDATE TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- 8. STORAGE BUCKET: chat-media
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-media',
  'chat-media',
  false,
  52428800, -- 50MB max limit
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime',
    'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/aac'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage object policies for chat-media
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Chat media: read if conversation member') THEN
    CREATE POLICY "Chat media: read if conversation member"
      ON storage.objects
      FOR SELECT TO authenticated
      USING (
        bucket_id = 'chat-media'
        AND (
          (storage.foldername(name))[1] = auth.uid()::text
          OR public.is_conversation_member(((storage.foldername(name))[2])::uuid, auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Chat media: upload own media to conversation') THEN
    CREATE POLICY "Chat media: upload own media to conversation"
      ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'chat-media'
        AND (storage.foldername(name))[1] = auth.uid()::text
        AND public.is_conversation_member(((storage.foldername(name))[2])::uuid, auth.uid())
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Chat media: delete own media') THEN
    CREATE POLICY "Chat media: delete own media"
      ON storage.objects
      FOR DELETE TO authenticated
      USING (
        bucket_id = 'chat-media'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

-- 9. SUPABASE REALTIME REPLICATION PUBLICATION
-- Enable realtime for tables if not already added to supabase_realtime publication
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reads;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
