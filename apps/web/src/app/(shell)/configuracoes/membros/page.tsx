"use client";

/**
 * T40 — Membros.
 *
 * A6.4 — a Member is never deleted: removal ends participation and preserves
 * historical authorship. B28 — removal IS a succession, so the dialog shows
 * everything that will be transferred and everything that will be released
 * BEFORE the act, and demands a successor who is active and not a Convidado.
 */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { memberCapacityMinutes, setMemberCapacity } from "@n1/dominio/operations";
import { useData, useRun, useSession } from "@/dados/store";
import { AVAILABILITY_LABEL } from "@/features/shell/format";
import { inviteMember, previewSuccession, removeMember } from "@n1/dominio/operations";
import { useFormat } from "@/features/shell/use-format";
import {
  Button,
  CabecalhoDePainel,
  ConfirmDialog,
  CorpoDeTela,
  EmptyState,
  Field,
  PageHeader,
  Painel,
  Section,
  Select,
  StateSeal,
  TextInput,
  Toast,
} from "@/features/shell/ui";
import {
  TransferOwnershipDialog,
  useTransferOwnershipDialog,
} from "@/features/configuracoes/transfer-ownership-dialog";


const TRANSFER_LABEL: Record<string, string> = {
  contact: "Contato",
  company: "Empresa",
  deal: "Negócio",
  agent: "Agente",
  automation: "Automação",
  panel: "Painel",
  collection: "Coleção",
};

const RELEASE_LABEL: Record<string, string> = {
  task: "Tarefa",
  checklistItem: "Item de Checklist",
  conversation: "Conversa",
};

