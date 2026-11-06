"use client";

/**
 * T46 — Catálogos.
 *
 * B34 — the catalogues are instantiated with the workspace and remain editable.
 * B54 — only a `finalidadeConsentimento` carries "exige consentimento para
 * enviar", and that flag is what makes a send be refused, so it is shown as a
 * consequence and not as a checkbox label.
 */

import Link from "next/link";
import { useData } from "@/dados/store";
import { CorpoDeTela, EmptyState, PageHeader, Pilula, Section, StateSeal } from "@/features/shell/ui";
import type { CatalogItem } from "@n1/dominio/types";

const KINDS: ReadonlyArray<{
  readonly kind: CatalogItem["kind"];
  readonly title: string;
  readonly description: string;
}> = [
  {
    kind: "origem",
    title: "Origens",
    description: "De onde o Contato ou o Negócio veio. O Canal pode definir uma Origem padrão.",
  },
  {
    kind: "qualificacao",
    title: "Qualificações",
    description: "Como o Contato foi classificado pela equipe.",
  },
  {
    kind: "finalidadeConsentimento",
    title: "Finalidades de Consentimento",
    description: "Para que o Contato autorizou ser contatado. Uma finalidade pode exigir consentimento antes do envio.",
  },
  {
    kind: "motivoPerda",
    title: "Motivos de Perda",
    description: "Por que um Negócio foi perdido. Um Funil pode exigir um deles ao encerrar.",
  },
  {
    kind: "motivoGanho",
    title: "Motivos de Ganho",
    description: "Por que um Negócio foi ganho.",
  },
];

/**
 * Origens, qualificações, finalidades e motivos só são usados por Contato e Negócio, que
 * moram nas tabelas do CRM (D-15-13, 3.4.7): contar no estado do CRM antigo mostraria
 * um número que não é o do Espaço. Em vez de um "0" falso, a tela diz que não conta.
 */
const USO_NO_CRM = "O uso no CRM não aparece aqui.";

export default function CatalogosPage() {
  const state = useData((data) => data);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        path={
          <Link href="/configuracoes" className="hover:underline">
            Configurações
          </Link>
        }
        title="Catálogos"
        meta={`${state.catalog.length} item(ns)`}
      />

      <CorpoDeTela>
        {KINDS.map((group) => {
          const items = state.catalog
            .filter((item) => item.kind === group.kind)
            .sort((a, b) => a.order - b.order);
          return (
            <Section key={group.kind} title={group.title} count={items.length}>
              <p className="app-meta mb-2">{group.description}</p>
              {items.length === 0 ? (
                <EmptyState title={`Nenhum item em ${group.title}.`} />
              ) : (
                <ul className="pilha-solta">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className="item-solto justify-between"
                      data-estatico="true"
                      data-atenuado={item.lifecycle === "ativo" ? undefined : "true"}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {item.color ? (
                          <span aria-hidden="true" className="pilula-ponto" style={{ background: item.color }} />
                        ) : null}
                        <span className="app-base truncate" style={{ color: "var(--texto)" }}>
                          {item.name}
                        </span>
                        {item.seeded ? (
                          <Pilula tom="neutro" className="shrink-0">
                            veio com o Espaço
                          </Pilula>
                        ) : null}
                        {item.requiresConsentToSend ? (
                          <Pilula tom="aviso" className="shrink-0">
                            sem consentimento, o envio é recusado
                          </Pilula>
                        ) : null}
                      </span>
                      <span className="app-meta flex shrink-0 items-center gap-3">
                        {USO_NO_CRM}
                        {item.lifecycle === "ativo" ? null : <StateSeal state={item.lifecycle} />}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          );
        })}
      </CorpoDeTela>
    </div>
  );
}
