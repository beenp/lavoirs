import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../api/profiles/index";

type MockResponse = {
  code: number;
  body: unknown;
  status: (code: number) => MockResponse;
  json: (body: unknown) => void;
};

function makeResponse(): MockResponse {
  const response: MockResponse = {
    code: 0,
    body: undefined,
    status(code) {
      response.code = code;
      return response;
    },
    json(body) {
      response.body = body;
    },
  };
  return response;
}

function makeRequest(overrides: Record<string, unknown> = {}) {
  return {
    method: "POST",
    headers: { authorization: "Bearer valid-token" },
    body: { displayName: "Mina", description: "Enjoys comics" },
    ...overrides,
  };
}

const authOk = () => ({ ok: true, status: 200, json: async () => ({ id: "user-42" }) });
const profileOk = (rows: unknown[]) => ({ ok: true, status: 201, json: async () => rows });

describe("POST /api/profiles", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "https://project.example.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "public-test-key");
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("rejects methods other than POST", async () => {
    const response = makeResponse();
    await handler(makeRequest({ method: "GET" }), response);
    expect(response.code).toBe(405);
    expect(response.body).toEqual({ error: "method_not_allowed" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires a bearer access token", async () => {
    const response = makeResponse();
    await handler(makeRequest({ headers: {} }), response);
    expect(response.code).toBe(401);
    expect(response.body).toEqual({ error: "missing_access_token" });
  });

  it("rejects malformed bodies and invalid profile fields", async () => {
    const invalidBodyResponse = makeResponse();
    await handler(makeRequest({ body: [] }), invalidBodyResponse);
    expect(invalidBodyResponse.code).toBe(400);
    expect(invalidBodyResponse.body).toEqual({ error: "invalid_request_body" });

    const invalidFieldsResponse = makeResponse();
    await handler(makeRequest({ body: { displayName: "  ", description: 7 } }), invalidFieldsResponse);
    expect(invalidFieldsResponse.code).toBe(400);
    expect(invalidFieldsResponse.body).toEqual({ error: "invalid_profile_fields" });
  });

  it("requires server-side Supabase environment values", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    const response = makeResponse();
    await handler(makeRequest(), response);
    expect(response.code).toBe(500);
    expect(response.body).toEqual({ error: "supabase_environment_not_configured" });
  });

  it("rejects an invalid Supabase access token", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
    const response = makeResponse();
    await handler(makeRequest(), response);
    expect(response.code).toBe(401);
    expect(response.body).toEqual({ error: "invalid_access_token" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses the authenticated user ID and returns the saved profile", async () => {
    fetchMock
      .mockResolvedValueOnce(authOk())
      .mockResolvedValueOnce(profileOk([{ id: "user-42", display_name: "Mina", description: "Enjoys comics" }]));
    const response = makeResponse();
    await handler(makeRequest({ body: { id: "attacker-id", displayName: "Mina", description: "Enjoys comics" } }), response);

    expect(response.code).toBe(200);
    expect(response.body).toEqual({
      profile: { id: "user-42", displayName: "Mina", description: "Enjoys comics" },
    });
    const writeCall = fetchMock.mock.calls[1];
    expect(JSON.parse(writeCall[1].body)).toEqual({
      id: "user-42",
      display_name: "Mina",
      description: "Enjoys comics",
    });
  });

  it("returns forbidden when profile row-level security denies the write", async () => {
    fetchMock
      .mockResolvedValueOnce(authOk())
      .mockResolvedValueOnce({ ok: false, status: 403 });
    const response = makeResponse();
    await handler(makeRequest(), response);
    expect(response.code).toBe(403);
    expect(response.body).toEqual({ error: "profile_save_failed" });
  });

  it("returns a gateway error when Supabase is unreachable", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network unavailable"));
    const response = makeResponse();
    await handler(makeRequest(), response);
    expect(response.code).toBe(502);
    expect(response.body).toEqual({ error: "supabase_unavailable" });
  });
});
