# VIDALORE SOCIAL — Phase 2: Social Network

## Preserve the existing foundation

Build on Lovable Cloud without replacing authentication, moving the backend, resetting tables, or deleting existing accounts or content. Phase 1 remains intact. No Phase 3 reels/stories or Phase 4 messaging implementation.

### Inspection results

- The live database has eight Phase 1 tables: `profiles`, `private_profiles`, `user_roles`, `points_transactions`, `reward_settings`, `achievements`, `user_achievements`, and `admin_audit_logs`.
- Existing profile, private-account flag, roles, rewards, badges, authentication, protected navigation and profile editor will be reused.
- No posts, relationships, notifications, reports or blocks table exists. There is no existing notification system to duplicate.
- Storage currently has one **private** `profile-media` area, with a 5 MB file limit and owner-only upload/update/delete rules. Reuse it for avatars and covers.
- Baseline record counts: one profile, one role record and two points transactions. Implementation must preserve these records.
- Current profile reads allow signed-in members to see profile fields; the private switch promises restricted posts once posting launches. Phase 2 will enforce that promise in the database.

## What will be built

### 1. Home and publishing

- Preserve the pink, black, rose and dark-burgundy visual identity and existing navigation. Centered desktop feed with discovery alongside; full-width mobile feed with bottom navigation.
- Avatar and “What's on your mind?” composer, text/photo/video controls, previews, removal before publishing, progress, cancellation where supported, success/error feedback and retry.
- Plain text, line breaks and emojis; one or multiple photos; a single video with optional caption. Owner-only edit and delete, including confirmed deletion.
- A reusable PostCard with author links, timestamp, media gallery/video playback, database-derived counts, reaction/comment/share/save actions and a working More menu.
- Stories-position preview uses **real suggested member avatars**, leading to their profiles; label it discovery rather than inventing active stories. Real story creation and expiry stay in Phase 3.
- Paginated feed: followed users, friends, then recent public-member posts, with popularity as a secondary signal. No fabricated trending topics. Discovery uses real eligible members and actual activity.
- Stable pages of approximately 20 entries, loading skeletons, quiet-feed state, error/retry and load-more controls.

### 2. Post interactions

- One removable heart reaction per member per post; extensible reaction type. Counts come from Cloud, never client-supplied totals.
- Expandable comments with owner editing/deletion, reactions, replies, reply counts and reporting. Replies share the comments model with a parent reference; validate the same original post and one reply level.
- Internal shares are real records and appear as attributed original-post shares in the feed. One active share per member/original post prevents accidental duplicates. Copy link and native sharing work; messaging-share controls are omitted until Phase 4.
- Dedicated authenticated post-link view, including unavailable/private/blocked states.
- Private Saved page with save/unsave. Only its owner can read the collection; saved items do not bypass original-post privacy.

### 3. Social circle and profiles

- Separate follow and friendship systems. Send/cancel/accept/decline requests, remove friends, follow/unfollow; no self-relationships or duplicate pairs.
- Friends page with requests, friends and real suggested members. Dedicated paginated followers/following views with follow controls.
- Profile counts and Posts/Photos/Videos/About tabs, keeping existing cover/avatar, bio, location, points and achievements.
- Own-profile controls: Edit Profile, Saved and Settings. Other profiles: Follow, friendship controls, Report and Block. No pretend Message button.
- Retain username immutability for this phase, consistent with Phase 1's existing disabled username field; improve photo validation and editing without exposing authentication fields.
- Private accounts retain a minimal discovery header; detailed profile content, social lists and posts are owner/friend-visible. Following does not grant private-account access or create friendship.

### 4. Notifications, reports and blocking

- Private Notifications page with unread count and mark-read controls.
- Database-created notifications for follows, friend requests/acceptance, post reactions, comments, replies and internal shares. No self-notifications or client-forged notifications.
- Working post/comment/reply/profile reports using Spam, Harassment, Inappropriate content, Fake account and Other.
- Reuse existing roles and audit logs for a small protected moderation report queue; this is not the full Phase 7 admin dashboard. Reporters can submit their own reports; authorized moderators/admins can review them. Ordinary members cannot change other reports.
- Bilateral block checks prevent profile interactions, follows, requests, reactions, comments and shares between blocked members. Hide blocked posts and discovery entries; suspend existing social connections without deleting user/content records. Provide an unblock list; unblocking does not silently recreate connections.

## Proposed Cloud additions — approval requested

### New tables (13)

