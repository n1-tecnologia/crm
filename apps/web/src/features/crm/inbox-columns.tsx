"use client";

/**
 * T21 — the three columns of the Caixa de Entrada: Filas e Canais · Conversas ·
 * a Conversa aberta (the `children`).
 *
 * Attending is queue work: whoever answers spends the day switching between
 * conversations, and one navigation per switch is a tax charged hundreds of
 * times a day. The queue stays on screen and the switch is instant.
 *
 * The filters live in the URL, so switching conversation never loses them and a
 * filtered view is shareable.
 *
 * A coluna da lista é um trilho: fundo rebaixado e cada Conversa é uma peça
 * solta em cima dele — a aberta e as não lidas em destaque.
 */

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ArrowUpDown, Check, Settings, SlidersHorizontal, Star, Users } from "lucide-react";
import { useCanais } from "@/dados/crm/canais";
import { useConversas, type FiltroDeConversasNaTela } from "@/dados/crm/conversas";
import { useData, useRun, useSession } from "@/dados/store";
import { useRecente } from "@/features/shell/recente";
import { contactDisplayName } from "@n1/dominio/derive";
// "Não lida" e a última atividade moram no domínio: o resumo do Início conta as mesmas mensagens novas.
import { naoLidas, ultimaAtividade as lastActivity } from "@n1/dominio/derive-resumo";
import { rotuloDoCanal } from "@n1/dominio/derive-conversacional";
import { capacidadesDoCanal, toggleConversationStar } from "@n1/dominio/operations";
import { CHANNEL_ICON } from "@/features/crm/conversation-thread";
import { AvatarDoContato } from "@/features/crm/avatar-do-contato";
import { ContactAvatar } from "@/features/crm/contact-card";
import { CHANNEL_TYPE_LABEL, CONVERSATION_STATE_LABEL } from "@/features/shell/format";
import { useFormat } from "@/features/shell/use-format";
import {
  Abas,
  Button,
  ConditionMarker,
  ConfirmDialog,
  EmptyState,
  Field,
  Icone,
  Pilula,
  Select,
  StateSeal,
} from "@/features/shell/ui";
import type { Canal } from "@n1/dominio/crm/canais";
import { LIMITES_CRM } from "@n1/dominio/crm/comum";
import type { ConversaNaLista, SituacaoDaConversa } from "@n1/dominio/crm/conversas";
import type { DataState } from "@n1/dominio/state";
import type { Conversation } from "@n1/dominio/types";

const SCOPES = [
  { value: "todas", label: "Todas" },
  { value: "minhas", label: "Minhas" },
  { value: "semAtribuido", label: "Sem Atribuído" },
  { value: "semFila", label: "Sem Fila" },
  { value: "adiadas", label: "Adiadas" },
] as const;

type Scope = (typeof SCOPES)[number]["value"];

const ABAS = [
  { value: "naoLidos", label: "Não lidos" },
  { value: "todos", label: "Todos" },
  { value: "recentes", label: "Recentes" },
  { value: "marcados", label: "Marcados" },
] as const;

type Aba = (typeof ABAS)[number]["value"];

const ORDENS = [
  { value: "recentes", label: "Mais recentes" },
  { value: "antigos", label: "Mais antigas" },
  { value: "naoLidas", label: "Mais não lidas primeiro" },
] as const;

type Ordem = (typeof ORDENS)[number]["value"];

const STATES = [
  { value: "todos", label: "Todos" },
  { value: "aberta", label: "Aberta" },
  { value: "pendente", label: "Pendente" },
  { value: "resolvida", label: "Resolvida" },
] as const;

