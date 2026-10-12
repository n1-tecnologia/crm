"use client";

/**
 * T23 — Canal.
 *
 * Documento 14, 7.1 — the capabilities come from the CHANNEL TYPE and are shown
 * as read-only: neither this Channel nor a Conversation may redefine them
 * (RN-CXE-05).
 *
 * C36 — da configuração, o SETOR (a Fila padrão) e a ORIGEM padrão se editam
 * aqui, por quem administra o Espaço de Trabalho (B35); o resto do painel
 * continua só leitura. São os mesmos dois campos que a página de conexão
 * pergunta.
 *
 * Dois caminhos, decididos por `channel.relational` (Fase 8):
 *
 *   - D-11 — o Canal da tabela própria (`plataforma.canais`, 008) grava por REST:
 *     `PATCH /canais/:id` para Setor e Origem, e `POST /canais/:id/…` para
 *     simular a conexão, desconectar e arquivar. A permissão vem de
 *     `usePodeNoCrm(<ação>, "canal")`, a mesma `podeNoCrm` que a api aplica — a
 *     tela só ESCONDE o botão, quem barra é o servidor (403). Depois de cada
 *     escrita, `rehidratar()` traz o Canal atualizado para `state.channels`; esta
 *     tela não lê `GET /canais/:id`.
 *   - D-12 — o Canal do seed (demo) segue pela operação antiga `configurarCanal`
 *     e por `recusaDeGerirCanais`, exatamente como antes. Ele não tem o bloco de
 *     Conexão: `configurarCanal` recusa o relacional, e a api não conhece o do seed.
 *
 * D-08 — "Simular conexão" liga o Canal sem provedor real e o MARCA como
 * simulado: a marca "conexão simulada" no cabeçalho e a faixa de aviso dizem que
 * nenhuma Mensagem sai da plataforma (T-08-36). Desconectar apaga a marca.
 */

import Link from "next/link";
import { use, useState } from "react";
import { ErroDeApi } from "@/dados/crm/cliente-crm";
import { arquivarCanal, desconectarCanal, editarCanal, simularConexaoDoCanal } from "@/dados/crm/canais";
import { usePodeNoCrm } from "@/dados/crm/sessao";
import { useData, useRehidratar, useRun, useSession } from "@/dados/store";
import { capacidadesDoCanal, configurarCanal, recusaDeGerirCanais } from "@n1/dominio/operations";
import { PROVEDORES, provedorDoCanal } from "@n1/dominio/provedores-de-canal";
import { MarcaDeConexaoSimulada, SeloDeOrigem, SeloDoProvedor } from "@/features/crm/selo-do-provedor";
import { CHANNEL_TYPE_LABEL, IDENTIFIER_TYPE_LABEL } from "@/features/shell/format";
import { useFormat } from "@/features/shell/use-format";
import {
  Button,
  ConditionMarker,
  ConfirmDialog,
  CorpoDeTela,
  EmptyState,
  PageHeader,
  Pilula,
  RecordPanel,
  RecordRow,
  Section,
  Select,
  StateSeal,
  Toast,
  type TomPilula,
} from "@/features/shell/ui";

const AVISO_DA_SIMULACAO =
  "Conexão simulada: o Canal aparece conectado para testar o chat, mas nenhuma Mensagem sai da plataforma.";

const APPROVAL_LABEL: Record<string, string> = {
  aprovado: "aprovado",
  pendente: "pendente",
  rejeitado: "rejeitado",
  pausado: "pausado",
};

/** O tom da pílula de aprovação: só aprovado e rejeitado têm cor; o resto é neutro. */
const APPROVAL_TONE: Record<string, TomPilula> = {
  aprovado: "sucesso",
  rejeitado: "erro",
};

