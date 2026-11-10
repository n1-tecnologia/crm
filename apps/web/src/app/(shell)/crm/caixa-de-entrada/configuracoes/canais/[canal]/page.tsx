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
 * O Canal vem de `GET /canais/:id` (`useCanal`, tabela `plataforma.canais`, 008) e
 * grava por REST: `PATCH /canais/:id` para Setor e Origem, e `POST /canais/:id/…`
 * para simular a conexão, desconectar e arquivar. A permissão vem de
 * `usePodeNoCrm(<ação>, "canal")`, a mesma `podeNoCrm` que a api aplica — a
 * tela só ESCONDE o botão, quem barra é o servidor (403). Depois de cada
 * escrita, `rehidratar()` atualiza o espelho do Canal em `GET /estado`, de que o
 * fio da Conversa ainda depende. Fila, Origem e Membros são configuração do
 * Espaço e continuam do store. As Conversas do Canal contam por
 * `GET /conversas?canalId=` (o `total` da api, não o tamanho da página).
 *
 * Um id que a api não conhece (404) mostra "Canal não encontrado." O Canal do
 * seed (demo) não tem mais ficha: a configuração dele pela operação antiga saiu
 * (D-15-12).
 *
 * D-08 — "Simular conexão" liga o Canal sem provedor real e o MARCA como
 * simulado: a marca "conexão simulada" no cabeçalho e a faixa de aviso dizem que
 * nenhuma Mensagem sai da plataforma (T-08-36). Desconectar apaga a marca.
 * CR-01 (16-17): o Canal ligado a um provedor real não volta a simulado; reconectar é pelo provedor
 * (`podeSimularConexao`, com `ligadoAoProvedor` vindo de `GET /canais/:id`).
 */

import Link from "next/link";
import { use, useState } from "react";
import { ErroDeApi } from "@/dados/crm/cliente-crm";
import { arquivarCanal, desconectarCanal, editarCanal, simularConexaoDoCanal, useCanal } from "@/dados/crm/canais";
import { useConversas } from "@/dados/crm/conversas";
import { usePodeNoCrm } from "@/dados/crm/sessao";
import { useData, useRehidratar } from "@/dados/store";
import { FRASE_DO_CANAL_REAL, podeSimularConexao, type CanalNaFicha } from "@n1/dominio/crm/canais";
import { capacidadesDoCanal } from "@n1/dominio/crm/capacidades";
import { PROVEDORES } from "@n1/dominio/provedores-de-canal";
import { MarcaDeConexaoSimulada, SeloDeOrigem, SeloDoProvedor } from "@/features/crm/selo-do-provedor";
import { CHANNEL_TYPE_LABEL, IDENTIFIER_TYPE_LABEL } from "@/features/shell/format";
import {
  Button,
  ConditionMarker,
  ConfirmDialog,
  CorpoDeTela,
  EmptyState,
  PageHeader,
  RecordPanel,
  RecordRow,
  Section,
  Select,
  StateSeal,
  Toast,
} from "@/features/shell/ui";

const AVISO_DA_SIMULACAO =
  "Conexão simulada: o Canal aparece conectado para testar o chat, mas nenhuma Mensagem sai da plataforma.";

export default function CanalPage({ params }: { params: Promise<{ canal: string }> }) {
  const { canal: id } = use(params);
  const canal = useCanal(id);

  if (canal.data === undefined) {
    // Carregando: nem "não encontrado" nem a ficha. O 404 (ou qualquer recusa) vem em `error`.
    if (canal.error === undefined) {
      return (
        <div className="flex h-full flex-col">
          <PageHeader title="Canal" />
          <CorpoDeTela>
            <p role="status" className="app-base px-1" style={{ color: "var(--texto-3)" }}>
              Carregando o Canal…
            </p>
          </CorpoDeTela>
        </div>
      );
    }
    const naoEncontrado = canal.error instanceof ErroDeApi && canal.error.status === 404;
    return (
      <div className="flex h-full flex-col">
        <PageHeader title={naoEncontrado ? "Canal não encontrado" : "Canal"} />
        <CorpoDeTela>
          <EmptyState
            title={naoEncontrado ? "Canal não encontrado." : "Não foi possível abrir o Canal."}
            hint={naoEncontrado ? "Ele pode ter sido removido do Espaço de Trabalho." : canal.error.message}
          />
        </CorpoDeTela>
      </div>
    );
  }

  return <FichaDoCanal channel={canal.data} />;
}

