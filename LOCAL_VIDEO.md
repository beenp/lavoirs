# Run video locally on this computer

From the repository root:

```powershell
npm.cmd run dev:local
```

Open http://127.0.0.1:5173, sign in with any email, complete your profile, join the queue, then click **Join group room** and allow camera/microphone access.

For a second participant, use a separate browser or private window. Another tab in the same browser shares the same session cookie. The first four local sessions are assigned to the same room. Sign out when finished to release your session's group slot.

The Windows LiveKit binary is installed under `.tools/livekit/` and verified against the official v1.13.7 release checksum. `.env.local` contains local-only LiveKit development credentials. Both are ignored by Git. The server binds to loopback and is intended for testing on this computer. Using another computer requires a reachable LiveKit server and HTTPS for browser media access.

`npm.cmd run dev` starts the UI and API only. `npm.cmd run dev:livekit` starts the media server separately. Do not start duplicate copies if these are already running.

The local API issues an HttpOnly session cookie, stores profiles in memory, assigns groups, and validates membership before issuing room tokens. It rejects browser-supplied identity headers. It is deliberately disabled outside local development; real Supabase authentication and matchmaking still need the teammate-owned adapters. Restarting the API clears local sessions/profiles. Local groups can start with one participant for testing; interest/radius matching and the 20-minute follow-up are not implemented here.

Verification: with the servers running, `npm.cmd run test:video` uses isolated Chrome processes and synthetic media to check two-client video, mute/leave, permission-denial handling, and unauthorized-token rejection. No physical camera is used by the tests.
