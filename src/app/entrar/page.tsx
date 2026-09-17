"use client";

/**
 * T01 — choose the Member that simulates the session.
 *
 * The ontology distinguishes Usuário (global identity that authenticates) from
 * Membro (the relation with a workspace) — A1.4 — and this prototype simulates
 * only the second. Registered in PENDENCIAS-FRONTEND, A2.
 *
 * Fora da casca: um cartão sólido centrado sobre a atmosfera (orbes, estrelas
 * e a grade de pontos), e cada Membro é uma peça solta — o clicável ocupa a
 * peça inteira.
 *
 * Movimento: a tela traz a própria janela de chegada. O cartão `revelar`,
 * título e parágrafo em cascata, e os Membros descem desfocados depois que o
 * cartão assentou. Ao escolher, o `push` acontece NO ATO: enquanto a rota
 * chega, o escolhido gira e os demais recuam.
 */

import { ChevronRight, Loader2 } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { useData, useSession } from "@/data/store";
import { Atmosfera } from "@/design/atmosfera";
import { Chegada } from "@/features/shell/chegada";
import { limpar, useNavegar } from "@/features/shell/navegacao";
import { ActorAvatar, CampoDeLanterna, Icone, Painel, StateSeal } from "@/features/shell/ui";

export default function EntrarPage() {
  const { setMemberId } = useSession();
  const [navegar, pendente] = useNavegar();
  // O Membro escolhido nesta visita. Sem ele, um alvo herdado de "Trocar de
  // Membro" faria todos recuarem sem ninguém girando.
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const workspace = useData((data) => data.workspace);
  const members = useData((data) => data.members);
  const roles = useData((data) => data.roles);

  // Chegou-se aqui por navegação e a casca — quem limpa o alvo quando o
  // endereço muda — já desmontou. A navegação chegou: nada mais pendente.
  useEffect(() => {
    limpar();
  }, []);

  const enter = (memberId: string) => {
    setEscolhido(memberId);
    setMemberId(memberId);
    // NO ATO: animação nenhuma segura o push.
    navegar("/");
  };

  const esperando = pendente && escolhido !== null;
  const nomeEscolhido = esperando ? members.find((m) => m.id === escolhido)?.displayName : undefined;

  return (
    <main className="relative flex min-h-screen items-center justify-center p-6">
      <Atmosfera />
      <Chegada>
        <div className="relative w-full max-w-lg" style={{ zIndex: "var(--z-conteudo)" }}>
          <CampoDeLanterna>
            {/* O aro herda o raio: a casca precisa do mesmo raio do Painel. */}
            <div className="lanterna casca-destaque revelar" style={{ borderRadius: "var(--r-painel)" }}>
              <Painel solido className="p-6">
                <div className="cascata">
                  <h1 className="ed-titulo" style={{ "--i": 0 } as CSSProperties}>
                    {workspace.name}
                  </h1>
                  <p className="app-base mt-1" style={{ "--i": 1, color: "var(--texto-3)" } as CSSProperties}>
                    Escolha o Membro que vai simular a sessão. Trocar de Membro muda tudo o que se vê: as
                    permissões são reais.
                  </p>
                </div>

                {/* Os Membros esperam o cartão assentar e descem desfocados (foco). */}
                <ul
                  className="cascata pilha-solta mt-6"
                  data-chegada="foco"
                  style={{ "--cascata-inicio": "var(--dur-2)" } as CSSProperties}
                >
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
                    const ocupado = esperando && escolhido === member.id;
                    const atenuado = esperando && escolhido !== member.id;
                    return (
                      <li key={member.id}>
                        {/* Quem não entra não sobe no hover: a peça fica estática. */}
                        <button
                          type="button"
                          onClick={() => enter(member.id)}
                          disabled={!canEnter}
                          title={canEnter ? undefined : reason}
                          aria-disabled={!canEnter}
                          aria-busy={ocupado || undefined}
                          data-alinhamento="topo"
                          data-estatico={canEnter ? undefined : "true"}
                          data-atenuado={atenuado ? "true" : undefined}
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
                          {/* O chevron promete a entrada; enquanto a rota chega, vira o giro. */}
                          {canEnter ? (
                            ocupado ? (
                              <Icone de={Loader2} tamanho="xs" className="girando self-center" />
                            ) : (
                              <Icone
                                de={ChevronRight}
                                tamanho="xs"
                                className="self-center"
                                style={{ color: "var(--texto-4)" }}
                              />
                            )
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Painel>
            </div>
          </CampoDeLanterna>

          {/* O giro nunca é o único sinal: o leitor de tela ouve a espera. */}
          <p role="status" className="sr-only">
            {nomeEscolhido ? `Entrando como ${nomeEscolhido}…` : ""}
          </p>

          <p className="app-sm mt-4 text-center" style={{ color: "var(--texto-3)" }}>
            A autenticação de Usuário não faz parte deste protótipo: não há backend. A escolha do Membro
            é estado da aplicação e não é gravada.
          </p>
        </div>
      </Chegada>
    </main>
  );
}
