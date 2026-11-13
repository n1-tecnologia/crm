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
 *
 * Sessão 8 — o Canal do Instagram conecta DE VERDADE: "Conectar com o Instagram"
 * pede à api a URL do login do Instagram e leva o navegador para lá; a volta cai
 * em `canais/instagram/retorno`, que conclui e reabre esta ficha. Para ele não há
 * "Simular conexão". Conectado, a ficha mostra a conta (@, nome e foto, lidos da
 * Meta pela api). Desconectar apaga o token.
 *
 * Sessão 4 — o WhatsApp não oficial conecta DE VERDADE: "Conectar" ("Reconectar" num Canal com erro) abre o painel do QR
 * code (`PainelDoQrCode`), que pede o QR à api e relê o Canal até a Evolution confirmar. "Simular conexão" só aparece
 * quando o servidor a permite (`simulacaoPermitida`, 4.3.4: desenvolvimento e homologação, nunca produção). A página de
 * conectar leva para cá com `?conectar=1` depois de criar o Canal: o painel abre sozinho e o endereço é limpo.
 *
 * Sessão 7 — o WhatsApp oficial (Cloud API) conecta DE VERDADE pelo token: "Conectar" ("Reconectar" num Canal com erro) abre o
 * painel do token (`PainelDoTokenDoWhatsApp`), onde se cola o ID do número, o ID da conta do WhatsApp Business e o token do
 * usuário do sistema da Meta; a api confere o número, guarda o token cifrado e conecta o Canal. Conectado, a ficha mostra o
 * número e a conta lidos da api (`useNumeroDoWhatsAppOficial`): o token nunca volta. Desconectar apaga o token guardado.
 * A seção "Mensagens de modelo" lista os modelos que a Meta aprovou para o Canal (`useModelosDoCanal`), com o estado, o motivo
 * da rejeição e o que o CRM ainda não envia; "Sincronizar com a Meta" (só para quem pode conectar o Canal) relê a lista.
 */

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, use, useCallback, useEffect, useRef, useState } from "react";
import { ErroDeApi } from "@/dados/crm/cliente-crm";
import {
  arquivarCanal,
  autorizarInstagram,
  desconectarCanal,
  editarCanal,
  simularConexaoDoCanal,
  useCanal,
  useContaDoInstagram,
  useNumeroDoWhatsAppOficial,
} from "@/dados/crm/canais";
import { useConversas } from "@/dados/crm/conversas";
import { PROVEDOR_COM_MODELOS, sincronizarModelosDoCanal, useModelosDoCanal } from "@/dados/crm/modelos";
import { usePodeNoCrm } from "@/dados/crm/sessao";
import { useData, useRehidratar } from "@/dados/store";
import { FRASE_DO_CANAL_REAL, podeConectarPorQrCode, podeSimularConexao, type CanalNaFicha } from "@n1/dominio/crm/canais";
import { capacidadesDoCanal, type ForaDaJanela } from "@n1/dominio/crm/capacidades";
import type { EstadoDeModelo, ModeloNaLista } from "@n1/dominio/crm/modelos";
import { PROVEDORES } from "@n1/dominio/provedores-de-canal";
import { irParaForaDoApp } from "@/features/crm/ir-para-fora";
import { PainelDoQrCode } from "@/features/crm/painel-do-qrcode";
import { PainelDoTokenDoWhatsApp } from "@/features/crm/painel-do-token";
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
} from "@/features/shell/ui";

