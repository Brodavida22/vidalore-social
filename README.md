# Vidalore Social

PROJECT: VIDALORE SOCIAL 🌹



BRAND IDENTITY



App name: VIDALORE SOCIAL 🌹



Tagline: Connect. Express. Play. Belong.



Build a premium, professional, modern social networking platform combining the best user experiences of Facebook-style social networking and TikTok-style vertical short videos.



This must be a real, functional social platform, not just a static UI prototype.



The application must be mobile-first, responsive, fast, accessible and especially optimized for Android smartphones, while also looking excellent on tablets and desktop screens.



---



1. MANDATORY BACKEND REQUIREMENT — LOVABLE CLOUD



Use LOVABLE CLOUD as the exclusive backend for this entire project.



I authorize Lovable Cloud to manage:



- PostgreSQL database.

- User authentication.

- Database tables and relationships.

- Database migrations.

- Row Level Security (RLS).

- User profiles.

- File and media storage.

- Realtime messaging.

- Realtime notifications.

- Backend functions.

- Scheduled tasks where needed.

- VIDA POINTS transactions.

- Administrative operations.



IMPORTANT:



- Do not connect an external Supabase project.

- Do not use my old Supabase project.

- Do not use Firebase.

- Do not create a separate backend.

- Do not use localStorage as a replacement for real database functionality.

- Do not create fake authentication.

- Do not create simulated database operations.

- Do not leave important features as non-functional placeholders.



Use Lovable Cloud for all backend functionality.



If Cloud is not enabled, request permission to enable it before building backend-dependent features.



---



2. DESIGN SYSTEM



Create a unique premium visual identity.



Main colours:



- Rose Pink: #FF2D83

- Deep Pink: #E91E63

- Black: #090609

- Dark Burgundy: #210B18

- Soft Rose: #FFB6D2

- White: #FFFFFF



Design direction:



- Premium pink-and-black aesthetic.

- Dark burgundy surfaces.

- Elegant gradients.

- Soft rose-coloured glow effects.

- Smooth animations.

- Modern glassmorphism used carefully.

- Rounded cards and buttons.

- Beautiful typography.

- Subtle transitions.

- Professional icons.

- Consistent spacing.



Do not make the interface childish, overly bright or cluttered.



Create a custom VIDALORE SOCIAL logo using an elegant rose-inspired symbol and clean typography.



The entire application must use the same design system.



---



3. WELCOME AND AUTHENTICATION



Create a beautiful landing experience called:



THE ROSE GARDEN 🌹



Features:



- Animated rose petals floating gently.

- Elegant pink glow.

- Dark premium background.

- VIDALORE SOCIAL branding.

- Tagline: Connect. Express. Play. Belong.

- Animated sign-in and sign-up panels.

- Smooth transitions.

- Responsive layout.



Authentication must be real and connected to Lovable Cloud.



Implement:



1. Create account using email and password.

2. Sign in using email and password.

3. Username selection.

4. Username availability validation.

5. Email verification.

6. Password recovery.

7. Secure sign-out.

8. Protected authenticated routes.

9. Persistent authentication sessions.

10. Clear authentication error messages.



Do not allow duplicate usernames.



Never expose users' passwords or authentication tokens.



---



4. USER PROFILES



Every account must have a profile.



Profile information:



- Profile picture.

- Cover photo.

- Username.

- Display name.

- Bio.

- Location (optional).

- Join date.

- Followers.

- Following.

- Friends.

- VIDA POINTS.

- Posts.

- Reels.

- Stories.

- Achievements.



Profile actions:



- Follow.

- Unfollow.

- Add friend.

- Remove friend.

- Message.

- Share profile.

- Report profile.

- Block user.



Allow users to edit their own profiles.



Users must not be able to edit another person's profile.



Keep private account information, including email addresses and dates of birth, protected.



---



5. HOME SOCIAL FEED



Build a professional social feed.



Users should be able to:



- Create text posts.

- Upload photos.

- Upload videos.

- Add captions.

- React to posts.

- Comment.

- Reply to comments.

- Share posts.

- Save posts.

- Delete their own posts.

- Edit their own posts.

- Report inappropriate posts.



Feed sections:



- For You.

- Following.

- Friends.



Display:



- Author profile picture.

- Username.

- Post time.

- Post content.

- Media.

- Reactions.

- Comments.

- Share count.



Use real database records.



Support pagination or efficient feed loading.



---



6. VIDALORE REELS



Create a full-screen vertical video experience inspired by modern short-video platforms.



Features:



- Vertical swipe navigation.

- Automatic playback of the active video.

- Pause and resume.

- Like and unlike.

- Comments.

- Share.

- Follow creator.

- Creator profile shortcut.

- View counter.

