import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RequireRole } from "@/components/RequireRole";
import type { CurrentUser } from "@/lib/api";

const auth = vi.hoisted(() => ({
  state: { user: null as CurrentUser | null, loading: false, openLogin: vi.fn() },
}));

vi.mock("@/lib/auth", () => ({ useAuth: () => auth.state }));

const player: CurrentUser = { id: "u1", name: "Hráč", email: "hrac@example.com", roles: ["PLAYER"] };
const manager: CurrentUser = { ...player, roles: ["PLAYER", "MANAGER"] };

beforeEach(() => {
  auth.state = { user: null, loading: false, openLogin: vi.fn() };
});

describe("RequireRole", () => {
  it("asks an anonymous visitor to sign in", async () => {
    render(<RequireRole roles={["MANAGER"]}>secret</RequireRole>);
    expect(screen.getByRole("heading", { name: "Nejdřív se přihlaste" })).toBeTruthy();
    expect(screen.queryByText("secret")).toBeNull();
    expect(auth.state.openLogin).toHaveBeenCalled();
    await userEvent.setup().click(screen.getByRole("button", { name: "Přihlásit se" }));
    expect(auth.state.openLogin).toHaveBeenCalledTimes(2);
  });

  it("shows no permission for a player on a manager page", () => {
    auth.state.user = player;
    render(<RequireRole roles={["MANAGER"]}>secret</RequireRole>);
    expect(screen.getByRole("heading", { name: "Nemáte oprávnění" })).toBeTruthy();
    expect(screen.queryByText("secret")).toBeNull();
  });

  it("renders the page for a manager", () => {
    auth.state.user = manager;
    render(<RequireRole roles={["MANAGER"]}>secret</RequireRole>);
    expect(screen.getByText("secret")).toBeTruthy();
  });

  it("shows a skeleton while the user is loading", () => {
    auth.state.loading = true;
    const { container } = render(<RequireRole>secret</RequireRole>);
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(auth.state.openLogin).not.toHaveBeenCalled();
  });
});
