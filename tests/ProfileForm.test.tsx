import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ProfileForm from "../apps/web/src/features/profile/ProfileForm";

describe("ProfileForm", () => {
  it("submits trimmed profile fields", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<ProfileForm busy={false} initialDisplayName="" initialDescription="" onSave={onSave} />);

    await user.type(screen.getByLabelText("Name shown to your group"), "  Kai  ");
    await user.type(screen.getByLabelText("A little about you"), "  Likes hiking  ");
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(onSave).toHaveBeenCalledWith("Kai", "Likes hiking");
  });

  it("does not submit when the required name is blank", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<ProfileForm busy={false} initialDisplayName="" initialDescription="" onSave={onSave} />);
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(onSave).not.toHaveBeenCalled();
  });
});
