"use client";

/**
 * T14 — Contato (FICHA DO MODELO ANTIGO, em inglês).
 *
 * Mantida intacta para os ids que Busca, Lixeira antiga, Caixa de Entrada e
 * Reuniões ainda produzem (D-15): a página nova (`/crm/contatos/[contato]`)
 * lê da api e, quando ela responde 404 para um id que existe em
 * `state.contacts`, renderiza esta. Some na fase de unificação.
 *
 * Só a assinatura mudou ao sair de `page.tsx`: o id chega por `contatoId`, em
 * vez de `params` (Promise) lido com `use`.
 *
 * A coluna principal é a CONVERSA COM A PESSOA, e é o mesmo componente que o
 * Negócio usa: a troca de mensagens não pode divergir entre as duas telas.
 * Abaixo dela vêm as associações, com contagem: Empresas e Negócios.
 *
 * A coluna lateral é TUDO QUE SABEMOS e o que é interno: Identificadores,
 * Tags, campos, Consentimentos, Notas e Tarefas. Nota é Comentário, não
 * Mensagem: ela não sai da plataforma.
 */

import { Plus, ShieldCheck, StickyNote } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useData, useRun } from "@/dados/store";
import { ConversationThread } from "@/features/crm/conversation-thread";
import { canaisDoFio } from "@n1/dominio/derive-conversacional";
import { TarefasDoContato } from "@/features/crm/tarefas-do-contato";
import { NovaTarefaConversacionalDialog } from "@/features/estrutura/nova-tarefa-conversacional-dialog";
import {
  ContactDataPanel,
  ContactIdentity,
  ContactQuickActions,
  ContactSummary,
  ContactTags,
} from "@/features/crm/contact-card";
import {
  ActionMenu,
  Button,
  CabecalhoDePainel,
  ConfirmDialog,
  CorpoDeTela,
  EmptyState,
  Field,
  Icone,
  PageHeader,
  Painel,
  RecordPanel,
  Select,
  StateSeal,
  TextArea,
  TextInput,
  Toast,
} from "@/features/shell/ui";
import type { ContactIdentifierType, Id } from "@n1/dominio/types";
import {
  addContactIdentifier,
  addContactNote,
  trashContact,
} from "@n1/dominio/operations";
import {
  MergeContactsDialog,
  useMergeDialog,
} from "@/features/crm/merge-contacts-dialog";
import {
  TransferIdentifierDialog,
  useTransferIdentifierDialog,
} from "@/features/crm/transfer-identifier-dialog";
import {
  RestoreCopyDialog,
  useRestoreCopyDialog,
} from "@/features/crm/restore-copy-dialog";
import { contactDisplayName } from "@n1/dominio/derive";
import { useFormat } from "@/features/shell/use-format";
import {
  CHANNEL_TYPE_LABEL,
  CONSENT_DECISION_LABEL,
  IDENTIFIER_TYPE_LABEL,
} from "@/features/shell/format";

/**
 * A conversa rola por dentro e prende o compositor embaixo, então precisa de
 * altura própria: a da janela, descontados o cabeçalho da tela e o respiro do
 * corpo. O corpo continua sendo o único bloco que rola.
 */
const ALTURA_DA_CONVERSA = "calc(100dvh - var(--cabecalho-tela-h) - 2 * var(--celula-x))";

