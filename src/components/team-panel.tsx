import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Company } from "@/lib/company";
import { canManage, securityClient, type CompanyRole } from "@/lib/security";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function TeamPanel({
  company,
  onAccepted,
}: {
  company?: Company;
  onAccepted: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [invite, setInvite] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: members = [], error } = useQuery({
    queryKey: ["members", company?.id],
    enabled: !!company,
    queryFn: async ({ signal }) => {
      const { data, error } = await securityClient
        .from("company_members")
        .select("*")
        .eq("company_id", company!.id)
        .abortSignal(signal);
      if (error) throw error;
      return data;
    },
  });
  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch {
      toast.error("Não foi possível concluir. Verifique sua permissão e os dados informados.");
    } finally {
      setBusy(false);
    }
  }
  async function changeMember(user: string, nextRole?: CompanyRole) {
    if (!company) return;
    await run(async () => {
      const { error } = nextRole
        ? await securityClient.rpc("set_company_member_role", {
            _company: company.id,
            _user: user,
            _role: nextRole,
          })
        : await securityClient.rpc("remove_company_member", { _company: company.id, _user: user });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["members", company.id] });
    });
  }
  return (
    <details className="mb-6 rounded border p-4">
      <summary>Equipe e convites{company ? ` · ${company.role ?? "sem permissão"}` : ""}</summary>
      {error && <p role="alert">Não foi possível carregar os membros.</p>}
      <ul>
        {members.map((m) => (
          <li key={m.user_id} className="my-2 flex flex-wrap items-center gap-2">
            <span>
              {m.user_id} · {m.role}
            </span>
            {company?.role === "owner" && m.role !== "owner" && (
              <>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void changeMember(m.user_id, m.role === "admin" ? "member" : "admin")
                  }
                >
                  Tornar {m.role === "admin" ? "membro" : "admin"}
                </Button>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm("Remover acesso deste membro?"))
                      void changeMember(m.user_id);
                  }}
                >
                  Remover membro
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
      {company && canManage(company.role) && (
        <form
          className="my-4 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const { data, error } = await securityClient.rpc("create_company_invitation", {
                _company: company.id,
                _email: email.trim(),
                _role: role,
              });
              if (error) throw error;
              setInvite(data);
              toast.success("Convite criado. Compartilhe o código com o destinatário.");
            });
          }}
        >
          <Input
            aria-label="E-mail do convidado"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <select
            aria-label="Papel do convidado"
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
          >
            <option value="member">Membro</option>
            {company.role === "owner" && <option value="admin">Administrador</option>}
          </select>
          <Button disabled={busy}>Criar convite</Button>
        </form>
      )}
      {invite && (
        <div className="my-3">
          <p>
            Código válido por 7 dias. O destinatário deve entrar com o e-mail confirmado e colar o
            código em “Equipe e convites”.
          </p>
          <Input aria-label="Código criado" readOnly value={invite} />
          <Button
            disabled={busy}
            variant="outline"
            onClick={() =>
              void run(async () => {
                const { error } = await securityClient.rpc("revoke_company_invitation", {
                  _token: invite,
                });
                if (error) throw error;
                setInvite("");
                toast.success("Convite revogado");
              })
            }
          >
            Revogar convite
          </Button>
        </div>
      )}
      <form
        className="my-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const { data, error } = await securityClient.rpc("accept_company_invitation", {
              _token: token.trim(),
            });
            if (error) throw error;
            await qc.invalidateQueries({ queryKey: ["companies"] });
            onAccepted(data);
            setToken("");
            toast.success("Convite aceito");
          });
        }}
      >
        <Input
          aria-label="Código do convite"
          required
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <Button disabled={busy}>Aceitar convite</Button>
      </form>
    </details>
  );
}
