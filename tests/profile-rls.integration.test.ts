import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

const supabaseUrl = process.env.SUPABASE_TEST_URL;
const publicKey = process.env.SUPABASE_TEST_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const localDescribe = supabaseUrl && publicKey && serviceRoleKey ? describe : describe.skip;

localDescribe("profile row-level security against local Supabase", () => {
  it("allows each user to save/read their row and blocks access to another user's row", async () => {
    const admin = createClient(supabaseUrl!, serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const firstEmail = `profile-rls-${randomUUID()}@example.test`;
    const secondEmail = `profile-rls-${randomUUID()}@example.test`;
    const password = "local-test-password-123";
    const createdUserIds: string[] = [];

    try {
      const { data: firstCreated, error: firstCreateError } = await admin.auth.admin.createUser({
        email: firstEmail,
        password,
        email_confirm: true,
      });
      if (firstCreateError || !firstCreated.user) throw firstCreateError ?? new Error("First test user was not created");
      createdUserIds.push(firstCreated.user.id);

      const { data: secondCreated, error: secondCreateError } = await admin.auth.admin.createUser({
        email: secondEmail,
        password,
        email_confirm: true,
      });
      if (secondCreateError || !secondCreated.user) throw secondCreateError ?? new Error("Second test user was not created");
      createdUserIds.push(secondCreated.user.id);

      const firstUser = createClient(supabaseUrl!, publicKey!, {
        auth: { autoRefreshToken: false, persistSession: false, storageKey: "profile-rls-first-user" },
      });
      const secondUser = createClient(supabaseUrl!, publicKey!, {
        auth: { autoRefreshToken: false, persistSession: false, storageKey: "profile-rls-second-user" },
      });
      const firstSignIn = await firstUser.auth.signInWithPassword({ email: firstEmail, password });
      const secondSignIn = await secondUser.auth.signInWithPassword({ email: secondEmail, password });
      expect(firstSignIn.error).toBeNull();
      expect(secondSignIn.error).toBeNull();

      const firstProfile = await firstUser.from("profiles").upsert({
        id: firstCreated.user.id,
        display_name: "First local test user",
        description: "Own-row write",
      }).select("id, display_name, description").single();
      expect(firstProfile.error).toBeNull();
      expect(firstProfile.data?.id).toBe(firstCreated.user.id);

      const secondProfile = await secondUser.from("profiles").upsert({
        id: secondCreated.user.id,
        display_name: "Second local test user",
        description: "Private to second user",
      }).select("id, display_name, description").single();
      expect(secondProfile.error).toBeNull();

      const unauthorizedWrite = await firstUser.from("profiles").upsert({
        id: secondCreated.user.id,
        display_name: "Attempted overwrite",
        description: null,
      }).select("id").maybeSingle();
      expect(unauthorizedWrite.error).not.toBeNull();

      const hiddenProfile = await firstUser.from("profiles")
        .select("id")
        .eq("id", secondCreated.user.id)
        .maybeSingle();
      expect(hiddenProfile.error).toBeNull();
      expect(hiddenProfile.data).toBeNull();
    } finally {
      await Promise.all(createdUserIds.map((id) => admin.auth.admin.deleteUser(id)));
    }
  });
});
