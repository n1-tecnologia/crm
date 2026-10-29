"use client";

/**
 * 2.1.8, D-16 — a linha de origem no topo de cada aba de aspecto das
 * Configurações. Uma só pergunta respondida em uma linha: DE ONDE vem o valor
 * desta aba, ou QUEM o bloqueia. A tela não decide nada: lê `origemDoAspecto`,
 * `contagemAcumulada` e `bloqueioAcima` do domínio, e a frase de recusa é a que
 * a operação devolveria (`blockedAbove`) — as duas nunca divergem.
 *
 * Aspectos que SUBSTITUEM (Conjunto de Status, Funcionalidades, Visualizações
 * padrão) mostram a origem; os que ACUMULAM (Campos, Tipos de Tarefa) mostram
 * quantos o nível define e quantos herda. `direita` recebe o interruptor de
 * bloqueio, que entra em 10-11.
 */

import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { useData } from "@/dados/store";
import { bloqueioAcima, contagemAcumulada, origemDoAspecto } from "@n1/dominio/derive";
import { blockedAbove } from "@n1/dominio/operations/configuration";
import { ReadOnlyNote } from "@/features/estrutura/configuration-editors";
import { Icone, Pilula } from "@/features/shell/ui";
import type { DataState } from "@n1/dominio/state";
import type { ConfigurableAspect, Id } from "@n1/dominio/types";

type TipoDeConteiner = "space" | "folder" | "list";

/** "Subpasta" é a Pasta que mora dentro de outra Pasta: o dado é o mesmo, a palavra muda. */
function palavraDoTipo(state: DataState, tipo: "space" | "folder", id: Id): "Espaço" | "Pasta" | "Subpasta" {
  if (tipo === "space") return "Espaço";
  return state.folders.find((f) => f.id === id)?.parentType === "folder" ? "Subpasta" : "Pasta";
}

export function CabecalhoDoAspecto({
  tipo,
  id,
  aspecto,
  direita,
}: {
  readonly tipo: TipoDeConteiner;
  readonly id: Id;
  readonly aspecto: ConfigurableAspect;
  readonly direita?: ReactNode;
}) {
  const state = useData((data) => data);
  const bloqueio = bloqueioAcima(state, tipo, id, aspecto);
  const frase = bloqueio ? blockedAbove(state, tipo, id, aspecto) : undefined;

  let origem: ReactNode = null;
  let defineAqui = false;
  if (aspecto === "statusSet" || aspecto === "features" || aspecto === "defaultViews") {
    const lida = origemDoAspecto(state, tipo, id, aspecto);
    defineAqui = lida.origem === "aqui";
    if (lida.origem === "aqui") {
      origem = <Pilula tom="info"><span className="min-w-0 truncate">Definido aqui</span></Pilula>;
    } else if (lida.origem === "herdado") {
      origem = (
        <Pilula tom="neutro" className="max-w-full">
          <span className="min-w-0 truncate">{`Herdado de ${palavraDoTipo(state, lida.de.tipo, lida.de.id)} ${lida.de.nome}`}</span>
        </Pilula>
      );
    } else {
      origem = <Pilula tom="neutro"><span className="min-w-0 truncate">Padrão da plataforma</span></Pilula>;
    }
  } else if (aspecto === "fieldDefinitions" || aspecto === "taskTypes") {
    const { aqui, herdados } = contagemAcumulada(state, tipo, id, aspecto);
    origem = (
      <span className="app-base" style={{ color: "var(--texto-2)" }}>
        {`${aqui} ${aqui === 1 ? "definido" : "definidos"} aqui · ${herdados} ${herdados === 1 ? "herdado" : "herdados"}`}
      </span>
    );
    defineAqui = true; // a contagem é informação própria, não uma "origem" que o bloqueio substitui
  }

  // O bloqueio vem NO LUGAR da origem; só convive com ela se o nível também define (dado antigo) ou se é contagem.
  const mostraOrigem = bloqueio === undefined || defineAqui;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {bloqueio ? (
        <Pilula tom="aviso" className="max-w-full">
          <Icone de={Lock} tamanho="xs" />
          <span className="min-w-0 truncate">{`Bloqueado por ${palavraDoTipo(state, bloqueio.tipo, bloqueio.id)} ${bloqueio.nome}`}</span>
        </Pilula>
      ) : null}
      {mostraOrigem ? origem : null}
      {direita ? <div className="ml-auto">{direita}</div> : null}
      {frase ? (
        <div className="basis-full">
          <ReadOnlyNote reason={frase} />
        </div>
      ) : null}
    </div>
  );
}