- Video captions.

- Upload video.

- Delete own video.

- Report video.



The active video should fit the screen beautifully.



Use efficient video loading and avoid loading every video at once.



Do not autoplay videos with sound before the user has interacted with the app.



---



7. STORIES



Create a 24-hour story system.



Users can:



- Upload image stories.

- Upload video stories.

- Add text to stories.

- View friends' stories.

- See who viewed their stories.

- Delete their own stories.



Stories should automatically expire after 24 hours.



Use secure media storage.



---



8. FRIENDS AND FOLLOWERS



Build a complete social connection system.



Features:



- Send friend requests.

- Accept requests.

- Reject requests.

- Cancel requests.

- Remove friends.

- Follow users.

- Unfollow users.

- View followers.

- View following.

- Suggested accounts.



Prevent duplicate requests and duplicate relationships.



---



9. PRIVATE AND GROUP MESSAGING



Build a real-time messaging system using Lovable Cloud.



Private messaging:



- Send text messages.

- Send images.

- Send videos.

- Send voice messages.

- Message timestamps.

- Read receipts.

- Typing indicators.

- Online status.

- Message deletion.

- Conversation list.

- Unread message count.



Group messaging:



- Create group chats.

- Group name.

- Group picture.

- Add participants.

- Remove participants.

- Group administrators.

- Group messages.

- Group media.



Only authorized conversation participants may read messages or access private attachments.



Use secure authorization checks for every messaging operation.



---



10. COMMUNITIES



Create a community system.



Users can:



- Create communities.

- Upload community pictures.

- Add descriptions.

- Join communities.

- Leave communities.

- Create community posts.

- Comment.

- React.

- Invite users.



Community owners and moderators can:



- Manage members.

- Remove inappropriate posts.

- Moderate reported content.



---



11. VIDA POINTS 🌹



Create a real reward system called VIDA POINTS.



Initial rewards:



- Successful account registration: +100 points.

- Completing a profile: +50 points.

- Additional achievements: configurable by the administrator.



Build:



- Points balance.

- Points history.

- Achievement badges.

- Rewards page.

- Leaderboard.

- Recent points activity.



CRITICAL SECURITY:



- Users must never be allowed to directly edit their points balance.

- Points must be awarded through trusted server-side backend functions.

- Every points transaction must have a database record.

- Prevent duplicate signup rewards.

- Prevent duplicate profile-completion rewards.

- Validate every reward on the server.

- Never trust points values supplied by the frontend.



---



12. NOTIFICATIONS



Create real-time notifications for:



- New followers.

- Friend requests.

- Accepted friend requests.

- Likes.

- Comments.

- Replies.

- Mentions.

- Messages.

- Community activity.

- Achievements.

- VIDA POINTS rewards.



Include:



- Notification badge.

- Mark as read.

- Mark all as read.

- Notification history.



---



13. EXPLORE PAGE



Create a discovery page with:



- Trending posts.

- Trending Reels.

- Popular creators.

- Suggested users.

- Popular communities.

- Search users.

- Search posts.

- Search communities.



Use a clean card-based layout.



---



14. GAMES AND ENTERTAINMENT



Create a games section with safe, age-appropriate social games.



Include:



- Word challenges.

- Trivia.

- Riddles.

- Daily challenges.

- Leaderboards.

- Achievements.



Games should support friendly competition without gambling, betting or real-money rewards.



---



15. ADMIN DASHBOARD



Create a secure administrative dashboard.



Admin features:



- View platform statistics.

- Manage users.

- Review reported accounts.

- Review reported posts.

- Review reported videos.

- Manage communities.

- Moderate inappropriate content.

- Suspend accounts when justified.

- Review moderation history.

- Manage achievement rewards.

- Configure VIDA POINTS rewards.



SECURITY:



- Administrator privileges must be stored and checked securely on the backend.

- Never trust a frontend-only admin flag.

- Ordinary users must never be able to grant themselves administrator permissions.

- Every sensitive admin action must be authorized server-side.

- Keep an audit record of important administrative actions.



---



16. SAFETY AND PRIVACY



Implement:



- Report user.

- Report post.

- Report comment.

- Report video.

- Block user.

- Unblock user.

- Account privacy settings.

- Secure messaging permissions.

- Protected profile information.

- Content moderation.

- Appropriate upload validation.

- Reasonable upload-size limits.

- Rate limiting for sensitive operations.



Make the platform suitable for a broad audience, including younger users.



Do not expose private information publicly.



---



17. DATABASE ARCHITECTURE



Design a properly structured PostgreSQL database in Lovable Cloud.



Create the necessary related tables for:



- Profiles.

- User roles.

- Posts.

- Post media.

- Reactions.

- Comments.

- Comment replies.

