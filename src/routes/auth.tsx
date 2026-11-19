import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LovableMark } from "@lovable.dev/cloud-auth-js/react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Nexus Workspace" },
      { name: "description", content: "Acesse ou crie sua conta no Nexus Workspace." },
      { property: "og:title", content: "Entrar — Nexus Workspace" },
      { property: "og:description", content: "Acesse ou crie sua conta no Nexus Workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const GoogleG = () => (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
    />
  </svg>
);

export function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up" | "recover" | "reset">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const isRecovery = () => new URLSearchParams(window.location.search).get("recovery") === "1";
    if (isRecovery()) setMode("reset");
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !isRecovery()) navigate({ to: "/dashboard" });
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setMode("reset");
      else if (event === "SIGNED_IN" && session && !isRecovery()) navigate({ to: "/dashboard" });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "recover") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin + "/auth?recovery=1",
        });
        if (error) throw error;
        toast.success("Se a conta existir, você receberá um link de recuperação.");
      } else if (mode === "reset") {
        const { data, error: authError } = await supabase.auth.getUser();
        if (authError || !data.user)
          throw new Error("Abra um link de recuperação válido enviado ao seu e-mail.");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) throw signOutError;
        setPassword("");
        setMode("in");
        window.history.replaceState(null, "", "/auth");
        toast.success("Senha atualizada. Entre novamente.");
      } else if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw new Error("E-mail ou senha inválidos.");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin + "/dashboard" },
        });
        if (error) throw error;
        if (!data.session) toast.success("Confira seu e-mail para confirmar a conta.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível concluir. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function social(p: "google" | "lovable") {
    const r = await lovable.auth.signInWithOAuth(p, {
      redirect_uri: window.location.origin + "/auth",
    });
    if (r.error) toast.error("Falha no login", { description: String(r.error.message ?? r.error) });
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 font-display text-xl text-sidebar-accent-foreground">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-gold font-bold text-gold-foreground">
            N
          </span>
          Nexus Workspace
        </div>
        <p className="max-w-sm font-display text-3xl text-sidebar-accent-foreground">
          Clareza operacional para quem decide.
        </p>
        <p className="text-sm opacity-60">Nexo Empresarial</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="text-3xl font-semibold">
            {mode === "recover"
              ? "Recuperar senha"
              : mode === "reset"
                ? "Nova senha"
                : mode === "in"
                  ? "Entrar"
                  : "Criar conta"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "in" ? "Bem-vindo de volta." : "Comece a organizar sua operação."}
          </p>
          {(mode === "in" || mode === "up") && (
            <div className="mt-6 grid gap-2">
              <Button variant="outline" type="button" onClick={() => social("google")}>
                <GoogleG /> Continuar com Google
              </Button>
              <Button variant="outline" type="button" onClick={() => social("lovable")}>
                <LovableMark /> Continuar com Lovable
              </Button>
            </div>
          )}
          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            ou
            <div className="h-px flex-1 bg-border" />
          </div>
          <form onSubmit={submit} className="grid gap-4">
            {mode !== "reset" && (
              <div className="grid gap-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            )}
            {mode !== "recover" && (
              <div className="grid gap-2">
                <Label htmlFor="pw">Senha</Label>
                <Input
                  id="pw"
                  type="password"
                  required
                  minLength={mode === "in" ? 1 : 12}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}
            <Button type="submit" disabled={busy}>
              {mode === "recover"
                ? "Enviar link"
                : mode === "reset"
                  ? "Salvar senha"
                  : mode === "in"
                    ? "Entrar"
                    : "Cadastrar"}
            </Button>
          </form>
          <button
            className="mt-4 text-sm text-primary hover:underline"
            onClick={() => {
              setPassword("");
              setMode(mode === "in" ? "up" : "in");
            }}
          >
            {mode === "in" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
          </button>
          {mode === "in" && (
            <button
              className="mt-4 block text-sm text-primary hover:underline"
              onClick={() => setMode("recover")}
            >
              Esqueci minha senha
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
