"use client";

/**
 * T41 — Membro.
 *
 * A6.4 — a removed Member keeps historical authorship, so this screen exists
 * for them too: it just stops offering actions and says why.
 *
 * C32, alternativa (b) — demoting to a Convidado-base role means the Member can
 * no longer own anything, so the demotion requires a transfer in the same act
 * and reuses the succession dialog. Registered in PENDENCIAS-FRONTEND.
 */

import Link from "next/link";
import { use, useState } from "react";
import { useData, useRun, useSession } from "@/dados/store";
import { alterarEmailDoConvite, alterarPapelDoMembro, previewSuccession } from "@n1/dominio/operations";
import { useFormat } from "@/features/shell/use-format";
import { AVAILABILITY_LABEL, PERMISSION_ORIGIN_LABEL, RESOURCE_TYPE_LABEL } from "@/features/shell/format";
import {
  Button,
  CabecalhoDePainel,
  CorpoDeTela,
  EmptyState,
  Field,
  PageHeader,
  Painel,
  RecordPanel,
  RecordRow,
  Select,
  StateSeal,
  TextInput,
  Toast,
} from "@/features/shell/ui";


const OWNED_LABEL: Record<string, string> = {
  contact: "Contatos",
  company: "Empresas",
  deal: "Negócios",
  agent: "Agentes",
  automation: "Automações",
  panel: "Painéis",
  collection: "Coleções",
};