export function InboxColumns({ children }: { readonly children: ReactNode }) {
  const state = useData((data) => data);
  const router = useRouter();
  const pathname = usePathname();
  const query = useSearchParams();

  const aba = (query.get("aba") ?? "naoLidos") as Aba;
  const ordem = (query.get("ordem") ?? "recentes") as Ordem;
  const [filtrando, setFiltrando] = useState(false);
  const [ordenando, setOrdenando] = useState(false);
  const scope = (query.get("escopo") ?? "todas") as Scope;
  const conversationState = query.get("estado") ?? "todos";
  const channelId = query.get("canal") ?? "todos";
  const queueId = query.get("fila") ?? "todas";
  /** Há recorte além da aba: é o que acende o botão de filtros. */
  const temFiltro =
    query.has("escopo") || query.has("estado") || query.has("canal") || query.has("fila");


  const setFilter = (key: string, value: string, fallback: string) => {
    const next = new URLSearchParams(query.toString());
    if (value === fallback) next.delete(key);
    else next.set(key, value);
    router.replace(next.size > 0 ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  const openId = pathname.split("/").at(-1);

  return (
    <div className="flex h-full min-h-0">
      {/*
        A lista e a Conversa aberta. Os filtros que ocupavam uma coluna inteira
        agora moram no painel: a coluna repetia na tela o que o painel já faz, e
        tirava largura justamente de onde se lê a conversa.
      */}
      <div
        className="flex w-96 min-h-0 shrink-0 flex-col"
        style={{ background: "var(--superficie-rebaixada)", borderRight: "1px solid var(--linha)" }}
      >
        <div className="shrink-0">
          {/* A mesma barra de 44px do cabeçalho da Conversa ao lado. */}
          <div
            className="flex items-center gap-1 px-3"
            style={{ minHeight: "var(--cabecalho-tela-h)", borderBottom: "1px solid var(--linha)" }}
          >
            <h2 className="app-md min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
              {scopeTitle(scope)}
            </h2>
            <button
              type="button"
              onClick={() => setFiltrando(true)}
              aria-pressed={temFiltro}
              title="Filtros"
              className="btn-icone btn-icone-nu"
              style={temFiltro ? { background: "var(--acento-lavado)", color: "var(--acento)" } : undefined}
            >
              <Icone de={SlidersHorizontal} tamanho="sm" />
              <span className="sr-only">Filtros</span>
            </button>
            <span className="relative">
              <button
                type="button"
                onClick={() => setOrdenando((atual) => !atual)}
                aria-expanded={ordenando}
                title="Ordenar"
                className="btn-icone btn-icone-nu"
              >
                <Icone de={ArrowUpDown} tamanho="sm" />
                <span className="sr-only">Ordenar</span>
              </button>
              {ordenando ? (
                <ul className="flutuante surgir-rapido absolute right-0 top-full z-20 mt-1 w-60 p-1">
                  {ORDENS.map((opcao) => (
                    <li key={opcao.value}>
                      <button
                        type="button"
                        onClick={() => {
                          setFilter("ordem", opcao.value, "recentes");
                          setOrdenando(false);
                        }}
                        className="item-menu w-full"
                        data-ativo={ordem === opcao.value ? "true" : undefined}
                      >
                        <span className="min-w-0 flex-1">{opcao.label}</span>
                        {ordem === opcao.value ? (
                          <Icone de={Check} tamanho="sm" style={{ color: "var(--acento)" }} />
                        ) : null}
                      </button>
                    </li>
                  ))}
                  {/*
                    §11 — a opção que não dá para escolher diz por quê, em vez
                    de sumir: sem Prazo configurado não existe atraso a ordenar.
                  */}
                  <li className="app-sm px-3 py-1.5 opacity-60" style={{ color: "var(--texto-3)" }}>
                    Maior atraso do Prazo
                    <span className="block">
                      O Prazo de resposta não foi definido nesta Caixa.
                    </span>
                  </li>
                </ul>
              ) : null}
            </span>
            {/* Fase 8: o único caminho para Canais e Filas é esta página; sem o atalho ela não existe para quem navega. */}
            <Link
              href="/crm/caixa-de-entrada/configuracoes"
              title="Configurações da Caixa de Entrada"
              className="btn-icone btn-icone-nu"
            >
              <Icone de={Settings} tamanho="sm" />
              <span className="sr-only">Configurações da Caixa de Entrada</span>
            </Link>
          </div>
        </div>

        {scope === "minhas" ? (
          <ListaDoCrm
            escopo={scope}
            aba={aba}
            ordem={ordem}
            situacao={conversationState}
            canalId={channelId}
            filaId={queueId}
            abertaId={openId}
            consulta={query.toString()}
            aoTrocarAba={(chave) => setFilter("aba", chave, "naoLidos")}
          />
        ) : (
          <ListaLegada
            escopo={scope}
            aba={aba}
            ordem={ordem}
            situacao={conversationState}
            canalId={channelId}
            filaId={queueId}
            abertaId={openId}
            consulta={query.toString()}
            aoTrocarAba={(chave) => setFilter("aba", chave, "naoLidos")}
          />
        )}
      </div>

      {/*
        O painel de filtros. Ele edita os MESMOS filtros que já moravam no
        endereço, em vez de criar um segundo recorte paralelo: o que a pessoa
        escolhe aqui continua compartilhável por link e sobrevive à troca de
        Conversa.
      */}
      <ConfirmDialog
        open={filtrando}
        title="Filtros"
        description="O recorte fica no endereço: trocar de Conversa não o perde, e um link já vem filtrado."
        confirmLabel="Aplicar"
        cancelLabel="Fechar"
        footerStart={
          temFiltro ? (
            <Button
              variant="ghost"
              onClick={() => {
                const limpo = new URLSearchParams(query.toString());
                for (const chave of ["escopo", "estado", "canal", "fila"]) limpo.delete(chave);
                router.replace(limpo.size > 0 ? `${pathname}?${limpo}` : pathname, { scroll: false });
              }}
            >
              Limpar
            </Button>
          ) : undefined
        }
        onConfirm={() => setFiltrando(false)}
        onCancel={() => setFiltrando(false)}
      >
        <div className="grid gap-3">
          <Field label="Escopo">
            {(id) => (
              <Select
                id={id}
                value={scope}
                onChange={(valor) => setFilter("escopo", valor, "todas")}
                options={SCOPES.map((o) => ({ value: o.value, label: o.label }))}
              />
            )}
          </Field>
          <Field label="Estado da Conversa">
            {(id) => (
              <Select
                id={id}
                value={conversationState}
                onChange={(valor) => setFilter("estado", valor, "todos")}
                options={STATES.map((o) => ({ value: o.value, label: o.label }))}
              />
            )}
          </Field>
          <Field label="Canal">
            {(id) => (
              <Select
                id={id}
                value={channelId}
                onChange={(valor) => setFilter("canal", valor, "todos")}
                options={[
                  { value: "todos", label: "Todos os Canais" },
                  ...state.channels.map((c) => ({
                    value: c.id,
                    label: rotuloDoCanal(c),
                  })),
                ]}
              />
            )}
          </Field>
          <Field label="Fila">
            {(id) => (
              <Select
                id={id}
                value={queueId}
                onChange={(valor) => setFilter("fila", valor, "todas")}
                options={[
                  { value: "todas", label: "Todas as Filas" },
                  { value: "semFila", label: "Sem Fila" },
                  ...state.queues.map((q) => ({ value: q.id, label: q.name })),
                ]}
              />
            )}
          </Field>
        </div>
      </ConfirmDialog>

      {/* Coluna 3 — a Conversa aberta */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

/** O que as duas listas recebem da barra e do endereço: os filtros já lidos da URL. */
interface PropsDaLista {
  readonly escopo: string;
  readonly aba: Aba;
  readonly ordem: Ordem;
  readonly situacao: string;
  readonly canalId: string;
  readonly filaId: string;
  readonly abertaId: string | undefined;
  /** A query string atual, sem `?`: ela acompanha o link para trocar de Conversa não perder o recorte. */
  readonly consulta: string;
  readonly aoTrocarAba: (chave: string) => void;
}

/**
 * 15-11 — o recorte do escopo como filtro da api: "Minhas" é `atribuidoId` do
 * Membro da sessão. O resto do recorte (aba, situação, Canal, Fila) se soma
 * em `filtroDaCaixa`.
 */
export function filtroDoEscopo(escopo: string, membroId: string): FiltroDeConversasNaTela {
  if (escopo === "minhas") return { atribuidoId: membroId };
  return {};
}

/** RN-CXE-19 — a janela de resposta do Canal já fechou: passou do prazo da última Mensagem recebida. */
export function foraDaJanela(
  canal: Pick<Canal, "tipo" | "provedor"> | undefined,
  ultimaRecebidaEm: string | null,
  agora: number,
): boolean {
  if (!canal || ultimaRecebidaEm === null) return false;
  const horas = capacidadesDoCanal({ channelType: canal.tipo, provider: canal.provedor }).responseWindowHours;
  if (horas === undefined) return false;
  return agora > Date.parse(ultimaRecebidaEm) + horas * 3_600_000;
}

function ordenarConversas(itens: readonly ConversaNaLista[], ordem: Ordem): ConversaNaLista[] {
  const maisRecentes = (a: ConversaNaLista, b: ConversaNaLista) => b.atualizadoEm.localeCompare(a.atualizadoEm);
  if (ordem === "antigos") return [...itens].sort((a, b) => maisRecentes(b, a));
  if (ordem === "naoLidas") return [...itens].sort((a, b) => b.naoLidas - a.naoLidas || maisRecentes(a, b));
  return [...itens].sort(maisRecentes);
}

/**
 * A lista do CRM novo: as Conversas de `plataforma.conversas`, por `GET /conversas`
 * (`useConversas`). O escopo, a aba, a situação, o Canal e a Fila viram filtros
 * da api; a ordem é aplicada à página carregada. O Canal vem de `useCanais` e a
 * janela de resposta do que a lista já traz (`ultimaRecebidaEm`), sem uma ida
 * por linha. O texto da api é renderizado como texto React (T-15-32).
 */
function ListaDoCrm({
  escopo,
  aba,
  ordem,
  situacao,
  canalId,
  filaId,
  abertaId,
  consulta,
  aoTrocarAba,
}: PropsDaLista) {
  const { memberId } = useSession();
  const recente = useRecente();
  const fmt = useFormat();
  const [agora] = useState(() => Date.now());
  const [selecionadas, setSelecionadas] = useState<readonly string[]>([]);

  const doRecorte: FiltroDeConversasNaTela = {
    ...filtroDoEscopo(escopo, memberId),
    ...(situacao !== "todos" ? { situacao: situacao as SituacaoDaConversa } : {}),
    ...(canalId !== "todos" ? { canalId } : {}),
    ...(filaId !== "todas" && filaId !== "semFila" ? { filaId } : {}),
  };
  const daAba: FiltroDeConversasNaTela =
    aba === "naoLidos" ? { naoLidas: true } : aba === "marcados" ? { comEstrela: true } : {};

  const lista = useConversas({ ...doRecorte, ...daAba });
  const canais = useCanais({ limite: LIMITES_CRM.paginaMaxima });
  // Os contadores das abas são `total` da api (uma consulta de uma linha cada), não o tamanho da página.
  const naoLidosNoRecorte = useConversas({ ...doRecorte, naoLidas: true, limite: 1 });
  const marcadosNoRecorte = useConversas({ ...doRecorte, comEstrela: true, limite: 1 });

  const itens = ordenarConversas(lista.data?.itens ?? [], ordem);
  const total = lista.data?.total ?? 0;
  const contagemDaAba = (qual: Aba): number =>
    qual === "naoLidos" ? (naoLidosNoRecorte.data?.total ?? 0) : qual === "marcados" ? (marcadosNoRecorte.data?.total ?? 0) : 0;

  return (
    <>
      <div className="shrink-0">
        <Abas
          rotulo="Recorte da Caixa"
          abas={ABAS.map(({ value, label }) => {
            const contagem = contagemDaAba(value);
            return {
              chave: value,
              rotulo: label,
              ...(value !== "todos" && value !== "recentes" && contagem > 0 ? { contador: contagem } : {}),
            };
          })}
          ativa={aba}
          aoTrocar={aoTrocarAba}
        />

        <label
          className="app-sm flex items-center gap-2 px-3 py-1.5"
          style={{ color: "var(--texto-3)", borderBottom: "1px solid var(--linha-sutil)" }}
        >
          <input
            type="checkbox"
            className="accent-[var(--acento)]"
            checked={itens.length > 0 && selecionadas.length === itens.length}
            onChange={(evento) => setSelecionadas(evento.target.checked ? itens.map((c) => c.id) : [])}
          />
          {selecionadas.length > 0
            ? `${selecionadas.length} selecionada(s)`
            : `Selecionar tudo · ${itens.length} de ${total}`}
        </label>
      </div>
      {lista.error ? (
        <div className="p-3">
          <EmptyState title="Não foi possível carregar as Conversas." hint="Confira a conexão e tente de novo." />
        </div>
      ) : lista.data && itens.length === 0 ? (
        <div className="p-3">
          <EmptyState
            title="Nenhuma Conversa com estes filtros."
            hint="Ajuste o escopo, o estado, a Fila ou o Canal na coluna ao lado."
          />
        </div>
      ) : (
        <ul key={aba} className="cascata aparecer pilha-solta relative min-h-0 flex-1 overflow-y-auto p-2">
          {itens.map((conversa) => {
            const canal = canais.data?.itens.find((c) => c.id === conversa.canalId);
            const IconeDoCanal = canal ? CHANNEL_ICON[canal.tipo] : undefined;
            const rotulo = canal
              ? rotuloDoCanal({ name: canal.nome, channelType: canal.tipo, provider: canal.provedor })
              : undefined;
            const aberta = conversa.id === abertaId;
            const porLer = conversa.naoLidas;
            const nome = conversa.contatoNome ?? "Contato não resolvido";
            // O título nasce como o nome do Contato: repeti-lo na segunda linha seria ruído.
            const previa = conversa.titulo !== conversa.contatoNome ? conversa.titulo : "";
            /*
              A peça é o <li>, não o link: a caixa de seleção fica fora do
              link (interativo dentro de interativo não existe), mas pertence
              à mesma Conversa.
            */
            return (
              <li
                key={conversa.id}
                className="item-solto"
                data-alinhamento="topo"
                data-destacado={aberta || porLer > 0 ? "true" : undefined}
                data-recente={conversa.id === recente ? "true" : undefined}
                style={{ paddingBlock: "var(--e-2)" }}
              >
                <input
                  type="checkbox"
                  aria-label={`Selecionar a Conversa com ${nome}`}
                  className="mt-2 shrink-0 accent-[var(--acento)]"
                  checked={selecionadas.includes(conversa.id)}
                  onChange={(evento) =>
                    setSelecionadas((atual) =>
                      evento.target.checked ? [...atual, conversa.id] : atual.filter((id) => id !== conversa.id),
                    )
                  }
                />

                <Link
                  href={`/crm/caixa-de-entrada/${conversa.id}${consulta !== "" ? `?${consulta}` : ""}`}
                  aria-current={aberta ? "page" : undefined}
                  className="flex min-w-0 flex-1 gap-2"
                >
                  {/* O rosto com o selo do Canal embaixo: a regra do Canal muda o que dá para responder. */}
                  <span className="relative shrink-0">
                    {conversa.contatoNome !== null ? (
                      <AvatarDoContato nome={conversa.contatoNome} />
                    ) : (
                      <span
                        className="app-xs grid size-7 place-items-center rounded-full"
                        style={{ background: "var(--superficie-2)", color: "var(--texto-3)" }}
                      >
                        ?
                      </span>
                    )}
                    {canal && IconeDoCanal ? (
                      // O disco é opaco de propósito: ele tapa o canto do rosto.
                      <span
                        title={rotulo}
                        className="absolute -bottom-1 -right-1 grid size-4 place-items-center rounded-full"
                        style={{ background: "var(--card)", color: "var(--acento)" }}
                      >
                        <IconeDoCanal className="size-3" />
                        <span className="sr-only">{rotulo}</span>
                      </span>
                    ) : null}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span
                        className={`app-base min-w-0 flex-1 truncate ${porLer > 0 ? "font-semibold" : ""}`}
                        style={{ color: "var(--texto)" }}
                      >
                        {nome}
                      </span>
                      <span className="app-meta app-numero shrink-0">{fmt.relative(conversa.atualizadoEm)}</span>
                      {porLer > 0 ? (
                        <Pilula tom="acento" className="app-numero shrink-0">
                          {porLer}
                        </Pilula>
                      ) : null}
                    </span>
                    {previa !== "" ? (
                      <span className="app-sm mt-0.5 block truncate" style={{ color: "var(--texto-3)" }}>
                        {previa}
                      </span>
                    ) : null}
                    <span className="app-meta mt-1 flex flex-wrap items-center gap-2">
                      {/* D-16: dois WhatsApps têm o mesmo ícone; o nome do Canal é o que os separa. */}
                      {canal && IconeDoCanal ? (
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <IconeDoCanal className="size-3 shrink-0" />
                          <span className="max-w-[12rem] truncate">{canal.nome}</span>
                        </span>
                      ) : null}
                      <span>{CONVERSATION_STATE_LABEL[conversa.situacao]}</span>
                      {conversa.contatoNome === null ? (
                        <ConditionMarker tone="warning">sem Contato resolvido</ConditionMarker>
                      ) : null}
                      {conversa.adiadaAte !== null ? <ConditionMarker>adiada</ConditionMarker> : null}
                      {foraDaJanela(canal, conversa.ultimaRecebidaEm, agora) ? (
                        <ConditionMarker tone="warning">fora do Prazo</ConditionMarker>
                      ) : null}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

/**
 * A lista do modelo antigo: as Conversas de `state.conversations`. Fica até a
 * 15-11 (Task 2) trocar todos os escopos pelo CRM novo; depois só sobra o Grupo.
 */
function ListaLegada({
  escopo: scope,
  aba,
  ordem,
  situacao: conversationState,
  canalId: channelId,
  filaId: queueId,
  abertaId: openId,
  consulta,
  aoTrocarAba,
}: PropsDaLista) {
  const state = useData((data) => data);
  const { memberId } = useSession();
  const run = useRun();
  const recente = useRecente();
  const fmt = useFormat();
  const [selecionadas, setSelecionadas] = useState<readonly string[]>([]);

  const active = state.conversations.filter((conversation) => conversation.lifecycle === "ativo");

  const filtered = active
    .filter((conversation) => matchesScope(conversation, scope, memberId))
    .filter((conversation) => conversationState === "todos" || conversation.state === conversationState)
    .filter((conversation) => channelId === "todos" || conversation.channelId === channelId)
    .filter((conversation) =>
      queueId === "todas"
        ? true
        : queueId === "semFila"
          ? conversation.queueId === undefined
          : conversation.queueId === queueId,
    )
    .filter((conversation) => {
      if (aba === "todos") return true;
      if (aba === "marcados") return conversation.starredBy.includes(memberId);
      if (aba === "recentes") return true;
      return naoLidas(conversation, memberId) > 0;
    })
    .sort((a, b) =>
      ordem === "antigos"
        ? lastActivity(a).localeCompare(lastActivity(b))
        : ordem === "naoLidas"
          ? naoLidas(b, memberId) - naoLidas(a, memberId)
          : lastActivity(b).localeCompare(lastActivity(a)),
    );

  const contagemDaAba = (qual: Aba): number =>
    active
      .filter((c) => matchesScope(c, scope, memberId))
      .filter((c) =>
        qual === "marcados"
          ? c.starredBy.includes(memberId)
          : qual === "naoLidos"
            ? naoLidas(c, memberId) > 0
            : true,
      ).length;


  return (
    <>
      <div className="shrink-0">
          <Abas
            rotulo="Recorte da Caixa"
            abas={ABAS.map(({ value, label }) => {
              const contagem = contagemDaAba(value);
              return {
                chave: value,
                rotulo: label,
                ...(value !== "todos" && value !== "recentes" && contagem > 0 ? { contador: contagem } : {}),
              };
            })}
            ativa={aba}
            aoTrocar={aoTrocarAba}
          />

          <label
            className="app-sm flex items-center gap-2 px-3 py-1.5"
            style={{ color: "var(--texto-3)", borderBottom: "1px solid var(--linha-sutil)" }}
          >
            <input
              type="checkbox"
              className="accent-[var(--acento)]"
              checked={filtered.length > 0 && selecionadas.length === filtered.length}
              onChange={(evento) =>
                setSelecionadas(evento.target.checked ? filtered.map((c) => c.id) : [])
              }
            />
            {selecionadas.length > 0
              ? `${selecionadas.length} selecionada(s)`
              : `Selecionar tudo · ${filtered.length} de ${active.length}`}
          </label>
      </div>
        {filtered.length === 0 ? (
          <div className="p-3">
            <EmptyState
              title="Nenhuma Conversa com estes filtros."
              hint="Ajuste o escopo, o estado, a Fila ou o Canal na coluna ao lado."
            />
          </div>
        ) : (
          <ul key={aba} className="cascata aparecer pilha-solta relative min-h-0 flex-1 overflow-y-auto p-2">
            {filtered.map((conversation) => {
              const contact = conversation.contactId
                ? state.contacts.find((c) => c.id === conversation.contactId)
                : undefined;
              const channel = state.channels.find((c) => c.id === conversation.channelId);
              const last = [...conversation.messages]
                .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                .at(-1);
              const outsideWindow = isOutsideWindow(state, conversation, Date.parse(lastActivity(conversation)));
              const canal = channel?.channelType;
              const IconeDoCanal = canal ? CHANNEL_ICON[canal] : undefined;
              const porLer = naoLidas(conversation, memberId);
              const marcada = conversation.starredBy.includes(memberId);
              const aberta = conversation.id === openId;
              /*
                A peça é o <li>, não o link: a caixa de seleção e a estrela
                ficam fora do link (interativo dentro de interativo não existe),
                mas pertencem à mesma Conversa.
              */
              return (
                <li
                  key={conversation.id}
                  className="item-solto"
                  data-alinhamento="topo"
                  data-destacado={aberta || porLer > 0 ? "true" : undefined}
                  data-recente={conversation.id === recente ? "true" : undefined}
                  style={{ paddingBlock: "var(--e-2)" }}
                >
                  <input
                    type="checkbox"
                    aria-label={`Selecionar a Conversa com ${contact ? contactDisplayName(contact) : conversation.title}`}
                    className="mt-2 shrink-0 accent-[var(--acento)]"
                    checked={selecionadas.includes(conversation.id)}
                    onChange={(evento) =>
                      setSelecionadas((atual) =>
                        evento.target.checked
                          ? [...atual, conversation.id]
                          : atual.filter((id) => id !== conversation.id),
                      )
                    }
                  />

                  <Link
                    href={`/crm/caixa-de-entrada/${conversation.id}${consulta !== "" ? `?${consulta}` : ""}`}
                    aria-current={aberta ? "page" : undefined}
                    className="flex min-w-0 flex-1 gap-2"
                  >
                    {/*
                      O rosto com o selo do Canal embaixo: quem atende precisa
                      saber POR ONDE está falando antes de abrir, porque a regra
                      do Canal muda o que dá para responder.
                    */}
                    <span className="relative shrink-0">
                      {contact ? (
                        <ContactAvatar contact={contact} />
                      ) : conversation.groupIdentifier ? (
                        // Conversa de grupo (INV-GRP-05): quem fala é o Grupo, não um Contato por resolver.
                        <span
                          className="grid size-7 place-items-center rounded-full"
                          style={{ background: "var(--info-lavado)", color: "var(--info)" }}
                          title="Conversa de grupo"
                        >
                          <Users className="size-3.5" />
                        </span>
                      ) : (
                        <span
                          className="app-xs grid size-7 place-items-center rounded-full"
                          style={{ background: "var(--superficie-2)", color: "var(--texto-3)" }}
                        >
                          ?
                        </span>
                      )}
                      {canal && IconeDoCanal ? (
                        // O disco é opaco de propósito: ele tapa o canto do rosto.
                        <span
                          title={channel ? rotuloDoCanal(channel) : (CHANNEL_TYPE_LABEL[canal] ?? canal)}
                          className="absolute -bottom-1 -right-1 grid size-4 place-items-center rounded-full"
                          style={{ background: "var(--card)", color: "var(--acento)" }}
                        >
                          <IconeDoCanal className="size-3" />
                          <span className="sr-only">
                            {channel ? rotuloDoCanal(channel) : (CHANNEL_TYPE_LABEL[canal] ?? canal)}
                          </span>
                        </span>
                      ) : null}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span
                          className={`app-base min-w-0 flex-1 truncate ${porLer > 0 ? "font-semibold" : ""}`}
                          style={{ color: "var(--texto)" }}
                        >
                          {contact
                            ? contactDisplayName(contact)
                            : (conversation.groupIdentifier?.name ?? conversation.unresolvedIdentifier?.value ?? "Contato não resolvido")}
                        </span>
                        <span className="app-meta app-numero shrink-0">
                          {fmt.relative(lastActivity(conversation))}
                        </span>
                        {porLer > 0 ? (
                          <Pilula tom="acento" className="app-numero shrink-0">
                            {porLer}
                          </Pilula>
                        ) : null}
                      </span>
                      <span className="app-sm mt-0.5 block truncate" style={{ color: "var(--texto-3)" }}>
                        {last
                          ? last.deletionMark
                            ? "Mensagem apagada"
                            : last.content
                          : conversation.title}
                      </span>
                      <span className="app-meta mt-1 flex flex-wrap items-center gap-2">
                        {/*
                          D-16: dois WhatsApps têm o mesmo ícone; o nome do Canal
                          é o que os separa na lista, antes de abrir a Conversa.
                        */}
                        {channel && IconeDoCanal ? (
                          <span className="inline-flex min-w-0 items-center gap-1">
                            <IconeDoCanal className="size-3 shrink-0" />
                            <span className="max-w-[12rem] truncate">{channel.name}</span>
                          </span>
                        ) : null}
                        <span>{CONVERSATION_STATE_LABEL[conversation.state]}</span>
                        {contact && contact.lifecycle !== "ativo" ? <StateSeal state={contact.lifecycle} /> : null}
                        {conversation.unresolvedIdentifier ? (
                          <ConditionMarker tone="warning">sem Contato resolvido</ConditionMarker>
                        ) : null}
                        {conversation.snooze ? <ConditionMarker>adiada</ConditionMarker> : null}
                        {outsideWindow ? <ConditionMarker tone="warning">fora do Prazo</ConditionMarker> : null}
                      </span>
                    </span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => run((data, id) => toggleConversationStar(data, id, conversation.id))}
                    aria-pressed={marcada}
                    title={marcada ? "Desmarcar" : "Marcar"}
                    className="btn-icone btn-icone-nu -mt-0.5 shrink-0"
                    style={marcada ? { color: "var(--acento)" } : undefined}
                  >
                    <Icone de={Star} tamanho="sm" style={marcada ? { fill: "var(--acento)" } : undefined} />
                    <span className="sr-only">{marcada ? "Desmarcar" : "Marcar"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
    </>
  );
}



/** O título da coluna diz o recorte: quem chega pelo atalho "Caixa de entrada" do Comercial vê "Minhas Conversas". */
export function scopeTitle(scope: string): string {
  if (scope === "minhas") return "Minhas Conversas";
  if (scope === "semAtribuido") return "Conversas sem Atribuído";
  if (scope === "semFila") return "Conversas sem Fila";
  if (scope === "adiadas") return "Conversas adiadas";
  return "Caixa de entrada da equipe";
}

export function matchesScope(conversation: Conversation, scope: string, memberId: string): boolean {
  if (scope === "minhas") {
    return conversation.assignee?.kind === "member" && conversation.assignee.id === memberId;
  }
  if (scope === "semAtribuido") return conversation.assignee === undefined;
  if (scope === "semFila") return conversation.queueId === undefined;
  if (scope === "adiadas") return conversation.snooze !== undefined;
  return true;
}

/** RN-CXE-19 — the marker that says a free reply is no longer possible. */
function isOutsideWindow(state: DataState, conversation: Conversation, now: number): boolean {
  const channel = state.channels.find((c) => c.id === conversation.channelId);
  if (!channel) return false;
  const hours = capacidadesDoCanal(channel).responseWindowHours;
  if (hours === undefined) return false;
  const received = [...conversation.messages]
    .filter((message) => message.direction === "recebida")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .at(-1);
  if (!received) return false;
  return now > Date.parse(received.createdAt) + hours * 3_600_000;
}

