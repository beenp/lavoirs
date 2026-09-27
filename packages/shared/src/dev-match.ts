import type { GroupMember, MatchmakingResult } from './matching.js';

// Local-only demo data. The token endpoint checks membership against this
// server-side fixture; it never trusts a member list sent by the browser.
export const DEV_MATCH: MatchmakingResult = {
  groupId: 'hackathon-room-001',
  members: [
    { id: 'fake-jordan', name: 'Jordan Lee', interests: ['indie games', 'art & design'] },
    { id: 'fake-alex', name: 'Alex Chen', interests: ['indie games', 'music'] },
    { id: 'fake-sam', name: 'Sam Rivera', interests: ['indie games', 'art & design'] },
    { id: 'fake-priya', name: 'Priya Shah', interests: ['indie games', 'music'] },
  ],
};

export const DEV_USERS: GroupMember[] = DEV_MATCH.members;
