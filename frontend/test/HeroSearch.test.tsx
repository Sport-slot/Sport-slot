import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HeroSearch } from "@/components/HeroSearch";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

beforeEach(() => {
  push.mockClear();
});

describe("HeroSearch", () => {
  it("navigates to the venue list with city and sport", async () => {
    const user = userEvent.setup();
    render(<HeroSearch />);
    await user.type(screen.getByPlaceholderText("Kde chceš hrát?"), "  Praha ");
    await user.selectOptions(screen.getByRole("combobox"), "tenis");
    await user.click(screen.getByRole("button", { name: /hledat/i }));
    expect(push).toHaveBeenCalledWith("/venues?city=Praha&sport=tenis");
  });

  it("navigates to the plain venue list without filters", async () => {
    const user = userEvent.setup();
    render(<HeroSearch />);
    await user.click(screen.getByRole("button", { name: /hledat/i }));
    expect(push).toHaveBeenCalledWith("/venues");
  });
});