function FichaDoCanal({ channel }: { readonly channel: CanalNaFicha }) {
  const state = useData((data) => data);
  const rehidratar = useRehidratar();
  const [aviso, setAviso] = useState<{ readonly texto: string; readonly erro: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [arquivando, setArquivando] = useState(false);
  const recusaDeEditar = usePodeNoCrm("editar", "canal");
  const recusaDeSimular = usePodeNoCrm("simular_conexao", "canal");
  const recusaDeDesconectar = usePodeNoCrm("desconectar", "canal");
  const recusaDeArquivar = usePodeNoCrm("arquivar", "canal");
  // O número é o `total` da api; a página (limite 20) só existe para a conta ser barata.
  const conversas = useConversas({ canalId: channel.id, limite: 20 });
  const totalDeConversas = conversas.data?.total;
  // A capacidade é do tipo, ajustada pelo provedor onde ele difere (D-02).
  const capabilities = capacidadesDoCanal({ channelType: channel.tipo, provider: channel.provedor });
  const queue = state.queues.find((q) => q.id === channel.filaPadraoId);
  const configuredBy = state.members.find((m) => m.id === channel.configuradoPor);
  const contactOwner = state.members.find((m) => m.id === channel.proprietarioPadraoId);
  const origin = state.catalog.find((item) => item.id === channel.origemPadraoId);
  const recusaDeConfigurar = recusaDeEditar ?? (channel.estado === "arquivado" ? "Um Canal arquivado não se configura." : undefined);
  const configurar = (patch: { readonly fila?: string | null; readonly origem?: string | null }, mensagem: string) =>
    executar(
      () =>
        editarCanal(channel.id, {
          ...(patch.fila !== undefined ? { filaPadraoId: patch.fila } : {}),
          ...(patch.origem !== undefined ? { origemPadraoId: patch.origem } : {}),
        }),
      mensagem,
    );
  /** Uma escrita REST do Canal: re-hidrata no sucesso, mostra a frase da api na recusa. */
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

  const channelType = CHANNEL_TYPE_LABEL[channel.tipo] ?? channel.tipo;
  const provedor = channel.provedor;
  const rotuloDoProvedor = PROVEDORES[provedor]?.rotulo ?? channelType;
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
        title={channel.nome}
        seal={
          <>
            <StateSeal state={channel.estado} />
            <SeloDoProvedor canal={channel} />
            <SeloDeOrigem canal={channel} />
            <MarcaDeConexaoSimulada canal={channel} />
            {channel.conexao === "conectada" ? null : (
              <ConditionMarker tone={channel.conexao === "com_erro" ? "danger" : "warning"}>
                {channel.conexao === "com_erro" ? "com erro" : "desconectada"}
              </ConditionMarker>
            )}
          </>
        }
        meta={`${rotuloDoProvedor}${channel.conexao === "conectada" ? " · conectada" : ""} · ${totalDeConversas ?? "—"} Conversa(s)`}
      />

      {channel.conexaoSimulada ? (
        <p
          className="app-base shrink-0 px-4 py-2"
          style={{ background: "var(--aviso-lavado)", color: "var(--aviso)", borderBottom: "1px solid var(--linha)" }}
        >
          {AVISO_DA_SIMULACAO}
        </p>
      ) : null}

      {channel.conexao !== "conectada" ? (
        <p
          className="app-base shrink-0 px-4 py-2"
          style={{ background: "var(--aviso-lavado)", color: "var(--aviso)", borderBottom: "1px solid var(--linha)" }}
        >
          Com o Canal {channel.conexao === "com_erro" ? "com erro" : "desconectado"}, uma Mensagem
          enviada fica registrada como pendente até a conexão voltar. Nada é descartado em silêncio.
        </p>
      ) : null}

      <CorpoDeTela>
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
          <div className="min-w-0">
            {/* O Canal da tabela não guarda Mensagens de modelo (a Fase 8 não as sincroniza): a seção diz isso, em vez de sumir. */}
            <Section title="Mensagens de modelo" count={0}>
              <EmptyState
                title="Nenhuma Mensagem de modelo sincronizada."
                hint={
                  capabilities.requiresTemplateOutsideWindow
                    ? "Sem um modelo aprovado, não é possível escrever fora da janela de resposta."
                    : "Este tipo de Canal não exige modelo para enviar."
                }
              />
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
                  <span className="identificador">{channel.identificadorExterno}</span>
                </RecordRow>
                <RecordRow label="Configurado por">{configuredBy?.displayName ?? "não encontrado"}</RecordRow>
                <RecordRow label="Setor (Fila padrão)">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="block w-44">
                      <Select
                        size="sm"
                        value={channel.filaPadraoId ?? ""}
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
                      value={channel.origemPadraoId ?? ""}
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
                <RecordRow label="Grupos">{channel.gruposHabilitados ? "habilitados" : "desabilitados"}</RecordRow>
              </dl>
              <div className="mt-3 grid gap-2">
                <p className="app-md" style={{ color: "var(--texto)" }}>
                  Conexão
                </p>
                <span className="flex flex-wrap gap-2">
                  {podeSimularConexao(channel) && recusaDeSimular === undefined ? (
                    <Button
                      variant="primary"
                      onClick={() => void executar(() => simularConexaoDoCanal(channel.id), "Conexão simulada.")}
                      carregando={ocupado}
                      disabledReason="Enviando…"
                    >
                      Simular conexão
                    </Button>
                  ) : null}
                  {channel.conexao !== "desconectada" && recusaDeDesconectar === undefined ? (
                    <Button
                      onClick={() => void executar(() => desconectarCanal(channel.id), "Canal desconectado.")}
                      carregando={ocupado}
                      disabledReason="Enviando…"
                    >
                      Desconectar
                    </Button>
                  ) : null}
                  {channel.estado === "ativo" && recusaDeArquivar === undefined ? (
                    <Button variant="danger" onClick={() => setArquivando(true)} carregando={ocupado} disabledReason="Enviando…">
                      Arquivar
                    </Button>
                  ) : null}
                </span>
                <p className="app-meta">
                  {channel.ligadoAoProvedor
                    ? FRASE_DO_CANAL_REAL
                    : "Sem um provedor real, a conexão é simulada e marcada como tal: serve para testar o chat."}
                </p>
              </div>
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
