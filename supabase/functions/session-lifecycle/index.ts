import { RoomServiceClient } from "npm:livekit-server-sdk@2.19.1";
import { createAdminClient, jsonResponse } from "../_shared/http.ts";

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const expectedSecret = Deno.env.get("SESSION_LIFECYCLE_SECRET");
  const suppliedSecret = request.headers.get("x-session-lifecycle-secret");
  if (!expectedSecret || suppliedSecret !== expectedSecret) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  try {
    const livekitUrl = Deno.env.get("LIVEKIT_URL");
    const livekitApiKey = Deno.env.get("LIVEKIT_API_KEY");
    const livekitApiSecret = Deno.env.get("LIVEKIT_API_SECRET");
    if (!livekitUrl || !livekitApiKey || !livekitApiSecret) {
      throw new Error("LiveKit server credentials are not configured.");
    }

    const serviceUrl = livekitUrl.replace(/^wss:/i, "https:").replace(/^ws:/i, "http:");
    const roomService = new RoomServiceClient(serviceUrl, livekitApiKey, livekitApiSecret);
    const admin = createAdminClient();
    const { data: rooms, error: processingError } = await admin.rpc("process_expired_group_sessions");
    if (processingError) throw processingError;

    let closedCount = 0;
    const failures: string[] = [];

    for (const room of rooms ?? []) {
      try {
        await roomService.deleteRoom(room.room_name);
      } catch (deleteError) {
        const liveRooms = await roomService.listRooms([room.room_name]);
        if (liveRooms.length > 0) {
          throw deleteError;
        }
      }

      const { error: markError } = await admin
        .from("groups")
        .update({ livekit_terminated_at: new Date().toISOString() })
        .eq("id", room.processed_group_id)
        .is("livekit_terminated_at", null);
      if (markError) {
        failures.push(room.processed_group_id);
      } else {
        closedCount += 1;
      }
    }

    return jsonResponse({ processedCount: (rooms ?? []).length, closedCount, failedGroupIds: failures });
  } catch (error) {
    console.error("Session lifecycle request failed:", error);
    return jsonResponse({ error: "Unable to process expired sessions." }, 500);
  }
});
