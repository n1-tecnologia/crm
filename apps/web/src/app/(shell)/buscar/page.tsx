"use client";

/**
 * T04 — Busca global. One field over every family, grouped by entity.
 *
 * The term lives in `?q=` (MAPA-DE-NAVEGACAO) so a search is shareable, comes
 * back on reload and lands in the browser history — three things a term kept in
 * component state loses.
 *
 * B103 — o que a busca hoje garante, e nomeadamente, o que ainda não. Até
 * 2026-09-22 este parágrafo prometia que a busca nunca revelava o que uma
 * permissão esconde; era falso — o arquivo não importava `useSession` e
 * devolvia `state.tasks` e `state.lists` inteiros a qualquer Membro (03-15,
 * T-3-75). Passa a ser verdade só para essas duas famílias:
 * `memberSeesTask` filtra Tarefas, `memberReachesContainer` filtra Listas,
 * de `@n1/dominio/derive`. A hidratação por `GET /estado` **não** é
 * filtrada por visibilidade — o cliente já tem o dado inteiro —, então o
 * filtro é obrigação de cada tela que enumere uma coleção, não uma
 * otimização (T-3-79, achado para o orquestrador, correção durável é
 * `apps/api`).
 *
 * As outras famílias — **Documentos, Agentes, Automações** — continuam sem
 * filtro nesta rodada. Não por serem difíceis: o predicado correto de cada uma
 * (alcance do contêiner de origem? dono do registro? `memberSeesResource`?) não
 * está decidido em nenhum artefato deste projeto, e o requisito que abriu este
 * plano (PAG-06) nomeia só Tarefa e Lista. Dívida conhecida, não descuido —
 * T-3-80, achado para o orquestrador.
 *
 * 15-14 (UCR-07) — **Contatos, Empresas, Negócios e Conversas** não vêm mais do
 * store: são `GET /contatos?q=`, `/empresas?q=`, `/negocios?q=` e `/conversas?q=`
 * (`dados/crm/*`), e quem aplica Papel e Espaço é a api (T-15-36). Só com 2 ou
 * mais caracteres (T-15-37); o `total` da api é o número do grupo. "Incluir
 * arquivados e na lixeira" acrescenta uma consulta por estado, só enquanto a
 * opção está marcada. A busca de Conversa é pelo título (a rota não olha o
 * texto das Mensagens, como a do modelo antigo olhava).
 *
 * O atalho "/" e a pílula da barra global prometem "tecle e busque": chegando
 * sem termo, o campo recebe o foco sozinho (as letras tecladas em seguida caem
 * nele). Chegando com `?q=` (recarga, link compartilhado) o foco fica onde o
 * navegador o pôs — nada rouba a leitura de um resultado.
 */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useData, useSession } from "@/dados/store";
import { memberReachesContainer, memberSeesTask } from "@n1/dominio/derive";
import type { EstadoCrm } from "@n1/dominio/crm/comum";
import type { ContatoResumo } from "@n1/dominio/crm/contatos";
import type { ConversaNaLista } from "@n1/dominio/crm/conversas";
import type { EmpresaResumo } from "@n1/dominio/crm/empresas";
import type { NegocioResumo } from "@n1/dominio/crm/negocios";
import { useContatos } from "@/dados/crm/contatos";
import { useConversas } from "@/dados/crm/conversas";
import { useEmpresas } from "@/dados/crm/empresas";
import { useNegocios } from "@/dados/crm/negocios";
import { BarraDeFiltros, CorpoDeTela, EmptyState, Icone, PageHeader, Section, StateSeal, Toast } from "@/features/shell/ui";

interface Hit {
  readonly id: string;
  readonly href: string;
  readonly title: string;
  readonly detail: string;
  readonly lifecycle: string;
}

const MIN_QUERY = 2;
/** Quantos resultados cada grupo lista (e pede à api). */
const POR_GRUPO = 10;

