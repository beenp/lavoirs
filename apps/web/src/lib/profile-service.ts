import type { ProfileInput, ProfileService } from '../../../../packages/shared/src/auth';
import type { Profile } from '../../../../packages/shared/src/profile';

/** Backend-independent transport. Supply authenticated fetch, or map your SDK here. */
export interface ProfileTransport {
  read(): Promise<unknown>;
  write(input: ProfileInput): Promise<unknown>;
}

export function parseProfile(value: unknown): Profile {
  if (!value || typeof value !== 'object') throw new Error('Invalid profile response');
  const p = value as Record<string, unknown>;
  const strings = ['id', 'email', 'name', 'location', 'description'] as const;
  if (strings.some(key => typeof p[key] !== 'string') || !p.id || !p.email
    || !Array.isArray(p.interests) || p.interests.some(i => typeof i !== 'string')
    || typeof p.radiusKm !== 'number' || !Number.isFinite(p.radiusKm) || p.radiusKm < 5 || p.radiusKm > 100
    || typeof p.transcriptionConsent !== 'boolean') throw new Error('Invalid profile response');
  // Explicit mapping prevents provider metadata or private columns reaching UI state.
  return {
    id: p.id as string, email: p.email as string, name: p.name as string,
    location: p.location as string, description: p.description as string,
    interests: [...p.interests] as string[], radiusKm: p.radiusKm,
    transcriptionConsent: p.transcriptionConsent,
  };
}

export function profileInput(profile: ProfileInput): ProfileInput {
  return {
    name: profile.name.trim(), location: profile.location.trim(),
    description: profile.description.trim(), interests: [...profile.interests],
    radiusKm: profile.radiusKm, transcriptionConsent: profile.transcriptionConsent,
  };
}

export function createProfileService(transport: ProfileTransport): ProfileService {
  return {
    async getMyProfile() {
      const result = await transport.read();
      return result === null ? null : parseProfile(result);
    },
    async saveMyProfile(input) {
      return parseProfile(await transport.write(profileInput(input)));
    },
  };
}

/** Optional HTTP adapter. The endpoint is a proposed contract, not an implemented API. */
export function createHttpProfileService(options: {
  endpoint?: string;
  fetch?: typeof fetch;
  getAccessToken?: () => Promise<string | null>;
} = {}): ProfileService {
  async function request(method: 'GET' | 'PUT', input?: ProfileInput) {
    const token = await options.getAccessToken?.();
    const response = await (options.fetch ?? fetch)(options.endpoint ?? '/api/profiles/me', {
      method, credentials: 'same-origin', cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(input ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(input ? { body: JSON.stringify(input) } : {}),
    });
    if (!response.ok) throw new Error(`Profile request failed (${response.status})`);
    return response.json();
  }
  return createProfileService({ read: () => request('GET'), write: input => request('PUT', input) });
}
