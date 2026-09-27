import type { User } from "../profiles/Profile";
import { Group, type MatchType } from "./Group";
import { MatchQueue } from "./queue";

/** In-memory collection of groups. In production, use the groups database table. */
export class Groups {
  private readonly groups = new Map<string, Group>();
  private nextGroupId = 1;

  /**
   * Ask the queue for ready member sets, create a Group for each, and remove
   * those members from the waiting list. The queue only selects candidates;
   * Group owns user groupId/inQueue updates.
   */
  createReadyGroups(queue: MatchQueue, now = new Date()): Group[] {
    const created: Group[] = [];
    for (const candidates of queue.findGroupCandidates(now)) {
      const shared = candidates[0].interests.filter((interest) =>
        candidates.every((user) => user.interests.includes(interest)),
      );
      const matchType: MatchType = shared.length > 0 ? "shared-interest" : "nearby";
      const group = this.createGroup(candidates, matchType, now, queue.groupSize);
      queue.removeMatchedUsers(candidates);
      created.push(group);
    }
    return created;
  }

  /** Store a group and assign its members to it. */
  createGroup(
    members: User[],
    matchType: MatchType,
    createdAt = new Date(),
    expectedSize = 4,
  ): Group {
    if (members.length !== expectedSize) {
      throw new Error(`A group must contain exactly ${expectedSize} users`);
    }
    const id = `group-${this.nextGroupId++}`;
    const group = new Group(id, members, matchType, createdAt);
    this.groups.set(id, group);
    return group;
  }

  get(groupId: string): Group | undefined {
    return this.groups.get(groupId);
  }

  getAll(): Group[] {
    return [...this.groups.values()];
  }

  getActive(): Group[] {
    return [...this.groups.values()].filter((group) => group.status === "active");
  }

  end(groupId: string): boolean {
    const group = this.groups.get(groupId);
    if (!group || group.status === "ended") return false;
    group.end();
    return true;
  }
}
