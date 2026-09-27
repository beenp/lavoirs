export interface Participant { id: string; name: string; interests: string[] }
export type GroupMember = Participant;
export interface MatchmakingResult { groupId: string; members: GroupMember[] }
export interface MatchGroup { id: string; participants: Participant[]; roomId: string }
export type QueueState = { status: 'idle' } | { status: 'waiting'; participants: Participant[] } | { status: 'matched'; group: MatchGroup };
export interface MatchmakingService { join(profileId: string): Promise<void>; leave(): Promise<void>; subscribe(listener: (state: QueueState) => void): () => void }
