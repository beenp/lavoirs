import type { AppServices, AuthSession } from '../../../../packages/shared/src/auth';
import type { Profile } from '../../../../packages/shared/src/profile';

export function createDemoServices(): AppServices {
  let session: AuthSession | null = null;
  let profile: Profile | null = null;
  const listeners = new Set<(session: AuthSession | null) => void>();
  return {
    auth: {
      mode: 'demo',
      requiresPassword: false,
      async getSession() { return session; },
      async authenticate({ email }) {
        session = { user: { id: crypto.randomUUID(), email } };
        profile = null;
        listeners.forEach(listener => listener(session));
        return { status: 'authenticated', session };
      },
      async signOut() {
        session = null;
        profile = null;
        listeners.forEach(listener => listener(null));
      },
      onSessionChange(listener) {
        listeners.add(listener);
        return () => { listeners.delete(listener); };
      },
    },
    profiles: {
      async getMyProfile() {
        if (!session) throw new Error('Please sign in again.');
        return profile;
      },
      async saveMyProfile(input) {
        if (!session) throw new Error('Please sign in again.');
        profile = { ...input, id: session.user.id, email: session.user.email };
        return profile;
      },
    },
  };
}

