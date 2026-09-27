import type { AppServices, AuthSession } from '../../../../packages/shared/src/auth';
import { createHttpProfileService } from './profile-service';

export async function localRequest(path: string, options: RequestInit = {}) {
  const response = await fetch(`/api/dev/${path}`, { ...options, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...options.headers } });
  if (!response.ok) throw new Error('The local API request failed. Make sure npm run dev is running.');
  return response.json();
}
export function createLocalServices(): AppServices {
  const listeners = new Set<(session: AuthSession | null) => void>();
  return {
    auth: {
      mode: 'demo', requiresPassword: false,
      getSession: () => localRequest('session'),
      async authenticate({ email }) {
        const session: AuthSession = await localRequest('session', { method: 'POST', body: JSON.stringify({ email }) });
        listeners.forEach(listener => listener(session));
        return { status: 'authenticated', session };
      },
      async signOut() { await localRequest('session', { method: 'DELETE' }); listeners.forEach(listener => listener(null)); },
      onSessionChange(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    },
    profiles: createHttpProfileService({ endpoint: '/api/dev/profile' }),
  };
}
