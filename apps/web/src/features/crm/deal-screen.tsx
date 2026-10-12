"use client";

/**
 * T18 — Negócio: a tela do Negócio, usada pela rota `/crm/negocios/[negocio]`
 * e, embutida, pelas Listas de "Meus negócios" (o card do Funil abre o
 * Negócio, não a Tarefa que o espelha).
 *
 * Closing is a form, not a button: B59 lets the Funnel demand a value on win
 * and a loss reason on loss, so the fields appear before the confirmation and
 * the submit stays disabled until they are valid (ux-flows.md).
 */

import {
  Briefcase,
  CheckSquare,
  ClipboardList,
  History,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useData, useRun, useSession } from "@/dados/store";
import {
  contactDisplayName,
  effectiveProbability,
  newestFirst,
} from "@n1/dominio/derive";
import { ConversationThread } from "@/features/crm/conversation-thread";
import {
  ContactDataPanel,
  ContactIdentity,
  ContactQuickActions,
  ContactSummary,
} from "@/features/crm/contact-card";
import {
  linkContactToDeal,
  loseDeal,
  moveDealToStage,
  setDealFieldValue,
  reopenDeal,
  unlinkContactFromDeal,
  winDeal,
} from "@n1/dominio/operations";
import {
  DEAL_CONTACT_ROLE_LABEL,
  DEAL_SITUATION_LABEL,
} from "@/features/shell/format";
import { useFormat } from "@/features/shell/use-format";
import {
  Button,
  ConfirmDialog,
  CorpoDeTela,
  EmptyState,
  Field,
  ActorAvatar,
  Icone,
  PageHeader,
  Pilula,
  RecordPanel,
  RecordRow,
  Select,
  StateSeal,
  TextArea,
  TextInput,
  Toast,
} from "@/features/shell/ui";
import type { DealContactRole, FieldValue, Id } from "@n1/dominio/types";

/** A situação do Negócio no vocabulário de cor do sistema: `perdido` não é vermelho. */
const SITUACAO_COR: Record<string, string> = {
  aberto: "var(--cor-neg-aberto)",
  ganho: "var(--cor-neg-ganho)",
  perdido: "var(--cor-neg-perdido)",
};

type Closing = "ganho" | "perdido" | null;

