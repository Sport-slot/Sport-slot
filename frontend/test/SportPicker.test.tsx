import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SportPicker } from "@/components/court-form/SportPicker";

describe("SportPicker", () => {
  it("toggles a popular sport", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<SportPicker value={[]} maxLength={50} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Tenis" }));
    expect(onChange).toHaveBeenLastCalledWith(["tenis"]);

    rerender(<SportPicker value={["tenis"]} maxLength={50} onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Tenis" }).getAttribute("aria-pressed")).toBe("true");
    await user.click(screen.getByRole("button", { name: "Tenis" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("adds a custom sport with Enter in lower case", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SportPicker value={["tenis"]} maxLength={50} onChange={onChange} />);
    await user.type(screen.getByLabelText("Jiný sport"), "  Nohejbal {Enter}");
    expect(onChange).toHaveBeenLastCalledWith(["tenis", "nohejbal"]);
  });

  it("does not add a duplicate sport", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SportPicker value={["tenis"]} maxLength={50} onChange={onChange} />);
    await user.type(screen.getByLabelText("Jiný sport"), "TENIS");
    await user.click(screen.getByRole("button", { name: /přidat/i }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows a validation error", () => {
    render(<SportPicker value={[]} error="Vyberte sport." maxLength={50} onChange={() => {}} />);
    expect(screen.getByText("Vyberte sport.")).toBeTruthy();
  });
});
