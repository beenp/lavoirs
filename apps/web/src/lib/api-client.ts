export type ProfileSubmission = {
  displayName: string;
  description?: string;
};

export type SavedProfile = {
  id: string;
  displayName: string;
  description: string | null;
};

export async function saveProfile(
  accessToken: string,
  profile: ProfileSubmission,
): Promise<SavedProfile> {
  const response = await fetch("/api/profiles", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(profile),
  });

  const result = await response.json() as {
    profile?: SavedProfile;
    error?: string;
  };

  if (!response.ok || !result.profile) {
    throw new Error(result.error ?? "profile_save_failed");
  }

  return result.profile;
}
