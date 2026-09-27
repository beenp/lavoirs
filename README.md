# Lavoirs

A project scaffold for a small-group, interest-based video meetup experience. It includes a working Supabase email/password signup and profile editor built with React, Vite, TypeScript, and Tailwind CSS. Matching, LiveKit rooms, and event recommendations remain planned features.

## Product flow

1. A member creates a profile with a name, approximate location, description, interests, and explicit media/transcription preferences.
2. Matching shows an approximate count of nearby members with overlapping interests and places the member in a queue for a group of four.
3. A LiveKit video room brings the group together with one or two interest-based conversation prompts; members can vote to skip a prompt or leave at any time.
4. At the end of a 20-minute session, the service presents three relevant in-person events occurring within the next two weeks.
5. Members can opt into an event and exchange contact details only with mutual consent.

## Scaffold map

- `apps/web/` — React and Vite frontend, organized by profile, matching, video room, and event features. `src/lib/` is reserved for browser clients and API access.
- `api/` — Vercel serverless API routes for profiles, matchmaking, LiveKit, event recommendations, and consent-based contact exchange.
- `middleware/` — request authentication, rate limiting, input validation, and approximate-location privacy boundaries.
- `packages/shared/` — shared TypeScript domain type file locations for profiles, matches, LiveKit sessions, and events.
- `supabase/migrations/` — planned schema migration locations for profiles, interests, groups, prompts, events, and connections.
- `supabase/functions/` — planned server-side matchmaking and recommendation function locations.
- `public/` — static frontend assets.

## LiveKit API file map

- `api/livekit/token.ts` — short-lived room access token endpoint.
- `api/livekit/rooms.ts` — room lifecycle operations for matched groups.
- `api/livekit/participants.ts` — participant state and room membership operations.
- `api/livekit/webhook.ts` — LiveKit room and participant event receiver.
- `api/livekit/transcription.ts` — consent-gated transcription integration boundary.
- `apps/web/src/lib/livekit-client.ts` — browser-side LiveKit connection boundary.
- `apps/web/src/features/room/` — room UI, participant grid, media controls, prompts, voting, and transcription consent.

The profile signup flow is implemented. Most matching, LiveKit, and event files remain placeholders; do not treat those features as implemented yet.

## File-by-file roles

### Repository and deployment

- `.env.example` — documents the names of environment variables the project will need; it should contain placeholders only, never real credentials.
- `vercel.json` — Vercel project configuration location for build, routing, and deployment settings.
- `apps/web/index.html` — Vite's HTML document template; the browser loads the React application through its script entry point.
- `apps/web/vite.config.ts` — Vite development server and frontend build configuration.
- `apps/web/tsconfig.json` — TypeScript compiler options for the frontend application.
- `apps/web/tailwind.config.ts` — Tailwind CSS content scanning and theme configuration.
- `apps/web/postcss.config.js` — PostCSS plugin configuration used when processing Tailwind CSS.

### React frontend

- `apps/web/src/main.tsx` — browser entry point for the React app; this is where the root component is mounted into the HTML page.
- `apps/web/src/app/App.tsx` — top-level React component that assembles the application shell and routed screens.
- `apps/web/src/app/routes.tsx` — page route definitions for profile setup, matching, calls, and recommendations.
- `apps/web/src/components/layout/AppShell.tsx` — shared page frame for common layout elements and nested pages.
- `apps/web/src/components/layout/Navigation.tsx` — shared navigation UI for moving between app sections.
- `apps/web/src/styles/index.css` — global styles and Tailwind CSS entry directives.
- `apps/web/src/lib/api-client.ts` — browser-side helper boundary for calling the Vercel API routes.
- `apps/web/src/lib/livekit-client.ts` — browser-side LiveKit SDK setup and connection helper boundary.
- `apps/web/src/lib/supabase-client.ts` — browser-side Supabase client setup boundary for approved client-accessible operations.

#### Profile feature

- `apps/web/src/features/profile/ProfilePage.tsx` — profile screen container and profile display flow.
- `apps/web/src/features/profile/ProfileForm.tsx` — form UI for name, description, approximate location, interests, and preference controls.

#### Matching feature

- `apps/web/src/features/matching/MatchingPage.tsx` — matching screen that combines interest selection, nearby availability, and queue state.
- `apps/web/src/features/matching/InterestSelector.tsx` — UI for selecting the interests used for matching and conversation prompts.
- `apps/web/src/features/matching/QueueStatus.tsx` — waiting-room status, including progress toward a four-person group.
- `apps/web/src/features/matching/MatchPreview.tsx` — pre-room summary of a proposed group and its shared interests.

#### Video room feature

- `apps/web/src/features/room/RoomPage.tsx` — page-level container for a live group conversation.
- `apps/web/src/features/room/LiveKitRoom.tsx` — React integration boundary that connects the room UI to the LiveKit client.
- `apps/web/src/features/room/ParticipantGrid.tsx` — video and participant tile layout for the group.
- `apps/web/src/features/room/MediaControls.tsx` — camera, microphone, and leave-room controls.
- `apps/web/src/features/room/ConversationPrompt.tsx` — display for the active icebreaker prompt.
- `apps/web/src/features/room/PromptVoting.tsx` — controls for voting to skip or keep a prompt.
- `apps/web/src/features/room/TranscriptConsent.tsx` — explicit consent UI for any speech transcription; transcription should remain off without consent.

#### Event and connection feature

- `apps/web/src/features/events/EventRecommendations.tsx` — results screen for three suggested in-person events after a session.
- `apps/web/src/features/events/EventCard.tsx` — single event summary and selection UI.
- `apps/web/src/features/events/ContactExchange.tsx` — mutual opt-in flow for exchanging contact details with group members.

