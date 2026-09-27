# Session lifecycle deployment

This setup deploys the server functions and schedules a check every minute. The database closes groups after 20 minutes; the lifecycle function then deletes the LiveKit room and marks teardown complete. Token issuance also caps each token's lifetime at the group's 20-minute deadline.

## 1. Configure server secrets

From the repository root, set the project-specific LiveKit credentials and a long random lifecycle secret:

```powershell
supabase secrets set LIVEKIT_URL="wss://your-livekit-host" LIVEKIT_API_KEY="your-api-key" LIVEKIT_API_SECRET="your-api-secret" SESSION_LIFECYCLE_SECRET="your-long-random-secret"
```

Keep these values in the Supabase secret store; do not commit them. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are supplied to deployed Edge Functions by Supabase.

## 2. Apply and deploy

Apply migration `012_session_events_and_consent.sql`, then deploy these functions:

```powershell
supabase functions deploy livekit-token
supabase functions deploy event-recommendations
supabase functions deploy contact-exchange
supabase functions deploy session-lifecycle
```

The first three functions validate the caller's Supabase access token. The lifecycle function uses `x-session-lifecycle-secret` because its caller is the database scheduler.

## 3. Schedule room cleanup

In the Supabase SQL Editor, store the project URL, publishable (or anon) API key, and the same lifecycle secret in Vault. Replace the placeholders with actual values without putting them in source control:

```sql
select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'session_project_url');
select vault.create_secret('YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY', 'session_publishable_key');
select vault.create_secret('YOUR_SESSION_LIFECYCLE_SECRET', 'session_lifecycle_secret');
```

Then create the minute schedule:

```sql
select cron.schedule(
  'expire-livekit-groups',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'session_project_url')
      || '/functions/v1/session-lifecycle',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'session_publishable_key'),
      'x-session-lifecycle-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'session_lifecycle_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

The database extensions `pg_cron` and `pg_net` are enabled by migration 012. Supabase's scheduler guide also documents invoking Edge Functions with `pg_cron` and `pg_net` and storing credentials in Vault: https://supabase.com/docs/guides/functions/schedule-functions.

## Client request contracts

- `POST /functions/v1/livekit-token` with the caller's Supabase bearer token and `{ "groupId": "..." }` returns `{ serverUrl, participantToken, groupId, expiresAt }` only for an active group member.
- `POST /functions/v1/event-recommendations` with `{ "groupId": "..." }` returns up to three upcoming events after the group ends.
- `POST /functions/v1/contact-exchange` with `{ "groupId": "...", "otherProfileId": "...", "consent": true }` records or revokes the caller's consent. Contact details are returned only once both people consent.
- `POST /functions/v1/session-lifecycle` is for the scheduled server request only; it requires `x-session-lifecycle-secret`.

Prompt voting uses the authenticated database RPC `vote_on_group_prompt(group_prompt_id, vote)` with `vote` set to `skip` or `keep`. A strict majority of currently active group members skips the prompt.

Event ranking uses overlap between group members' selected interests and `event_interests`. Add event-to-interest tags as part of event ingestion; events without tags cannot be matched by this ranking function.