export default function CanalPage({ params }: { params: Promise<{ canal: string }> }) {
  const { canal } = use(params);
  const state = useData((data) => data);
  const run = useRun();
  const session = useSession();
  const rehidratar = useRehidratar();
  const fmt = useFormat();
  const [aviso, setAviso] = useState<{ readonly texto: string; readonly erro: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [arquivando, setArquivando] = useState(false);
  // Os hooks vêm antes do "Canal não encontrado": a ordem deles não pode depender do Canal.
  const recusaDeEditar = usePodeNoCrm("editar", "canal");
  const recusaDeSimular = usePodeNoCrm("simular_conexao", "canal");
  const recusaDeDesconectar = usePodeNoCrm("desconectar", "canal");
  const recusaDeArquivar = usePodeNoCrm("arquivar", "canal");
  const channel = state.channels.find((c) => c.id === canal);

  if (!channel) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Canal não encontrado" />
        <CorpoDeTela>
          <EmptyState title="Canal não encontrado." hint="Ele pode ter sido removido do Espaço de Trabalho." />
        </CorpoDeTela>
      </div>
    );
  }

  const capabilities = capacidadesDoCanal(channel);
  const queue = state.queues.find((q) => q.id === channel.defaultQueueId);
  const configuredBy = state.members.find((m) => m.id === channel.configuredByMemberId);
  const contactOwner = state.members.find((m) => m.id === channel.defaultContactOwnerMemberId);
  const origin = state.catalog.find((item) => item.id === channel.defaultOriginId);
  const relacional = channel.relational === true;
  const recusaDeConfigurar = relacional
    ? (recusaDeEditar ?? (channel.lifecycle === "arquivado" ? "Um Canal arquivado não se configura." : undefined))
    : recusaDeGerirCanais(state, session.memberId);
  const configurar = async (patch: { readonly fila?: string | null; readonly origem?: string | null }, mensagem: string) => {
    if (relacional) {
      await executar(
        () =>
          editarCanal(channel.id, {
            ...(patch.fila !== undefined ? { filaPadraoId: patch.fila } : {}),
            ...(patch.origem !== undefined ? { origemPadraoId: patch.origem } : {}),
          }),
        mensagem,
      );
      return;
    }
    const r = run((data, me) =>
      configurarCanal(data, me, channel.id, {
        ...(patch.fila !== undefined ? { defaultQueueId: patch.fila } : {}),
        ...(patch.origem !== undefined ? { defaultOriginId: patch.origem } : {}),
      }),
    );
    setAviso(r.ok ? { texto: mensagem, erro: false } : { texto: r.error, erro: true });
  };
  /** Uma escrita REST do Canal relacional: re-hidrata no sucesso, mostra a frase da api na recusa. */
  const executar = async (escrita: () => Promise<unknown>, mensagem: string) => {
    setOcupado(true);
    try {
      await escrita();
      await rehidratar();
      setAviso({ texto: mensagem, erro: false });
    } catch (falha) {
      setAviso({ texto: falha instanceof ErroDeApi ? falha.message : "Não foi possível concluir. Tente de novo.", erro: true });
    } finally {
      setOcupado(false);
    }
  };
  const conversations = state.conversations.filter((c) => c.channelId === channel.id);

  const channelType = CHANNEL_TYPE_LABEL[channel.channelType] ?? channel.channelType;
  const provedor = provedorDoCanal(channel);
  const rotuloDoProvedor = provedor === undefined ? channelType : PROVEDORES[provedor].rotulo;
  const resolvedIdentifiers = capabilities.resolvesIdentifierTypes
    .map((type) => IDENTIFIER_TYPE_LABEL[type] ?? type)
    .join(", ");
  const deliveryStatuses = capabilities.reportedDeliveryStatuses.join(", ");

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        path={
          <>
            <Link href="/crm/caixa-de-entrada" className="hover:underline">
              Caixa de Entrada
            </Link>
            {" › "}
            <Link href="/crm/caixa-de-entrada/configuracoes" className="hover:underline">
              Configurações
            </Link>
          </>
        }
        title={channel.name}
        seal={
          <>
            <StateSeal state={channel.lifecycle} />
            <SeloDoProvedor canal={channel} />
            <SeloDeOrigem canal={channel} />
            <MarcaDeConexaoSimulada canal={channel} />
            {channel.connection === "conectada" ? null : (
              <ConditionMarker tone={channel.connection === "comErro" ? "danger" : "warning"}>
                {channel.connection === "comErro" ? "com erro" : "desconectada"}
              </ConditionMarker>
            )}
          </>
        }
        meta={`${rotuloDoProvedor}${channel.connection === "conectada" ? " · conectada" : ""} · ${conversations.length} Conversa(s)`}
      />

      {channel.simulatedConnection ? (
        <p
          className="app-base shrink-0 px-4 py-2"
          style={{ background: "var(--aviso-lavado)", color: "var(--aviso)", borderBottom: "1px solid var(--linha)" }}
        >
          {AVISO_DA_SIMULACAO}
        </p>
      ) : null}

      {channel.connection !== "conectada" ? (
        <p
          className="app-base shrink-0 px-4 py-2"
          style={{ background: "var(--aviso-lavado)", color: "var(--aviso)", borderBottom: "1px solid var(--linha)" }}
        >
          Com o Canal {channel.connection === "comErro" ? "com erro" : "desconectado"}, uma Mensagem
          enviada fica registrada como pendente até a conexão voltar. Nada é descartado em silêncio.
        </p>
      ) : null}

      <CorpoDeTela>
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
          <div className="min-w-0">
            <Section title="Mensagens de modelo" count={channel.messageTemplates.length}>
              {channel.messageTemplates.length === 0 ? (
                <EmptyState
                  title="Nenhuma Mensagem de modelo sincronizada."
                  hint={
                    capabilities.requiresTemplateOutsideWindow
                      ? "Sem um modelo aprovado, não é possível escrever fora da janela de resposta."
                      : "Este tipo de Canal não exige modelo para enviar."
                  }
                />
              ) : (
                <table className="tabela">
                  <thead>
                    <tr>
                      <th className="app-coluna">Nome</th>
                      <th className="app-coluna">Categoria</th>
                      <th className="app-coluna">Idioma</th>
                      <th className="app-coluna">Aprovação</th>
                      <th className="app-coluna">Sincronizado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {channel.messageTemplates.map((template) => (
                      <tr key={template.providerId}>
                        <td className="py-2 align-top">
                          <p className="app-md" style={{ color: "var(--texto)" }}>
                            {template.name}
                          </p>
                          <p className="app-meta mt-0.5">{template.body}</p>
                        </td>
                        <td className="py-2 align-top">{template.category}</td>
                        <td className="py-2 align-top">{template.language}</td>
                        <td className="py-2 align-top">
                          <Pilula tom={APPROVAL_TONE[template.approval] ?? "neutro"}>
                            {APPROVAL_LABEL[template.approval]}
                          </Pilula>
                        </td>
                        <td className="app-meta app-numero py-2 align-top">{fmt.instant(template.syncedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>
          </div>

          <aside className="grid min-w-0 content-start gap-3">
            <RecordPanel title="Configuração">
              <dl>
                <RecordRow label="Provedor">
                  <span className="flex min-w-0 items-center gap-2">
                    <span>{rotuloDoProvedor}</span>
                    <SeloDoProvedor canal={channel} />
                  </span>
                </RecordRow>
                <RecordRow label="Origem do cadastro">
                  <SeloDeOrigem canal={channel} />
                </RecordRow>
                <RecordRow label="Identificador externo">
                  <span className="identificador">{channel.externalId}</span>
                </RecordRow>
                <RecordRow label="Configurado por">{configuredBy?.displayName ?? "não encontrado"}</RecordRow>
                <RecordRow label="Setor (Fila padrão)">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="block w-44">
                      <Select
                        size="sm"
                        value={channel.defaultQueueId ?? ""}
                        onChange={(v) => void configurar({ fila: v || null }, v ? "Setor do Canal alterado." : "O Canal ficou sem setor.")}
                        placeholder="Nenhum"
                        {...(recusaDeConfigurar ? { disabled: true, disabledReason: recusaDeConfigurar } : {})}
                        options={[
                          { value: "", label: "Nenhum — a Conversa nasce sem Fila" },
                          ...state.queues.filter((q) => q.lifecycle === "ativo").map((q) => ({ value: q.id, label: q.name })),
                        ]}
                      />
                    </span>
                    {queue ? (
                      <Link href={`/crm/caixa-de-entrada/configuracoes/filas/${queue.id}`} className="app-meta hover:underline">
                        ver a Fila
                      </Link>
                    ) : null}
                  </span>
                </RecordRow>
                <RecordRow label="Proprietário padrão de Contato">{contactOwner?.displayName ?? "não definido"}</RecordRow>
                <RecordRow label="Origem padrão">
                  <span className="block w-44">
                    <Select
                      size="sm"
                      value={channel.defaultOriginId ?? ""}
                      onChange={(v) => void configurar({ origem: v || null }, v ? "Origem do Canal alterada." : "O Canal ficou sem origem.")}
                      placeholder={origin?.name ?? "Nenhuma"}
                      {...(recusaDeConfigurar ? { disabled: true, disabledReason: recusaDeConfigurar } : {})}
                      options={[
                        { value: "", label: "Nenhuma" },
                        ...state.catalog.filter((i) => i.kind === "origem" && i.lifecycle === "ativo").map((i) => ({ value: i.id, label: i.name })),
                      ]}
                    />
                  </span>
                </RecordRow>
                <RecordRow label="Grupos">{channel.groupsEnabled ? "habilitados" : "desabilitados"}</RecordRow>
              </dl>
              {relacional ? (
                <div className="mt-3 grid gap-2">
                  <p className="app-md" style={{ color: "var(--texto)" }}>
                    Conexão
                  </p>
                  <span className="flex flex-wrap gap-2">
                    {channel.lifecycle === "ativo" && channel.connection !== "conectada" && recusaDeSimular === undefined ? (
                      <Button
                        variant="primary"
                        onClick={() => void executar(() => simularConexaoDoCanal(channel.id), "Conexão simulada.")}
                        carregando={ocupado}
                        disabledReason="Enviando…"
                      >
                        Simular conexão
                      </Button>
                    ) : null}
                    {channel.connection !== "desconectada" && recusaDeDesconectar === undefined ? (
                      <Button
                        onClick={() => void executar(() => desconectarCanal(channel.id), "Canal desconectado.")}
                        carregando={ocupado}
                        disabledReason="Enviando…"
                      >
                        Desconectar
                      </Button>
                    ) : null}
                    {channel.lifecycle === "ativo" && recusaDeArquivar === undefined ? (
                      <Button variant="danger" onClick={() => setArquivando(true)} carregando={ocupado} disabledReason="Enviando…">
                        Arquivar
                      </Button>
                    ) : null}
                  </span>
                  <p className="app-meta">
                    Sem um provedor real, a conexão é simulada e marcada como tal: serve para testar o chat.
                  </p>
                </div>
              ) : null}
              <p className="app-meta mt-2">
                Configurar o Canal é rastreabilidade, não governança: o Canal não tem Proprietário.
              </p>
              {aviso ? (
                <div className="mt-2">
                  <Toast tone={aviso.erro ? "error" : "success"} onDismiss={() => setAviso(null)}>{aviso.texto}</Toast>
                </div>
              ) : null}
            </RecordPanel>

            <RecordPanel title="Capacidades do tipo de Canal">
              <dl>
                <RecordRow label="Janela de resposta">
                  {capabilities.responseWindowHours === undefined
                    ? "sem janela"
                    : `${capabilities.responseWindowHours}h`}
                </RecordRow>
                <RecordRow label="Fora da janela">
                  {capabilities.requiresTemplateOutsideWindow
                    ? "só Mensagem de modelo aprovada"
                    : "envio livre"}
                </RecordRow>
                <RecordRow label="Resolve identificadores">
                  <span title={resolvedIdentifiers}>{resolvedIdentifiers}</span>
                </RecordRow>
                <RecordRow label="Assunto e cópias">{capabilities.hasSubjectAndCopies ? "sim" : "não"}</RecordRow>
                <RecordRow label="Status de entrega reportados">
                  <span title={deliveryStatuses}>{deliveryStatuses}</span>
                </RecordRow>
                <RecordRow label="Remetente externo edita">{capabilities.externalSenderMayEdit ? "sim" : "não"}</RecordRow>
                <RecordRow label="Reações">{capabilities.reactions ? "sim" : "não"}</RecordRow>
                <RecordRow label="Grupos">{capabilities.groups ? "sim" : "não"}</RecordRow>
                <RecordRow label="Identidade anônima">{capabilities.anonymousIdentity ? "sim" : "não"}</RecordRow>
              </dl>
              <p className="app-meta mt-2">
                Somente leitura: a capacidade é do tipo de Canal, ajustada pelo provedor só onde ele difere (D-02).
              </p>
            </RecordPanel>
          </aside>
        </div>
      </CorpoDeTela>

      <ConfirmDialog
        open={arquivando}
        title="Arquivar o Canal?"
        description="Ele é desconectado e sai das listas de Canais ativos. As Conversas ficam como histórico; o número pode ser conectado de novo num Canal novo."
        confirmLabel="Arquivar"
        destructive
        onConfirm={() => {
          setArquivando(false);
          void executar(() => arquivarCanal(channel.id), "Canal arquivado.");
        }}
        onCancel={() => setArquivando(false)}
      />
    </div>
  );
}
