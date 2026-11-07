CREATE POLICY "Signed-in users view profile media" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'profile-media');
CREATE POLICY "Users upload own profile media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profile-media' AND (storage.foldername(name))[1] = auth.uid()::text
    AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp','gif'));
CREATE POLICY "Users update own profile media" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'profile-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own profile media" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'profile-media' AND (storage.foldername(name))[1] = auth.uid()::text);