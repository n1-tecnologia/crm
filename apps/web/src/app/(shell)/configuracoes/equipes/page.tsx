"use client";

/**
 * T42 — Equipes.
 *
 * RN-ET-12 — only `ativo` or `suspenso` Members belong to a Team. A Team grants
 * permission to several people at once; it never replaces the Papel, and it is
 * not a hierarchy.
 */

import Link from "next/link";
import { useData } from "@/dados/store";
import { useFormat } from "@/features/shell/use-format";
import { CabecalhoDePainel, CorpoDeTela, EmptyState, PageHeader, Painel, Pilula, ReguaDeSecao } from "@/features/shell/ui";

export default function EquipesPage() {
  const state = useData((data) => data);
  const fmt = useFormat();
  const teams = state.teams;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        path={
          <Link href="/configuracoes" className="hover:underline">
            Configurações
          </Link>
        }
        title="Equipes"
        meta={`${teams.length} Equipe(s)`}
      />

      <CorpoDeTela>
        {teams.length === 0 ? (
          <EmptyState
            title="Nenhuma Equipe."
            hint="Crie uma Equipe quando um mesmo conjunto de Membros precisar receber a mesma permissão repetidas vezes."
          />
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2 lg:items-start">
            {teams.map((team) => {
              const members = team.memberIds
                .map((id) => state.members.find((m) => m.id === id))
                .filter((member) => member !== undefined);
              const queues = state.queues.filter((queue) => queue.eligibleTeamIds.includes(team.id));
              const grants = state.grants.filter(
                (grant) => grant.subjectKind === "team" && grant.subjectId === team.id,
              );
              return (
                <li key={team.id}>
                  <Painel>
                    <CabecalhoDePainel
                      titulo={team.name}
                      acao={
                        <span className="app-meta app-numero shrink-0">
                          criada em {fmt.instant(team.createdAt)}
                        </span>
                      }
                    />
                    <div className="p-3">
                      {team.description ? (
                        <p className="app-base px-1" style={{ color: "var(--texto-3)" }}>
                          {team.description}
                        </p>
                      ) : null}

                      <ReguaDeSecao rotulo="Membros" contagem={members.length} />
                      {members.length === 0 ? (
                        <EmptyState
                          compact
                          title="Equipe sem Membros."
                          hint="Uma Equipe vazia não concede nada a ninguém."
                        />
                      ) : (
                        <ul className="flex flex-wrap gap-1">
                          {members.map((member) => (
                            <li key={member.id}>
                              <Link
                                href={`/configuracoes/membros/${member.id}`}
                                className="inline-flex transition-opacity hover:opacity-80"
                              >
                                <Pilula tom="neutro">
                                  {`${member.displayName}${member.state === "suspenso" ? " · suspenso" : ""}`}
                                </Pilula>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="app-meta mt-3 space-y-1 px-1">
                        <p>
                          {grants.length === 0
                            ? "Nenhuma Concessão direta a esta Equipe."
                            : `${grants.length} Concessão(ões) direta(s) sobre Recursos.`}
                        </p>
                        <p>
                          {queues.length === 0
                            ? "Não é elegível em nenhuma Fila."
                            : `Elegível em: ${queues.map((queue) => queue.name).join(", ")}.`}
                        </p>
                      </div>
                    </div>
                  </Painel>
                </li>
              );
            })}
          </ul>
        )}
      </CorpoDeTela>
    </div>
  );
}
