"use client";

/**
 * T03 — Minha Conta.
 *
 * A1.4 — Usuário and Membro are different things. This screen shows the Membro,
 * which is what this prototype simulates; the Usuário identity that would
 * authenticate has no backend here (PENDENCIAS-FRONTEND, A2).
 *
 * B86 — the Memória de Usuário is internal to the Member: it never retains
 * third-party data, and disabling it stops new items without erasing history.
 */

import Link from "next/link";
import { useData, useSession } from "@/data/store";
import { AVAILABILITY_LABEL } from "@/features/shell/format";
import { useFormat } from "@/features/shell/use-format";
import {
  CabecalhoDePainel,
  CorpoDeTela,
  EmptyState,
  PageHeader,
  Painel,
  Pilula,
  RecordPanel,
  RecordRow,
  StateSeal,
} from "@/features/shell/ui";


const AVAILABILITY_ORIGIN_LABEL: Record<string, string> = {
  membro: "definida pelo Membro",
  automacao: "definida por Automação",
  horarioDeAtendimento: "definida pelo horário de atendimento",
};

export default function MinhaContaPage() {
  const state = useData((data) => data);
  const fmt = useFormat();
  const { memberId } = useSession();
  const member = state.members.find((m) => m.id === memberId);

  if (!member) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Membro não encontrado" />
        <CorpoDeTela>
          <EmptyState
            title="Nenhum Membro nesta sessão."
            hint="Escolha um Membro para simular a sessão."
            action={
              <Link href="/entrar" className="btn btn-contorno btn-sm">
                Trocar de Membro
              </Link>
            }
          />
        </CorpoDeTela>
      </div>
    );
  }

  const role = state.roles.find((r) => r.id === member.roleId);
  const teams = state.teams.filter((team) => team.memberIds.includes(member.id));
  const queues = state.queues.filter(
    (queue) =>
      queue.eligibleMemberIds.includes(member.id) ||
      queue.eligibleTeamIds.some((teamId) => teams.some((team) => team.id === teamId)),
  );
  const activeItems = member.userMemory.items.filter((item) => item.state === "ativo");
  const isOwner = state.workspace.ownerMemberId === member.id;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={member.displayName}
        seal={<StateSeal state={member.state} />}
        details={
          <>
            <Pilula tom="neutro">{role?.name ?? "Papel não encontrado"}</Pilula>
            {isOwner ? <Pilula tom="acento">Proprietário do Espaço de Trabalho</Pilula> : null}
            <Pilula tom="neutro" comPonto>
              {AVAILABILITY_LABEL[member.availability.value] ?? member.availability.value}
            </Pilula>
          </>
        }
        actions={
          <Link href="/entrar" className="btn btn-contorno btn-sm">
            Trocar de Membro
          </Link>
        }
      />

      <CorpoDeTela>
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="grid min-w-0 content-start gap-3">
            <Painel>
              <CabecalhoDePainel titulo="Memória de Usuário" contagem={activeItems.length} />
              <div className="p-3">
                <p className="app-sm mb-2 text-[var(--texto-3)]">
                  {member.userMemory.enabled
                    ? "Ativa: o que você conta ao Chat pode virar um item aqui. Nada de terceiros é guardado."
                    : "Desativada: nenhum item novo é criado. Os existentes continuam registrados."}
                </p>
                {member.userMemory.items.length === 0 ? (
                  <EmptyState
                    compact
                    title="Nenhum item de memória."
                    hint="Um item nasce de uma Sessão de Chat ou de algo que você registra diretamente."
                  />
                ) : (
                  <ul className="pilha-solta">
                    {member.userMemory.items.map((item) => (
                      <li
                        key={item.id}
                        className="item-solto"
                        data-bloco="true"
                        data-estatico="true"
                        data-atenuado={item.state === "ativo" ? undefined : "true"}
                      >
                        <p
                          className={`app-base ${item.state === "ativo" ? "text-[var(--texto)]" : "text-[var(--texto-3)] line-through"}`}
                        >
                          {item.content}
                        </p>
                        <p className="app-sm mt-0.5 text-[var(--texto-3)]">
                          {item.origin.kind === "sessao" ? "de uma Sessão de Chat" : "registrado por você"} ·{" "}
                          {fmt.instant(item.createdAt)}
                          {item.state === "desativado" ? " · desativado" : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Painel>

            <Painel>
              <CabecalhoDePainel titulo="Equipes" contagem={teams.length} />
              <div className="p-3">
                {teams.length === 0 ? (
                  <EmptyState
                    compact
                    title="Você não está em nenhuma Equipe."
                    hint="A Equipe agrupa Membros para conceder permissão de uma vez; não substitui o Papel."
                  />
                ) : (
                  <ul className="pilha-solta">
                    {teams.map((team) => (
                      <li key={team.id}>
                        <Link href="/configuracoes/equipes" className="item-solto">
                          <span className="app-base min-w-0 flex-1 truncate text-[var(--texto)]">{team.name}</span>
                          <span className="app-sm app-numero shrink-0 text-[var(--texto-3)]">{team.memberIds.length} Membro(s)</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Painel>

            <Painel>
              <CabecalhoDePainel titulo="Filas em que você é elegível" contagem={queues.length} />
              <div className="p-3">
                {queues.length === 0 ? (
                  <EmptyState
                    compact
                    title="Você não é elegível em nenhuma Fila."
                    hint="A elegibilidade concede ver as Conversas que passam pela Fila — e nada além."
                  />
                ) : (
                  <ul className="pilha-solta">
                    {queues.map((queue) => (
                      <li key={queue.id}>
                        <Link href={`/crm/caixa-de-entrada/configuracoes/filas/${queue.id}`} className="item-solto">
                          <span className="app-base min-w-0 flex-1 truncate text-[var(--texto)]">{queue.name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Painel>
          </div>

          <aside className="grid min-w-0 content-start gap-3">
            <RecordPanel title="Participação">
              <dl>
                <RecordRow label="Papel">{role?.name ?? "—"}</RecordRow>
                <RecordRow label="Papel de sistema">{role?.system ? "sim" : `não · teto ${role?.base}`}</RecordRow>
                <RecordRow label="Entrou em">{member.joinedAt ? fmt.instant(member.joinedAt) : "—"}</RecordRow>
                <RecordRow label="Convidado por">
                  {state.members.find((m) => m.id === member.invitedBy)?.displayName ?? "—"}
                </RecordRow>
                <RecordRow label="Disponibilidade">
                  {AVAILABILITY_LABEL[member.availability.value] ?? member.availability.value}
                  <span className="app-meta block">
                    {AVAILABILITY_ORIGIN_LABEL[member.availability.origin] ?? member.availability.origin}
                  </span>
                </RecordRow>
              </dl>
            </RecordPanel>

            <RecordPanel title="Espaço de Trabalho">
              <dl>
                <RecordRow label="Nome">{state.workspace.name}</RecordRow>
                <RecordRow label="Fuso horário">{state.workspace.locale.timezone}</RecordRow>
                <RecordRow label="Moeda">{state.workspace.locale.currency}</RecordRow>
                <RecordRow label="Idioma">{state.workspace.locale.language}</RecordRow>
              </dl>
              <p className="app-meta mt-2">
                Usuário e Membro são coisas distintas: a identidade que autentica não faz parte deste
                protótipo.
              </p>
            </RecordPanel>
          </aside>
        </div>
      </CorpoDeTela>
    </div>
  );
}
