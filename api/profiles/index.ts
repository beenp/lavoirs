type ApiRequest = {
  method?: string;
  headers: { authorization?: string | string[] };
  body?: unknown;
};

type ApiResponse = {
  status(code: number): ApiResponse;
  json(body: unknown): void;
};

type SavedProfileRow = {
  id: string;
  display_name: string;
  description: string | null;
};

declare const process: {
  env: Record<string, string | undefined>;
};

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const authorization = req.headers.authorization;
  const accessToken = typeof authorization === "string" && authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!accessToken) {
    res.status(401).json({ error: "missing_access_token" });
    return;
  }

  if (typeof req.body !== "object" || req.body === null || Array.isArray(req.body)) {
    res.status(400).json({ error: "invalid_request_body" });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
  const hasValidDescription = body.description === undefined
    || body.description === null
    || typeof body.description === "string";
  const description = typeof body.description === "string" ? body.description.trim() : "";

  if (!hasValidDescription || displayName.length < 1 || displayName.length > 80 || description.length > 600) {
    res.status(400).json({ error: "invalid_profile_fields" });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !publishableKey) {
    res.status(500).json({ error: "supabase_environment_not_configured" });
    return;
  }

  try {
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!authResponse.ok) {
      res.status(401).json({ error: "invalid_access_token" });
      return;
    }

    const authUser: unknown = await authResponse.json();

    if (typeof authUser !== "object" || authUser === null || Array.isArray(authUser)
      || typeof (authUser as { id?: unknown }).id !== "string") {
      res.status(401).json({ error: "invalid_access_token" });
      return;
    }

    const userId = (authUser as { id: string }).id;
    const profileResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?on_conflict=id`, {
      method: "POST",
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({
        id: userId,
        display_name: displayName,
        description: description || null,
      }),
    });

    if (!profileResponse.ok) {
      res.status(profileResponse.status === 403 ? 403 : 502).json({ error: "profile_save_failed" });
      return;
    }

    const rows = await profileResponse.json() as SavedProfileRow[];
    const savedProfile = rows[0];

    if (!savedProfile) {
      res.status(502).json({ error: "profile_save_failed" });
      return;
    }

    res.status(200).json({
      profile: {
        id: savedProfile.id,
        displayName: savedProfile.display_name,
        description: savedProfile.description,
      },
    });
  } catch {
    res.status(502).json({ error: "supabase_unavailable" });
  }
}
