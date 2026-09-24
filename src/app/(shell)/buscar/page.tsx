"use client";

/**
 * T04 — Busca global. One field over every family, grouped by entity.
 *
 * The term lives in `?q=` (MAPA-DE-NAVEGACAO) so a search is shareable, comes
 * back on reload and lands in the browser history — three things a term kept in
 * component state loses.
 *
 * B103 — the search never reveals what a permission hides, and it never
 * confuses "nothing found" with "no access": a container the Member cannot see
 * simply does not enter the result set, and the screen says how many families
 * were searched so the absence is legible.
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
import { useData } from "@/data/store";
import { contactDisplayName } from "@/data/derive";
import { BarraDeFiltros, CorpoDeTela, EmptyState, Icone, PageHeader, Section, StateSeal } from "@/features/shell/ui";

interface Hit {
  readonly id: string;
  readonly href: string;
  readonly title: string;
  readonly detail: string;
  readonly lifecycle: string;
}

const MIN_QUERY = 2;

export default function BuscarPage() {
  const state = useData((data) => data);
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

  const keep = (lifecycle: string): boolean => includeInactive || lifecycle === "ativo";
  const matches = (...fields: ReadonlyArray<string | undefined>): boolean =>
    fields.some((field) => field !== undefined && field.toLowerCase().includes(term));

  const groups: ReadonlyArray<{ readonly label: string; readonly hits: readonly Hit[] }> = !ready
    ? []
    : [
        {
          label: "Tarefas",
          hits: state.tasks
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
            .filter((list) => keep(list.lifecycle) && matches(list.name, list.description))
            .map((list) => ({
              id: list.id,
              href: `/estrutura/listas/${list.id}`,
              title: list.name,
              detail: list.description ?? "",
              lifecycle: list.lifecycle,
            })),
        },
        {
          label: "Contatos",
          hits: state.contacts
            .filter(
              (contact) =>
                keep(contact.lifecycle) &&
                (matches(contact.firstName, contact.lastName) ||
                  contact.identifiers.some((identifier) => matches(identifier.displayValue))),
            )
            .map((contact) => ({
              id: contact.id,
              href: `/crm/contatos/${contact.id}`,
              title: contactDisplayName(contact),
              detail: contact.identifiers.map((identifier) => identifier.displayValue).join(" · "),
              lifecycle: contact.lifecycle,
            })),
        },
        {
          label: "Empresas",
          hits: state.companies
            .filter((company) => keep(company.lifecycle) && matches(company.legalName, company.tradeName))
            .map((company) => ({
              id: company.id,
              href: `/crm/empresas/${company.id}`,
              title: company.legalName,
              detail: company.tradeName ?? "",
              lifecycle: company.lifecycle,
            })),
        },
        {
          label: "Negócios",
          hits: state.deals
            .filter((deal) => keep(deal.lifecycle) && matches(deal.title, deal.readableId, deal.object))
            .map((deal) => ({
              id: deal.id,
              href: `/crm/negocios/${deal.id}`,
              title: deal.title,
              detail: state.funnels.find((f) => f.id === deal.funnelId)?.name ?? "",
              lifecycle: deal.lifecycle,
            })),
        },
        {
          label: "Conversas",
          hits: state.conversations
            .filter(
              (conversation) =>
                keep(conversation.lifecycle) &&
                (matches(conversation.title) ||
                  conversation.messages.some(
                    (message) => message.deletionMark === undefined && matches(message.content),
                  )),
            )
            .map((conversation) => ({
              id: conversation.id,
              href: `/crm/caixa-de-entrada/${conversation.id}`,
              title: conversation.title,
              detail: state.channels.find((c) => c.id === conversation.channelId)?.name ?? "",
              lifecycle: conversation.lifecycle,
            })),
        },
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

  const total = groups.reduce((sum, group) => sum + group.hits.length, 0);

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
        {!ready ? (
          <EmptyState
            title="Escreva ao menos duas letras."
            hint="A busca cobre Tarefas, Listas, Contatos, Empresas, Negócios, Conversas, Documentos, Agentes e Automações."
          />
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
            <Section key={group.label} title={group.label} count={group.hits.length}>
              <ul className="cascata pilha-solta">
                {group.hits.slice(0, 10).map((hit) => (
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
              {group.hits.length > 10 ? (
                <p className="app-meta app-numero px-1 pt-2">
                  Mostrando 10 de {group.hits.length}. Refine o termo para ver o restante.
                </p>
              ) : null}
            </Section>
          ))
        )}
      </CorpoDeTela>
    </div>
  );
}
