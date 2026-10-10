"use client";

/**
 * Empresa (FICHA DO MODELO ANTIGO, em inglês).
 *
 * Mantida intacta para os ids que Busca, Lixeira antiga e Tarefas ainda
 * produzem (D-15): a página nova (`/crm/empresas/[empresa]`) lê da api e,
 * quando ela responde 404 para um id que existe em `state.companies`,
 * renderiza esta. Some na fase de unificação.
 *
 * Só a assinatura mudou ao sair de `page.tsx`: o id chega por `empresaId`, em
 * vez de `params` (Promise) lido com `use`.
 *
 * Empresa, no mesmo esqueleto de Contato e Negócio.
 *
 * A coluna principal conversa, mas não com a Empresa: não existe Conversa com
 * Empresa, só com Contato. Por isso a conversa aqui é a de UM Contato vinculado,
 * escolhido acima das abas — e quem não tem Contato vinculado não tem por onde
 * falar, que é a verdade do modelo e não uma limitação da tela. Abaixo dela vêm
 * as associações (Contatos e Negócios); a lateral guarda o cadastro.
 */

import { FileText, Fingerprint, Network } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useData, useRun } from "@/dados/store";
import {
  COMPANY_IDENTIFIER_LABEL,
  DEAL_SITUATION_LABEL,
} from "@/features/shell/format";
import { useFormat } from "@/features/shell/use-format";
import {
  addCompanyIdentifier,
  endContactCompanyLink,
  linkContactToCompany,
  trashCompany,
} from "@n1/dominio/operations";
import { contactDisplayName } from "@n1/dominio/derive";
import type { Contact } from "@n1/dominio/types";
import { ConversationThread, channelsOf } from "@/features/crm/conversation-thread";
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
  RecordRow,
  Select,
  StateSeal,
  TextInput,
  Toast,
} from "@/features/shell/ui";

/**
 * A conversa rola por dentro e prende o compositor embaixo, então precisa de
 * altura própria: a da janela, descontados o cabeçalho da tela e o respiro do
 * corpo. O corpo continua sendo o único bloco que rola.
 */
const ALTURA_DA_CONVERSA = "calc(100dvh - var(--cabecalho-tela-h) - 2 * var(--celula-x))";