export function DealScreen({
  dealId,
  embedded,
}: {
  readonly dealId: string;
  /** Dentro de outra tela (a Lista do Funil): trilha própria e um botão para fechar. */
  readonly embedded?: { readonly path: React.ReactNode; readonly onClose: () => void };
}) {
  const state = useData((data) => data);
  const fmt = useFormat();
  const run = useRun();
  const { memberId } = useSession();
  const router = useRouter();
  const query = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [reasonId, setReasonId] = useState("");
  const [note, setNote] = useState("");
  const [linkingContactId, setLinkingContactId] = useState("");
  const [confirmingReopen, setConfirmingReopen] = useState(false);
  const [desvinculando, setDesvinculando] = useState<string | null>(null);
  const [canalDaConversa, setCanalDaConversa] = useState<Id | null>(
    null,
  );
  const [linkingRole, setLinkingRole] = useState<DealContactRole>("decisor");

  /**
   * D07 — the closing dialog lives in the URL (`?ganhar=` / `?perder=`), not in
   * component state: encerrar um Negócio is a step people share, reload and
   * expect in the browser history.
   */
  const closing: Closing = query.has("ganhar")
    ? "ganho"
    : query.has("perder")
      ? "perdido"
      : null;
  // Os outros parâmetros ficam (a Lista do Funil guarda `?tarefa=` na URL).
  const withClosing = (which: Exclude<Closing, null> | null) => {
    const next = new URLSearchParams(query.toString());
    next.delete("ganhar");
    next.delete("perder");
    if (which) next.set(which === "ganho" ? "ganhar" : "perder", "");
    const texto = next.toString();
    return texto ? `?${texto}` : "?";
  };
  const openDialog = (which: Exclude<Closing, null>) => {
    setReasonId("");
    router.replace(withClosing(which), { scroll: false });
  };
  const closeDialog = () => {
    setAmount("");
    setReasonId("");
    setNote("");
    router.replace(withClosing(null), { scroll: false });
  };

  const deal = state.deals.find((d) => d.id === dealId);
  const funnel = state.funnels.find((f) => f.id === deal?.funnelId);

  if (!deal || !funnel) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Negócio não encontrado" />
        <CorpoDeTela>
          <EmptyState
            title="Negócio não encontrado."
            hint="Ele pode ter sido eliminado, ou você não tem permissão para vê-lo."
          />
        </CorpoDeTela>
      </div>
    );
  }

  const stage = funnel.stages.find((s) => s.id === deal.stageId);
  const stages = [...funnel.stages].sort((a, b) => a.order - b.order);
  const owner = state.members.find((m) => m.id === deal.ownerMemberId);
  const company = state.companies.find((c) => c.id === deal.companyId);
  const probability = effectiveProbability(state, deal);

  /**
   * O Contato principal do Negócio é com quem se conversa. Sem ele, a coluna
   * principal não tem assunto — e a Etapa Agendamento exige um Contato
   * justamente por isso.
   */
  const principal = (() => {
    const vinculo =
      deal.contactLinks.find((l) => l.principal) ?? deal.contactLinks[0];
    return vinculo
      ? state.contacts.find((c) => c.id === vinculo.contactId)
      : undefined;
  })();

  // Os cinco campos do roteiro, na ordem do processo.
  /**
   * Os seis campos do roteiro, na ordem do processo. A lista NÃO tira os
   * vazios: eles são exatamente o que a pessoa veio preencher, e a Etapa
   * Qualificação não deixa sair sem eles.
   */
  const camposDoRoteiro = [
    "fd_criterio_fit",
    "fd_criterio",
    "fd_dor",
    "fd_decisor",
    "fd_orcamento",
    "fd_prazo",
  ]
    .map((definitionId) => state.fieldDefinitions.find((d) => d.id === definitionId))
    .filter((definicao) => definicao !== undefined);

  const valorDoCampo = (definitionId: string) =>
    deal.fieldValues.find((v) => v.definitionId === definitionId);


  const gravarCampo = (definitionId: string, valor: FieldValue["value"]) =>
    report(
      run((data, memberId) => setDealFieldValue(data, memberId, deal.id, definitionId, valor)),
      "Campo do roteiro gravado.",
    );


  // Tarefa aberta do Proprietário, mais próxima do vencimento.
  const proximaTarefa = state.tasks
    .filter(
      (task) =>
        task.lifecycle === "ativo" &&
        task.assignees.some(
          (a) => a.kind === "member" && a.id === deal.ownerMemberId,
        ) &&
        task.dueDate !== undefined,
    )
    .sort((a, b) =>
      String(a.dueDate?.value).localeCompare(String(b.dueDate?.value)),
    )[0];

  const atividade = newestFirst(
    state.activity.filter(
      (registro) => registro.objectType === "deal" && registro.objectId === deal.id,
    ),
  );

  const editable = deal.lifecycle === "ativo" && deal.situation === "aberto";

  // Mirrors reopenDeal: reopening a WON deal is an administrator-level act.
  const actingRole = state.roles.find(
    (role) => role.id === state.members.find((m) => m.id === memberId)?.roleId,
  );
  const isAdminLevel =
    actingRole?.base === "administrador" || actingRole?.base === "proprietario";

  const lossReasons = state.catalog.filter(
    (item) => item.kind === "motivoPerda" && item.lifecycle === "ativo",
  );
  const winReasons = state.catalog.filter(
    (item) => item.kind === "motivoGanho" && item.lifecycle === "ativo",
  );

  // RN-NEG-11 — o que a reabertura limpa como atributo corrente.
  const clearedOnReopen = [
    deal.situation === "ganho" && deal.winReasonId
      ? `Motivo de Ganho: ${state.catalog.find((c) => c.id === deal.winReasonId)?.name}`
      : undefined,
    deal.situation === "perdido" && deal.lossReasonId
      ? `Motivo de Perda: ${state.catalog.find((c) => c.id === deal.lossReasonId)?.name}`
      : undefined,
    deal.closingNote ? "Nota de encerramento" : undefined,
    deal.closedAt ? "Momento de encerramento" : undefined,
  ].filter((part) => part !== undefined);

  const parsedAmount = Number(amount.replace(",", "."));
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const winBlocked =
    funnel.closingRules.requireValueOnWin && !amountValid && !deal.value;
  const lossBlocked = funnel.closingRules.requireLossReason && reasonId === "";
  const blockedReason =
    closing === "ganho" && winBlocked
      ? "Este Funil exige um valor maior que zero para o Negócio ganho."
      : closing === "perdido" && lossBlocked
        ? "Este Funil exige um Motivo de Perda."
        : undefined;

  const report = (result: { ok: boolean; error?: string }, message: string) => {
    if (result.ok) {
      setError(null);
      setNotice(message);
      closeDialog();
    } else {
      setNotice(null);
      setError(result.error ?? "Não foi possível concluir a operação.");
    }
  };

  const linkContact = () => {
    report(
      run((data, memberId) =>
        linkContactToDeal(
          data,
          memberId,
          deal.id,
          linkingContactId,
          linkingRole,
        ),
      ),
      "Contato vinculado ao Negócio.",
    );
    setLinkingContactId("");
  };

  const move = (stageId: string) => {
    report(
      run((data, memberId) =>
        moveDealToStage(data, memberId, deal.id, stageId),
      ),
      "Etapa alterada.",
    );
  };

  const confirmWin = () => {
    report(
      run((data, memberId) =>
        winDeal(data, memberId, deal.id, {
          ...(amountValid
            ? { value: { amount: parsedAmount, currency: "BRL" as const } }
            : {}),
          ...(reasonId ? { winReasonId: reasonId } : {}),
          ...(note ? { closingNote: note } : {}),
        }),
      ),
      "Negócio marcado como ganho.",
    );
  };

  const confirmLoss = () => {
    report(
      run((data, memberId) =>
        loseDeal(data, memberId, deal.id, {
          ...(reasonId ? { lossReasonId: reasonId } : {}),
          ...(note ? { closingNote: note } : {}),
        }),
      ),
      "Negócio marcado como perdido.",
    );
  };

  const confirmReopen = () => {
    report(
      run((data, memberId) => reopenDeal(data, memberId, deal.id)),
      "Negócio reaberto.",
    );
  };

  /**
   * A Etapa é o terceiro eixo da ficha, ao lado da Qualificação e da Temperatura:
   * o que a pessoa é, quão perto está, e em que ponto do Funil o Negócio está.
   *
   * As transições que o Funil não permite continuam na lista e dizem por que não
   * podem ser escolhidas — sumir com elas esconderia o desenho do Funil.
   */
  const etapaDoNegocio = (() => {
    const somenteLeitura =
      deal.situation !== "aberto" || deal.lifecycle !== "ativo";
    const motivoDeBloqueio =
      deal.situation !== "aberto"
        ? "Um Negócio ganho ou perdido preserva a sua última Etapa."
        : "Este Negócio é somente leitura.";
    const permitidas = stage?.allowedTransitionStageIds ?? [];

    return (
      <div className="grid gap-1.5">
        {/* Etapa e Qualificação lado a lado, como a Qualificação do Contato e a
            Temperatura acima: os quatro eixos da ficha em duas linhas. */}
        <div className="grid grid-cols-2 items-end gap-2">
          <span className="grid min-w-0 gap-1.5">
            <label
              className="app-sm"
              style={{ color: "var(--texto-3)" }}
              htmlFor="etapa-do-negocio"
            >
              Etapa · {stages.findIndex((s) => s.id === deal.stageId) + 1} de{" "}
              {stages.length}
            </label>
            <Select
              id="etapa-do-negocio"
              value={deal.stageId}
              onChange={move}
              disabled={somenteLeitura}
              disabledReason={motivoDeBloqueio}
              options={stages.map((option) => ({
                value: option.id,
                label: option.name,
                detail: `${option.defaultProbability}%`,
                ...(permitidas.length > 0 &&
                !permitidas.includes(option.id) &&
                option.id !== deal.stageId
                  ? {
                      disabledReason:
                        "Este Funil não permite a transição direta para esta Etapa.",
                    }
                  : {}),
              }))}
            />
          </span>

          <span className="grid min-w-0 gap-1.5">
            <label
              className="app-sm"
              style={{ color: "var(--texto-3)" }}
              htmlFor="resultado-da-qualificacao"
            >
              Qualificação
            </label>
            <Select
              id="resultado-da-qualificacao"
              value={String(
                deal.fieldValues.find(
                  (v) => v.definitionId === "fd_result_qual",
                )?.value ?? "",
              )}
              onChange={(valor) =>
                report(
                  run((data, memberId) =>
                    setDealFieldValue(
                      data,
                      memberId,
                      deal.id,
                      "fd_result_qual",
                      valor || null,
                    ),
                  ),
                  "Resultado da qualificação registrado.",
                )
              }
              disabled={somenteLeitura}
              disabledReason={motivoDeBloqueio}
              placeholder="Ainda não qualificado"
              options={(
                state.fieldDefinitions.find((d) => d.id === "fd_result_qual")
                  ?.options ?? []
              ).map((opcao) => ({ value: opcao, label: opcao }))}
            />
          </span>
        </div>
      </div>
    );
  })();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        path={
          embedded ? (
            embedded.path
          ) : (
            <>
              <Link href="/crm/negocios" className="hover:underline">
                Negócios
              </Link>
              {" › "}
              <Link href={`/crm/funis/${funnel.id}`} className="hover:underline">
                {funnel.name}
              </Link>
            </>
          )
        }
        title={deal.title}
        seal={
          <>
            <StateSeal state={deal.lifecycle} />
            <Pilula cor={SITUACAO_COR[deal.situation] ?? "var(--texto-3)"}>
              {DEAL_SITUATION_LABEL[deal.situation]}
            </Pilula>
          </>
        }
        meta={deal.value ? fmt.money(deal.value) : "sem valor declarado"}
        details={
          <>
            {/* A barra é a ORDEM da Etapa no Funil: progressão, não previsão. */}
            <Pilula tom="acento" className="shrink-0">
              {stage?.name ?? "—"}
            </Pilula>
            <span
              aria-hidden="true"
              className="min-w-0 flex-1 overflow-hidden rounded-full"
              style={{ height: "var(--barra-viz-h)", background: "var(--superficie-3)" }}
            >
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${(((stage?.order ?? 0) + 1) / Math.max(stages.length, 1)) * 100}%`,
                  background: "var(--acento)",
                }}
              />
            </span>
            <span className="app-meta app-numero shrink-0">
              Etapa {(stage?.order ?? 0) + 1} de {stages.length}
            </span>
            <span className="app-meta shrink-0">na Etapa desde {fmt.relative(deal.enteredStageAt)}</span>
          </>
        }
        actions={
          <>
            {deal.situation === "aberto" ? (
              <>
                <Button
                  variant="primary"
                  onClick={() => openDialog("ganho")}
                  disabled={deal.lifecycle !== "ativo"}
                  disabledReason="Um Negócio arquivado ou na lixeira é somente leitura."
                >
                  Marcar como ganho
                </Button>
                <Button
                  onClick={() => openDialog("perdido")}
                  disabled={deal.lifecycle !== "ativo"}
                  disabledReason="Um Negócio arquivado ou na lixeira é somente leitura."
                >
                  Marcar como perdido
                </Button>
              </>
            ) : (
              <Button
                variant="danger"
                onClick={() => setConfirmingReopen(true)}
                disabled={deal.situation === "ganho" && !isAdminLevel}
                disabledReason="Só Administradores reabrem um Negócio ganho."
              >
                Reabrir
              </Button>
            )}
            {embedded ? (
              <>
                <Link
                  href={`/crm/negocios/${deal.id}`}
                  className="btn btn-contorno"
                >
                  Abrir no CRM
                </Link>
                <Button onClick={embedded.onClose}>
                  Fechar
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <ConfirmDialog
        open={desvinculando !== null}
        title="Remover o Contato deste Negócio?"
        description="O Vínculo com o Negócio não tem período: removê-lo apaga a ligação. As Conversas do Contato permanecem, e ele continua na Empresa."
        confirmLabel="Remover"
        destructive
        onConfirm={() => {
          if (!desvinculando) return;
          report(
            run((data, memberId) =>
              unlinkContactFromDeal(data, memberId, deal.id, desvinculando),
            ),
            "Contato desvinculado do Negócio.",
          );
          setDesvinculando(null);
        }}
        onCancel={() => setDesvinculando(null)}
      />

      <ConfirmDialog
        open={confirmingReopen}
        title={`Reabrir “${deal.title}”?`}
        description={`O Negócio volta a ${stage?.name ?? "a Etapa atual"} como aberto.${
          clearedOnReopen.length > 0
            ? ` Isto some do registro: ${clearedOnReopen.join(" · ")}. Fica guardado no Registro de Atividade, mas não volta ao preencher de novo.`
            : ""
        }`}
        confirmLabel="Reabrir"
        destructive
        onConfirm={() => {
          confirmReopen();
          setConfirmingReopen(false);
        }}
        onCancel={() => setConfirmingReopen(false)}
      />

      {/* O corpo é coluna flex para que, em tela larga, a conversa e a lateral
          rolem cada uma por si; abaixo disso o corpo inteiro rola. */}
      <CorpoDeTela className="flex min-h-0 flex-col">
        {notice ? <Toast tone="success">{notice}</Toast> : null}
        {error ? <Toast tone="error">{error}</Toast> : null}

        <ConfirmDialog
          open={closing !== null}
          title={
            closing === "ganho" ? "Marcar como ganho" : "Marcar como perdido"
          }
          description={`O Negócio permanece na Etapa ${stage?.name ?? "atual"}. Reabrir é possível depois${
            closing === "ganho"
              ? ", mas só um Administrador reabre um Negócio ganho."
              : "."
          }`}
          confirmLabel="Confirmar"
          destructive={closing === "perdido"}
          {...(blockedReason ? { confirmDisabledReason: blockedReason } : {})}
          onConfirm={closing === "ganho" ? confirmWin : confirmLoss}
          onCancel={closeDialog}
        >
          <div className="grid gap-3">
            {closing === "ganho" ? (
              <Field
                label={`Valor ${funnel.closingRules.requireValueOnWin ? "(obrigatório neste Funil)" : "(opcional)"}`}
                {...(funnel.closingRules.requireValueOnWin &&
                amount !== "" &&
                !amountValid
                  ? { error: "Informe um valor maior que zero." }
                  : {})}
              >
                {(id) => (
                  <TextInput
                    id={id}
                    value={amount}
                    onChange={setAmount}
                    invalid={amount !== "" && !amountValid}
                    placeholder={
                      deal.value ? String(deal.value.amount) : "0,00"
                    }
                  />
                )}
              </Field>
            ) : null}

            <Field
              label={
                closing === "ganho"
                  ? "Motivo de Ganho (opcional)"
                  : "Motivo de Perda"
              }
              {...(closing === "perdido" &&
              funnel.closingRules.requireLossReason
                ? { hint: "Obrigatório neste Funil." }
                : {})}
            >
              {(id) => (
                <Select
                  id={id}
                  value={reasonId}
                  onChange={setReasonId}
                  searchable
                  placeholder="Não informar"
                  options={(closing === "ganho" ? winReasons : lossReasons).map(
                    (item) => ({
                      value: item.id,
                      label: item.name,
                    }),
                  )}
                />
              )}
            </Field>

            <Field label="Nota de encerramento (opcional)">
              {(id) => (
                <TextArea id={id} value={note} onChange={setNote} rows={2} />
              )}
            </Field>
          </div>
        </ConfirmDialog>

        {/*
          A tela é a CONVERSA, com o Negócio como contexto — é o que um SDR faz
          o dia todo. A coluna principal é a conversa por Canal; a lateral diz
          quem é a pessoa, o que o Negócio é, a próxima Tarefa e o que aconteceu
          por último.

          A Etapa fica na lateral, junto do valor e da previsão: são eles que os
          Requisitos olham quando o Negócio tenta andar.
        */}
        <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
          {/* ── principal: a conversa ── */}
          <div className="min-w-0 xl:min-h-0">
            {principal ? (
              <ConversationThread
                contact={principal}
                canalSelecionado={canalDaConversa}
                onCanalChange={setCanalDaConversa}
              />
            ) : (
              <EmptyState
                title="Este Negócio não tem Contato vinculado."
                hint="Sem Contato não há com quem conversar — e a Etapa Agendamento exige um."
              />
            )}
          </div>

          {/* ── lateral: quem é a pessoa e o que o Negócio é ── */}
          <div className="relative grid content-start gap-3 xl:min-h-0 xl:overflow-y-auto">
            {principal ? (
              <>
                <ContactIdentity
                  contact={principal}
                  editavel={editable}
                  abaixo={etapaDoNegocio}
                />
                <ContactQuickActions
                  contact={principal}
                  onCanal={setCanalDaConversa}
                />
                <ContactDataPanel contact={principal} />
                <ContactSummary contact={principal} />
              </>
            ) : (
              etapaDoNegocio
            )}

            <RecordPanel
              icon={<Icone de={Briefcase} tamanho="sm" />}
              title="Dados do Negócio"
            >
              <dl className="grid">
                <RecordRow label="Probabilidade">
                  {probability}%
                  {deal.overriddenProbability !== undefined ? " (à mão)" : " (da Etapa)"}
                </RecordRow>
                <RecordRow label="Fechamento previsto">
                  {deal.expectedCloseDate ? fmt.civilDate(deal.expectedCloseDate) : "—"}
                </RecordRow>
                <RecordRow label="Origem">
                  {state.catalog.find((item) => item.id === deal.originId)?.name ?? "—"}
                </RecordRow>
                <RecordRow label="Empresa">
                  {company ? (
                    <Link href={`/crm/empresas/${company.id}`} className="hover:underline">
                      {company.tradeName}
                    </Link>
                  ) : (
                    "—"
                  )}
                </RecordRow>
                <RecordRow label="Tags">
                  {deal.tagIds.length === 0 ? (
                    "—"
                  ) : (
                    <span className="inline-flex flex-wrap items-center justify-end gap-1">
                      {deal.tagIds.map((tagId) => {
                        const tag = state.tags.find((t) => t.id === tagId);
                        return (
                          <Pilula key={tagId} cor={tag?.color ?? "var(--texto-3)"}>
                            {tag?.name ?? tagId}
                          </Pilula>
                        );
                      })}
                    </span>
                  )}
                </RecordRow>
                {/*
                  A ontologia chama esta pessoa de Proprietário: o Negócio não tem
                  Atribuído como a Tarefa tem. É quem responde pelo Negócio.
                */}
                <RecordRow label="Proprietário">
                  <span className="inline-flex items-center gap-1.5">
                    <ActorAvatar
                      kind="member"
                      name={owner?.displayName ?? "—"}
                      {...(owner?.photoFileId ? { photoFileId: owner.photoFileId } : {})}
                    />
                    {owner?.displayName ?? "—"}
                  </span>
                </RecordRow>
              </dl>
            </RecordPanel>

            <RecordPanel
              icon={<Icone de={ClipboardList} tamanho="sm" />}
              title="Roteiro de qualificação"
              count={camposDoRoteiro.length}
            >
              <div className="grid gap-3">
                {camposDoRoteiro.map((definicao) => {
                  const valor = valorDoCampo(definicao.id)?.value;
                  const arquivado = valorDoCampo(definicao.id)?.state === "arquivado";
                  const bloqueio = arquivado
                    ? "Este Valor está arquivado: ele é preservado, não editado."
                    : !editable
                      ? "Este Negócio é somente leitura."
                      : undefined;
                  return (
                    <Field
                      key={definicao.id}
                      label={definicao.name}
                      {...(definicao.description ? { hint: definicao.description } : {})}
                    >
                      {(id) =>
                        definicao.type === "singleSelect" ? (
                          <Select
                            id={id}
                            value={valor === null || valor === undefined ? "" : String(valor)}
                            onChange={(escolha) => gravarCampo(definicao.id, escolha || null)}
                            disabled={bloqueio !== undefined}
                            {...(bloqueio ? { disabledReason: bloqueio } : {})}
                            placeholder="Não informado"
                            options={(definicao.options ?? []).map((opcao) => ({
                              value: opcao,
                              label: opcao,
                            }))}
                          />
                        ) : definicao.type === "longText" ? (
                          <TextArea
                            id={id}
                            rows={2}
                            autoGrow
                            value={valor === null || valor === undefined ? "" : String(valor)}
                            onChange={(texto) => gravarCampo(definicao.id, texto || null)}
                            disabled={bloqueio !== undefined}
                            {...(bloqueio ? { disabledReason: bloqueio } : {})}
                          />
                        ) : (
                          <TextInput
                            id={id}
                            type={definicao.type === "currency" ? "number" : "text"}
                            value={valor === null || valor === undefined ? "" : String(valor)}
                            onChange={(texto) =>
                              gravarCampo(
                                definicao.id,
                                texto === ""
                                  ? null
                                  : definicao.type === "currency"
                                    ? Number(texto)
                                    : texto,
                              )
                            }
                            disabled={bloqueio !== undefined}
                            {...(bloqueio ? { disabledReason: bloqueio } : {})}
                          />
                        )
                      }
                    </Field>
                  );
                })}
              </div>
            </RecordPanel>

            <RecordPanel
              icon={<Icone de={Users} tamanho="sm" />}
              title="Contatos vinculados"
              count={deal.contactLinks.length}
            >
              {deal.contactLinks.length > 0 ? (
                <ul className="pilha-solta mb-2">
                  {deal.contactLinks.map((vinculo) => {
                    const contato = state.contacts.find(
                      (c) => c.id === vinculo.contactId,
                    );
                    return (
                      // A peça não clica inteira: o nome é link, e o "Remover" é botão.
                      <li
                        key={vinculo.id}
                        className="item-solto"
                        data-estatico="true"
                        style={{ paddingBlock: "var(--e-1)" }}
                      >
                        <Link
                          href={`/crm/contatos/${vinculo.contactId}`}
                          className="app-base min-w-0 flex-1 truncate hover:underline"
                          style={{ color: "var(--texto)" }}
                        >
                          {contato
                            ? contactDisplayName(contato)
                            : vinculo.contactId}
                        </Link>
                        <span className="app-meta flex shrink-0 items-center gap-1">
                          {DEAL_CONTACT_ROLE_LABEL[vinculo.role] ??
                            vinculo.role}
                          {vinculo.principal ? " · principal" : ""}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDesvinculando(vinculo.id)}
                            disabled={!editable}
                            disabledReason="Este Negócio é somente leitura."
                          >
                            Remover
                          </Button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState compact title="Nenhum Contato. A Etapa Agendamento exige ao menos um." />
              )}
              <div className="grid gap-2">
                <Select
                  value={linkingContactId}
                  onChange={setLinkingContactId}
                  searchable
                  placeholder="Vincular Contato"
                  options={state.contacts
                    .filter((c) => c.lifecycle === "ativo")
                    .filter(
                      (c) =>
                        !deal.contactLinks.some((l) => l.contactId === c.id),
                    )
                    .map((c) => ({
                      value: c.id,
                      label: contactDisplayName(c),
                    }))}
                />
                <Select
                  value={linkingRole}
                  onChange={(valor) => setLinkingRole(valor as DealContactRole)}
                  options={Object.entries(DEAL_CONTACT_ROLE_LABEL).map(
                    ([value, label]) => ({
                      value,
                      label,
                    }),
                  )}
                />
                <Button
                  variant="secondary"
                  onClick={linkContact}
                  disabled={linkingContactId === "" || !editable}
                  disabledReason={
                    editable
                      ? "Escolha o Contato."
                      : "Este Negócio é somente leitura."
                  }
                >
                  Vincular
                </Button>
              </div>
            </RecordPanel>

            <RecordPanel
              icon={<Icone de={CheckSquare} tamanho="sm" />}
              title="Próxima Tarefa do Proprietário"
            >
              {proximaTarefa ? (
                <Link
                  href={`/estrutura/tarefas/${proximaTarefa.id}`}
                  className="item-solto"
                  data-bloco="true"
                >
                  <span className="app-base block truncate" style={{ color: "var(--texto)" }}>
                    {proximaTarefa.title}
                  </span>
                  <span className="app-meta block">
                    {proximaTarefa.dueDate
                      ? `vence ${fmt.taskDate(proximaTarefa.dueDate)}`
                      : "sem data"}
                  </span>
                </Link>
              ) : (
                <EmptyState compact title="Nenhuma Tarefa atribuída ao Proprietário deste Negócio." />
              )}
            </RecordPanel>

            <RecordPanel
              icon={<Icone de={History} tamanho="sm" />}
              title="Última atividade"
              count={atividade.length}
            >
              {atividade.length === 0 ? (
                <EmptyState compact title="Nada registrado ainda." />
              ) : (
                <ul className="pilha-solta">
                  {atividade.slice(0, 4).map((registro) => (
                    <li key={registro.id} className="item-solto" data-bloco="true" data-estatico="true">
                      <span className="app-base block" style={{ color: "var(--texto)" }}>
                        {registro.action}
                      </span>
                      <span className="app-meta block">
                        {fmt.instant(registro.at)}
                        {registro.after ? ` · ${registro.after}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {atividade.length > 4 ? (
                <p className="app-meta mt-2">
                  Mostrando 4 de {atividade.length}.{" "}
                  <Link href="/configuracoes/auditoria" className="underline">
                    Ver tudo na Auditoria
                  </Link>
                  .
                </p>
              ) : null}
            </RecordPanel>
          </div>
        </div>
      </CorpoDeTela>
    </div>
  );
}
