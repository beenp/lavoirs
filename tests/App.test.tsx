import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authListener: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  signUp: vi.fn(),
  from: vi.fn(),
  query: {
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    select: vi.fn(),
    single: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock("../apps/web/src/lib/supabase-client", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
      signInWithPassword: mocks.signInWithPassword,
      signOut: mocks.signOut,
      signUp: mocks.signUp,
    },
    from: mocks.from,
  },
}));

import App from "../apps/web/src/app/App";

function makeSession() {
  return {
    user: {
      id: "user-123",
      email: "kai@example.com",
      user_metadata: { display_name: "Kai", description: "Board games" },
    },
  };
}

describe("profile signup application", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.eq.mockImplementation(() => mocks.query);
    mocks.query.select.mockImplementation(() => mocks.query);
    mocks.query.upsert.mockImplementation(() => mocks.query);
    mocks.query.maybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.query.single.mockResolvedValue({
      data: { id: "user-123", display_name: "Kai", description: "Board games" },
      error: null,
    });
    mocks.from.mockReturnValue(mocks.query);
    mocks.onAuthStateChange.mockImplementation((listener) => {
      mocks.authListener.mockImplementation(listener);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
  });

  it("creates an account, then saves the owner profile", async () => {
    const user = userEvent.setup();
    const session = makeSession();
    mocks.signUp.mockImplementation(async () => {
      mocks.authListener("SIGNED_IN", session);
      return { data: { session }, error: null };
    });
    render(<App />);
    await screen.findByRole("heading", { name: "Create your profile" });

    await user.type(screen.getByLabelText("Name shown to your group"), "Kai");
    await user.type(screen.getByLabelText("A little about you"), "Board games");
    await user.type(screen.getByLabelText("Email"), "kai@example.com");
    await user.type(screen.getByLabelText(/Password/), "long-test-password");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    await screen.findByRole("heading", { name: "Finish your profile" });

    await user.click(screen.getByRole("button", { name: "Save profile" }));
    await screen.findByText("Profile saved.");

    expect(mocks.signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: "kai@example.com",
      password: "long-test-password",
      options: expect.objectContaining({
        data: { display_name: "Kai", description: "Board games" },
      }),
    }));
    expect(mocks.query.upsert).toHaveBeenCalledWith({
      id: "user-123",
      display_name: "Kai",
      description: "Board games",
    }, { onConflict: "id" });
  });

  it("shows signup confirmation guidance when no session is returned", async () => {
    const user = userEvent.setup();
    mocks.signUp.mockResolvedValue({ data: { session: null }, error: null });
    render(<App />);
    await screen.findByRole("heading", { name: "Create your profile" });

    await user.type(screen.getByLabelText("Name shown to your group"), "Kai");
    await user.type(screen.getByLabelText("Email"), "kai@example.com");
    await user.type(screen.getByLabelText(/Password/), "long-test-password");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect((await screen.findByRole("status")).textContent).toContain("Check your email to confirm");
  });

  it("signs in an existing user and signs that user out", async () => {
    const user = userEvent.setup();
    const session = makeSession();
    mocks.signInWithPassword.mockImplementation(async () => {
      mocks.authListener("SIGNED_IN", session);
      return { error: null };
    });
    mocks.signOut.mockImplementation(async () => {
      mocks.authListener("SIGNED_OUT", null);
      return { error: null };
    });
    render(<App />);
    await screen.findByRole("heading", { name: "Create your profile" });

    await user.click(screen.getByRole("button", { name: "Already have an account? Sign in" }));
    await user.type(screen.getByLabelText("Email"), "kai@example.com");
    await user.type(screen.getByLabelText(/Password/), "long-test-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByRole("button", { name: "Sign out" });
    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: "kai@example.com", password: "long-test-password" });
    expect(await screen.findByRole("heading", { name: "Create your profile" })).toBeTruthy();
  });

  it("shows a profile loading error when the database read fails", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: makeSession() }, error: null });
    mocks.query.maybeSingle.mockResolvedValue({ data: null, error: new Error("RLS read denied") });
    render(<App />);

    expect((await screen.findByRole("alert")).textContent).toContain("Could not load your profile: RLS read denied");
  });
});