export function FichaDeContatoLegado({ contatoId: contato }: { readonly contatoId: string }) {
  const state = useData((data) => data);
  const fmt = useFormat();
  const { mergingContactId, openMerge, closeMerge } = useMergeDialog();
  const { transferringId, openTransfer, closeTransfer } =
    useTransferIdentifierDialog();
  const { restoring, openRestore, closeRestore } = useRestoreCopyDialog();
  const run = useRun();
  const [confirmingTrash, setConfirmingTrash] = useState(false);
  const [addingIdentifier, setAddingIdentifier] = useState(false);
  const [identifierType, setIdentifierType] =
    useState<ContactIdentifierType>("telefone");
  const [identifierValue, setIdentifierValue] = useState("");
  const [nota, setNota] = useState("");
  const [registrandoNota, setRegistrandoNota] = useState(false);
  const [canalDaConversa, setCanalDaConversa] = useState<Id | null>(
    null,
  );
  // C35 — a Tarefa nasce deste Contato: Lista e Canal são escolha do diálogo.
  const [criandoTarefa, setCriandoTarefa] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const record = state.contacts.find((c) => c.id === contato);

  if (!record) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Registro não encontrado" />
        <CorpoDeTela>
          <EmptyState
            title="Contato não encontrado."
            hint="Ele pode ter sido eliminado, ou você não tem permissão para vê-lo."
          />
        </CorpoDeTela>
      </div>
    );
  }

  const somenteLeitura =
    record.lifecycle === "mesclado" || record.lifecycle === "naLixeira";

  const empresas = state.contactCompanyLinks.filter(
    (l) => l.contactId === record.id,
  );
  const negocios = state.deals.filter(
    (d) =>
      d.lifecycle === "ativo" &&
      d.contactLinks.some((l) => l.contactId === record.id),
  );
  // Sem Canal o thread mostra só o estado vazio, e a altura de conversa sobraria.
  const temCanal = canaisDoFio(state, record).some((c) => c.alcancavel);

  const reportar = (
    resultado: { ok: boolean; error?: string },
    mensagem: string,
  ) => {
    if (resultado.ok) {
      setError(null);
      setNotice(mensagem);
    } else {
      setNotice(null);
      setError(resultado.error ?? "Não foi possível concluir a operação.");
    }
  };

  return (
    <div className="flex h-full flex-col">
      <ConfirmDialog
        open={confirmingTrash}
        title={`Enviar ${contactDisplayName(record)} à lixeira?`}
        description={`O Contato sai das listagens e pode ser restaurado por ${state.workspace.trashPolicy.retentionDays} dias. Uma Mensagem recebida também o traz de volta automaticamente, porque uma Conversa sem Contato resolvido é pior que um Contato na lixeira.`}
        confirmLabel="Enviar à lixeira"
        destructive
        onConfirm={() => {
          reportar(
            run((data, memberId) => trashContact(data, memberId, record.id)),
            "Contato enviado à lixeira.",
          );
          setConfirmingTrash(false);
        }}
        onCancel={() => setConfirmingTrash(false)}
      />
      <MergeContactsDialog
        contactId={mergingContactId}
        onClose={closeMerge}
        onDone={setNotice}
      />
      <TransferIdentifierDialog
        identifierId={transferringId}
        fromContactId={record.id}
        onClose={closeTransfer}
        onDone={setNotice}
      />
      <RestoreCopyDialog
        contactId={record.id}
        open={restoring}
        onClose={closeRestore}
        onDone={setNotice}
      />
      {/* Chaveado pelo Contato: o Contato inicial do diálogo é o desta ficha. */}
      <NovaTarefaConversacionalDialog
        key={record.id}
        open={criandoTarefa}
        contactId={record.id}
        onClose={() => setCriandoTarefa(false)}
        onDone={(mensagem) => {
          setCriandoTarefa(false);
          setError(null);
          setNotice(mensagem);
        }}
      />

      <PageHeader
        title={contactDisplayName(record)}
        path={
          <Link href="/crm/contatos" className="hover:underline">
            Contatos
          </Link>
        }
        seal={<StateSeal state={record.lifecycle} />}
        actions={
          <ActionMenu
            label="Ações do Contato"
            items={[
              {
                label: "Mesclar com outro Contato",
                onSelect: () => openMerge(record.id),
              },
              ...(record.lifecycle === "mesclado"
                ? [{ label: "Restaurar cópia", onSelect: () => openRestore() }]
                : []),
              {
                label: "Enviar à lixeira",
                destructive: true,
                onSelect: () => setConfirmingTrash(true),
                ...(somenteLeitura
                  ? { disabledReason: "Este Contato é somente leitura." }
                  : {}),
              },
            ]}
          />
        }
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

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
          {/* ──────────── principal: a conversa por Canal e as associações ──── */}
          <div className="grid min-w-0 content-start gap-3">
            <Painel
              solido
              className="flex min-w-0 flex-col overflow-hidden"
              style={temCanal ? { height: ALTURA_DA_CONVERSA } : undefined}
            >
              <ConversationThread
                contact={record}
                canalSelecionado={canalDaConversa}
                onCanalChange={setCanalDaConversa}
                flush
              />
            </Painel>

            <div className="grid gap-3 md:grid-cols-3">
              <Painel className="min-w-0">
                <CabecalhoDePainel titulo="Empresas" contagem={empresas.length} />
                <div className="p-3">
                  {empresas.length === 0 ? (
                    <EmptyState compact title="Nenhuma Empresa vinculada." />
                  ) : (
                    <ul className="pilha-solta">
                      {empresas.map((vinculo) => (
                        <li key={vinculo.id}>
                          <Link
                            href={`/crm/empresas/${vinculo.companyId}`}
                            className="item-solto"
                            data-atenuado={vinculo.end ? "true" : undefined}
                          >
                            {/* Duas linhas: em três colunas, nome e papel lado a lado truncariam os dois. */}
                            <span className="min-w-0 flex-1">
                              <span className="app-base block truncate" style={{ color: "var(--texto)" }}>
                                {state.companies.find((c) => c.id === vinculo.companyId)
                                  ?.tradeName ?? "—"}
                              </span>
                              <span className="app-meta block truncate">
                                {vinculo.role}
                                {vinculo.principalForContact ? " · principal" : ""}
                                {vinculo.end ? " · encerrado" : ""}
                              </span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Painel>

              <Painel className="min-w-0">
                <CabecalhoDePainel titulo="Negócios" contagem={negocios.length} />
                <div className="p-3">
                  {negocios.length === 0 ? (
                    <EmptyState compact title="Nenhum Negócio com este Contato." />
                  ) : (
                    <ul className="pilha-solta">
                      {negocios.map((negocio) => {
                        const funil = state.funnels.find((f) => f.id === negocio.funnelId);
                        return (
                          <li key={negocio.id}>
                            <Link href={`/crm/negocios/${negocio.id}`} className="item-solto">
                              <span className="min-w-0 flex-1">
                                <span className="app-base block truncate" style={{ color: "var(--texto)" }}>
                                  {negocio.title}
                                </span>
                                <span className="app-meta block truncate">
                                  {funil?.name} › {funil?.stages.find((e) => e.id === negocio.stageId)?.name}
                                </span>
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </Painel>

              {/* C35 — as Tarefas conversacionais que nasceram deste Contato. */}
              <TarefasDoContato
                contactId={record.id}
                onCriar={() => setCriandoTarefa(true)}
                rotuloDoBotao="Nova Tarefa conversacional"
              />
            </div>
          </div>

          {/* ───────────────────────────── lateral: o dossiê ───────────────── */}
          <div className="grid min-w-0 content-start gap-3">
            <Painel className="p-4">
              <ContactIdentity contact={record} editavel={!somenteLeitura} />
              <div className="mt-3">
                <ContactQuickActions
                  contact={record}
                  onCanal={setCanalDaConversa}
                  onNota={() => setRegistrandoNota(true)}
                />
              </div>
            </Painel>

            <ContactDataPanel
              contact={record}
              {...(somenteLeitura ? {} : { onTransferir: openTransfer })}
              acao={
                addingIdentifier ? null : (
                  <Button
                    variant="ghost"
                    onClick={() => setAddingIdentifier(true)}
                    disabled={somenteLeitura}
                    disabledReason="Este Contato é somente leitura."
                  >
                    Acrescentar Identificador
                  </Button>
                )
              }
            />

            {addingIdentifier ? (
              <RecordPanel icon={<Icone de={Plus} tamanho="sm" />} title="Novo Identificador">
                <form
                  className="grid gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    reportar(
                      run((data, memberId) =>
                        addContactIdentifier(
                          data,
                          memberId,
                          record.id,
                          identifierType,
                          identifierValue,
                        ),
                      ),
                      "Identificador acrescentado.",
                    );
                    setIdentifierValue("");
                    setAddingIdentifier(false);
                  }}
                >
                  <Field label="Tipo">
                    {(id) => (
                      <Select
                        id={id}
                        value={identifierType}
                        onChange={(value) =>
                          setIdentifierType(value as ContactIdentifierType)
                        }
                        options={Object.entries(IDENTIFIER_TYPE_LABEL).map(
                          ([value, label]) => ({
                            value,
                            label,
                          }),
                        )}
                      />
                    )}
                  </Field>
                  <Field label="Valor">
                    {(id) => (
                      <TextInput
                        id={id}
                        value={identifierValue}
                        onChange={setIdentifierValue}
                      />
                    )}
                  </Field>
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      disabled={identifierValue.trim() === ""}
                      disabledReason="Informe o valor."
                    >
                      Acrescentar
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setAddingIdentifier(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              </RecordPanel>
            ) : null}

            <ContactSummary contact={record} />

            <ContactTags contact={record} />

            {registrandoNota ? (
              <RecordPanel icon={<Icone de={StickyNote} tamanho="sm" />} title="Nota interna">
                <form
                  className="grid gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    reportar(
                      run((data, memberId) =>
                        addContactNote(data, memberId, record.id, nota),
                      ),
                      "Nota registrada.",
                    );
                    setNota("");
                    setRegistrandoNota(false);
                  }}
                >
                  <label className="sr-only" htmlFor="nota-contato">
                    Nota interna
                  </label>
                  <TextArea
                    id="nota-contato"
                    value={nota}
                    onChange={setNota}
                    rows={3}
                    placeholder="A Nota é Comentário: fica no registro e não sai da plataforma."
                  />
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      disabled={nota.trim() === "" || somenteLeitura}
                      disabledReason={
                        somenteLeitura
                          ? "Este Contato é somente leitura."
                          : "Escreva a nota antes de salvar."
                      }
                    >
                      Registrar nota
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setRegistrandoNota(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              </RecordPanel>
            ) : null}

            <RecordPanel
              icon={<Icone de={ShieldCheck} tamanho="sm" />}
              title="Consentimentos"
              count={record.consents.length}
            >
              {record.consents.length === 0 ? (
                <EmptyState compact title="Envios de finalidade marketing serão bloqueados." />
              ) : (
                <ul className="pilha-solta">
                  {record.consents.map((consentimento, indice) => (
                    <li key={indice} className="item-solto" data-estatico="true">
                      <span className="app-base min-w-0" style={{ color: "var(--texto)" }}>
                        {
                          state.catalog.find(
                            (c) => c.id === consentimento.purposeId,
                          )?.name
                        }{" "}
                        ·{" "}
                        {CHANNEL_TYPE_LABEL[consentimento.channelType] ??
                          consentimento.channelType}{" "}
                        ·{" "}
                        {CONSENT_DECISION_LABEL[consentimento.decision] ??
                          consentimento.decision}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </RecordPanel>

            {record.comments.length > 0 ? (
              <RecordPanel
                icon={<Icone de={StickyNote} tamanho="sm" />}
                title="Notas"
                count={record.comments.length}
              >
                <ul className="pilha-solta">
                  {[...record.comments].reverse().map((comentario) => (
                    <li key={comentario.id} className="item-solto" data-bloco="true" data-estatico="true">
                      <p className="app-base" style={{ color: "var(--texto)" }}>
                        {comentario.content}
                      </p>
                      <p className="app-meta">
                        {state.members.find((m) => m.id === comentario.author.id)
                          ?.displayName ?? "—"}{" "}
                        · {fmt.instant(comentario.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              </RecordPanel>
            ) : null}
          </div>
        </div>
      </CorpoDeTela>
    </div>
  );
}