export function FichaDeEmpresaLegado({ empresaId: empresa }: { readonly empresaId: string }) {
  const state = useData((data) => data);
  const record = state.companies.find((c) => c.id === empresa);
  const run = useRun();
  const fmt = useFormat();
  const [confirmingTrash, setConfirmingTrash] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [endingLinkId, setEndingLinkId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conversandoCom, setConversandoCom] = useState<string | null>(null);
  const [vinculandoId, setVinculandoId] = useState("");
  const [cargo, setCargo] = useState("");
  const [tipoDeIdentificador, setTipoDeIdentificador] = useState<
    "dominio" | "documentoFiscal" | "telefone"
  >("dominio");
  const [valorDoIdentificador, setValorDoIdentificador] = useState("");

  if (!record) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Registro não encontrado" />
        <CorpoDeTela>
          <EmptyState
            title="Empresa não encontrada."
            hint="Ela pode ter sido eliminada, ou você não tem permissão para vê-la."
          />
        </CorpoDeTela>
      </div>
    );
  }

  const vinculos = state.contactCompanyLinks.filter(
    (l) => l.companyId === record.id,
  );
  const negocios = state.deals.filter((d) => d.companyId === record.id);
  const filiais = state.companies.filter(
    (c) => c.parentCompanyId === record.id,
  );
  const matriz = record.parentCompanyId
    ? state.companies.find((c) => c.id === record.parentCompanyId)
    : undefined;
  const proprietario = state.members.find((m) => m.id === record.ownerMemberId);

  const interlocutores = vinculos
    .filter((l) => l.end === undefined)
    .map((l) => state.contacts.find((c) => c.id === l.contactId))
    .filter((c): c is Contact => c !== undefined && c.lifecycle === "ativo");
  const interlocutor =
    interlocutores.find((c) => c.id === conversandoCom) ??
    interlocutores.find((c) =>
      vinculos.some((l) => l.contactId === c.id && l.principalForCompany),
    ) ??
    interlocutores[0];
  // Sem Canal o thread mostra só o estado vazio, e a altura de conversa sobraria.
  const temCanal = interlocutor !== undefined && channelsOf(interlocutor).length > 0;

  const somenteLeitura = record.lifecycle !== "ativo";

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
      <PageHeader
        title={record.tradeName || record.legalName}
        seal={<StateSeal state={record.lifecycle} />}
        details={
          <span className="app-meta">
            Proprietário:{" "}
            <span className="app-base" style={{ color: "var(--texto-1)" }}>
              {proprietario?.displayName ?? "—"}
            </span>
          </span>
        }
        actions={
          <ActionMenu
            items={[
              {
                label: "Enviar à lixeira",
                onSelect: () => setConfirmingTrash(true),
                destructive: true,
                ...(record.lifecycle === "naLixeira"
                  ? { disabledReason: "Já está na lixeira." }
                  : record.lifecycle === "mesclado"
                    ? {
                        disabledReason:
                          "Uma Empresa mesclada não vai para a lixeira.",
                      }
                    : {}),
              },
            ]}
          />
        }
      />

      <ConfirmDialog
        open={endingLinkId !== null}
        title="Encerrar o Vínculo com esta Empresa?"
        description="O Vínculo continua no histórico, marcado como encerrado com a data de hoje. Quem saiu não desaparece da ficha — apagar o Vínculo apagaria que a pessoa esteve aqui."
        confirmLabel="Encerrar Vínculo"
        onConfirm={() => {
          if (!endingLinkId) return;
          const today = new Date().toISOString().slice(0, 10);
          const result = run((data, memberId) =>
            endContactCompanyLink(data, memberId, endingLinkId, today),
          );
          if (result.ok) {
            setError(null);
            setNotice("Vínculo encerrado; ele permanece no histórico.");
          } else {
            setNotice(null);
            setError(result.error);
          }
          setEndingLinkId(null);
        }}
        onCancel={() => setEndingLinkId(null)}
      />

      <ConfirmDialog
        open={confirmingTrash}
        title={`Enviar ${record.tradeName || record.legalName} à lixeira?`}
        description="Os Vínculos com Contatos são preservados enquanto ela estiver lá. Negócios abertos e filiais impedem o envio — a operação diz quantos."
        confirmLabel="Enviar à lixeira"
        destructive
        onConfirm={() => {
          const result = run((data, memberId) =>
            trashCompany(data, memberId, record.id),
          );
          if (result.ok) {
            setError(null);
            setNotice("Empresa enviada à lixeira.");
          } else {
            setNotice(null);
            setError(result.error);
          }
          setConfirmingTrash(false);
        }}
        onCancel={() => setConfirmingTrash(false)}
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
          {/* ─────── principal: a conversa, sempre por um Contato, e as associações ── */}
          <div className="grid min-w-0 content-start gap-3">
            {interlocutor ? (
              <Painel
                solido
                className="flex min-w-0 flex-col overflow-hidden"
                style={temCanal ? { height: ALTURA_DA_CONVERSA } : undefined}
              >
                {interlocutores.length > 1 ? (
                  <label
                    className="app-sm flex shrink-0 items-center gap-2 px-3 py-2"
                    style={{ borderBottom: "1px solid var(--linha)", color: "var(--texto-3)" }}
                  >
                    Conversando com
                    <span className="min-w-0 flex-1">
                      <Select
                        value={interlocutor.id}
                        onChange={setConversandoCom}
                        options={interlocutores.map((c) => ({
                          value: c.id,
                          label: contactDisplayName(c),
                        }))}
                      />
                    </span>
                  </label>
                ) : null}
                <div className="min-h-0 flex-1">
                  <ConversationThread contact={interlocutor} flush />
                </div>
              </Painel>
            ) : (
              <Painel>
                <EmptyState
                  title="Nenhum Contato ativo nesta Empresa."
                  hint="Não existe Conversa com Empresa: vincule um Contato para ter com quem falar."
                />
              </Painel>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <Painel className="min-w-0">
                <CabecalhoDePainel titulo="Contatos" contagem={vinculos.length} />
                <div className="grid gap-3 p-3">
                  {vinculos.length === 0 ? (
                    <EmptyState compact title="Nenhum Contato vinculado." />
                  ) : (
                    <ul className="pilha-solta">
                      {vinculos.map((link) => {
                        const contact = state.contacts.find(
                          (c) => c.id === link.contactId,
                        );
                        return (
                          <li
                            key={link.id}
                            className="item-solto"
                            data-estatico="true"
                            data-atenuado={link.end ? "true" : undefined}
                            style={{ paddingBlock: "var(--e-2)" }}
                          >
                            <span className="min-w-0 flex-1">
                              <Link
                                href={`/crm/contatos/${link.contactId}`}
                                className="app-base block truncate hover:underline"
                                style={{ color: "var(--texto)" }}
                              >
                                {contact ? contactDisplayName(contact) : link.contactId}
                              </Link>
                              <span className="app-meta block truncate">
                                {link.role}
                                {link.start
                                  ? ` · desde ${fmt.civilDate(link.start)}`
                                  : ""}
                                {link.end
                                  ? ` · encerrado em ${fmt.civilDate(link.end)}`
                                  : ""}
                              </span>
                            </span>
                            {/*
                              O Vínculo tem período: encerrar preserva a história.
                              Apagá-lo apagaria que a pessoa esteve aqui.
                            */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEndingLinkId(link.id)}
                              disabled={link.end !== undefined}
                              disabledReason="Este Vínculo já está encerrado."
                            >
                              Encerrar Vínculo
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <form
                    className="grid gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      reportar(
                        run((data, memberId) =>
                          linkContactToCompany(data, memberId, {
                            contactId: vinculandoId,
                            companyId: record.id,
                            role: cargo,
                          }),
                        ),
                        "Contato vinculado à Empresa.",
                      );
                      setVinculandoId("");
                      setCargo("");
                    }}
                  >
                    <Select
                      value={vinculandoId}
                      onChange={setVinculandoId}
                      searchable
                      placeholder="Vincular Contato"
                      options={state.contacts
                        .filter((c) => c.lifecycle === "ativo")
                        .filter(
                          (c) =>
                            !vinculos.some(
                              (l) => l.contactId === c.id && l.end === undefined,
                            ),
                        )
                        .map((c) => ({ value: c.id, label: contactDisplayName(c) }))}
                    />
                    <label className="sr-only" htmlFor="cargo-vinculo">
                      Cargo no Vínculo
                    </label>
                    <TextInput
                      id="cargo-vinculo"
                      value={cargo}
                      onChange={setCargo}
                      placeholder="Cargo — do Vínculo, não do Contato"
                    />
                    <Button
                      variant="secondary"
                      type="submit"
                      disabled={
                        vinculandoId === "" || cargo.trim() === "" || somenteLeitura
                      }
                      disabledReason={
                        somenteLeitura
                          ? "Esta Empresa é somente leitura."
                          : vinculandoId === ""
                            ? "Escolha o Contato."
                            : "Informe o cargo."
                      }
                    >
                      Vincular
                    </Button>
                  </form>
                </div>
              </Painel>

              <Painel className="min-w-0">
                <CabecalhoDePainel titulo="Negócios" contagem={negocios.length} />
                <div className="p-3">
                  {negocios.length === 0 ? (
                    <EmptyState compact title="Nenhum Negócio." />
                  ) : (
                    <ul className="pilha-solta">
                      {negocios.map((deal) => (
                        <li key={deal.id}>
                          <Link href={`/crm/negocios/${deal.id}`} className="item-solto">
                            <span className="app-base min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
                              {deal.title}
                            </span>
                            <span className="app-meta shrink-0">
                              {DEAL_SITUATION_LABEL[deal.situation] ?? deal.situation}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Painel>
            </div>
          </div>

          {/* ───────────────────────────── lateral: o cadastro ─────────────── */}
          <div className="grid min-w-0 content-start gap-3">
            <RecordPanel
              icon={<Icone de={Fingerprint} tamanho="sm" />}
              title="Identificadores"
              count={record.identifiers.length}
            >
              {record.identifiers.length === 0 ? (
                <EmptyState compact title="Nenhum identificador cadastrado." />
              ) : (
                <ul className="grid gap-1.5">
                  {record.identifiers.map((identifier) => (
                    <li key={identifier.id} className="min-w-0">
                      <span className="app-meta block">
                        {COMPANY_IDENTIFIER_LABEL[identifier.type] ??
                          identifier.type}
                      </span>
                      <span className="identificador block truncate" style={{ color: "var(--texto)" }}>
                        {identifier.value}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <form
                className="mt-2 grid gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  reportar(
                    run((data, memberId) =>
                      addCompanyIdentifier(
                        data,
                        memberId,
                        record.id,
                        tipoDeIdentificador,
                        valorDoIdentificador,
                      ),
                    ),
                    "Identificador acrescentado.",
                  );
                  setValorDoIdentificador("");
                }}
              >
                <Field label="Tipo">
                  {(id) => (
                    <Select
                      id={id}
                      value={tipoDeIdentificador}
                      onChange={(v) =>
                        setTipoDeIdentificador(
                          v as "dominio" | "documentoFiscal" | "telefone",
                        )
                      }
                      options={Object.entries(COMPANY_IDENTIFIER_LABEL).map(
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
                      value={valorDoIdentificador}
                      onChange={setValorDoIdentificador}
                    />
                  )}
                </Field>
                <Button
                  variant="secondary"
                  type="submit"
                  disabled={valorDoIdentificador.trim() === "" || somenteLeitura}
                  disabledReason={
                    somenteLeitura
                      ? "Esta Empresa é somente leitura."
                      : "Informe o valor do identificador."
                  }
                >
                  Acrescentar identificador
                </Button>
              </form>
            </RecordPanel>

            <RecordPanel icon={<Icone de={FileText} tamanho="sm" />} title="Razão social">
              <p className="app-base" style={{ color: "var(--texto)" }}>
                {record.legalName}
              </p>
            </RecordPanel>

            <RecordPanel
              icon={<Icone de={Network} tamanho="sm" />}
              title="Grupo"
              count={filiais.length}
            >
              <dl>
                <RecordRow label={matriz ? "Filial de" : "Posição"}>
                  {matriz ? (
                    <Link
                      href={`/crm/empresas/${matriz.id}`}
                      className="hover:underline"
                    >
                      {matriz.tradeName || matriz.legalName}
                    </Link>
                  ) : (
                    "Raiz do próprio grupo"
                  )}
                </RecordRow>
              </dl>
              {filiais.length === 0 ? (
                <EmptyState compact title="Nenhuma filial." />
              ) : (
                <ul className="pilha-solta mt-2">
                  {filiais.map((sub) => (
                    <li key={sub.id}>
                      <Link
                        href={`/crm/empresas/${sub.id}`}
                        className="item-solto app-base"
                        style={{ color: "var(--texto)" }}
                      >
                        <span className="min-w-0 flex-1 truncate">{sub.tradeName || sub.legalName}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </RecordPanel>
          </div>
        </div>
      </CorpoDeTela>
    </div>
  );
}
