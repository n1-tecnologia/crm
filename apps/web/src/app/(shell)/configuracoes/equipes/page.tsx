"use client";

/**
 * T42 — Equipes.
 *
 * RN-ET-12 — only `ativo` or `suspenso` Members belong to a Team. A Team grants
 * permission to several people at once; it never replaces the Papel, and it is
 * not a hierarchy.
 *
 * 12.4.4 — Administradores criam, editam e excluem Equipes aqui, e põem e tiram
 * Membros no painel de cada uma. Quem recusa é o domínio (`equipes.ts`): uma
 * Equipe com Concessão não se exclui, e só Membro ativo ou suspenso entra.
 */

import Link from "next/link";
import { useState } from "react";
import type { Team } from "@n1/dominio";
import { addMemberToTeam, deleteTeam, removeMemberFromTeam } from "@n1/dominio/operations";
import { useData, useRun, useSession } from "@/dados/store";
import { EquipeDialog } from "@/features/configuracoes/equipe-dialog";
import { useFormat } from "@/features/shell/use-format";
import {
  Button,
  CabecalhoDePainel,
  ConfirmDialog,
  CorpoDeTela,
  EmptyState,
  PageHeader,
  Painel,
  Pilula,
  ReguaDeSecao,
  Select,
  Toast,
} from "@/features/shell/ui";

export default function EquipesPage() {
  const state = useData((data) => data);
  const fmt = useFormat();
  const run = useRun();
  const { memberId } = useSession();
  const teams = state.teams;
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** A Equipe em edição; `"nova"` abre o diálogo vazio. `aberturas` remonta o diálogo a cada abertura. */
  const [emEdicao, setEmEdicao] = useState<Team | "nova" | null>(null);
  const [aberturas, setAberturas] = useState(0);
  const [excluindo, setExcluindo] = useState<Team | null>(null);

  const acting = state.members.find((m) => m.id === memberId);
  const actingBase = state.roles.find((r) => r.id === acting?.roleId)?.base;
  const mayGovern = acting?.state === "ativo" && (actingBase === "administrador" || actingBase === "proprietario");
  const naoGoverna = "Só um Administrador ou o Proprietário muda uma Equipe.";

  const abrir = (alvo: Team | "nova") => {
    setAberturas((n) => n + 1);
    setEmEdicao(alvo);
  };
  const desfecho = (r: { ok: true } | { ok: false; error: string }, frase: string) => {
    if (r.ok) {
      setError(null);
      setNotice(frase);
    } else {
      setNotice(null);
      setError(r.error);
    }
  };

  /** RN-ET-12 — quem pode entrar: ativo ou suspenso, e que ainda não está. */
  const candidatos = (team: Team) =>
    state.members.filter((m) => (m.state === "ativo" || m.state === "suspenso") && !team.memberIds.includes(m.id));

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
        actions={
          <Button variant="primary" onClick={() => abrir("nova")} disabled={!mayGovern} disabledReason={naoGoverna}>
            Nova Equipe
          </Button>
        }
      />

      {emEdicao !== null ? (
        <EquipeDialog
          key={aberturas}
          {...(emEdicao === "nova" ? {} : { equipe: emEdicao })}
          onClose={() => setEmEdicao(null)}
          onDone={(frase) => {
            setError(null);
            setNotice(frase);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={excluindo !== null}
        title={`Excluir ${excluindo?.name ?? "Equipe"}`}
        description="A Equipe some, e os Membros dela continuam no Espaço de Trabalho. Uma Equipe que ainda tem Concessões de acesso não se exclui: revogue-as antes."
        confirmLabel="Excluir Equipe"
        destructive
        onConfirm={() => {
          if (!excluindo) return;
          const nome = excluindo.name;
          desfecho(run((data, me) => deleteTeam(data, me, excluindo.id)), `Equipe ${nome} excluída.`);
          setExcluindo(null);
        }}
        onCancel={() => setExcluindo(null)}
      />

      <CorpoDeTela>
        {notice ? (
          <Toast tone="success" onDismiss={() => setNotice(null)}>
            {notice}
          </Toast>
        ) : null}
        {error ? (
          <Toast tone="error" onDismiss={() => setError(null)}>
            {error}
          </Toast>
        ) : null}

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
              const quemPodeEntrar = candidatos(team);
              return (
                <li key={team.id}>
                  <Painel>
                    <CabecalhoDePainel
                      titulo={team.name}
                      acao={
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="app-meta app-numero">criada em {fmt.instant(team.createdAt)}</span>
                          <Button size="sm" variant="ghost" onClick={() => abrir(team)} disabled={!mayGovern} disabledReason={naoGoverna}>
                            Editar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setExcluindo(team)} disabled={!mayGovern} disabledReason={naoGoverna}>
                            Excluir
                          </Button>
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
                            <li key={member.id} className="inline-flex items-center gap-0.5">
                              <Link
                                href={`/configuracoes/membros/${member.id}`}
                                className="inline-flex transition-opacity hover:opacity-80"
                              >
                                <Pilula tom="neutro">
                                  {`${member.displayName}${member.state === "suspenso" ? " · suspenso" : ""}`}
                                </Pilula>
                              </Link>
                              {mayGovern ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    desfecho(
                                      run((data, me) => removeMemberFromTeam(data, me, team.id, member.id)),
                                      `${member.displayName} saiu de ${team.name}.`,
                                    )
                                  }
                                >
                                  <span aria-hidden="true">×</span>
                                  <span className="sr-only">Tirar {member.displayName} da Equipe</span>
                                </Button>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}

                      {mayGovern ? (
                        <div className="mt-3 max-w-xs">
                          <Select
                            value=""
                            placeholder="Adicionar Membro"
                            searchable
                            semOpcoes="Todo Membro ativo ou suspenso já está nesta Equipe."
                            options={quemPodeEntrar.map((m) => ({ value: m.id, label: m.displayName }))}
                            onChange={(id) => {
                              const nome = state.members.find((m) => m.id === id)?.displayName ?? "O Membro";
                              desfecho(run((data, me) => addMemberToTeam(data, me, team.id, id)), `${nome} entrou em ${team.name}.`);
                            }}
                          />
                        </div>
                      ) : null}

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
