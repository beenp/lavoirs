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

    const { data: membership, error: membershipError } = await admin
      .from("group_members")
      .select("group_id")
      .eq("group_id", groupId)
      .eq("profile_id", user.id)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) return jsonResponse({ error: "You were not a member of this group." }, 403);

    const { data: group, error: groupError } = await admin
      .from("groups")
      .select("status,ended_at")
      .eq("id", groupId)
      .maybeSingle();
    if (groupError) throw groupError;

    const endedAt = group?.ended_at ? Date.parse(group.ended_at) : Number.NaN;
    if (!group || group.status !== "ended" || !Number.isFinite(endedAt)
      || Date.now() - endedAt > 14 * 24 * 60 * 60 * 1000) {
      return jsonResponse({ error: "Recommendations are available after the group session ends." }, 409);
    }

    const { error: generationError } = await admin.rpc(
      "generate_group_event_recommendations",
      { p_group_id: groupId },
    );
    if (generationError) throw generationError;

    const { data: recommendations, error: recommendationError } = await admin
      .from("group_event_recommendations")
      .select("id,event_id,recommendation_rank")
      .eq("group_id", groupId)
      .order("recommendation_rank");
    if (recommendationError) throw recommendationError;

    const eventIds = (recommendations ?? []).map((recommendation) => recommendation.event_id);
    if (eventIds.length === 0) return jsonResponse({ recommendations: [] });

    const { data: events, error: eventError } = await admin
      .from("events")
      .select("id,title,description,starts_at,ends_at,venue_name,venue_address,city,region,event_url")
      .in("id", eventIds);
    if (eventError) throw eventError;

    const eventById = new Map((events ?? []).map((event) => [event.id, event]));
    return jsonResponse({
      recommendations: (recommendations ?? []).flatMap((recommendation) => {
        const event = eventById.get(recommendation.event_id);
        return event ? [{ ...recommendation, event }] : [];
      }),
    });
  } catch (error) {
    console.error("Event recommendation request failed:", error);
    return jsonResponse({ error: "Unable to load event recommendations." }, 500);
  }
});
