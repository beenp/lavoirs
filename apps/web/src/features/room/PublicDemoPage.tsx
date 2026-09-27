import { useState, type FormEvent } from 'react';
import type { GroupMember } from '../../../../../packages/shared/src/matching';
import { requestDemoRoomToken } from '../../lib/livekit-client';
import { LiveKitRoom } from './LiveKitRoom';

const DEMO_ROOM_ID = 'lavoirs-demo-room';

export default function PublicDemoPage() {
  const [displayName, setDisplayName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [member, setMember] = useState<GroupMember | null>(null);

  function enterRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = displayName.trim();
    const code = inviteCode.trim();
    if (!name || !code) return;
    setDisplayName(name);
    setInviteCode(code);
    setMember({ id: 'demo-guest', name, interests: [] });
  }

  return <section className="page-content profile-page">
    <div className="eyebrow">LIVE DEMO ROOM</div>
    <h1>Four people.<br/><em>One conversation.</em></h1>
    <p className="muted">Enter the host’s invite code, then join with your camera and microphone.</p>
    {!member ? <form className="surface profile-form" onSubmit={enterRoom}>
      <label>Your display name<input required maxLength={40} autoComplete="name" value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="What should the group call you?"/></label>
      <label>Room invite code<input required maxLength={128} autoComplete="off" value={inviteCode} onChange={event => setInviteCode(event.target.value)} placeholder="Ask the host for the code"/></label>
      <button className="primary" type="submit">Continue to room →</button>
      <p className="field-hint">The room admits up to four people. Your browser will ask for camera and microphone access when you join.</p>
    </form> : <>
      <LiveKitRoom
        groupId={DEMO_ROOM_ID}
        user={member}
        requestToken={() => requestDemoRoomToken(member.name, inviteCode)}
        showMoviePrompts
      />
      <button className="text-button" onClick={() => setMember(null)}>Change name or invite code</button>
    </>}
  </section>;
}