### Vercel API routes

- `api/auth/session.ts` — server-side session validation or session-related operations for protected endpoints.
- `api/profiles/index.ts` — profile collection endpoint, such as creating or retrieving the current user's profile.
- `api/profiles/[profileId].ts` — endpoint for reading or updating a specific profile by ID.
- `api/matching/nearby-count.ts` — returns a privacy-preserving approximate count of eligible nearby members with related interests.
- `api/matching/queue.ts` — joins or checks the user's matchmaking queue state.
- `api/matching/leave-queue.ts` — removes the current user from the matchmaking queue.
- `api/matching/groups.ts` — creates or retrieves matched groups of four and their room assignments.
- `api/matching/prompts.ts` — supplies interest-based prompts and records prompt skip votes.
- `api/livekit/token.ts` — issues a short-lived LiveKit access token after server-side identity and room authorization checks.
- `api/livekit/rooms.ts` — creates, looks up, or closes LiveKit rooms for matched groups.
- `api/livekit/participants.ts` — handles authorized participant membership or state operations for a room.
- `api/livekit/webhook.ts` — receives LiveKit server events, such as room or participant lifecycle notifications.
- `api/livekit/transcription.ts` — server boundary for starting or handling transcription only when the required consent is recorded.
- `api/events/recommendations.ts` — returns three relevant in-person event recommendations within the requested two-week window.
- `api/connections/contact-exchange.ts` — records and fulfills mutual consent before sharing contact information.

### Middleware and shared domain types

- `middleware/auth.ts` — reusable authentication checks for protected API requests.
- `middleware/rate-limit.ts` — reusable request throttling for endpoints that need abuse protection.
- `middleware/location-privacy.ts` — limits location precision and helps keep exact location out of public matching results.
- `middleware/request-validation.ts` — shared request shape and input validation boundary for API handlers.
- `packages/shared/src/profile.ts` — shared TypeScript type location for member profiles and profile preferences.
- `packages/shared/src/matching.ts` — shared type location for interests, queue entries, matches, and groups.
- `packages/shared/src/livekit.ts` — shared type location for rooms, participants, tokens, and LiveKit events.
- `packages/shared/src/events.ts` — shared type location for event recommendations and contact exchange state.

### Supabase

- `supabase/migrations/001_profiles.sql` — database schema migration for member display names and descriptions.
- `supabase/migrations/002_interests_and_matching.sql` — schema migration for interests, queue entries, and matching data.
- `supabase/migrations/003_rooms_and_participants.sql` — schema migration for group sessions and participant membership.
- `supabase/migrations/004_prompts_and_votes.sql` — schema migration for icebreaker prompts and skip votes.
- `supabase/migrations/005_events_and_connections.sql` — schema migration for recommendations, event choices, and consent-based connections.
- `supabase/functions/matchmaking/index.ts` — Supabase Edge Function entry point for server-side queue processing and group formation; it is not the React web entry point.
- `supabase/functions/event-recommendations/index.ts` — Supabase Edge Function entry point for server-side event recommendation work; it is not the React web entry point.


## Profile signup setup

1. Run `npm.cmd install` at the repository root in Windows PowerShell.
2. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from your Supabase project. For local Supabase, use the API URL and public `anon` key shown by `supabase status`.
3. Apply the profile table and its row-level security policies, including `supabase/migrations/007_profile_owner_policies.sql`, to the database you are using.
4. In Supabase Auth settings, allow `http://localhost:5173` as a redirect URL. The local `supabase/config.toml` already allows the localhost Vite URLs.
5. Run `npm.cmd run dev` and open the local address Vite prints.

Signup creates the Supabase Auth account and keeps the name and description in Auth metadata until the user has a session. The signed-in browser then upserts `public.profiles` with that user's ID; the profile owner policies restrict each account to its own row. If email confirmation is required, confirm the email and return to the app; the confirmation redirect may establish a session, otherwise sign in to finish saving the profile. The frontend uses only a publishable/anon key; never put a service-role key in a `VITE_` variable. These forms write through Supabase Auth and RLS; `api/profiles/index.ts` is a separate server-side profile endpoint and is not called by this screen.

The current `profiles` table stores `display_name` and `description`. The signup page does not yet collect location or interests because those are not profile columns in the current schema; add and apply the appropriate migration before extending this form.

### New signup-related file roles

- `apps/web/src/main.tsx` — browser entry point; imports the global styles and mounts the React application.
- `apps/web/src/app/App.tsx` — observes Supabase auth state, creates/signs in accounts, loads the current profile, and saves profile changes.
- `apps/web/src/features/profile/AuthForm.tsx` — email/password form for account creation and sign-in.
- `apps/web/src/features/profile/ProfilePage.tsx` — signed-in profile screen and sign-out control.
- `apps/web/src/features/profile/ProfileForm.tsx` — edits the profile fields supported by the current database table.
- `apps/web/src/lib/supabase-client.ts` — creates the browser Supabase client from public Vite environment variables.
- `apps/web/src/styles/index.css` — Tailwind CSS entry point and minimal global browser styles.
- `supabase/migrations/007_profile_owner_policies.sql` — limits profile row access to its authenticated owner.

## Tests

Run `npm.cmd test` for the signup/profile UI and Vercel profile API unit tests. `tests/profile-rls.integration.test.ts` exercises real row-level security against local Supabase and runs when `SUPABASE_TEST_URL`, `SUPABASE_TEST_ANON_KEY`, and `SUPABASE_TEST_SERVICE_ROLE_KEY` are provided to the test process. It creates uniquely named test accounts and deletes them during cleanup. Keep the service-role value in a local test environment only; never prefix it with `VITE_`.
