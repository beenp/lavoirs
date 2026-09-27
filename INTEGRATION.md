# Frontend setup and handoff

Use Node.js 20.19+ or 22.12+. From the repository root:

```sh
npm install
npm run dev
npm run build
```

On Windows PowerShell with restricted script execution, use `npm.cmd` instead of `npm`. The build performs TypeScript checking and generates `dist`. Use `npm run preview` to preview it.

## Demo flow

The app always opens on login. Enter any valid email, complete your profile, and join the simulated four-person queue. Three seeded participants arrive about two seconds apart. Cancel the queue, edit the profile, enter a room preview, leave, or sign out. All data lives only in React state and resets on refresh. No password, real account, audio, or transcript is collected.

## Integration boundaries

### Pages and routing

React Router owns navigation in `apps/web/src/app/routes.tsx`, with `BrowserRouter` mounted in `main.tsx`:

| URL | Page |
| --- | --- |
| `/` | Home page when signed in; login landing when signed out. The Lavoirs logo always links here. |
| `/login` | Email/password or email-link login |
| `/signup` | Account creation using the auth adapter's signup intent |
| `/profile` | Profile setup and editing (requires login) |
| `/queue` | Breakout queue (requires a complete profile) |
| `/rooms/:roomId` | Room preview (requires the current matched room ID) |
| `/events` | Follow-up integration placeholder (requires a current group) |
| Other URLs | Not-found page with a return link |

Browser back/forward and internal links work without a full reload. Queue timers clean up when leaving the queue page. A room's demo preview button opens the events page; it does not simulate a completed 20-minute conversation. Leaving a room clears its group, so old room history cannot reopen it.

The app waits for session restoration before evaluating protected routes. Demo sessions and matches are in memory: refreshing a protected page returns to login. Live auth can restore a profile; restoring matched rooms after refresh still requires the matchmaking owner's group lookup. Frontend route guards are not a substitute for backend authorization. Vercel's existing SPA rewrite serves direct page URLs while preserving `/api/` routes.

Authentication and profile storage now use the replaceable `services.ts` adapter. See [AUTH_CONTRACT.md](AUTH_CONTRACT.md) for the exact teammate contract. The default adapter is still an in-memory demo; live adapters can restore sessions and existing profiles.

- `apps/web/src/app/App.tsx` owns login → profile → queue → room screen state. Replace demo email continuation with Supabase authentication before exposing protected features.
- `packages/shared/src/profile.ts` defines the profile contract: approximate location, matching radius, interests, and optional transcription consent (off by default).
- `packages/shared/src/matching.ts` defines participants, groups, queue states, and the future matchmaking service interface. Replace the seeded timer in `MatchingPage.tsx` with authenticated queue operations and subscription updates. Nearby counts are not yet connected.
- `MatchingPage` passes a `MatchGroup` to `RoomPage`. The LiveKit owner can use `roomId` to request an authorized server token. The current room is a preview without video or a running session timer.
- Prompt voting, the 20-minute timer, real event recommendations, and mutual contact exchange remain teammate integration work.
- Vercel builds from the repository root using `vercel.json`. Deployment has not been performed. API files remain empty placeholders and require implementation before backend use.

## Manual smoke check

1. Open the app and confirm the login screen and demo notice appear.
2. Continue with a valid email. Name and city are required; at least one interest must be selected.
3. Save a profile and check the chosen location, radius, and interests on the queue screen.
4. Join, leave before completion, and verify all three seats reset. Rejoin and wait for all four seats.
5. Enter the preview, leave, edit the profile, and sign out.
6. Check narrow mobile and desktop layouts. Refresh should return to login.
