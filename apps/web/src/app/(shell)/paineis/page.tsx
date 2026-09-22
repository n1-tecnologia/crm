"use client";

import Link from "next/link";
import { useData } from "@/dados/store";
import type { Panel } from "@n1/dominio/types";
import { CampoDeLanterna } from "@/design/lanterna";
import { Selo } from "@/features/estrutura/icone-de-tipo";
import { ICONE_DE_ANCORA, ICONE_DE_VISTA } from "@/features/paineis/graficos";
import { RESOURCE_TYPE_LABEL } from "@/features/shell/format";
import {
  ActorAvatar,
  CorpoDeTela,
  EmptyState,
  Icone,
  PageHeader,
  StateSeal,
} from "@/features/shell/ui";

/** Quantos widgets a peça mostra antes de resumir o resto num "+N". */
const PREVIA = 4;
/** Teto de lanternas por grade: cada uma custa um `getBoundingClientRect` por quadro de ponteiro. */
const LANTERNAS_POR_GRADE = 12;

export default function PaineisPage() {
  const state = useData((data) => data);
  const items = state.panels.filter((p) => p.lifecycle !== "naLixeira");

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Painéis"
        meta={`${items.length} ${items.length === 1 ? "Painel" : "Painéis"}`}
      />
      <CorpoDeTela>
        {items.length === 0 ? (
          <EmptyState
            title="Nenhum Painel ainda."
            hint="Um Painel lê as entidades com as permissões de quem o consulta e nunca guarda dados."
          />
        ) : (
          /*
           * Galeria, não tabela: um Painel se reconhece pelo que ele mostra, e
           * quatro linhas de "Nome · Âncora · 5" não dizem isso. Cada peça
           * traz a âncora, a prévia dos widgets e quem responde por ele.
           */
          <CampoDeLanterna className="@container">
            <ul className="cascata grade-solta @2xl:grid-cols-2 @5xl:grid-cols-3" data-chegada="foco">
              {items.map((panel, i) => (
                <li key={panel.id}>
                  <PecaDePainel
                    panel={panel}
                    indice={i}
                    dono={
                      state.members.find((m) => m.id === panel.ownerMemberId)
                        ?.displayName ?? "—"
                    }
                  />
                </li>
              ))}
            </ul>
          </CampoDeLanterna>
        )}
      </CorpoDeTela>
    </div>
  );
}

function PecaDePainel({
  panel,
  dono,
  indice,
}: {
  readonly panel: Panel;
  readonly dono: string;
  readonly indice: number;
}) {
  const tipo = panel.anchor?.type ?? "workspace";
  const escondidos = panel.widgets.length - PREVIA;
  // A peça é Link: flutua no hover e acende a lanterna (só as 12 primeiras).
  return (
    <Link
      href={`/paineis/${panel.id}`}
      className={indice < LANTERNAS_POR_GRADE ? "item-solto flutua lanterna h-full" : "item-solto flutua h-full"}
      data-bloco="true"
    >
      {/* A peça de bloco é `display: block`; a coluna flex fica dentro, para o
          rodapé descer ao pé da peça quando a vizinha é mais alta. */}
      <span className="flex h-full flex-col">
        <span className="flex items-start gap-3">
          <Selo
            icone={ICONE_DE_ANCORA[tipo]}
            cor="var(--acento)"
            lavado="var(--acento-lavado)"
          />
          <span className="min-w-0 flex-1">
            <span
              className="app-md block truncate"
              style={{ color: "var(--texto)" }}
            >
              {panel.name}
            </span>
            <span className="app-meta block truncate">
              {panel.anchor
                ? `${RESOURCE_TYPE_LABEL[tipo] ?? tipo} · ${panel.anchor.nameAtTheTime}`
                : "Espaço de Trabalho inteiro"}
            </span>
          </span>
          <StateSeal state={panel.lifecycle} />
        </span>

        {panel.widgets.length === 0 ? (
          <span
            className="app-sm mt-3 mb-3 block"
            style={{ color: "var(--texto-3)" }}
          >
            Sem widgets.
          </span>
        ) : (
          <ul className="mt-3 mb-3 flex flex-col gap-1">
            {panel.widgets.slice(0, PREVIA).map((widget) => (
              <li
                key={widget.id}
                className="app-sm flex min-w-0 items-center gap-2"
                style={{ color: "var(--texto-2)" }}
              >
                <Icone
                  de={ICONE_DE_VISTA[widget.viewType]}
                  tamanho="xs"
                  style={{ color: "var(--texto-4)" }}
                />
                <span className="truncate">{widget.title}</span>
              </li>
            ))}
            {escondidos > 0 ? (
              <li className="app-meta app-numero pl-6">
                +{escondidos} {escondidos === 1 ? "widget" : "widgets"}
              </li>
            ) : null}
          </ul>
        )}

        <span
          className="app-meta mt-auto flex items-center justify-between gap-2 border-t pt-3"
          style={{ borderColor: "var(--linha-sutil)" }}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <ActorAvatar kind="member" name={dono} />
            <span className="truncate">{dono}</span>
          </span>
          <span className="app-numero shrink-0">
            {panel.widgets.length}{" "}
            {panel.widgets.length === 1 ? "widget" : "widgets"}
          </span>
        </span>
      </span>
    </Link>
  );
}