export default function MembroPage({ params }: { params: Promise<{ membro: string }> }) {
  const { membro } = use(params);
  const state = useData((data) => data);
  const fmt = useFormat();
  const { memberId } = useSession();
  const run = useRun();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** O e-mail do convite em edição — só para Membro sem login (ver `alterarEmailDoConvite`). */
  const [novoEmail, setNovoEmail] = useState<string | null>(null);

  const member = state.members.find((m) => m.id === membro);

  if (!member) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Membro não encontrado" />
        <CorpoDeTela>
          <EmptyState
            title="Membro não encontrado."
            hint="Este identificador não existe neste Espaço de Trabalho."
          />
        </CorpoDeTela>
      </div>
    );
  }

  const acting = state.members.find((m) => m.id === memberId);
  const actingRole = state.roles.find((r) => r.id === acting?.roleId);
  const mayGovern = actingRole?.base === "administrador" || actingRole?.base === "proprietario";

  const role = state.roles.find((r) => r.id === member.roleId);
  const isOwner = state.workspace.ownerMemberId === member.id;
  const removed = member.state === "removido";
  const preview = previewSuccession(state, member.id);
  const teams = state.teams.filter((team) => team.memberIds.includes(member.id));
  const queues = state.queues.filter(
    (queue) =>
      queue.eligibleMemberIds.includes(member.id) ||
      queue.eligibleTeamIds.some((teamId) => teams.some((team) => team.id === teamId)),
  );
  const grants = state.grants.filter(
    (grant) => grant.subjectKind === "member" && grant.subjectId === member.id,
  );
  const activity = state.activity.filter(
    (record) => record.actor.kind === "member" && record.actor.id === member.id,
  );
  const successor = state.members.find((m) => m.id === member.successorId);

  const owned = preview.transfers.reduce<Record<string, number>>((counts, item) => {
    counts[item.type] = (counts[item.type] ?? 0) + 1;
    return counts;
  }, {});

  const changeRole = (roleId: string) => {
    const nextRole = state.roles.find((r) => r.id === roleId);
    if (!nextRole) return;
    if (nextRole.base === "convidado" && preview.transfers.length > 0) {
      setNotice(null);
      setError(
        `Rebaixar para um Papel de base Convidado exige transferir ${preview.transfers.length} registro(s) de propriedade no mesmo ato. Encerre a participação com Sucessor ou transfira a propriedade antes.`,
      );
      return;
    }
    // Uma operação do domínio de verdade: o servidor grava (antes, a troca
    // mudava só a cópia do store e se perdia — `transporte.ts` recusava).
    const r = run((data, me) => alterarPapelDoMembro(data, me, { memberId: member.id, roleId }));
    if (!r.ok) {
      setNotice(null);
      setError(r.error);
      return;
    }
    setError(null);
    setNotice(`Papel alterado para ${nextRole.name}.`);
  };

  const salvarEmail = () => {
    if (novoEmail === null) return;
    const r = run((data, me) => alterarEmailDoConvite(data, me, { memberId: member.id, email: novoEmail }));
    if (r.ok) {
      setError(null);
      setNotice(`E-mail do convite alterado para ${r.value.invitedIdentity?.value}. Nenhum convite foi enviado.`);
      setNovoEmail(null);
    } else {
      setNotice(null);
      setError(r.error);
    }
  };
  // O e-mail só se altera aqui enquanto o Membro não tem login: depois disso ele é o da conta.
  const podeAlterarEmail = mayGovern && !removed && !member.userId;

  /** A mesma frase serve de ajuda do campo e de motivo do controle desligado (§11). */
  const roleNote = isOwner
    ? "O Papel do Proprietário muda pela transferência de propriedade, não por aqui."
    : removed
      ? "Uma participação encerrada não muda de Papel."
      : !mayGovern
        ? "Só um Administrador ou o Proprietário muda o Papel de um Membro."
        : "Um Papel personalizado nunca ultrapassa o teto do Papel de sistema que declara como base.";

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        path={
          <>
            <Link href="/configuracoes" className="hover:underline">
              Configurações
            </Link>
            {" › "}
            <Link href="/configuracoes/membros" className="hover:underline">
              Membros
            </Link>
          </>
        }
        title={member.displayName}
        seal={<StateSeal state={member.state} />}
        meta={`${activity.length} Registro(s) de Atividade`}
      />

      {removed ? (
        <p
          className="app-base shrink-0 px-4 py-2"
          style={{ background: "var(--aviso-lavado)", color: "var(--aviso)", borderBottom: "1px solid var(--linha)" }}
        >
          Participação encerrada
          {member.removedAt ? ` em ${fmt.instant(member.removedAt)}` : ""}
          {successor ? `, sucedida por ${successor.displayName}` : ""}. A autoria histórica permanece e
          nada aqui é editável.
        </p>
      ) : null}

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

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
          <div className="grid min-w-0 content-start gap-3">
            <Painel>
              <CabecalhoDePainel titulo="Papel" />
              <div className="p-4">
                <div className="max-w-sm">
                  <Field label="Papel neste Espaço de Trabalho" hint={roleNote}>
                    {(id) => (
                      <Select
                        id={id}
                        value={member.roleId}
                        onChange={changeRole}
                        disabled={!mayGovern || removed || isOwner}
                        disabledReason={roleNote}
                        options={state.roles.map((option) => ({
                          value: option.id,
                          label: option.system ? `${option.name} (sistema)` : `${option.name} (teto ${option.base})`,
                        }))}
                      />
                    )}
                  </Field>
                </div>
              </div>
            </Painel>

            <Painel>
              <CabecalhoDePainel titulo="O que este Membro possui" contagem={preview.transfers.length} />
              <div className="p-3">
                {preview.transfers.length === 0 ? (
                  <EmptyState
                    compact
                    title="Este Membro não é Proprietário de nada."
                    hint="Encerrar a participação não transferiria nenhum registro."
                  />
                ) : (
                  <ul className="grade-solta sm:grid-cols-2">
                    {Object.entries(owned).map(([type, count]) => (
                      <li key={type} className="item-solto" data-estatico="true">
                        <span className="app-base min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
                          {OWNED_LABEL[type] ?? type}
                        </span>
                        <span className="app-md app-numero shrink-0" style={{ color: "var(--texto)" }}>
                          {count}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="app-meta mt-2 px-1">
                  Encerrar a participação transfere tudo isto ao Sucessor, e libera{" "}
                  {preview.releases.length} atribuição(ões) sem Responsável.{" "}
                  <Link href="/configuracoes/membros" className="underline">
                    Encerrar a partir da lista de Membros
                  </Link>
                  .
                </p>
              </div>
            </Painel>

            <Painel>
              <CabecalhoDePainel titulo="Atividade recente" contagem={activity.length} />
              <div className="p-3">
                {activity.length === 0 ? (
                  <EmptyState compact title="Nenhum Registro de Atividade deste Membro." />
                ) : (
                  <ul className="pilha-solta">
                    {activity.slice(0, 15).map((record) => (
                      <li key={record.id} className="item-solto" data-estatico="true">
                        <span className="app-meta app-numero shrink-0">{fmt.instant(record.at)}</span>
                        <span className="app-base min-w-0 flex-1 truncate" style={{ color: "var(--texto-1)" }}>
                          {record.action}
                          {record.objectName ? ` · ${record.objectName}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {activity.length > 15 ? (
                  <p className="app-meta app-numero mt-2 px-1">
                    Mostrando 15 de {activity.length}.{" "}
                    <Link href="/configuracoes/auditoria" className="underline">
                      Ver tudo na Auditoria
                    </Link>
                    .
                  </p>
                ) : null}
              </div>
            </Painel>
          </div>

          <aside className="grid min-w-0 content-start gap-3">
            <RecordPanel title="Participação">
              <dl>
                <RecordRow label="Papel">{role?.name ?? "Papel não encontrado"}</RecordRow>
                {isOwner ? <RecordRow label="Propriedade">Proprietário do Espaço de Trabalho</RecordRow> : null}
                <RecordRow label="Disponibilidade">
                  {AVAILABILITY_LABEL[member.availability.value] ?? member.availability.value}
                </RecordRow>
                <RecordRow label="Estado">{member.state}</RecordRow>
                <RecordRow label="Entrou em">{member.joinedAt ? fmt.instant(member.joinedAt) : "—"}</RecordRow>
                <RecordRow label="Convidado por">
                  {state.members.find((m) => m.id === member.invitedBy)?.displayName ?? "—"}
                </RecordRow>
                <RecordRow label="Identidade do convite">
                  {novoEmail !== null ? (
                    <form
                      className="grid gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        salvarEmail();
                      }}
                    >
                      <label htmlFor="email-do-convite" className="sr-only">
                        Novo e-mail do convite
                      </label>
                      <TextInput id="email-do-convite" type="email" value={novoEmail} onChange={setNovoEmail} placeholder="nome@empresa.com.br" />
                      <span className="flex gap-2">
                        <Button size="sm" variant="primary" type="submit" disabled={!novoEmail.trim()} disabledReason="Informe o e-mail.">
                          Salvar e-mail
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setNovoEmail(null)}>
                          Cancelar
                        </Button>
                      </span>
                      <span className="app-meta">Só altera o e-mail guardado — nenhum convite é enviado.</span>
                    </form>
                  ) : (
                    <span className="flex flex-wrap items-center gap-2">
                      <span>{member.invitedIdentity?.value ?? "—"}</span>
                      {podeAlterarEmail ? (
                        <Button size="sm" variant="ghost" onClick={() => setNovoEmail(member.invitedIdentity?.value ?? "")}>
                          Alterar e-mail
                        </Button>
                      ) : null}
                    </span>
                  )}
                </RecordRow>
                <RecordRow label="Removido em">{member.removedAt ? fmt.instant(member.removedAt) : "—"}</RecordRow>
                <RecordRow label="Sucessor">{successor?.displayName ?? "—"}</RecordRow>
              </dl>
            </RecordPanel>

            <RecordPanel title="Equipes" count={teams.length}>
              {teams.length === 0 ? (
                <EmptyState compact title="Não está em nenhuma Equipe." />
              ) : (
                <ul className="pilha-solta">
                  {teams.map((team) => (
                    <li key={team.id} className="item-solto" data-estatico="true">
                      <span className="app-base min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
                        {team.name}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </RecordPanel>

            <RecordPanel title="Filas elegíveis" count={queues.length}>
              {queues.length === 0 ? (
                <EmptyState compact title="Não é elegível em nenhuma Fila." />
              ) : (
                <ul className="pilha-solta">
                  {queues.map((queue) => (
                    <li key={queue.id}>
                      <Link href={`/crm/caixa-de-entrada/configuracoes/filas/${queue.id}`} className="item-solto">
                        <span className="app-base min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
                          {queue.name}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </RecordPanel>

            <RecordPanel title="Concessões diretas" count={grants.length}>
              {grants.length === 0 ? (
                <EmptyState
                  compact
                  title="Nenhuma Concessão direta."
                  hint="Toda permissão deste Membro vem do Papel, da herança ou da elegibilidade de Fila."
                />
              ) : (
                <ul className="pilha-solta">
                  {grants.map((grant) => (
                    <li key={grant.id} className="item-solto" data-estatico="true" data-bloco="true">
                      <span className="app-base" style={{ color: "var(--texto-1)" }}>
                        {grant.action} em {RESOURCE_TYPE_LABEL[grant.resourceType] ?? grant.resourceType} · escopo{" "}
                        {grant.scope === "subarvore" ? "subárvore" : grant.scope} · origem:{" "}
                        {PERMISSION_ORIGIN_LABEL[grant.origin] ?? grant.origin}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </RecordPanel>

            <RecordPanel title="Memória de Usuário">
              <p className="app-base" style={{ color: "var(--texto-3)" }}>
                {member.userMemory.enabled ? "Ativa" : "Desativada"} ·{" "}
                {member.userMemory.items.filter((item) => item.state === "ativo").length} item(ns) ativo(s).
              </p>
              <p className="app-meta mt-1">
                É interna ao Membro e só ele a lê. Não aparece aqui em conteúdo.
              </p>
            </RecordPanel>
          </aside>
        </div>
      </CorpoDeTela>
    </div>
  );
}
