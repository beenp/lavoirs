import { useEffect, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { Profile } from '../../../../packages/shared/src/profile';
import type { MatchGroup } from '../../../../packages/shared/src/matching';
import type { AppServices } from '../../../../packages/shared/src/auth';
import type { useAccount } from './useAccount';
import LoginPage from '../features/auth/LoginPage';
import ProfilePage from '../features/profile/ProfilePage';
import MatchingPage from '../features/matching/MatchingPage';
import RoomPage from '../features/room/RoomPage';
import EventRecommendations from '../features/events/EventRecommendations';
import PublicDemoPage from '../features/room/PublicDemoPage';

interface Props {
    services: AppServices;
    profile: Profile | null;
    group: MatchGroup | null;
    setProfile: (profile: Profile) => void;
    setGroup: (group: MatchGroup | null) => void;
    account: ReturnType<typeof useAccount>;
}

export function hasCompleteProfile(profile: Profile | null) {
    return !!(profile?.name.trim() && profile.location.trim() && profile.interests.length);
}

function RoomRoute({ group, profile, onLeave, onEvents }: { group: MatchGroup | null; profile: Profile | null; onLeave: () => void; onEvents: () => void }) {
    const { roomId } = useParams();
    if (!group || !profile || roomId !== group.roomId || !group.participants.some(p => p.id === profile.id)) return <Navigate to="/queue" replace />;
    return <><RoomPage group={group} user={profile} onLeave={onLeave} /><div className="route-actions"><button className="primary" onClick={onEvents}>Preview what comes next →</button><p className="field-hint">Demo shortcut to the follow-up page. The live session timer is not connected.</p></div></>;
}

export default function AppRoutes({ services, profile, group, setProfile, setGroup, account }: Props) {
    const navigate = useNavigate();
    const location = useLocation();
    const home = !profile ? '/login' : hasCompleteProfile(profile) ? '/queue' : '/profile';

    useEffect(() => {
        const titles: Record<string, string> = { '/': 'Live demo room', '/login': 'Log in', '/signup': 'Join the party', '/profile': 'Your profile', '/queue': 'Find your group', '/events': 'Meet again' };
        document.title = `${titles[location.pathname] ?? (location.pathname.startsWith('/rooms/') ? 'Your room' : 'Lavoirs')} · Lavoirs`;
        window.scrollTo(0, 0);
        document.querySelector<HTMLElement>('main')?.focus({ preventScroll: true });
    }, [location.pathname]);

    function protect(page: ReactNode, complete = false) {
        if (!profile) return <Navigate to="/login" replace />;
        if (complete && !hasCompleteProfile(profile)) return <Navigate to="/profile" replace />;
        return page;
    }
    function leaveRoom() { setGroup(null); navigate('/queue', { replace: true }); }

    return <Routes>
        <Route path="/" element={<PublicDemoPage />} />
        <Route path="/login" element={profile ? <Navigate to={home} replace /> : <LoginPage key="login" onContinue={account.login} demo={services.auth.mode === 'demo'} requiresPassword={services.auth.requiresPassword} />} />
        <Route path="/signup" element={profile ? <Navigate to={home} replace /> : <LoginPage key="signup" signup onContinue={account.login} demo={services.auth.mode === 'demo'} requiresPassword={services.auth.requiresPassword} />} />
        <Route path="/profile" element={protect(profile && <ProfilePage profile={profile} onSave={draft => { void account.save(draft, saved => { setProfile(saved); navigate('/queue'); }); }} />)} />
        <Route path="/queue" element={protect(profile && <MatchingPage profile={profile} onEdit={() => navigate('/profile')} onJoin={match => { setGroup(match); navigate(`/rooms/${encodeURIComponent(match.roomId)}`); }} />, true)} />
        <Route path="/rooms/:roomId" element={protect(<RoomRoute group={group} profile={profile} onLeave={leaveRoom} onEvents={() => navigate('/events')} />, true)} />
        <Route path="/events" element={protect(group ? <EventRecommendations onBackToQueue={leaveRoom} /> : <Navigate to="/queue" replace />, true)} />
        <Route path="*" element={<section className="page-content"><div className="eyebrow">WRONG WARP PIPE</div><h1>This page wandered off.</h1><p className="muted">Let’s get you back to your people.</p><Link className="primary" to={home}>Back to the lobby</Link></section>} />
    </Routes>;
}
