import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  reset: vi.fn(),
  update: vi.fn(),
  signOut: vi.fn(),
  getUser: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => () => ({}),
  useNavigate: () => mocks.navigate,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      getUser: mocks.getUser,
      onAuthStateChange: mocks.onAuthStateChange,
      resetPasswordForEmail: mocks.reset,
      updateUser: mocks.update,
      signOut: mocks.signOut,
    },
  },
}));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock("@/integrations/lovable/index", () => ({ lovable: {} }));
vi.mock("@lovable.dev/cloud-auth-js/react", () => ({ LovableMark: () => null }));
import { AuthPage } from "@/routes/auth";

beforeEach(() => {
  vi.resetAllMocks();
  window.history.replaceState(null, "", "/auth");
  mocks.getSession.mockResolvedValue({ data: { session: null } });
  mocks.getUser.mockResolvedValue({ data: { user: { id: "a" } }, error: null });
  mocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  mocks.reset.mockResolvedValue({ error: null });
  mocks.update.mockResolvedValue({ error: null });
  mocks.signOut.mockResolvedValue({ error: null });
});
afterEach(cleanup);
describe("Password recovery", () => {
  it("requests a same-origin recovery link and displays a non-enumerating response", async () => {
    render(<AuthPage />);
    fireEvent.click(screen.getByText("Esqueci minha senha"));
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "person@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar link" }));
    await waitFor(() =>
      expect(mocks.reset).toHaveBeenCalledWith("person@example.test", {
        redirectTo: window.location.origin + "/auth?recovery=1",
      }),
    );
    expect(mocks.success).toHaveBeenCalledWith(
      "Se a conta existir, você receberá um link de recuperação.",
    );
  });
  it("keeps a recovery session on the password form and signs out after saving", async () => {
    window.history.replaceState(null, "", "/auth?recovery=1");
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: "a" } } } });
    render(<AuthPage />);
    fireEvent.change(await screen.findByLabelText("Senha"), {
      target: { value: "new-password-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar senha" }));
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalled());
    expect(mocks.update).toHaveBeenCalledWith({ password: "new-password-123" });
    expect(mocks.navigate).not.toHaveBeenCalled();
    await waitFor(() => expect(window.location.search).toBe(""));
    const listener = mocks.onAuthStateChange.mock.calls[0]![0];
    listener("SIGNED_IN", { user: { id: "a" } });
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/dashboard" });
  });
  it("rejects expired recovery sessions before attempting a password update", async () => {
    window.history.replaceState(null, "", "/auth?recovery=1");
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error("expired") });
    render(<AuthPage />);
    fireEvent.change(await screen.findByLabelText("Senha"), {
      target: { value: "new-password-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar senha" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(mocks.update).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Salvar senha" })).toBeEnabled();
  });
});
