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
    const { groupId, otherProfileId, consent } = body ?? {};
    if (!isUuid(groupId) || !isUuid(otherProfileId) || typeof consent !== "boolean") {
      return jsonResponse({ error: "groupId, otherProfileId, and boolean consent are required." }, 400);
    }
    if (otherProfileId === user.id) {
      return jsonResponse({ error: "You cannot exchange contact details with yourself." }, 400);
    }

    const { data: group, error: groupError } = await admin
      .from("groups")
      .select("status,ended_at")
      .eq("id", groupId)
      .maybeSingle();
    if (groupError) throw groupError;

    const endedAt = group?.ended_at ? Date.parse(group.ended_at) : Number.NaN;
    const accessWindowOpen = group?.status === "active"
      || (group?.status === "ended" && Number.isFinite(endedAt)
        && Date.now() - endedAt <= 14 * 24 * 60 * 60 * 1000);
    if (!accessWindowOpen) {
      return jsonResponse({ error: "Contact exchange is available during the session and for 14 days after it ends." }, 403);
    }

    const { data: members, error: membersError } = await admin
      .from("group_members")
      .select("profile_id")
      .eq("group_id", groupId)
      .in("profile_id", [user.id, otherProfileId]);
    if (membersError) throw membersError;
    const memberIds = new Set((members ?? []).map((member) => member.profile_id));
    if (!memberIds.has(user.id) || !memberIds.has(otherProfileId)) {
      return jsonResponse({ error: "Both people must have been members of this group." }, 403);
    }

    const { data: mutualConsent, error: consentError } = await admin.rpc(
      "set_contact_exchange_consent",
      {
        p_group_id: groupId,
        p_profile_id: user.id,
        p_other_profile_id: otherProfileId,
        p_consent: consent,
      },
    );
    if (consentError) throw consentError;
    if (!mutualConsent) return jsonResponse({ mutualConsent: false, contact: null });

    const [{ data: profile, error: profileError }, { data: authUser, error: authError }] = await Promise.all([
      admin.from("profiles").select("display_name").eq("id", otherProfileId).maybeSingle(),
      admin.auth.admin.getUserById(otherProfileId),
    ]);
    if (profileError) throw profileError;
    if (authError) throw authError;

    return jsonResponse({
      mutualConsent: true,
      contact: {
        displayName: profile?.display_name ?? "Participant",
        email: authUser.user.email ?? null,
      },
    });
  } catch (error) {
    console.error("Contact exchange request failed:", error);
    return jsonResponse({ error: "Unable to process contact consent." }, 500);
  }
});
