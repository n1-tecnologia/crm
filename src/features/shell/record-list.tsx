"use client";

/**
 * A LISTAGEM GENÉRICA das telas-índice: Contatos, Empresas, Funis, Tarefas,
 * Agentes, Automações, Conhecimento, Habilidades, Painéis, Estrutura.
 *
 * É a `.tabela` do sistema: cada linha é uma peça com contorno, raio e vão,
 * o cabeçalho de colunas é fixo e o rodapé diz o corte. Every column is an
 * attribute the ontology defines; nothing is invented here.
 *
 * §15 dos padrões — a collection that grows carries ordering and pagination;
 * a silent `slice` that hides rows is a defect, so the count is always stated.
 *
 * Com `hrefOf`, a LINHA INTEIRA abre o registro, como na tabela de Tarefas
 * (2026-09-28, nos Grupos das Ferramentas: "ela deve se comportar como as
 * outras, em qualquer parte dela que eu clicar ela deve abrir"). Um clique
 * que nasce num controle (link, botão, campo, menu) é dele; arrastar para
 * selecionar texto não abre; Ctrl/Cmd abre numa aba nova. O teclado continua
 * pelo link do nome, na primeira coluna.
 */

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Button, EmptyState } from "./ui";
import { useNavegar } from "./navegacao";
import { useRecente } from "./recente";

export interface Column<T> {
  readonly key: string;
  readonly label: string;
  readonly render: (item: T) => ReactNode;
  readonly className?: string;
}

const PAGE_SIZE = 25;

/** O que, clicado dentro da linha, é do próprio controle — não abre o registro. */
const CONTROLES = "a, button, input, select, textarea, label, [role=menu], [role=listbox], [role=dialog]";

export function RecordList<T extends { readonly id: string }>({
  items,
  columns,
  hrefOf,
  emptyTitle,
  emptyHint,
  emptyAction,
}: {
  readonly items: readonly T[];
  readonly columns: ReadonlyArray<Column<T>>;
  readonly hrefOf?: (item: T) => string;
  readonly emptyTitle: string;
  readonly emptyHint?: string;
  readonly emptyAction?: ReactNode;
}) {
  const [shown, setShown] = useState(PAGE_SIZE);
  // Só a linha do último resultado acende (`data-recente`), por --dur-realce.
  const recente = useRecente();
  const [navegar] = useNavegar();

  if (items.length === 0) {
    return <EmptyState title={emptyTitle} {...(emptyHint ? { hint: emptyHint } : {})} {...(emptyAction ? { action: emptyAction } : {})} />;
  }

  const visible = items.slice(0, shown);

  // ARMADILHA: um wrapper com `overflow-x: auto` vira contêiner de rolagem nos
  // DOIS eixos, e aí o `thead` fixo passa a grudar num box de altura automática
  // — ou seja, não gruda em nada. Quem rola é o corpo da tela.
  return (
    <div>
      <table className="tabela">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={`app-coluna ${column.className ?? ""}`}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="cascata">
          {visible.map((item) => (
            <tr
              key={item.id}
              data-recente={item.id === recente ? "true" : undefined}
              className={hrefOf ? "cursor-pointer" : undefined}
              onClick={
                hrefOf
                  ? (event) => {
                      if ((event.target as HTMLElement).closest(CONTROLES)) return;
                      if (window.getSelection()?.toString()) return;
                      const href = hrefOf(item);
                      if (event.metaKey || event.ctrlKey) {
                        window.open(href, "_blank", "noopener");
                        return;
                      }
                      navegar(href);
                    }
                  : undefined
              }
            >
              {columns.map((column, index) => (
                <td key={column.key} className={column.className}>
                  {index === 0 && hrefOf ? (
                    <Link href={hrefOf(item)} className="app-md hover:underline" style={{ color: "var(--texto)" }}>
                      {column.render(item)}
                    </Link>
                  ) : (
                    column.render(item)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex items-center justify-between gap-4 px-1 pt-2">
        <span className="app-meta app-numero">
          Mostrando {visible.length} de {items.length}
        </span>
        {shown < items.length ? (
          <Button variant="ghost" size="sm" onClick={() => setShown((value) => value + PAGE_SIZE)}>
            Mostrar mais
          </Button>
        ) : null}
      </div>
    </div>
  );
}
