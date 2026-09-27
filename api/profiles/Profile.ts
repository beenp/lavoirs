export interface UserLocation {
  /** Exact latitude in decimal degrees. Keep this server-side. */
  latitude: number;
  /** Exact longitude in decimal degrees. Keep this server-side. */
  longitude: number;
}

export interface UserOptions {
  id: string;
  name: string;
  hobbies?: string[];
  interests?: string[];
  location: UserLocation;
  inQueue?: boolean;
  groupId?: string | null;
}

/** User data used by the matchmaking system. */
export class User {
  readonly id: string;
  name: string;
  hobbies: string[]; // this is the users profile interests
  interests: string[]; // interests used for matching in each session
  
  location: UserLocation;
  inQueue: boolean;
  groupId: string | null;

  constructor(options: UserOptions) {
    if (!options.id.trim()) throw new Error("User id is required");
    if (!Number.isFinite(options.location.latitude) || options.location.latitude < -90 || options.location.latitude > 90) {
      throw new Error("Latitude must be between -90 and 90");
    }
    if (!Number.isFinite(options.location.longitude) || options.location.longitude < -180 || options.location.longitude > 180) {
      throw new Error("Longitude must be between -180 and 180");
    }

    this.id = options.id;
    this.name = options.name;
    this.hobbies = [...(options.hobbies ?? [])];
    this.interests = [...(options.interests ?? [])];
    this.location = { ...options.location };
    this.inQueue = options.inQueue ?? false;
    this.groupId = options.groupId ?? null;
  }
}
