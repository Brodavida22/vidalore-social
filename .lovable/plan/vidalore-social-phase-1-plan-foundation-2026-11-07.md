# VIDALORE SOCIAL 🌹 — Phase 1 Plan (Foundation)

Lovable Cloud is being enabled as the only backend. Nothing in the database is created until you approve this plan.

## What Phase 1 delivers

1. **The Rose Garden** welcome screen at `/` — dark burgundy background, floating rose petals, pink glow, custom rose logo, tagline, animated Sign in / Sign up panels.
2. **Real accounts** — email + password sign-up with username picker (live "available / taken" check), email verification, sign in, forgot/reset password, sign out, sessions that persist, clear error messages.
3. **Protected app shell** — mobile bottom bar (Home, Explore, Create, Reels, Profile) and desktop sidebar. Pages not yet built show an honest "Coming in Phase X" state, not fake buttons.
4. **Profiles** — view any profile (avatar, cover, display name, @username, bio, location, join date, VIDA POINTS); edit only your own, with photo uploads.
5. **VIDA POINTS** — +100 on signup and +50 when profile is complete (avatar, display name, bio), awarded by the database itself, once only, with a history record. Users cannot change their balance.

## Proposed database (Phase 1 tables)

```text
auth.users (managed by Cloud — holds email & password, never exposed)
   │1
   ├──1 profiles          public info: username (unique, lowercase), display_name,
   │                      bio, location, avatar_url, cover_url, points_balance,
   │                      is_private, created_at, updated_at
   ├──1 private_profiles  email copy, date_of_birth — readable only by owner
   ├──* user_roles        role: admin | moderator | user  (separate table)
   ├──* points_transactions  amount, reason, reference — append-only ledger
   └──* user_achievements ─* achievements (code, name, points, active)
```

Also created now as the foundation for later phases (empty, locked down): `admin_audit_logs`, `reward_settings` (admin-configurable point values: signup=100, profile_complete=50).

Phase 2+ tables (posts, comments, reactions, follows, friends, reels, stories, messages, communities, notifications, reports, blocks, moderation) will each be proposed for approval before their phase.

## Security rules

- RLS on every table. Profiles: anyone signed in can read public columns; only owner can update, and never `points_balance` or `username` changes that collide.
- Points: only a trusted database function can insert into the ledger; balance updates via trigger. Unique constraint `(user_id, reason)` for one-time rewards blocks duplicates.
- Roles: checked with a secure `has_role()` function; no user can insert roles. You'll be made admin manually once you've signed up.
- Storage: `avatars` and `covers` buckets, public read, users can upload only into their own folder, 5 MB image limit, image types only.
- Username: 3–20 chars, letters/numbers/underscore, unique case-insensitive.

## Technical details

- Trigger on `auth.users` insert creates profile + private profile + `user` role + signup reward atomically (username passed in sign-up metadata).
- Trigger on profile update checks completeness and awards +50 once.
- Username availability via a security-definer RPC returning only true/false.
- Routes: `/` (Rose Garden/auth), `/reset-password`, `/_authenticated/home`, `/_authenticated/u/$username`, `/_authenticated/settings/profile`, `/_authenticated/points`.
- Fonts: Cormorant Garamond (display) + Manrope (body). Tokens in oklch.

## Testing before reporting

Sign up, duplicate-username rejection, profile edit, attempt to edit another profile / own points (must fail), reward granted once, mobile 390px screenshots.