export default function MembrosPage() {
  const state = useData((data) => data);
  const fmt = useFormat();
  const { memberId } = useSession();
  const run = useRun();
  const router = useRouter();
  const query = useSearchParams();
  /**
   * D04 — a sucessão vive no endereço (`?remover-membro=<membro>`): é o ato de
   * governança mais consequente do produto, e um recarregamento não pode
   * apagar o que já foi lido na prévia.
   */
  const removing = query.get("remover-membro");
  const setRemoving = (value: string | null) => {
    const next = new URLSearchParams(query.toString());
    if (value === null) next.delete("remover-membro");
    else next.set("remover-membro", value);
    router.replace(next.size > 0 ? `?${next}` : "?", { scroll: false });
  };
  const [successorId, setSuccessorId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("");
  const { transferring, openTransfer, closeTransfer } = useTransferOwnershipDialog();

  const acting = state.members.find((m) => m.id === memberId);
  const actingRole = state.roles.find((r) => r.id === acting?.roleId);
  const mayGovern = actingRole?.base === "administrador" || actingRole?.base === "proprietario";

  const active = state.members.filter((m) => m.state !== "removido");
  const removed = state.members.filter((m) => m.state === "removido");
  const limit = state.workspace.limits.members;
  const atLimit = active.length >= limit;

  const target = removing ? state.members.find((m) => m.id === removing) : undefined;
  const preview = target ? previewSuccession(state, target.id) : null;

  const eligibleSuccessors = state.members.filter((member) => {
    if (member.state !== "ativo") return false;
    if (member.id === removing) return false;
    const role = state.roles.find((r) => r.id === member.roleId);
    return role?.base !== "convidado";
  });

  const invitableRoles = state.roles.filter((role) => role.base !== "proprietario");
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim());

  const confirmInvite = () => {
    const result = run((data, actingId) =>
      inviteMember(data, actingId, { email: inviteEmail, roleId: inviteRoleId || (invitableRoles[0]?.id ?? "") }),
    );
    if (result.ok) {
      setError(null);
      setNotice(`Convite enviado para ${result.value.invitedIdentity?.value}. O Membro entra como pendente e conta para o limite.`);
      setInviting(false);
      setInviteEmail("");
      setInviteRoleId("");
    } else {
      setNotice(null);
      setError(result.error);
    }
  };

  const confirmRemoval = () => {
    if (!target) return;
    const result = run((data, actingId) => removeMember(data, actingId, target.id, successorId));
    if (result.ok) {
      setError(null);
      setNotice(`Participação de ${target.displayName} encerrada; a autoria histórica permanece.`);
      setRemoving(null);
      setSuccessorId("");
    } else {
      setNotice(null);
      setError(result.error);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        path={
          <Link href="/configuracoes" className="hover:underline">
            Configurações
          </Link>
        }
        title="Membros"
        meta={`${active.length} de ${limit} participações · ${removed.length} encerrada(s)`}
        actions={
          <>
            <Button
              onClick={openTransfer}
              disabled={state.workspace.ownerMemberId !== memberId}
              disabledReason="Só o Proprietário do Espaço de Trabalho transfere a propriedade."
            >
              Transferir propriedade
            </Button>
          <Button
            variant="primary"
            onClick={() => {
              setInviting(true);
              setError(null);
            }}
            disabled={!mayGovern || atLimit}
            disabledReason={
              !mayGovern
                ? "Só um Administrador ou o Proprietário convida um Membro."
                : `O limite de ${limit} Membros do Espaço de Trabalho foi atingido.`
            }
          >
            Convidar Membro
          </Button>
          </>
        }
      />

      <TransferOwnershipDialog open={transferring} onClose={closeTransfer} onDone={setNotice} />

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

        {inviting ? (
          <Painel className="mb-6">
            <CabecalhoDePainel titulo="Convidar Membro" />
            <div className="p-4">
              <p className="app-base" style={{ color: "var(--texto-3)" }}>
                O convite é dirigido a um e-mail. O Membro entra como <em>pendente</em>, já conta para o
                limite do Espaço de Trabalho e só age depois de aceitar.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="E-mail">
                  {(id) => (
                    <TextInput
                      id={id}
                      type="email"
                      value={inviteEmail}
                      onChange={setInviteEmail}
                      placeholder="pessoa@empresa.com.br"
                    />
                  )}
                </Field>
                <Field
                  label="Papel"
                  hint="O Papel de Proprietário não se concede por convite: muda por transferência de propriedade."
                >
                  {(id) => (
                    <Select
                      id={id}
                      value={inviteRoleId || (invitableRoles[0]?.id ?? "")}
                      onChange={setInviteRoleId}
                      options={invitableRoles.map((role) => ({
                        value: role.id,
                        label: role.system ? `${role.name} (sistema)` : `${role.name} (teto ${role.base})`,
                      }))}
                    />
                  )}
                </Field>
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="primary"
                  onClick={confirmInvite}
                  disabled={!emailValid}
                  disabledReason="Informe um e-mail válido antes de enviar o convite."
                >
                  Enviar convite
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setInviting(false);
                    setInviteEmail("");
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </Painel>
        ) : null}
        {target && preview ? (
          <ConfirmDialog
            open={target !== undefined && preview !== null}
            title={`Remover ${target?.displayName ?? "Membro"}`}
            description="O Membro não é apagado: a autoria de tudo o que ele fez continua registrada. O que ele possuía passa ao Sucessor; o que ele apenas atendia é liberado."
            confirmLabel="Remover Membro"
            destructive
            {...(successorId === ""
              ? { confirmDisabledReason: "Escolha o Sucessor antes de remover o Membro." }
              : {})}
            onConfirm={confirmRemoval}
            onCancel={() => {
              setRemoving(null);
              setSuccessorId("");
            }}
          >
            <div className="grid gap-3">
              <h2 className="app-md" style={{ color: "var(--texto)" }}>
                Encerrar a participação de {target.displayName}
              </h2>
              <p className="app-base" style={{ color: "var(--texto-3)" }}>
                O Membro não é apagado: a autoria de tudo o que ele fez continua registrada. O que ele
                possuía passa ao Sucessor; o que ele apenas atendia é liberado.
              </p>

              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="app-coluna">
                    Passa ao Sucessor ({preview.transfers.length})
                  </p>
                  {preview.transfers.length === 0 ? (
                    <p className="app-base mt-1" style={{ color: "var(--texto-3)" }}>Nada a transferir.</p>
                  ) : (
                    <ul className="app-base relative mt-1 max-h-40 space-y-0.5 overflow-y-auto" style={{ color: "var(--texto-3)" }}>
                      {preview.transfers.map((item) => (
                        <li key={`${item.type}-${item.id}`}>
                          {TRANSFER_LABEL[item.type] ?? item.type}: {item.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="app-coluna">
                    Fica sem Responsável ({preview.releases.length})
                  </p>
                  {preview.releases.length === 0 ? (
                    <p className="app-base mt-1" style={{ color: "var(--texto-3)" }}>Nada a liberar.</p>
                  ) : (
                    <ul className="app-base relative mt-1 max-h-40 space-y-0.5 overflow-y-auto" style={{ color: "var(--texto-3)" }}>
                      {preview.releases.map((item) => (
                        <li key={`${item.type}-${item.id}`}>
                          {RELEASE_LABEL[item.type] ?? item.type}: {item.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <ul className="app-base mt-3 space-y-0.5" style={{ color: "var(--texto-3)" }}>
                <li>{preview.pendingApprovals} Solicitação(ões) de Aprovação passam ao Sucessor.</li>
                <li>
                  {preview.privateContainerGrants} Concessão(ões) sobre contêineres privados passam ao
                  Sucessor.
                </li>
                <li>{preview.chatSessions} Sessão(ões) de Chat deixam de ser acessíveis.</li>
              </ul>

              <div className="mt-3 max-w-sm">
                <Field label="Sucessor" hint="Precisa ser um Membro ativo e não pode ter Papel de base Convidado.">
                  {(id) => (
                    <Select
                      id={id}
                      value={successorId}
                      onChange={setSuccessorId}
                      placeholder="Escolher Sucessor"
                      options={eligibleSuccessors.map((member) => ({
                        value: member.id,
                        label: `${member.displayName} · ${state.roles.find((r) => r.id === member.roleId)?.name}`,
                      }))}
                    />
                  )}
                </Field>
              </div>
            </div>
          </ConfirmDialog>
        ) : null}

        <Section title="Participações" count={active.length}>
          <table className="tabela">
            <thead>
              <tr>
                <th className="app-coluna">Membro</th>
                <th className="app-coluna">Papel</th>
                <th className="app-coluna">Estado</th>
                <th className="app-coluna">Disponibilidade</th>
                <th className="app-coluna">Entrou</th>
                <th className="app-coluna">Capacidade/sem</th>
                <th className="app-coluna" />
              </tr>
            </thead>
            <tbody>
              {active.map((member) => {
                const role = state.roles.find((r) => r.id === member.roleId);
                const isOwner = state.workspace.ownerMemberId === member.id;
                return (
                  <tr key={member.id}>
                    <td>
                      <Link
                        href={`/configuracoes/membros/${member.id}`}
                        className="app-md hover:underline"
                        style={{ color: "var(--texto)" }}
                      >
                        {member.displayName}
                      </Link>
                      {member.invitedIdentity ? (
                        <span className="app-meta block">
                          {member.invitedIdentity.value}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      {role?.name ?? "—"}
                      {isOwner ? <span className="app-meta block">Proprietário</span> : null}
                    </td>
                    <td>
                      <StateSeal state={member.state} />
                      {member.state === "ativo" ? (
                        <span className="app-meta">ativo</span>
                      ) : null}
                    </td>
                    <td>
                      {AVAILABILITY_LABEL[member.availability.value] ?? member.availability.value}
                    </td>
                    <td>
                      <span className="app-meta app-numero">
                        {member.joinedAt ? fmt.instant(member.joinedAt) : "—"}
                      </span>
                    </td>
                    <td>
                      <CapacityEditor
                        memberId={member.id}
                        editavel={member.state === "ativo" && (mayGovern || member.id === memberId)}
                        onResult={(result, message) => {
                          if (result.ok) {
                            setError(null);
                            setNotice(message);
                          } else {
                            setNotice(null);
                            setError(result.error ?? "Não foi possível concluir a operação.");
                          }
                        }}
                      />
                    </td>
                    <td className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setRemoving(member.id);
                          setSuccessorId("");
                          setError(null);
                        }}
                        disabled={!mayGovern || isOwner || member.id === memberId}
                        disabledReason={
                          isOwner
                            ? "Transfira a propriedade do Espaço de Trabalho antes de remover este Membro. Use “Transferir propriedade” no cabeçalho."
                            : member.id === memberId
                              ? "Você não encerra a própria participação por aqui."
                              : "Só um Administrador ou o Proprietário encerra uma participação."
                        }
                      >
                        Encerrar
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>

        <Section title="Participações encerradas" count={removed.length}>
          {removed.length === 0 ? (
            <EmptyState title="Nenhuma participação encerrada." />
          ) : (
            <ul className="pilha-solta">
              {removed.map((member) => {
                const successor = state.members.find((m) => m.id === member.successorId);
                return (
                  <li key={member.id}>
                    <Link href={`/configuracoes/membros/${member.id}`} className="item-solto" data-atenuado="true">
                      <span className="app-base min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
                        {member.displayName}
                      </span>
                      <span className="app-meta app-numero shrink-0">
                        {member.removedAt ? fmt.instant(member.removedAt) : ""}
                        {successor ? ` · sucedido por ${successor.displayName}` : ""}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="app-meta mt-2 px-1">
            A autoria histórica permanece: quem foi removido continua aparecendo em todo Registro de
            Atividade que criou.
          </p>
        </Section>
      </CorpoDeTela>
    </div>
  );
}

/**
 * Fase 3 — capacidade semanal em horas, gravada em minutos. Só o próprio ou
 * quem governa edita; o resto lê.
 */
function CapacityEditor({
  memberId,
  editavel,
  onResult,
}: {
  readonly memberId: string;
  readonly editavel: boolean;
  readonly onResult: (result: { ok: boolean; error?: string }, message: string) => void;
}) {
  const run = useRun();
  const minutos = useData((data) => memberCapacityMinutes(data, memberId));
  const [horas, setHoras] = useState(String(minutos / 60));
  const valor = Number(horas.replace(",", "."));
  const valido = horas.trim() !== "" && Number.isFinite(valor) && valor >= 0 && valor <= 168;
  const gravar = () => {
    if (!valido) {
      onResult({ ok: false, error: "A capacidade é em horas por semana, de 0 a 168." }, "");
      setHoras(String(minutos / 60));
      return;
    }
    if (Math.round(valor * 60) !== minutos) {
      onResult(run((data, me) => setMemberCapacity(data, me, memberId, Math.round(valor * 60))), "Capacidade semanal alterada.");
    }
  };
  if (!editavel) {
    return (
      <span className="app-numero" style={{ color: "var(--texto)" }}>
        {minutos / 60} h
      </span>
    );
  }
  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(event) => {
        event.preventDefault();
        gravar();
      }}
    >
      <label className="sr-only" htmlFor={`capacidade-${memberId}`}>
        Capacidade semanal em horas
      </label>
      <input
        id={`capacidade-${memberId}`}
        type="number"
        min={0}
        max={168}
        step={0.5}
        value={horas}
        onChange={(event) => setHoras(event.target.value)}
        onBlur={gravar}
        aria-invalid={!valido}
        className="campo app-numero w-16"
        style={{ height: "var(--controle-h-sm)" }}
      />
      <span className="app-meta">h</span>
    </form>
  );
}