/** O vocabulário do selo (`StateSeal`) para o `estado` das tabelas do CRM. */
const SELO_DO_ESTADO: Readonly<Record<EstadoCrm, string>> = { ativo: "ativo", arquivado: "arquivado", na_lixeira: "naLixeira" };

interface ConsultaDoCrm<T> {
  readonly liga: boolean;
  readonly dados: { readonly itens: T[]; readonly total: number } | undefined;
  readonly carregando: boolean;
  readonly erro: Error | undefined;
}

interface GrupoDoCrm {
  readonly hits: readonly Hit[];
  readonly total: number;
  readonly carregando: boolean;
  readonly erro: Error | undefined;
}

/** Junta as consultas LIGADAS de um grupo (uma por estado); `keepPreviousData` não vaza resultado de consulta desligada. */
function reunir<T>(consultas: readonly ConsultaDoCrm<T>[], paraHit: (item: T) => Hit): GrupoDoCrm {
  const ligadas = consultas.filter((consulta) => consulta.liga);
  return {
    hits: ligadas.flatMap((consulta) => (consulta.dados?.itens ?? []).map(paraHit)),
    total: ligadas.reduce((soma, consulta) => soma + (consulta.dados?.total ?? 0), 0),
    carregando: ligadas.some((consulta) => consulta.carregando),
    erro: ligadas.find((consulta) => consulta.erro !== undefined)?.erro,
  };
}

/**
 * Contatos, Empresas, Negócios e Conversas pelas rotas REST. A consulta de `ativo` liga com o termo
 * pronto; as de `arquivado` e `na_lixeira` só com a opção marcada. Conversa não tem `arquivado`.
 */
function useBuscaNoCrm(termo: string, pronta: boolean, comInativos: boolean) {
  const q = termo.trim();
  const ligaInativos = pronta && comInativos;
  const pausadoAtivo = { pausado: !pronta };
  const pausadoInativo = { pausado: !ligaInativos };
  const contatos = [
    useContatos({ q, limite: POR_GRUPO }, pausadoAtivo),
    useContatos({ q, estado: "arquivado", limite: POR_GRUPO }, pausadoInativo),
    useContatos({ q, estado: "na_lixeira", limite: POR_GRUPO }, pausadoInativo),
  ];
  const empresas = [
    useEmpresas({ q, limite: POR_GRUPO }, pausadoAtivo),
    useEmpresas({ q, estado: "arquivado", limite: POR_GRUPO }, pausadoInativo),
    useEmpresas({ q, estado: "na_lixeira", limite: POR_GRUPO }, pausadoInativo),
  ];
  const negocios = [
    useNegocios({ q, limite: POR_GRUPO }, pausadoAtivo),
    useNegocios({ q, estado: "arquivado", limite: POR_GRUPO }, pausadoInativo),
    useNegocios({ q, estado: "na_lixeira", limite: POR_GRUPO }, pausadoInativo),
  ];
  const conversas = [
    useConversas({ q, limite: POR_GRUPO }, pausadoAtivo),
    useConversas({ q, estado: "na_lixeira", limite: POR_GRUPO }, pausadoInativo),
  ];
  const ligas = (indice: number) => (indice === 0 ? pronta : ligaInativos);
  const consulta = <T,>(resposta: { data: { itens: T[]; total: number } | undefined; isLoading: boolean; error: Error | undefined }, indice: number): ConsultaDoCrm<T> => ({
    liga: ligas(indice),
    dados: resposta.data,
    carregando: resposta.isLoading,
    erro: resposta.error,
  });
  return {
    contatos: reunir(
      contatos.map(consulta),
      (contato: ContatoResumo): Hit => ({
        id: contato.id,
        href: `/crm/contatos/${contato.id}`,
        title: contato.nomeDeExibicao,
        detail: [contato.emailPrincipal, contato.telefonePrincipal].filter(Boolean).join(" · "),
        lifecycle: SELO_DO_ESTADO[contato.estado],
      }),
    ),
    empresas: reunir(
      empresas.map(consulta),
      (empresa: EmpresaResumo): Hit => ({
        id: empresa.id,
        href: `/crm/empresas/${empresa.id}`,
        title: empresa.nomeDeExibicao,
        detail: empresa.dominioPrincipal ?? empresa.documentoPrincipal ?? "",
        lifecycle: SELO_DO_ESTADO[empresa.estado],
      }),
    ),
    negocios: reunir(
      negocios.map(consulta),
      (negocio: NegocioResumo): Hit => ({
        id: negocio.id,
        href: `/crm/negocios/${negocio.id}`,
        title: negocio.titulo,
        detail: [negocio.contato?.nome, negocio.empresa?.nome].filter(Boolean).join(" · "),
        lifecycle: SELO_DO_ESTADO[negocio.estado],
      }),
    ),
    conversas: reunir(
      conversas.map(consulta),
      (conversa: ConversaNaLista): Hit => ({
        id: conversa.id,
        href: `/crm/caixa-de-entrada/${conversa.id}`,
        title: conversa.titulo,
        detail: conversa.contatoNome ?? "",
        lifecycle: SELO_DO_ESTADO[conversa.estado],
      }),
    ),
  };
}

