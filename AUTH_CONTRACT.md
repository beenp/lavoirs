# Auth and user-profile contract

This is the frontend interface, not a required database schema or HTTP route design. Supabase, another SDK, or an HTTP backend can implement it. The authoritative types are in `packages/shared/src/auth.ts` and `packages/shared/src/profile.ts`.

## What the auth owner provides

```ts
interface AuthSession {
  user: { id: string; email: string };
}

interface AuthInput {
  email: string;
  intent: 'login' | 'signup';
  password?: string;
}

type AuthResult =
  | { status: 'authenticated'; session: AuthSession }
  | { status: 'pending'; message: string };

interface AuthService {
  mode: 'demo' | 'live';
  requiresPassword: boolean;
  getSession(): Promise<AuthSession | null>;
  authenticate(input: AuthInput): Promise<AuthResult>;
  signOut(): Promise<void>;
  onSessionChange(listener: (session: AuthSession | null) => void): () => void;
}
```

- Set `mode: 'live'` in the real adapter. `requiresPassword` controls whether the login form shows a password field.
- `getSession` restores a valid session, or returns `null` when signed out. Reject on operational failures.
- `authenticate` handles login/signup according to `intent`. Return `authenticated` only after identity is verified. Email-link delivery or email verification returns `pending` with safe display text such as “Check your email to continue.” Sending an email does not authenticate the user.
- The adapter owns redirect/callback processing for email links. After verification, emit a session through `onSessionChange`, or restore it through `getSession` after reload.
- Emit `null` when a session expires or the user signs out. The subscription must return an unsubscribe function. Do not emit a new user session before authenticated profile reads can succeed.
- `signOut` resolves after provider session cleanup; reject if it fails.
- Throw/reject failures. The UI displays generic error messages and supports retry; never put secrets in display messages.
- Tokens, refresh logic, cookies, database clients, and credentials stay inside the adapter. Never expose service-role keys in frontend code. Backend endpoints must validate identity independently of UI state.

## What the profile owner provides

```ts
interface Profile {
  id: string; // Same stable ID as session.user.id
  email: string; // From the authenticated identity
  name: string;
  location: string; // Display city/neighborhood, not exact coordinates
  description: string;
  interests: string[];
  radiusKm: number;
  transcriptionConsent: boolean;
}

type ProfileInput = Omit<Profile, 'id' | 'email'>;

interface ProfileService {
  getMyProfile(): Promise<Profile | null>;
  saveMyProfile(input: ProfileInput): Promise<Profile>;
}
```

- `getMyProfile` returns `null` only when the authenticated user has no profile; reject on database/network failures.
- `saveMyProfile` creates or updates the current user's profile and returns the saved, normalized object. Derive ID/email from the authenticated session on the trusted side; never trust a submitted user ID.
- Map snake_case columns, related interest rows, and null database fields to this frontend shape in the adapter. Use empty strings/arrays for optional text/interests and default transcription consent to `false`.
- Validate on the server: trimmed name (1–60 characters), location (1–100), description (0–500), at least one supported interest, radius 5–100 km, and boolean consent. Current UI radius uses increments of 5 km.
- The current interest labels are exported as `INTERESTS` in `InterestSelector.tsx`. If the database uses interest IDs, map them in the adapter or agree on a shared catalog.
- A city string is for display. The matchmaking owner must resolve geographic data for actual radius matching.

## Plug it in

Demo behavior is isolated in `apps/web/src/lib/demo-services.ts`. `services.ts` is the single wiring point, and `App` also accepts an injected `AppServices` object. Screens never need database credentials or column names.

For profile persistence, `apps/web/src/lib/profile-service.ts` provides `createProfileService({ read, write })` for an SDK adapter, plus `createHttpProfileService({ endpoint, getAccessToken })` for a backend API. Both validate returned profile data and explicitly whitelist editable fields. The UI updates from the backend's saved response, not from the submitted draft. Failed saves preserve the form for retry, and identity checks reject profiles belonging to a different user.

The optional HTTP adapter expects `GET /api/profiles/me` to return a profile or JSON `null`, and `PUT /api/profiles/me` to return the saved profile. All errors, including unauthorized requests, use non-2xx responses. This endpoint is **not implemented**; the URL is configurable. The default remains the demo adapter. Backend validation and authorization remain mandatory.

Only authentication and profile persistence are covered here. Queue/group membership, future event choices, and mutual contact sharing remain separate backend integrations; they are not persisted by this profile adapter.

Implement/export an object matching `AppServices` and replace the final export in `apps/web/src/lib/services.ts`:

```ts
import { teammateAuth, teammateProfiles } from './your-provider-adapter';

export const services: AppServices = {
  auth: teammateAuth,
  profiles: teammateProfiles,
};
```

No screen changes are required for the supported email/password or email-link flows. OAuth buttons, OTP-code entry, password reset, and MFA would require additional UI and contract methods if your team chooses them.

`useAccount.ts` manages async loading, errors, session changes, profile saves, and ignores stale profile responses after identity changes. Existing complete profiles go to the queue; new/incomplete profiles go to setup. Demo services remain in memory and reset on refresh. Matchmaking and room services are separate integrations and remain simulated even after real auth is connected.

## Teammate acceptance checks

Verify new signup, returning login, invalid credentials, pending verification, refresh restoration, expired session, profile read failure, save failure/retry, sign-out failure/retry, and account switching. Ensure another user's profile cannot be read or overwritten. Test both password and email-link settings if supported.
