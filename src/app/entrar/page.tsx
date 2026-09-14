"use client";

/**
 * T01 — choose the Member that simulates the session.
 *
 * The ontology distinguishes Usuário (global identity that authenticates) from
 * Membro (the relation with a workspace) — A1.4 — and this prototype simulates
 * only the second. Registered in PENDENCIAS-FRONTEND, A2.
 *
 * Fora da casca: um cartão sólido centrado sobre a grade de pontos, e cada
 * Membro é uma peça solta — o clicável ocupa a peça inteira.
 */

import { useRouter } from "next/navigation";
import { useData, useSession } from "@/data/store";
import { ActorAvatar, Painel, StateSeal } from "@/features/shell/ui";

export default function EntrarPage() {
  const router = useRouter();
  const { setMemberId } = useSession();
  const workspace = useData((data) => data.workspace);
  const members = useData((data) => data.members);
  const roles = useData((data) => data.roles);

  const enter = (memberId: string) => {
    setMemberId(memberId);
    router.push("/");
  };

  return (
    <main className="grade-pontos flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <Painel solido className="p-6">
          <h1 className="ed-titulo">{workspace.name}</h1>
          <p className="app-base mt-1" style={{ color: "var(--texto-3)" }}>
            Escolha o Membro que vai simular a sessão. Trocar de Membro muda tudo o que se vê: as
            permissões são reais.
          </p>

          <ul className="pilha-solta mt-6">
            {members.map((member) => {
              const role = roles.find((r) => r.id === member.roleId);
              // RN-ET-08 / A6.4 — `pendente` and `removido` do not act.
              const canEnter = member.state === "ativo" || member.state === "suspenso";
              const reason =
                member.state === "pendente"
                  ? "Convite não aceito."
                  : member.state === "removido"
                    ? "Participação encerrada; a autoria histórica permanece."
                    : member.state === "suspenso"
                      ? "Participação suspensa: entra apenas em leitura."
                      : "";
              return (
                <li key={member.id}>
                  {/* Quem não entra não sobe no hover: a peça fica estática. */}
                  <button
                    type="button"
                    onClick={() => enter(member.id)}
                    disabled={!canEnter}
                    title={canEnter ? undefined : reason}
                    aria-disabled={!canEnter}
                    data-alinhamento="topo"
                    data-estatico={canEnter ? undefined : "true"}
                    className="item-solto w-full text-left disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ paddingBlock: "var(--e-2)" }}
                  >
                    <ActorAvatar
                      kind="member"
                      name={member.displayName}
                      size="grande"
                      {...(member.photoFileId ? { photoFileId: member.photoFileId } : {})}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="app-md" style={{ color: "var(--texto)" }}>
                          {member.displayName}
                        </span>
                        <StateSeal state={member.state} />
                      </span>
                      <span className="app-base block" style={{ color: "var(--texto-3)" }}>
                        {role?.name}
                        {reason ? ` · ${reason}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Painel>

        <p className="app-sm mt-4 text-center" style={{ color: "var(--texto-3)" }}>
          A autenticação de Usuário não faz parte deste protótipo: não há backend. A escolha do Membro
          é estado da aplicação e não é gravada.
        </p>
      </div>
    </main>
  );
}
