import type { MatchGroup, GroupMember } from '../../../../../packages/shared/src/matching';
import { LiveKitRoom } from './LiveKitRoom';

export default function RoomPage({ group, user, onLeave }: { group: MatchGroup; user: GroupMember; onLeave: () => void }) {
  return <section className="page-content">
    <div className="eyebrow">YOUR ROOM</div>
    <h1>You’ve found <em>your group.</em></h1>
    <p className="muted">Your conversation starts with a shared interest. Join when you’re ready.</p>
    <LiveKitRoom groupId={group.id} user={user}/>
    <div className="surface room-prompt"><div className="eyebrow">A LITTLE ICEBREAKER</div><h2>What got you into {user.interests[0]?.toLowerCase() || 'your interests'}, and what would you recommend to someone new?</h2></div>
    <button className="primary" onClick={onLeave}>Back to the queue</button>
  </section>;
}
