import { AccessToken } from "npm:livekit-server-sdk@2.19.1";
import { authenticatedUser, createAdminClient, corsHeaders, isUuid, jsonResponse } from "../_shared/http.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const admin = createAdminClient();
    const user = await authenticatedUser(request, admin);
    if (!user) return jsonResponse({ error: "A valid signed-in session is required." }, 401);

    const body = await request.json().catch(() => null);
    const groupId = body?.groupId;
    if (!isUuid(groupId)) return jsonResponse({ error: "A valid groupId is required." }, 400);

    const { data: member, error: memberError } = await admin
      .from("group_members")
      .select("group_id")
      .eq("group_id", groupId)
      .eq("profile_id", user.id)
      .is("left_at", null)
      .maybeSingle();

    if (memberError) throw memberError;
    if (!member) return jsonResponse({ error: "You are not an active member of this group." }, 403);

    const { data: group, error: groupError } = await admin
      .from("groups")
      .select("id,status,started_at,ended_at,livekit_room_name")
      .eq("id", groupId)
      .maybeSingle();

    if (groupError) throw groupError;
    if (!group || group.status !== "active" || group.ended_at) {
      return jsonResponse({ error: "This group is not active." }, 403);
    }

    const startedAt = group.started_at ? Date.parse(group.started_at) : Number.NaN;
    const remainingSeconds = Math.floor((startedAt + 20 * 60 * 1000 - Date.now()) / 1000);
    if (!Number.isFinite(startedAt) || remainingSeconds <= 0) {
      return jsonResponse({ error: "This group's 20-minute session has ended." }, 410);
    }

    const livekitUrl = Deno.env.get("LIVEKIT_URL");
    const livekitApiKey = Deno.env.get("LIVEKIT_API_KEY");
    const livekitApiSecret = Deno.env.get("LIVEKIT_API_SECRET");
    if (!livekitUrl || !livekitApiKey || !livekitApiSecret) {
      throw new Error("LiveKit server credentials are not configured.");
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    const roomName = group.livekit_room_name || group.id;
    const token = new AccessToken(livekitApiKey, livekitApiSecret, {
      identity: user.id,
      name: profile?.display_name || "Participant",
      ttl: remainingSeconds,
    });
    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return jsonResponse({
      serverUrl: livekitUrl,
      participantToken: await token.toJwt(),
      groupId: group.id,
      expiresAt: new Date(Date.now() + remainingSeconds * 1000).toISOString(),
    });
  } catch (error) {
    console.error("LiveKit token request failed:", error);
    return jsonResponse({ error: "Unable to issue a LiveKit token." }, 500);
  }
});
