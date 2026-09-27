# Lavoirs

A working frontend demo and integration for a small-group, interest-based video meetup experience. The planned stack is React, Vite, TypeScript, Tailwind CSS, LiveKit Cloud, Supabase, and Vercel.

## Product flow

1. A member creates a profile with a name and media preferences.
2. A LiveKit video room brings the group together with interest-based conversation prompts; members can skip their local prompt
4. At the end of a 20-minute session, the service presents three relevant in-person events occurring within the next two weeks.
5. Members can opt into an event and exchange contact details only with mutual consent.


## LiveKit API file map

- `api/livekit/token.ts` — short-lived room access token endpoint.
- `apps/web/src/lib/livekit-client.ts` — browser-side LiveKit connection boundary.
- `apps/web/src/features/room/` — room UI, participant grid, media controls, prompts, voting, and transcription consent.

The login, profile, matching demo, room preview, and frontend configuration are implemented. See INTEGRATION.md for setup and teammate handoff details. Other backend files remain placeholders.

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
- `apps/web/src/features/profile/ProfileForm.tsx` — form UI for name

#### Video room feature

- `apps/web/src/features/room/RoomPage.tsx` — page-level container for a live group conversation.
- `apps/web/src/features/room/LiveKitRoom.tsx` — React integration boundary that connects the room UI to the LiveKit client.
- `apps/web/src/features/room/ParticipantGrid.tsx` — video and participant tile layout for the group.
- `apps/web/src/features/room/MediaControls.tsx` — camera, microphone, and leave-room controls.
- `apps/web/src/features/room/ConversationPrompt.tsx` — display for the active icebreaker prompt.
- `apps/web/src/features/room/PromptVoting.tsx` — controls for voting to skip or keep a prompt.

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


