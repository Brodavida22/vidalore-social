# VIDALORE SOCIAL roadmap

- [x] Phase 1 — Foundation: Cloud, schema, auth, profiles, Rose Garden, signup/profile rewards
- [ ] Phase 2 — Approve additive schema, storage and security plan; preserve tested Phase 1
- [ ] Phase 2 — Posts/media, paginated feed, reactions, comments/replies, shares, private saves
- [ ] Phase 2 — Friends, follows, discovery, profile tabs and social lists
- [ ] Phase 2 — Private notifications, reports and bilateral blocking
- [ ] Phase 2 — Ownership/privacy/media tests, authenticated end-to-end flows and Android/tablet/desktop checks
- [ ] Phase 3 — Media (reels, stories)
- [ ] Phase 4 — Messaging + notifications
- [ ] Phase 5 — Communities, explore, search
- [ ] Phase 6 — Rewards, achievements, leaderboards, games
- [ ] Phase 7 — Admin dashboard, reports, moderation, audit logs
- [ ] Phase 8 — Security & testing pass

## Stage 1 — Persistent social posts (approved additive DB changes)

- [ ] Migration: posts, post_media, post_likes, post_comments, post_comment_likes, post_saves + RLS
- [ ] Private post-media bucket with per-user/post folders and access policies
- [ ] Replace localStorage post code with real backend calls (composer, card, comments, saved, share, home/explore/profile)
- [ ] Types, tests (two accounts, persistence, ownership, private saves, media access), typecheck/lint/build
