import { useState } from 'react';
import { ArrowRight, MapPin, Users, Clock, Sparkles } from 'lucide-react';
import type { Profile } from '../../../../../packages/shared/src/profile';
import type { MatchGroup } from '../../../../../packages/shared/src/matching';
import { localRequest } from '../../lib/local-services';

export default function MatchingPage({ profile, onEdit, onJoin }: { profile: Profile; onEdit: () => void; onJoin: (group: MatchGroup) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function join() {
    setBusy(true); setError('');
    try {
      const group: MatchGroup = await localRequest('group');
      onJoin(group);
    } catch { setError('Could not find your room. Please make sure the local API is running and try again.'); }
    finally { setBusy(false); }
  }
  return <section className="page-content">
    <div className="eyebrow">YOUR PEOPLE ARE OUT THERE</div>
    <h1>A good conversation<br/>starts with <em>hello.</em></h1>
    <p className="muted">Four people, shared interests, and a little room for the unexpected.</p>
    <div className="queue-layout">
      <div className="surface queue-main">
        <div className="section-top"><span className="pill"><span className="status-dot"/> Local matching</span><span className="muted"><MapPin size={14}/> {profile.location} · {profile.radiusKm} km</span></div>
        <h2>Meet your next conversation.</h2>
        <p className="muted">A small group. A shared spark. No crowded rooms.</p>
        <div className="queue-people">{[0, 1, 2, 3].map(i => <div key={i}>
          <div className={`queue-avatar ${i === 0 ? 'filled color-0' : ''}`}>{i === 0 ? profile.name.slice(0, 1).toUpperCase() : <Users size={23}/>}</div>
          <strong>{i === 0 ? 'You' : 'Someone new'}</strong><small>{i === 0 ? 'Ready to connect' : 'An open seat'}</small>
        </div>)}</div>
        <div className="queue-message" role="status">{busy ? 'Finding your room…' : 'Your seat is waiting.'}</div>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy} onClick={() => void join()}>Join the queue<ArrowRight size={18}/></button>
        <p className="field-hint">Local test mode: enter immediately and wait for other browsers to join. Interest and radius matching is not connected yet.</p>
      </div>
      <aside className="queue-sidebar">
        <div className="surface"><div className="section-top"><h3>Your common ground</h3><button className="text-button" onClick={onEdit}>Edit</button></div><div className="interest-list">{profile.interests.map(i => <span className="interest selected" key={i}>{i}</span>)}</div><p className="field-hint">Matching will use your interests and approximate location.</p></div>
        <div className="surface what-next"><h3>A little of what to expect</h3><p><Users size={19}/><span><strong>Just four of you</strong>A conversation everyone has space in.</span></p><p><Sparkles size={19}/><span><strong>Skip the awkward start</strong>Prompts inspired by what you love.</span></p><p><Clock size={19}/><span><strong>20 minutes to connect</strong>Then discover local things to do together.</span></p></div>
      </aside>
    </div>
  </section>;
}