- Saved posts.

- Reels.

- Reel views.

- Stories.

- Story views.

- Friend requests.

- Friend relationships.

- Follows.

- Conversations.

- Conversation participants.

- Messages.

- Communities.

- Community members.

- Community posts.

- Notifications.

- VIDA POINTS transactions.

- Achievements.

- User achievements.

- Reports.

- Blocks.

- Moderation actions.

- Administrative audit logs.



Use:



- Appropriate primary keys.

- Foreign keys.

- Unique constraints.

- Database indexes.

- Created and updated timestamps.

- Appropriate relationships.

- Data validation constraints.



Avoid unnecessary duplicate data.



Enable and configure RLS for every table.



Create policies based on the actual permissions required by each feature.



Do not assume that hiding a button in the frontend provides security.



Test access permissions for different user roles.



---



18. APPLICATION STRUCTURE



Use a clean, maintainable architecture.



Preferred frontend:



- React.

- TypeScript.

- Tailwind CSS.

- Reusable components.

- Responsive layouts.

- Accessible interactions.



Use Lovable Cloud SDK and supported integrations for backend functionality.



Organize the code into clear sections:



- Components.

- Pages.

- Hooks.

- Services.

- Types.

- Utilities.

- Authentication.

- Backend integrations.



Keep frontend and backend responsibilities separate.



All sensitive business logic must run server-side.



---



19. MAIN NAVIGATION



Mobile bottom navigation:



1. Home.

2. Explore.

3. Create.

4. Reels.

5. Profile.



Additional accessible sections:



- Stories.

- Messages.

- Notifications.

- Friends.

- Communities.

- VIDA POINTS.

- Settings.



Desktop should use an elegant sidebar and responsive content layout.



---



20. PERFORMANCE



Optimize the app for real-world use.



Requirements:



- Fast initial loading.

- Lazy-loaded images.

- Efficient video loading.

- Pagination.

- Optimized database queries.

- Responsive image sizes.

- Realtime subscriptions only where necessary.

- Loading skeletons.

- Empty states.

- Error states.

- Retry options.



Avoid unnecessary database requests.



---



21. DEVELOPMENT ROADMAP



Build this application in phases.



PHASE 1 — FOUNDATION



- Lovable Cloud setup.

- Database architecture.

- Authentication.

- User profiles.

- Rose Garden welcome screen.

- VIDA POINTS registration reward.



PHASE 2 — SOCIAL NETWORK



- Home feed.

- Posts.

- Reactions.

- Comments.

- Friends.

- Followers.

- Profile improvements.



PHASE 3 — MEDIA



- Reels.

- Video uploads.

- Stories.

- Media storage.



PHASE 4 — COMMUNICATION



- Private messaging.

- Group messaging.

- Notifications.

- Realtime features.



PHASE 5 — COMMUNITY



- Communities.

- Explore.

- Search.

- Suggestions.



PHASE 6 — REWARDS



- VIDA POINTS.

- Achievements.

- Leaderboards.

- Games.



PHASE 7 — ADMINISTRATION



- Admin dashboard.

- Reports.

- Moderation.

- Audit logs.



PHASE 8 — SECURITY AND TESTING



- Review all database tables.

- Review all RLS policies.

- Test authentication.

- Test account permissions.

- Test messaging privacy.

- Test file access.

- Test VIDA POINTS security.

- Test administrator authorization.

- Fix errors.

- Run security checks.

- Test mobile responsiveness.



---



22. IMPORTANT BUILDING INSTRUCTIONS



Do not attempt to build every feature carelessly in one step.



Start with the project foundation and Lovable Cloud backend.



Before creating database tables, explain the proposed schema and relationships.



Before making major database or security changes, explain what will change and request my approval.



After each phase:



1. Explain what you created.

2. Explain which Lovable Cloud resources were added.

3. Explain which database tables were created or modified.

4. Explain which features are functional.

5. Explain which features remain unfinished.

6. Test the completed features.

7. Fix errors before moving to the next phase.



Do not claim that something works unless it has actually been implemented and tested.



Do not replace real functionality with sample data or fake buttons.



Use realistic sample content only when clearly identified as demonstration content.



Keep the design consistent across every page.



The final result must feel like a professionally designed social networking application, not a generic template.



---



FINAL INSTRUCTION



Begin by setting up VIDALORE SOCIAL using LOVABLE CLOUD as its exclusive backend.



Do not connect an external Supabase project.



First build PHASE 1 properly, including the database, authentication, secure user profiles and Rose Garden welcome experience.



Show me the proposed architecture and explain the Cloud setup before proceeding with major database changes.



Build carefully, professionally and securely.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d1424fa1-e764-4e75-81f5-bfe8b49ee88d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
