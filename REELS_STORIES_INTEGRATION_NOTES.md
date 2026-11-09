# VIDALORE SOCIAL — Reels & Stories integration notes

This update replaces the Reels and Stories localStorage data path with the existing Supabase client (`@/integrations/supabase/client`). It does not create or switch Supabase projects and does not add database triggers or migrations.

## Integrated

- Reels are loaded from `reels`, with creator details from `profiles`.
- Reel likes and saves use `reel_likes` and `reel_saves`.
- Reel comments use `reel_comments`; comment reactions use `reel_comment_likes`.
- Reel video files upload to the existing `reel-videos` bucket.
- Stories load from `stories`, profile details from `profiles`, and views from `story_views`.
- Story image/video files upload to the existing `story-media` bucket.
- Stories are filtered by `expires_at` so expired stories no longer appear after 24 hours.
- The existing `vidalore:reels-updated` browser event is preserved.
- Uploaded media paths, rather than expiring signed URLs, are stored in database rows. Signed URLs are generated when media is loaded.

## Configuration and checks

- The existing Supabase client and database definitions are retained. The generated database type helper section had malformed generic aliases in the supplied ZIP; those syntax errors were corrected.
- No `.env` file is included in the handover ZIP. Keep your real environment variables private and configure them in your deployment provider. `.env.example` remains available as a template.
- TypeScript syntax transpilation passed for all modified TypeScript/TSX files.
- A full `tsc`, lint, test, and production build could not be completed in this environment because project dependencies were not installed; the dependency installation attempt timed out. Run `npm install` (or the package manager used by your project), then `npm run build` and `npm test` before deploying.

## Existing limitations intentionally preserved

- `creatorVerified` is always false because no verified profile field is present in the supplied schema.
- `isFollowing` is not inferred because no verified follow relationship table was present in the supplied schema.
- Reel view counts and share counts are displayed from existing database columns; this update does not invent individual view tracking or a share-count mechanism.
- Sample preset clips/images remain external demo media. User-selected local files are uploaded to Supabase Storage.
