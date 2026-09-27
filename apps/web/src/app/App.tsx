import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowUpRight, AudioLines } from 'lucide-react';
import { services as defaultServices } from '../lib/services';
import type { AppServices } from '../../../../packages/shared/src/auth';
import { useAccount } from './useAccount';
import AppRoutes from './routes';
import type { Profile } from '../../../../packages/shared/src/profile';
import type { MatchGroup } from '../../../../packages/shared/src/matching';

export default function App({ services = defaultServices }: { services?: AppServices }) {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [group, setGroup] = useState<MatchGroup | null>(null);
    const location = useLocation();
    const account = useAccount(services, next => {
        setGroup(null);
        setProfile(next);
    });
    const step = location.pathname === '/' ? 'Your next adventure starts here' : location.pathname.startsWith('/rooms/') ? '03 / Say hello'
        : location.pathname === '/events' ? '04 / Meet again'
            : location.pathname === '/queue' ? '02 / Find your group' : '01 / Your profile';

    return <div className="app">
        <header className="site-header">
            <Link className="brand" to="/" aria-label="Lavoirs home"><span className="brand-mark"><AudioLines size={23} /></span>lavoirs<span className="brand-period">.</span></Link>
            <nav aria-label="Main navigation">
                {profile ? <><span className="header-note">{step}</span><button className="text-button" disabled={account.busy} onClick={account.logout}>Sign out<ArrowUpRight size={15} /></button></>
                    : location.pathname === '/' ? <span className="header-note">Invite-only video meetup</span>
                        : <><span className="header-note">Online conversations. Offline possibilities.</span><a href="#how-it-works">How it works<ArrowUpRight size={15} /></a></>}
            </nav>
        </header>
        <main tabIndex={-1}>
            {account.error && <p className="surface error" role="alert">{account.error}</p>}
            {account.notice && <p className="surface" role="status">{account.notice}</p>}
            {account.busy && <p role="status">Please wait…</p>}
            {account.initializing ? <section className="page-content" aria-label="Loading account" /> :
                <fieldset disabled={account.busy} aria-busy={account.busy}>
                    <AppRoutes services={services} profile={profile} group={group} setProfile={setProfile} setGroup={setGroup} account={account} />
                </fieldset>}
        </main>
        <footer><span>Good company starts with common ground.</span><span>Made for a more connected world <span className="footer-spark">✳</span></span></footer>
    </div>;
}
