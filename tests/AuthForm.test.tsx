import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AuthForm from "../apps/web/src/features/profile/AuthForm";

describe("AuthForm", () => {
  it("submits trimmed signup details", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<AuthForm busy={false} error="" message="" onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Name shown to your group"), "  Avery  ");
    await user.type(screen.getByLabelText("A little about you"), "  Loves ceramics  ");
    await user.type(screen.getByLabelText("Email"), "  avery@example.com  ");
    await user.type(screen.getByLabelText(/Password/), "a-strong-password");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(onSubmit).toHaveBeenCalledWith("sign-up", {
      email: "avery@example.com",
      password: "a-strong-password",
      displayName: "Avery",
      description: "Loves ceramics",
    });
  });

  it("requires a nonblank signup name", () => {
    const onSubmit = vi.fn();
    render(<AuthForm busy={false} error="" message="" onSubmit={onSubmit} />);
    const form = screen.getByRole("button", { name: "Create account" }).closest("form");

    if (!form) throw new Error("Auth form was not rendered");
    fireEvent.submit(form);

    expect(screen.getByRole("alert").textContent).toContain("Enter the name");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("switches to sign-in and hides signup-only fields", async () => {
    const user = userEvent.setup();
    render(<AuthForm busy={false} error="" message="" onSubmit={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Already have an account? Sign in" }));

    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(screen.queryByLabelText("Name shown to your group")).toBeNull();
  });
});
