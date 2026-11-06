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
import { useRef, useState, type ReactNode } from "react";
import { ArrowUpDown, Check, Settings, SlidersHorizontal, Star, Users } from "lucide-react";
import { useCanais } from "@/dados/crm/canais";
import { marcarConversa, useConversas, type FiltroDeConversasNaTela } from "@/dados/crm/conversas";
import { useData, useRun, useSession } from "@/dados/store";
import { useRecente } from "@/features/shell/recente";
// "Não lida" e a última atividade moram no domínio: o resumo do Início conta as mesmas mensagens novas.
import { naoLidas, ultimaAtividade as lastActivity } from "@n1/dominio/derive-resumo";
import { rotuloDoCanal } from "@n1/dominio/derive-conversacional";
import { capacidadesDoCanal, toggleConversationStar } from "@n1/dominio/operations";
import { CHANNEL_ICON } from "@/features/crm/conversation-thread";
import { AvatarDoContato } from "@/features/crm/avatar-do-contato";
import { CONVERSATION_STATE_LABEL } from "@/features/shell/format";
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
} from "@/features/shell/ui";
import type { Canal } from "@n1/dominio/crm/canais";
import { LIMITES_CRM } from "@n1/dominio/crm/comum";
import type { ConversaNaLista, SituacaoDaConversa } from "@n1/dominio/crm/conversas";
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
  const filas = useData((data) => data.queues);
  const canais = useCanais({ limite: LIMITES_CRM.paginaMaxima });
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

        <ListaDaCaixa
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
                  ...(canais.data?.itens ?? []).map((c) => ({
                    value: c.id,
                    label: rotuloDoCanal({ name: c.nome, channelType: c.tipo, provider: c.provedor }),
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
                  ...filas.map((q) => ({ value: q.id, label: q.name })),
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

/** O que a lista recebe da barra e do endereço: os filtros já lidos da URL. */
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
 * 15-11 — o escopo como filtro da api: "Minhas" é `atribuidoId` do Membro da
 * sessão. Os outros escopos não filtram por atribuição na api (ver
 * `recorteNoCliente`).
 */
export function filtroDoEscopo(escopo: string, membroId: string): FiltroDeConversasNaTela {
  if (escopo === "minhas") return { atribuidoId: membroId };
  return {};
}

/**
 * O que a api ainda não filtra: sem Atribuído, sem Fila e Adiadas. A tela pede a
 * página inteira (`LIMITES_CRM.paginaMaxima`) e recorta ela; o `total` desses
 * recortes é o da página recortada, não o do Espaço (WINDOWS.md, 15-11).
 */
export function recorteNoCliente(escopo: string, filaId: string): ((c: ConversaNaLista) => boolean) | undefined {
  const regras: Array<(c: ConversaNaLista) => boolean> = [];
  if (escopo === "semAtribuido") regras.push((c) => c.atribuido === null);
  if (escopo === "semFila" || filaId === "semFila") regras.push((c) => c.filaId === null);
  if (escopo === "adiadas") regras.push((c) => c.adiadaAte !== null);
  return regras.length === 0 ? undefined : (c) => regras.every((regra) => regra(c));
}

/** Uma consulta da lista: a página da api, recortada na tela quando o filtro não existe na api. */
export function useRecorte(filtro: FiltroDeConversasNaTela, noCliente: ((c: ConversaNaLista) => boolean) | undefined) {
  const resposta = useConversas(noCliente ? { ...filtro, limite: LIMITES_CRM.paginaMaxima } : filtro);
  const itens = resposta.data ? (noCliente ? resposta.data.itens.filter(noCliente) : resposta.data.itens) : [];
  return {
    carregada: resposta.data !== undefined,
    erro: resposta.error,
    itens,
    total: noCliente ? itens.length : (resposta.data?.total ?? 0),
  };
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

/** A Conversa de Grupo (F14-D-05) só existe no estado antigo: não tem linha em `plataforma.conversas`. */
export function ehConversaDeGrupo(conversa: Conversation): boolean {
  return conversa.lifecycle === "ativo" && conversa.groupIdentifier !== undefined;
}

/** Um item da lista, venha de `plataforma.conversas` ou do Grupo do estado antigo. */
interface ItemDaCaixa {
  readonly id: string;
  readonly origem: "crm" | "grupo";
  readonly nome: string;
  readonly rosto: "contato" | "grupo" | "desconhecido";
  readonly previa: string;
  readonly atividadeEm: string;
  readonly naoLidas: number;
  readonly estrela: boolean;
  readonly canalId: string;
  readonly situacao: string;
  readonly adiada: boolean;
  readonly semContatoResolvido: boolean;
  readonly ultimaRecebidaEm: string | null;
}

function itemDoCrm(conversa: ConversaNaLista): ItemDaCaixa {
  return {
    id: conversa.id,
    origem: "crm",
    nome: conversa.contatoNome ?? "Contato não resolvido",
    rosto: conversa.contatoNome === null ? "desconhecido" : "contato",
    // O título nasce como o nome do Contato: repeti-lo na segunda linha seria ruído.
    previa: conversa.titulo !== conversa.contatoNome ? conversa.titulo : "",
    atividadeEm: conversa.atualizadoEm,
    naoLidas: conversa.naoLidas,
    estrela: conversa.estrela,
    canalId: conversa.canalId,
    situacao: conversa.situacao,
    adiada: conversa.adiadaAte !== null,
    semContatoResolvido: conversa.contatoNome === null,
    ultimaRecebidaEm: conversa.ultimaRecebidaEm,
  };
}

function itemDoGrupo(conversa: Conversation, membroId: string): ItemDaCaixa {
  const ultimaRecebida = [...conversa.messages]
    .filter((m) => m.direction === "recebida")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .at(-1);
  const ultima = [...conversa.messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1);
  return {
    id: conversa.id,
    origem: "grupo",
    nome: conversa.groupIdentifier?.name ?? conversa.title,
    rosto: "grupo",
    previa: ultima ? (ultima.deletionMark ? "Mensagem apagada" : ultima.content) : conversa.title,
    atividadeEm: lastActivity(conversa),
    naoLidas: naoLidas(conversa, membroId),
    estrela: conversa.starredBy.includes(membroId),
    canalId: conversa.channelId,
    situacao: conversa.state,
    adiada: conversa.snooze !== undefined,
    semContatoResolvido: false,
    ultimaRecebidaEm: ultimaRecebida?.createdAt ?? null,
  };
}

function ordenarItens(itens: readonly ItemDaCaixa[], ordem: Ordem): ItemDaCaixa[] {
  const maisRecentes = (a: ItemDaCaixa, b: ItemDaCaixa) => b.atividadeEm.localeCompare(a.atividadeEm);
  if (ordem === "antigos") return [...itens].sort((a, b) => maisRecentes(b, a));
  if (ordem === "naoLidas") return [...itens].sort((a, b) => b.naoLidas - a.naoLidas || maisRecentes(a, b));
  return [...itens].sort(maisRecentes);
}

/** O Grupo entra no recorte da Caixa pelas mesmas regras de escopo, estado, Canal, Fila e aba. */
function grupoNoRecorte(
  conversa: Conversation,
  recorte: { readonly escopo: string; readonly situacao: string; readonly canalId: string; readonly filaId: string },
  membroId: string,
): boolean {
  return (
    ehConversaDeGrupo(conversa) &&
    matchesScope(conversa, recorte.escopo, membroId) &&
    (recorte.situacao === "todos" || conversa.state === recorte.situacao) &&
    (recorte.canalId === "todos" || conversa.channelId === recorte.canalId) &&
    (recorte.filaId === "todas" ||
      (recorte.filaId === "semFila" ? conversa.queueId === undefined : conversa.queueId === recorte.filaId))
  );
}

/**
 * A lista da Caixa: as Conversas de `plataforma.conversas`, por `GET /conversas`
 * (`useConversas`), mais as de Grupo, que seguem no estado antigo (F14-D-05). O
 * escopo, a aba, a situação, o Canal e a Fila viram filtros da api; a ordem é
 * aplicada à página carregada e os contadores são o `total` da api. O Canal vem
 * de `useCanais` e a janela de resposta do que a lista já traz
 * (`ultimaRecebidaEm`), sem uma ida por linha. O texto da api é renderizado como
 * texto React (T-15-32).
 */
function ListaDaCaixa({
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
  const run = useRun();
  const recente = useRecente();
  const fmt = useFormat();
  const [agora] = useState(() => Date.now());
  const [selecionadas, setSelecionadas] = useState<readonly string[]>([]);
  const [paginas, setPaginas] = useState(1);
  /** A estrela mostrada enquanto a gravação não terminou: o 2º clique parte dela, não da lista velha. */
  const [marcadas, setMarcadas] = useState<Readonly<Record<string, boolean>>>({});
  const filaDeGravacao = useRef<Record<string, Promise<unknown>>>({});

  const conversasAntigas = useData((data) => data.conversations);
  const canais = useCanais({ limite: LIMITES_CRM.paginaMaxima });

  const noCliente = recorteNoCliente(escopo, filaId);
  const limite = Math.min(LIMITES_CRM.paginaMaxima, LIMITES_CRM.paginaPadrao * paginas);
  const doRecorte: FiltroDeConversasNaTela = {
    ...filtroDoEscopo(escopo, memberId),
    ...(situacao !== "todos" ? { situacao: situacao as SituacaoDaConversa } : {}),
    ...(canalId !== "todos" ? { canalId } : {}),
    ...(filaId !== "todas" && filaId !== "semFila" ? { filaId } : {}),
  };
  const daAba: FiltroDeConversasNaTela =
    aba === "naoLidos" ? { naoLidas: true } : aba === "marcados" ? { comEstrela: true } : {};

  const lista = useRecorte({ ...doRecorte, ...daAba, limite }, noCliente);
  // Os contadores das abas são `total` da api (uma consulta de uma linha cada), não o tamanho da página.
  const naoLidosNoRecorte = useRecorte({ ...doRecorte, naoLidas: true, limite: 1 }, noCliente);
  const marcadosNoRecorte = useRecorte({ ...doRecorte, comEstrela: true, limite: 1 }, noCliente);

  const recorteDoGrupo = { escopo, situacao, canalId, filaId };
  const gruposDoRecorte = conversasAntigas.filter((c) => grupoNoRecorte(c, recorteDoGrupo, memberId));
  const gruposDaAba = gruposDoRecorte.filter((c) =>
    aba === "naoLidos" ? naoLidas(c, memberId) > 0 : aba === "marcados" ? c.starredBy.includes(memberId) : true,
  );

  const itens = ordenarItens(
    [...lista.itens.map(itemDoCrm), ...gruposDaAba.map((c) => itemDoGrupo(c, memberId))],
    ordem,
  );
  const total = lista.total + gruposDaAba.length;
  const contagemDaAba = (qual: Aba): number =>
    qual === "naoLidos"
      ? naoLidosNoRecorte.total + gruposDoRecorte.filter((c) => naoLidas(c, memberId) > 0).length
      : qual === "marcados"
        ? marcadosNoRecorte.total + gruposDoRecorte.filter((c) => c.starredBy.includes(memberId)).length
        : 0;
  const haMais = !noCliente && lista.itens.length < lista.total && limite < LIMITES_CRM.paginaMaxima;

  /**
   * Estrela do Membro. Conversa do CRM: `PUT /conversas/:id/marcacao`, uma de cada
   * vez por Conversa (a ordem dos cliques é a ordem gravada) e cada clique parte
   * do valor que o anterior deixou; a recusa desfaz o que a tela mostrava. O
   * Grupo não tem Conversa nas tabelas e segue pela operação antiga.
   */
  const alternarEstrela = (item: ItemDaCaixa) => {
    if (item.origem === "grupo") {
      run((data, id) => toggleConversationStar(data, id, item.id));
      return;
    }
    const novo = !(marcadas[item.id] ?? item.estrela);
    const sem = (atual: Readonly<Record<string, boolean>>) =>
      Object.fromEntries(Object.entries(atual).filter(([id]) => id !== item.id));
    setMarcadas((atual) => ({ ...atual, [item.id]: novo }));
    filaDeGravacao.current[item.id] = (filaDeGravacao.current[item.id] ?? Promise.resolve())
      .then(() => marcarConversa(item.id, { estrela: novo }))
      .then(
        () => setMarcadas((atual) => (atual[item.id] === novo ? sem(atual) : atual)),
        () => setMarcadas(sem),
      );
  };

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
      {lista.erro ? (
        <div className="p-3">
          <EmptyState title="Não foi possível carregar as Conversas." hint="Confira a conexão e tente de novo." />
        </div>
      ) : lista.carregada && itens.length === 0 ? (
        <div className="p-3">
          <EmptyState
            title="Nenhuma Conversa com estes filtros."
            hint="Ajuste o escopo, o estado, a Fila ou o Canal na coluna ao lado."
          />
        </div>
      ) : (
        <ul key={aba} className="cascata aparecer pilha-solta relative min-h-0 flex-1 overflow-y-auto p-2">
          {itens.map((item) => {
            const canal = canais.data?.itens.find((c) => c.id === item.canalId);
            const IconeDoCanal = canal ? CHANNEL_ICON[canal.tipo] : undefined;
            const rotulo = canal
              ? rotuloDoCanal({ name: canal.nome, channelType: canal.tipo, provider: canal.provedor })
              : undefined;
            const aberta = item.id === abertaId;
            const porLer = item.naoLidas;
            const marcada = item.origem === "crm" ? (marcadas[item.id] ?? item.estrela) : item.estrela;
            /*
              A peça é o <li>, não o link: a caixa de seleção e a estrela
              ficam fora do link (interativo dentro de interativo não existe),
              mas pertencem à mesma Conversa.
            */
            return (
              <li
                key={item.id}
                className="item-solto"
                data-alinhamento="topo"
                data-destacado={aberta || porLer > 0 ? "true" : undefined}
                data-recente={item.id === recente ? "true" : undefined}
                style={{ paddingBlock: "var(--e-2)" }}
              >
                <input
                  type="checkbox"
                  aria-label={`Selecionar a Conversa com ${item.nome}`}
                  className="mt-2 shrink-0 accent-[var(--acento)]"
                  checked={selecionadas.includes(item.id)}
                  onChange={(evento) =>
                    setSelecionadas((atual) =>
                      evento.target.checked ? [...atual, item.id] : atual.filter((id) => id !== item.id),
                    )
                  }
                />

                <Link
                  href={`/crm/caixa-de-entrada/${item.id}${consulta !== "" ? `?${consulta}` : ""}`}
                  aria-current={aberta ? "page" : undefined}
                  className="flex min-w-0 flex-1 gap-2"
                >
                  {/* O rosto com o selo do Canal embaixo: a regra do Canal muda o que dá para responder. */}
                  <span className="relative shrink-0">
                    {item.rosto === "contato" ? (
                      <AvatarDoContato nome={item.nome} />
                    ) : item.rosto === "grupo" ? (
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
                        {item.nome}
                      </span>
                      <span className="app-meta app-numero shrink-0">{fmt.relative(item.atividadeEm)}</span>
                      {porLer > 0 ? (
                        <Pilula tom="acento" className="app-numero shrink-0">
                          {porLer}
                        </Pilula>
                      ) : null}
                    </span>
                    {item.previa !== "" ? (
                      <span className="app-sm mt-0.5 block truncate" style={{ color: "var(--texto-3)" }}>
                        {item.previa}
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
                      <span>{CONVERSATION_STATE_LABEL[item.situacao]}</span>
                      {item.semContatoResolvido ? (
                        <ConditionMarker tone="warning">sem Contato resolvido</ConditionMarker>
                      ) : null}
                      {item.adiada ? <ConditionMarker>adiada</ConditionMarker> : null}
                      {foraDaJanela(canal, item.ultimaRecebidaEm, agora) ? (
                        <ConditionMarker tone="warning">fora do Prazo</ConditionMarker>
                      ) : null}
                    </span>
                  </span>
                </Link>

                <button
                  type="button"
                  onClick={() => alternarEstrela(item)}
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
          {haMais ? (
            <li className="grid place-items-center py-2">
              <Button variant="ghost" onClick={() => setPaginas((atual) => atual + 1)}>
                Mostrar mais
              </Button>
            </li>
          ) : null}
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