/** O que acontece depois da janela de resposta, como a ficha diz. */
const FORA_DA_JANELA: Readonly<Record<ForaDaJanela, { readonly linha: string; readonly modelos: string }>> = {
  livre: { linha: "envio livre", modelos: "Este tipo de Canal não exige modelo para enviar." },
  soModelo: {
    linha: "só Mensagem de modelo aprovada",
    modelos: "Sem um modelo aprovado, não é possível escrever fora da janela de resposta.",
  },
  bloqueado: {
    linha: "só o Contato reabre a conversa",
    modelos: "O Instagram não tem Mensagem de modelo: depois da janela, só o Contato reabre a conversa escrevendo de novo.",
  },
};

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
  const [qrAberto, setQrAberto] = useState(false);
  const [tokenAberto, setTokenAberto] = useState(false);
  const recusaDeEditar = usePodeNoCrm("editar", "canal");
  const recusaDeSimular = usePodeNoCrm("simular_conexao", "canal");
  const recusaDeConectar = usePodeNoCrm("conectar", "canal");
  // Sessão 4: o WhatsApp não oficial conecta lendo um QR code (pela Evolution), não pela simulação.
  const conectaPorQr = podeConectarPorQrCode(channel) && recusaDeConectar === undefined;
  const abrirQrCode = useCallback(() => setQrAberto(true), []);
  const fecharQrCode = useCallback(() => setQrAberto(false), []);
  // O Canal confirmou: o espelho do store acompanha, como depois de qualquer escrita de conexão.
  const aoConectarPorQr = useCallback(() => void rehidratar(), [rehidratar]);
  // Sessão 8: o Instagram conecta pelo login de verdade, não pela simulação.
  const ehInstagram = channel.provedor === "instagram-graph";
  const conectadoDeVerdade = channel.conexao === "conectada" && !channel.conexaoSimulada;
  const recusaDeDesconectar = usePodeNoCrm("desconectar", "canal");
  const recusaDeArquivar = usePodeNoCrm("arquivar", "canal");
  // Sessão 7: o WhatsApp oficial conecta colando o ID do número, o ID da conta e o token (painel do token), não por QR code.
  const ehWhatsAppOficial = channel.provedor === "whatsapp-cloud";
  const conectaPorToken = ehWhatsAppOficial && channel.estado === "ativo" && !conectadoDeVerdade && recusaDeConectar === undefined;
  const abrirToken = useCallback(() => setTokenAberto(true), []);
  const fecharToken = useCallback(() => setTokenAberto(false), []);
  // A api confirmou: o espelho do Canal acompanha e a ficha diz que conectou (o painel fecha em seguida).
  const aoConectarPorToken = useCallback(() => {
    void rehidratar();
    setAviso({ texto: "WhatsApp oficial conectado.", erro: false });
  }, [rehidratar]);
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

  /** Leva o navegador ao login do Instagram; só volta para cá pela página de retorno. */
  const conectarInstagram = async () => {
    setOcupado(true);
    try {
      irParaForaDoApp(await autorizarInstagram(channel.id));
    } catch (falha) {
      setAviso({ texto: falha instanceof ErroDeApi ? falha.message : "Não foi possível abrir o login do Instagram. Tente de novo.", erro: true });
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
      {/* `useSearchParams` fora de um `Suspense` tira a página inteira da pré-renderização: só este pedaço espera o endereço. */}
      <Suspense fallback={null}>
        <AbrirPeloEndereco pode={conectaPorQr || conectaPorToken} onAbrir={ehWhatsAppOficial ? abrirToken : abrirQrCode} />
      </Suspense>
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
            {/* 7.3: o WhatsApp oficial lista os modelos sincronizados da Meta; os outros Canais dizem que não têm modelo, em vez de sumir. */}
            <ModelosDoCanal
              canalId={channel.id}
              oficial={channel.provedor === PROVEDOR_COM_MODELOS}
              conectadoDeVerdade={conectadoDeVerdade}
              podeSincronizar={recusaDeConectar === undefined && channel.estado === "ativo"}
              dicaDaJanela={FORA_DA_JANELA[capabilities.foraDaJanela].modelos}
            />
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
                {ehWhatsAppOficial && conectadoDeVerdade ? <NumeroDoWhatsAppOficial canalId={channel.id} /> : null}
                {ehInstagram && conectadoDeVerdade ? (
                  <RecordRow label="Conectado como">
                    <ContaConectadaDoInstagram canalId={channel.id} usuarioDoCanal={channel.identificadorExterno} />
                  </RecordRow>
                ) : null}
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
                  {ehInstagram && channel.estado === "ativo" && !conectadoDeVerdade && recusaDeConectar === undefined ? (
                    <Button variant="primary" onClick={() => void conectarInstagram()} carregando={ocupado} disabledReason="Abrindo o Instagram…">
                      Conectar com o Instagram
                    </Button>
                  ) : null}
                  {conectaPorQr ? (
                    <Button variant="primary" onClick={abrirQrCode}>
                      {channel.conexao === "com_erro" ? "Reconectar" : "Conectar"}
                    </Button>
                  ) : null}
                  {conectaPorToken ? (
                    <Button variant="primary" onClick={abrirToken}>
                      {channel.conexao === "com_erro" ? "Reconectar" : "Conectar"}
                    </Button>
                  ) : null}
                  {!ehInstagram && podeSimularConexao(channel) && recusaDeSimular === undefined ? (
                    <Button
                      // No WhatsApp a conexão de verdade é o QR code (não oficial) ou o token (oficial); simular fica como ação secundária (só onde o servidor permite).
                      {...(conectaPorQr || conectaPorToken ? {} : { variant: "primary" as const })}
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
                  {ehInstagram
                    ? `O botão abre o login do Instagram: entre com a conta @${channel.identificadorExterno} e autorize o acesso às mensagens do Direct. Desconectar apaga a autorização guardada.`
                    : conectaPorQr
                      ? "O botão mostra um QR code: no celular do número do Canal, abra o WhatsApp › Aparelhos conectados › Conectar um aparelho e leia. Desconectar tira o aparelho da lista."
                      : ehWhatsAppOficial
                        ? "O botão pede o ID do número, o ID da conta do WhatsApp Business e o token do usuário do sistema da Meta. O token fica cifrado no servidor e não volta à tela. Desconectar apaga o token guardado."
                        : channel.ligadoAoProvedor
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
                <RecordRow label="Fora da janela">{FORA_DA_JANELA[capabilities.foraDaJanela].linha}</RecordRow>
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

      {/* Montado só enquanto aberto: fechar desmonta e para os temporizadores. Fica de pé mesmo quando o Canal vira conectada,
          para mostrar "Conectado" antes de fechar sozinho. */}
      {qrAberto ? <PainelDoQrCode canal={channel} onFechar={fecharQrCode} onConectado={aoConectarPorQr} /> : null}
      {/* Idem: montado só enquanto aberto, e fechar apaga o que foi colado (o token não fica no estado). */}
      {tokenAberto ? <PainelDoTokenDoWhatsApp canal={channel} onFechar={fecharToken} onConectado={aoConectarPorToken} /> : null}
    </div>
  );
}

/**
 * Sessão 4: a página de conectar leva para `…/canais/<id>?conectar=1` depois de criar um Canal que conecta por QR code.
 * Abre o painel uma vez só e limpa o endereço (um F5 não reabre). Se a pessoa não pode conectar, só limpa.
 */
function AbrirPeloEndereco({ pode, onAbrir }: { readonly pode: boolean; readonly onAbrir: () => void }) {
  const parametros = useSearchParams();
  const caminho = usePathname();
  const router = useRouter();
  const feito = useRef(false);
  const pedido = parametros.get("conectar") === "1";
  useEffect(() => {
    if (!pedido || feito.current) return;
    feito.current = true;
    if (pode) onAbrir();
    router.replace(caminho);
  }, [pedido, pode, onAbrir, router, caminho]);
  return null;
}

/**
 * Sessão 7: o número e a conta do WhatsApp oficial ligados ao Canal, lidos da api (o token nunca vem). Sem resposta, as
 * linhas não aparecem: o identificador externo do Canal já está na ficha.
 */
function NumeroDoWhatsAppOficial({ canalId }: { readonly canalId: string }) {
  const numero = useNumeroDoWhatsAppOficial(canalId);
  if (numero.data === undefined) return null;
  return (
    <>
      <RecordRow label="Número na Meta">
        <span className="identificador">{numero.data.numeroExibido}</span>
      </RecordRow>
      <RecordRow label="ID do número">
        <span className="identificador">{numero.data.phoneNumberId}</span>
      </RecordRow>
      <RecordRow label="ID da conta (WABA)">
        <span className="identificador">{numero.data.wabaId}</span>
      </RecordRow>
    </>
  );
}

/**
 * Sessão 8: a conta do Instagram ligada ao Canal, lida da Meta pela api (a foto não
 * é guardada: o endereço dela vence). Sem resposta da Meta, fica o @ do Canal.
 */
function ContaConectadaDoInstagram({ canalId, usuarioDoCanal }: { readonly canalId: string; readonly usuarioDoCanal: string }) {
  const conta = useContaDoInstagram(canalId);
  const usuario = conta.data?.usuario ?? usuarioDoCanal;
  return (
    <span className="flex min-w-0 items-center gap-2">
      {conta.data?.fotoUrl ? (
        // A foto vem do CDN do Instagram e o endereço vence: sem otimização do Next, que guardaria o endereço.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={conta.data.fotoUrl} alt="" width={20} height={20} className="size-5 shrink-0 rounded-full" />
      ) : null}
      <span className="identificador truncate" title={conta.data?.nome ?? undefined}>
        @{usuario}
      </span>
      {conta.data?.nome ? <span className="app-meta truncate">{conta.data.nome}</span> : null}
    </span>
  );
}

/** O selo de cada estado do modelo na Meta; só `aprovado` é verde, e o resto diz por que o modelo não sai. */
const SELO_DO_ESTADO: Readonly<Record<EstadoDeModelo, { readonly rotulo: string; readonly tom: "sucesso" | "aviso" | "erro" | "neutro" }>> = {
  aprovado: { rotulo: "Aprovado", tom: "sucesso" },
  pendente: { rotulo: "Em análise", tom: "aviso" },
  rejeitado: { rotulo: "Rejeitado", tom: "erro" },
  pausado: { rotulo: "Pausado", tom: "aviso" },
  desativado: { rotulo: "Desativado", tom: "neutro" },
};

const ROTULO_DA_CATEGORIA: Readonly<Record<ModeloNaLista["categoria"], string>> = {
  utilidade: "Utilidade",
  marketing: "Marketing",
  autenticacao: "Autenticação",
};

/**
 * Sessão 7 (7.3): as Mensagens de modelo do Canal. O modelo nasce e é aprovado na Meta; o CRM o sincroniza (ao conectar, de hora
 * em hora, quando a Meta avisa e por este botão) e a Caixa oferece os aprovados. Aqui aparecem TODOS, em qualquer estado: o
 * motivo da rejeição que a Meta deu e o que o CRM ainda não envia (cabeçalho de mídia, variável fora do corpo…) ficam à vista.
 * Só o WhatsApp oficial tem modelo: nos outros Canais a seção diz a regra do tipo, em vez de sumir.
 */
function ModelosDoCanal({
  canalId,
  oficial,
  conectadoDeVerdade,
  podeSincronizar,
  dicaDaJanela,
}: {
  readonly canalId: string;
  readonly oficial: boolean;
  readonly conectadoDeVerdade: boolean;
  readonly podeSincronizar: boolean;
  readonly dicaDaJanela: string;
}) {
  const fmt = useFormat();
  const lista = useModelosDoCanal(oficial ? canalId : undefined);
  const [sincronizando, setSincronizando] = useState(false);
  const [resultado, setResultado] = useState<{ readonly texto: string; readonly erro: boolean } | null>(null);

  if (!oficial) {
    return (
      <Section title="Mensagens de modelo" count={0}>
        <EmptyState title="Nenhuma Mensagem de modelo sincronizada." hint={dicaDaJanela} />
      </Section>
    );
  }

  const sincronizar = async () => {
    setSincronizando(true);
    setResultado(null);
    try {
      const r = await sincronizarModelosDoCanal(canalId);
      const partes = [`${r.criados} ${r.criados === 1 ? "novo" : "novos"}`, `${r.atualizados} ${r.atualizados === 1 ? "atualizado" : "atualizados"}`, `${r.removidos} ${r.removidos === 1 ? "removido" : "removidos"}`];
      setResultado({
        texto: `Modelos sincronizados com a Meta: ${partes.join(", ")}.${r.ignorados > 0 ? ` ${r.ignorados} de um tipo que o CRM ainda não conhece ficaram de fora.` : ""}`,
        erro: false,
      });
    } catch (falha) {
      setResultado({ texto: falha instanceof ErroDeApi ? falha.message : "Não foi possível sincronizar os modelos. Tente de novo.", erro: true });
    } finally {
      setSincronizando(false);
    }
  };

  const itens = lista.data?.itens ?? [];
  const ultima = itens.map((m) => m.sincronizadoEm).sort().at(-1);
  const botao =
    podeSincronizar && conectadoDeVerdade ? (
      <Button onClick={() => void sincronizar()} carregando={sincronizando} disabledReason="Sincronizando com a Meta…">
        Sincronizar com a Meta
      </Button>
    ) : undefined;

  return (
    <Section title="Mensagens de modelo" count={itens.length} {...(botao ? { action: botao } : {})}>
      {resultado ? (
        <p role={resultado.erro ? "alert" : "status"} className="app-base mb-2" style={{ color: resultado.erro ? "var(--erro)" : "var(--sucesso)" }}>
          {resultado.texto}
        </p>
      ) : null}
      {lista.data === undefined ? (
        lista.error === undefined ? (
          <p role="status" className="app-base px-1" style={{ color: "var(--texto-3)" }}>
            Carregando as Mensagens de modelo…
          </p>
        ) : (
          <EmptyState title="Não foi possível carregar as Mensagens de modelo." hint={lista.error.message} />
        )
      ) : itens.length === 0 ? (
        <EmptyState
          title="Nenhuma Mensagem de modelo sincronizada."
          hint={
            conectadoDeVerdade
              ? "Crie o modelo no Gerenciador do WhatsApp, na Meta, e use “Sincronizar com a Meta”. Sem um modelo aprovado não é possível começar a conversa nem escrever fora da janela de resposta."
              : "Conecte o número para trazer os modelos da conta."
          }
        />
      ) : (
        <>
          <ul className="grid gap-2" data-modelos-do-canal="true">
            {itens.map((m) => (
              <li key={m.id} data-modelo={m.nome} className="item-solto" data-estatico="true" style={{ display: "grid", gap: "0.25rem" }}>
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="app-md min-w-0 truncate" style={{ color: "var(--texto)" }}>
                    {m.nome}
                  </span>
                  <Pilula tom={SELO_DO_ESTADO[m.estado].tom}>{SELO_DO_ESTADO[m.estado].rotulo}</Pilula>
                  <span className="app-meta">
                    {m.idioma} · {ROTULO_DA_CATEGORIA[m.categoria]}
                    {m.quantidadeDeVariaveis > 0 ? ` · ${m.quantidadeDeVariaveis} ${m.quantidadeDeVariaveis === 1 ? "variável" : "variáveis"}` : ""}
                  </span>
                </span>
                {m.estado === "rejeitado" ? (
                  <span className="app-meta" style={{ color: "var(--erro)" }}>
                    {m.motivoDeRejeicao ? `Motivo da Meta: ${m.motivoDeRejeicao}` : "A Meta rejeitou este modelo e não disse o motivo."}
                  </span>
                ) : null}
                {m.motivoDeNaoEnviavel ? (
                  <span className="app-meta" style={{ color: "var(--aviso)" }}>
                    Aprovado, mas não sai pelo CRM: {m.motivoDeNaoEnviavel}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="app-meta mt-2">
            {itens.filter((m) => m.enviavel).length} de {itens.length} podem ser enviados pelo CRM.
            {ultima ? ` Última sincronização: ${fmt.instant(ultima)}.` : ""}
          </p>
        </>
      )}
    </Section>
  );
}