| Table               | Purpose and principal constraints                                                   |
| ------------------- | ----------------------------------------------------------------------------------- |
| `posts`             | Author, text, publication state, created/edited times; owner management             |
| `post_media`        | Original post, owner, storage path, media kind, verified metadata and gallery order |
| `post_reactions`    | Member/post/type; unique member + post                                              |
| `comments`          | Author, post, optional parent comment, text and timestamps                          |
| `comment_reactions` | Member/comment/type; unique member + comment                                        |
| `saved_posts`       | Private member/post collection; unique pair                                         |
| `post_shares`       | Member/original post/time; unique active pair                                       |
| `friend_requests`   | Sender, recipient, request state/time; unique unordered pending pair                |
| `friendships`       | Canonically ordered member pair/time; unique pair                                   |
| `follows`           | Follower, followed, time; unique pair                                               |
| `blocks`            | Blocker, blocked, time; unique pair                                                 |
| `reports`           | Reporter, validated post/comment/profile target, reason, review status/time         |
| `notifications`     | Recipient, actor, event, reference, time/read state                                 |

All user references reuse `public.profiles`. Add appropriate foreign keys, primary keys, indexes, uniqueness, validation and timestamps. Add nullable storage-path fields to profiles if needed for safer image delivery; preserve existing URL fields and media. No reset or destructive schema replacement.

### Storage

- Reuse private `profile-media` for avatars/covers; retain 5 MB image limit.
- Add private `post-images` and `post-videos` areas with owner-scoped paths.
- Initial defaults: up to 10 photos, 10 MB each; or one MP4/WebM video up to 100 MB. Validate size, actual file signatures, MIME type and supported playback; do not rely on file extensions. These are implementation defaults, not new rewards or product pricing.
- Publish only verified media. Authorize media access against post/profile privacy before issuing short-lived viewing links; never make private storage public. Clean up failed/unpublished uploads belonging to the requester.
- Replace five-year profile viewing links with short-lived delivery for new reads while preserving existing files. Previously issued links cannot be retroactively made private merely by changing the profile flag; inspect legacy assets and address affected object access before calling privacy complete.

### Security and technical implementation

- RLS and explicit role grants on every new table. Authenticated read scopes, owner writes, private saves/notifications and privileged report review; no anonymous social-data access.
- Restrictive block/privacy checks on existing profile reads where required, preserving owner-read paths and existing authentication/profile/reward triggers.
- Trusted database functions handle atomic relationship transitions, validated notifications and authoritative counts. Security-definer helpers use fixed search paths, verify caller identity, and have narrowly scoped execution grants.
- App server operations use authenticated TanStack server functions and the existing bearer middleware. Ordinary operations run with the member's permissions, not an administrator bypass. All inputs are validated; sensitive errors are logged privately and shown as friendly messages.
- Paginated, indexed queries and targeted cache updates; reactions/comments do not reload the whole feed. No realtime subscriptions are needed for the initial version; notifications refresh on entry/focus/manual refresh.
- Extend existing routes/services and focused social UI modules. Add unique page metadata to each content page and keep existing public welcome/reset pages.

## Build sequence

1. Apply approved additive Cloud schema, privacy rules and private storage settings.
2. Build posts/composer/media, post links, home feed and reactions/comments/shares/saves.
3. Build relationships/discovery, profile tabs and social lists.
4. Build notifications/reports/moderation queue/blocking and error states.
5. Run security, authenticated end-to-end and device checks; repair regressions before reporting.

## Verification and completion gate

- Keep small persistent tests for uniqueness, ownership, privacy, friendship state transitions, notification events, media validation, limits and blocking.
- Exercise real Cloud flows: text/image/video publication, edit/delete, heart toggle, comment/edit/delete/reply/reaction, internal share, copied post link, save/unsave and readback through the UI.
- Use two distinct authenticated accounts for cross-user permissions, friend request lifecycle, follows/counts, notifications, private saved collections, private profiles and bilateral block/unblock. Do not silently choose another user's account; request account-testing permission if needed.
- Verify existing sign-in/sign-out, retained profile/reward records and owner profile editing. Do not change existing reward amounts.
- Check small Android (360px), large Android (412px), tablet (768px) and desktop (1280px), including composer, gallery, video, comments, profile tabs, dialogs and bottom navigation; no horizontal overflow and reduced-motion support.
- Inspect application errors, database lint findings and unauthorized direct-data attempts. Passing lint alone is not proof of security.
- Final report: completed features, tables changed, storage changes, security changes, tests performed, remaining issues and outstanding approval. **Do not label Phase 2 complete if important features or checks remain unfinished.**

## Approval boundary

Approving this plan authorizes these additive Phase 2 tables, private storage areas and necessary privacy/security updates. No database or storage changes have been made yet. Existing accounts, content and Phase 1 systems remain in place.
