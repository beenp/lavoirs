import { randomUUID } from 'node:crypto';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { readDevSession } from '../../server/dev-sessions.js';
import type { LiveKitTokenRequest, LiveKitTokenResponse } from '../../packages/shared/src/livekit.js';

interface TokenRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface TokenResponseWriter {
  status(code: number): TokenResponseWriter;
  json(payload: unknown): unknown;
  setHeader?(name: string, value: string): void;
}

function readBody(body: unknown): LiveKitTokenRequest | null {
  if (!body || typeof body !== 'object' || !('groupId' in body)) return null;
  const groupId = (body as { groupId?: unknown }).groupId;
  return typeof groupId === 'string' && groupId.length > 0 && groupId.length <= 100
    ? { groupId }
    : null;
}

function readDemoBody(body: unknown): { displayName: string; inviteCode: string } | null {
  if (!body || typeof body !== 'object') return null;
  const value = body as { displayName?: unknown; inviteCode?: unknown };
  if (typeof value.displayName !== 'string' || typeof value.inviteCode !== 'string') return null;
  const displayName = value.displayName.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!displayName || displayName.length > 40 || value.inviteCode.length > 128) return null;
  return { displayName, inviteCode: value.inviteCode };
}

function isDemoBody(body: unknown): boolean {
  return !!body && typeof body === 'object' && ('displayName' in body || 'inviteCode' in body);
}

async function issueDemoRoomToken(
  displayName: string,
  inviteCode: string,
  res: TokenResponseWriter,
) {
  const expectedCode = process.env.MVP_INVITE_CODE;
  if (!expectedCode) return res.status(503).json({ error: 'The demo invite code is not configured on the server.' });
  if (inviteCode !== expectedCode) return res.status(401).json({ error: 'That invite code is not valid.' });

  const { LIVEKIT_URL: serverUrl, LIVEKIT_API_KEY: apiKey, LIVEKIT_API_SECRET: apiSecret } = process.env;
  if (!serverUrl || !apiKey || !apiSecret) {
    return res.status(503).json({ error: 'LiveKit Cloud credentials are not configured on the server.' });
  }

  try {
    const roomName = 'lavoirs-demo-room';
    const apiHost = serverUrl.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
    const roomService = new RoomServiceClient(apiHost, apiKey, apiSecret);
    let rooms = await roomService.listRooms([roomName]);
    if (!rooms.length) {
      try {
        await roomService.createRoom({ name: roomName, maxParticipants: 4, emptyTimeout: 60, departureTimeout: 20 });
      } catch {
        // Concurrent first joins can race to create the same room. Continue if
        // the other request successfully created it.
        rooms = await roomService.listRooms([roomName]);
        if (!rooms.length) throw new Error('Could not create the demo room.');
      }
    }
    if ((await roomService.listParticipants(roomName)).length >= 4) {
      return res.status(409).json({ error: 'This demo room already has four people. Ask the host for another session.' });
    }

    const accessToken = new AccessToken(apiKey, apiSecret, {
      identity: randomUUID(),
      name: displayName,
      ttl: '10m',
    });
    accessToken.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true, canPublishData: false });
    const response: LiveKitTokenResponse = {
      serverUrl,
      participantToken: await accessToken.toJwt(),
      roomName,
      participantName: displayName,
    };
    return res.status(200).json(response);
  } catch {
    return res.status(502).json({ error: 'Could not prepare the LiveKit demo room.' });
  }
}

export default async function handler(req: TokenRequest, res: TokenResponseWriter) {
  res.setHeader?.('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST to request room access.' });
  }

  // Minimal public-demo path: an invite code admits a participant to one
  // shared room. Credentials stay server-side; Supabase auth is not required.
  if (isDemoBody(req.body)) {
    const demo = readDemoBody(req.body);
    if (!demo) return res.status(400).json({ error: 'Enter a display name (up to 40 characters) and invite code.' });
    return issueDemoRoomToken(demo.displayName, demo.inviteCode, res);
  }

  // Local sessions are enabled only on this computer in development.
  // Production must use verified auth and database group membership.
  const hostHeader = req.headers.host;
  const localHost = typeof hostHeader === 'string' && /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(hostHeader);
  if (process.env.NODE_ENV !== 'development' || process.env.DEV_FAKE_USER_AUTH !== 'true' || !localHost) {
    return res.status(503).json({ error: 'Room authentication is not configured.' });
  }

  const session = readDevSession(req.headers.cookie);
  if (!session) return res.status(401).json({ error: 'Please sign in before joining a room.' });
  const request = readBody(req.body);
  if (!request) {
    return res.status(400).json({ error: 'A groupId is required.' });
  }

  if (request.groupId !== session.groupId || !session.profile) {
    return res.status(403).json({ error: 'This user is not a member of that group.' });
  }

  const { LIVEKIT_URL: serverUrl, LIVEKIT_API_KEY: apiKey, LIVEKIT_API_SECRET: apiSecret } = process.env;
  if (!serverUrl || !apiKey || !apiSecret) {
    return res.status(503).json({ error: 'Add LiveKit credentials to .env.local, then restart the dev server.' });
  }

  try {
    // The room name and participant identity come from the server-side match,
    // not from caller-controlled token claims.
    const roomName = `lavoirs_${session.groupId}`;
    const accessToken = new AccessToken(apiKey, apiSecret, {
      identity: session.user.id,
      name: session.profile.name,
      ttl: '10m',
    });
    accessToken.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
    });

    const response: LiveKitTokenResponse = {
      serverUrl,
      participantToken: await accessToken.toJwt(),
      roomName,
      participantName: session.profile.name,
    };
    return res.status(200).json(response);
  } catch {
    return res.status(500).json({ error: 'Could not create room access.' });
  }
}
