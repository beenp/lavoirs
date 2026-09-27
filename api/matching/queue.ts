import type { User } from "../profiles/Profile";

/** Users waiting to be grouped, plus the matching policy for this queue. */
export class MatchQueue {
  private readonly users: User[] = [];
  private readonly waitingSince = new Map<string, number>();

  constructor(
    readonly groupSize = 4,
    readonly maxDistanceKm = 50,
    readonly fallbackAfterMs = 60_000,
  ) {
    if (!Number.isInteger(groupSize) || groupSize < 2) {
      throw new Error("groupSize must be an integer of at least 2");
    }
    if (!Number.isFinite(maxDistanceKm) || maxDistanceKm <= 0) {
      throw new Error("maxDistanceKm must be positive");
    }
    if (!Number.isFinite(fallbackAfterMs) || fallbackAfterMs < 0) {
      throw new Error("fallbackAfterMs must be zero or greater");
    }
  }

  /** Add a user who has chosen interests for this session. */
  join(user: User): void {
    if (user.groupId) throw new Error("User already belongs to a group");
    if (this.users.some((queuedUser) => queuedUser.id === user.id)) return;
    if (user.interests.length === 0) throw new Error("Select at least one session interest");

    user.inQueue = true;
    this.users.push(user);
    this.waitingSince.set(user.id, Date.now());
  }

  /** Remove a waiting user. Returns false when they are not in this queue. */
  leave(userId: string): boolean {
    const index = this.users.findIndex((user) => user.id === userId);
    if (index < 0) return false;
    this.users[index].inQueue = false;
    this.users.splice(index, 1);
    this.waitingSince.delete(userId);
    return true;
  }

  get size(): number {
    return this.users.length;
  }

  /** Return a snapshot of IDs, not the internal user array. */
  getWaitingUserIds(): string[] {
    return this.users.map((user) => user.id);
  }

  /**
   * Select complete groups without creating them or changing user state.
   * Groups is responsible for creating Group objects and removing their users.
   */
  findGroupCandidates(now = new Date()): User[][] {
    const available = [...this.users];
    const candidates: User[][] = [];

    while (available.length >= this.groupSize) {
      const sharedInterestGroup = this.findSharedInterestGroup(available);
      if (sharedInterestGroup) {
        candidates.push(sharedInterestGroup);
        this.removeFromList(available, sharedInterestGroup);
        continue;
      }

      const oldestWait = Math.min(
        ...available.map((user) => this.waitingSince.get(user.id) ?? now.getTime()),
      );
      if (now.getTime() - oldestWait < this.fallbackAfterMs) break;

      const nearbyGroup = this.findNearbyGroup(available);
      if (!nearbyGroup) break;
      candidates.push(nearbyGroup);
      this.removeFromList(available, nearbyGroup);
    }

    return candidates;
  }

  /** Called by Groups after it successfully creates a group for these users. */
  removeMatchedUsers(users: User[]): void {
    for (const user of users) {
      const index = this.users.findIndex((queuedUser) => queuedUser.id === user.id);
      if (index >= 0) this.users.splice(index, 1);
      this.waitingSince.delete(user.id);
    }
  }

  private findSharedInterestGroup(available: User[]): User[] | undefined {
    for (const anchor of available) {
      const group = [anchor];
      let sharedInterests = [...anchor.interests];
      const nearby = available
        .filter((user) => user !== anchor && this.areNearby(anchor, user))
        .sort((a, b) => (this.waitingSince.get(a.id) ?? 0) - (this.waitingSince.get(b.id) ?? 0));

      for (const candidate of nearby) {
        if (!group.every((member) => this.areNearby(member, candidate))) continue;
        const intersection = sharedInterests.filter((interest) => candidate.interests.includes(interest));
        if (intersection.length === 0) continue;
        group.push(candidate);
        sharedInterests = intersection;
        if (group.length === this.groupSize) return group;
      }
    }
    return undefined;
  }

  private findNearbyGroup(available: User[]): User[] | undefined {
    for (const anchor of available) {
      const group = [anchor];
      const nearby = available
        .filter((user) => user !== anchor && this.areNearby(anchor, user))
        .sort((a, b) => {
          const overlap = this.pairInterestCount(b, group) - this.pairInterestCount(a, group);
          return overlap || this.distanceKm(anchor, a) - this.distanceKm(anchor, b);
        });

      for (const candidate of nearby) {
        if (!group.every((member) => this.areNearby(member, candidate))) continue;
        group.push(candidate);
        if (group.length === this.groupSize) return group;
      }
    }
    return undefined;
  }

  private pairInterestCount(user: User, group: User[]): number {
    return group.reduce(
      (total, member) => total + user.interests.filter((interest) => member.interests.includes(interest)).length,
      0,
    );
  }

  private areNearby(a: User, b: User): boolean {
    return this.distanceKm(a, b) <= this.maxDistanceKm;
  }

  private distanceKm(a: User, b: User): number {
    const radians = (degrees: number) => (degrees * Math.PI) / 180;
    const latitudeDelta = radians(b.location.latitude - a.location.latitude);
    const longitudeDelta = radians(b.location.longitude - a.location.longitude);
    const haversine =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(radians(a.location.latitude)) *
        Math.cos(radians(b.location.latitude)) *
        Math.sin(longitudeDelta / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  }

  private removeFromList(list: User[], users: User[]): void {
    const ids = new Set(users.map((user) => user.id));
    for (let index = list.length - 1; index >= 0; index--) {
      if (ids.has(list[index].id)) list.splice(index, 1);
    }
  }
}
