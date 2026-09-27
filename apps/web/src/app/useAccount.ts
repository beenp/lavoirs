import { useEffect, useRef, useState } from 'react';
import type { AppServices, AuthInput, AuthSession } from '../../../../packages/shared/src/auth';
import type { Profile } from '../../../../packages/shared/src/profile';

export function useAccount(services: AppServices, onProfile: (profile: Profile | null) => void) {
    const [busy, setBusy] = useState(true);
    const [initializing, setInitializing] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const callback = useRef(onProfile);
    callback.current = onProfile;
    const revision = useRef(0);
    const receiveRef = useRef<(session: AuthSession | null) => Promise<void>>(async () => { });

    useEffect(() => {
        let active = true;
        let receivedEvent = false;
        let userId: string | null | undefined;
        async function receive(session: AuthSession | null) {
            if (!active || userId === (session?.user.id ?? null)) return;
            userId = session?.user.id ?? null;
            const request = ++revision.current;
            setBusy(true); setError(''); setNotice('');
            callback.current(null);
            try {
                if (!session) return;
                const saved = await services.profiles.getMyProfile();
                if (!active || request !== revision.current) return;
                if (saved && saved.id !== session.user.id) throw new Error('Profile identity mismatch');
                callback.current(saved ?? { id: session.user.id, email: session.user.email, name: '', location: '', description: '', interests: [], radiusKm: 25, transcriptionConsent: false });
            } catch {
                userId = undefined;
                if (active && request === revision.current) setError('Could not load your profile. Please sign in again.');
            } finally { if (active && request === revision.current) { setBusy(false); setInitializing(false); } }
        }
        receiveRef.current = receive;
        const unsubscribe = services.auth.onSessionChange(session => { receivedEvent = true; void receive(session); });
        services.auth.getSession().then(session => { if (!receivedEvent) void receive(session); }).catch(() => {
            if (active && !receivedEvent) { setError('Could not restore your session. Please sign in again.'); setBusy(false); setInitializing(false); }
        });
        return () => { active = false; revision.current++; unsubscribe(); };
    }, [services]);

    async function login(input: AuthInput) {
        setBusy(true); setError(''); setNotice('');
        const before = revision.current;
        try {
            const result = await services.auth.authenticate(input);
            if (result.status === 'pending') setNotice(result.message);
            else await receiveRef.current(result.session);
        } catch { setError('Unable to sign in. Check your details and try again.'); }
        finally { if (before === revision.current) setBusy(false); }
    }
    async function logout() {
        setBusy(true); setError('');
        try { await services.auth.signOut(); await receiveRef.current(null); }
        catch { setError('Could not sign out. Please try again.'); }
        finally { setBusy(false); }
    }
    async function save(profile: Profile, onSaved: (profile: Profile) => void) {
        const request = revision.current;
        setBusy(true); setError('');
        try {
            const { id: _id, email: _email, ...input } = profile;
            const saved = await services.profiles.saveMyProfile(input);
            if (request === revision.current) {
                if (saved.id !== profile.id) throw new Error('Profile identity mismatch');
                onSaved(saved);
            }
        } catch { if (request === revision.current) setError('Could not save your profile. Please try again.'); }
        finally { if (request === revision.current) setBusy(false); }
    }
    return { busy, initializing, error, notice, login, logout, save };
}