export default function BuscarPage() {
  const state = useData((data) => data);
  const { memberId } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const query = params.get("q") ?? "";
  const [includeInactive, setIncludeInactive] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  // Só no navegador (efeito), e só sem termo: quem já está no campo não sente nada.
  useEffect(() => {
    if (query === "") campo.current?.focus();
  }, [query]);

  const setQuery = (value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set("q", value);
    else next.delete("q");
    router.replace(next.size > 0 ? `/buscar?${next}` : "/buscar", { scroll: false });
  };

  const term = query.trim().toLowerCase();
  const ready = term.length >= MIN_QUERY;

  const crm = useBuscaNoCrm(query, ready, includeInactive);

  const keep = (lifecycle: string): boolean => includeInactive || lifecycle === "ativo";
  const matches = (...fields: ReadonlyArray<string | undefined>): boolean =>
    fields.some((field) => field !== undefined && field.toLowerCase().includes(term));

  const groups: ReadonlyArray<{ readonly label: string; readonly hits: readonly Hit[]; readonly total?: number }> = !ready
    ? []
    : [
        {
          label: "Tarefas",
          hits: state.tasks
            .filter((task) => memberSeesTask(state, memberId, task.id))
            .filter((task) => keep(task.lifecycle) && matches(task.title, task.readableId, task.description))
            .map((task) => ({
              id: task.id,
              href: `/estrutura/tarefas/${task.id}`,
              title: task.title,
              detail: state.lists.find((l) => l.id === task.listId)?.name ?? "",
              lifecycle: task.lifecycle,
            })),
        },
        {
          label: "Listas",
          hits: state.lists
            .filter((list) => memberReachesContainer(state, memberId, "list", list.id))
            .filter((list) => keep(list.lifecycle) && matches(list.name, list.description))
            .map((list) => ({
              id: list.id,
              href: `/estrutura/listas/${list.id}`,
              title: list.name,
              detail: list.description ?? "",
              lifecycle: list.lifecycle,
            })),
        },
        { label: "Contatos", hits: crm.contatos.hits, total: crm.contatos.total },
        { label: "Empresas", hits: crm.empresas.hits, total: crm.empresas.total },
        { label: "Negócios", hits: crm.negocios.hits, total: crm.negocios.total },
        { label: "Conversas", hits: crm.conversas.hits, total: crm.conversas.total },
        {
          label: "Documentos",
          hits: state.documents
            .filter(
              (document) =>
                keep(document.lifecycle) && matches(document.title, document.metadata.summary),
            )
            .map((document) => ({
              id: document.id,
              href: `/ia/conhecimento/documentos/${document.id}`,
              title: document.title,
              detail: state.collections.find((c) => c.id === document.collectionId)?.name ?? "",
              lifecycle: document.lifecycle,
            })),
        },
        {
          label: "Agentes",
          hits: state.agents
            .filter((agent) => keep(agent.lifecycle) && matches(agent.name, agent.description))
            .map((agent) => ({
              id: agent.id,
              href: `/ia/agentes/${agent.id}`,
              title: agent.name,
              detail: agent.description ?? "",
              lifecycle: agent.lifecycle,
            })),
        },
        {
          label: "Automações",
          hits: state.automations
            .filter((automation) => keep(automation.lifecycle) && matches(automation.name))
            .map((automation) => ({
              id: automation.id,
              href: `/ia/automacoes/${automation.id}`,
              title: automation.name,
              detail: automation.description ?? "",
              lifecycle: automation.lifecycle,
            })),
        },
      ].filter((group) => group.hits.length > 0);

  const countOf = (group: { readonly hits: readonly Hit[]; readonly total?: number }): number => group.total ?? group.hits.length;
  const total = groups.reduce((sum, group) => sum + countOf(group), 0);
  const consultando = ready && [crm.contatos, crm.empresas, crm.negocios, crm.conversas].some((grupo) => grupo.carregando);
  const recusaDoCrm = ready ? [crm.contatos, crm.empresas, crm.negocios, crm.conversas].find((grupo) => grupo.erro !== undefined)?.erro : undefined;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Buscar"
        meta={ready && total > 0 ? `${total} resultado(s) em ${groups.length} família(s)` : undefined}
      />

      {/* O termo e o recorte vivem na barra de filtros, onde o sistema põe a busca. */}
      <BarraDeFiltros>
        <label className="relative min-w-0 flex-1" style={{ maxWidth: "32rem" }}>
          <span className="sr-only">Termo</span>
          <Icone
            de={Search}
            tamanho="xs"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--texto-4)" }}
          />
          <input
            ref={campo}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nome, identificador legível, conteúdo"
            className="campo pl-9"
            style={{ height: "var(--controle-h-sm)" }}
          />
        </label>
        <label className="app-base flex items-center gap-2 text-[var(--texto)]">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(event) => setIncludeInactive(event.target.checked)}
            className="accent-[var(--acento)]"
            style={{ width: "var(--caixa-tam)", height: "var(--caixa-tam)" }}
          />
          Incluir arquivados e na lixeira
        </label>
      </BarraDeFiltros>

      <CorpoDeTela>
        {recusaDoCrm ? (
          <Toast tone="error">Não foi possível buscar no CRM: {recusaDoCrm.message}</Toast>
        ) : null}
        {!ready ? (
          <EmptyState
            title="Escreva ao menos duas letras."
            hint="A busca cobre Tarefas, Listas, Contatos, Empresas, Negócios, Conversas, Documentos, Agentes e Automações."
          />
        ) : total === 0 && consultando ? (
          <p className="app-meta px-1" role="status">
            Buscando…
          </p>
        ) : total === 0 ? (
          <EmptyState
            title={`Nada encontrado para "${query.trim()}".`}
            hint={
              includeInactive
                ? "Nenhum registro visível para você corresponde a este termo."
                : "Registros arquivados e na lixeira estão fora desta busca. Marque a opção acima para incluí-los."
            }
          />
        ) : (
          groups.map((group) => (
            <Section key={group.label} title={group.label} count={countOf(group)}>
              <ul className="cascata pilha-solta">
                {group.hits.slice(0, POR_GRUPO).map((hit) => (
                  <li key={hit.id}>
                    <Link href={hit.href} className="item-solto" data-bloco="true">
                      <span className="flex items-center gap-2">
                        <span className="app-md truncate text-[var(--texto)]">{hit.title}</span>
                        <StateSeal state={hit.lifecycle} />
                      </span>
                      {hit.detail ? (
                        <span className="app-sm block truncate text-[var(--texto-3)]">{hit.detail}</span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
              {countOf(group) > POR_GRUPO ? (
                <p className="app-meta app-numero px-1 pt-2">
                  Mostrando {POR_GRUPO} de {countOf(group)}. Refine o termo para ver o restante.
                </p>
              ) : null}
            </Section>
          ))
        )}
      </CorpoDeTela>
    </div>
  );
}
