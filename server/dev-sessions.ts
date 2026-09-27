import { randomUUID } from 'node:crypto';
import type { Profile } from '../packages/shared/src/profile.js';

const sessions = new Map<string, { user: { id: string; email: string }; profile: Profile | null; groupId: string }>();
export function localDevelopment(headers: Record<string, unknown>) {
  return process.env.NODE_ENV === 'development' && process.env.DEV_FAKE_USER_AUTH === 'true'
    && typeof headers.host === 'string' && /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(headers.host);
}
export function readDevSession(cookie: unknown) {
  const key = typeof cookie === 'string' ? cookie.split(';').map(s => s.trim()).find(s => s.startsWith('lavoirs_dev='))?.slice(12) : undefined;
  return key ? sessions.get(key) : undefined;
}
export function deleteDevSession(cookie: unknown) {
  const key = typeof cookie === 'string' ? cookie.split(';').map(s => s.trim()).find(s => s.startsWith('lavoirs_dev='))?.slice(12) : undefined;
  if (key) sessions.delete(key);
}
export function createDevSession(email: string) {
  const counts = new Map<string, number>();
  for (const session of sessions.values()) counts.set(session.groupId, (counts.get(session.groupId) ?? 0) + 1);
  const groupId = [...counts].find(([, count]) => count < 4)?.[0] ?? `local-${randomUUID()}`;
  const key = randomUUID();
  const session = { user: { id: randomUUID(), email }, profile: null, groupId };
  sessions.set(key, session);
  return { key, session };
}
export function devGroup(session: NonNullable<ReturnType<typeof readDevSession>>) {
  const participants = [...sessions.values()].filter(s => s.groupId === session.groupId).map(s => ({
    id: s.user.id, name: s.profile?.name || s.user.email.split('@')[0], interests: s.profile?.interests ?? [],
  }));
  return { id: session.groupId, roomId: session.groupId, participants };
}
