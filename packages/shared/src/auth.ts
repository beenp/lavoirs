import type { Profile } from './profile.js';

export interface AuthSession { user: { id: string; email: string } }
export interface AuthInput {
  email: string;
  intent: 'login' | 'signup';
  password?: string;
}
export type AuthResult =
  | { status: 'authenticated'; session: AuthSession }
  | { status: 'pending'; message: string };

export interface AuthService {
  mode: 'demo' | 'live';
  requiresPassword: boolean;
  getSession(): Promise<AuthSession | null>;
  authenticate(input: AuthInput): Promise<AuthResult>;
  signOut(): Promise<void>;
  // Emit null on expiry/sign-out. Return a cleanup function.
  onSessionChange(listener: (session: AuthSession | null) => void): () => void;
}

export type ProfileInput = Omit<Profile, 'id' | 'email'>;
export interface ProfileService {
  // Operate on the authenticated user, never a caller-supplied identity.
  getMyProfile(): Promise<Profile | null>;
  saveMyProfile(input: ProfileInput): Promise<Profile>;
}
export interface AppServices { auth: AuthService; profiles: ProfileService }
