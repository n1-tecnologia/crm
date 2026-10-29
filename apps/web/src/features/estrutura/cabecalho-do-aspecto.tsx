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
 * quantos o nível define e quantos herda.
 *
 * 2.6.5 item 7, D-15, D-16 — Espaço e Pasta/Subpasta ganham, na mesma faixa, o
 * interruptor «Bloquear para os níveis abaixo» (`InterruptorDeBloqueio`). A Lista
 * nunca o mostra (D-15: ela não bloqueia). A tela não decide a regra: chama
 * `setContainerBlock` e mostra a frase que o domínio devolver.
 */

import { Lock } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { useData, useRunConfirmado, useSession } from "@/dados/store";
import {
  bloqueioAcima,
  containerAdminRefusal,
  contagemAcumulada,
  effectiveLifecycleOfContainer,
  origemDoAspecto,
} from "@n1/dominio/derive";
import { setContainerBlock } from "@n1/dominio/operations";
import { blockedAbove } from "@n1/dominio/operations/configuration";
import { ReadOnlyNote } from "@/features/estrutura/configuration-editors";
import { Icone, Pilula, Toast, Toggle } from "@/features/shell/ui";
import type { DataState } from "@n1/dominio/state";
import type { ConfigurableAspect, Id } from "@n1/dominio/types";

type TipoDeConteiner = "space" | "folder" | "list";

/** "Subpasta" é a Pasta que mora dentro de outra Pasta: o dado é o mesmo, a palavra muda. */
function palavraDoTipo(state: DataState, tipo: "space" | "folder", id: Id): "Espaço" | "Pasta" | "Subpasta" {
  if (tipo === "space") return "Espaço";
  return state.folders.find((f) => f.id === id)?.parentType === "folder" ? "Subpasta" : "Pasta";
}

/** O nome do aspecto no Toast, com a concordância fixada pelo UI-SPEC («Aspecto × frase»). */
const FRASE_DO_BLOQUEIO: Partial<Record<ConfigurableAspect, { readonly bloquear: string; readonly liberar: string }>> = {
  statusSet: {
    bloquear: "Conjunto de Status bloqueado para os níveis abaixo.",
    liberar: "Conjunto de Status liberado para os níveis abaixo.",
  },
  features: {
    bloquear: "Funcionalidades bloqueadas para os níveis abaixo.",
    liberar: "Funcionalidades liberadas para os níveis abaixo.",
  },
  defaultViews: {
    bloquear: "Visualizações padrão bloqueadas para os níveis abaixo.",
    liberar: "Visualizações padrão liberadas para os níveis abaixo.",
  },
  fieldDefinitions: {
    bloquear: "Campos bloqueados para os níveis abaixo.",
    liberar: "Campos liberados para os níveis abaixo.",
  },
  taskTypes: {
    bloquear: "Tipos de Tarefa bloqueados para os níveis abaixo.",
    liberar: "Tipos de Tarefa liberados para os níveis abaixo.",
  },
};

/**
 * D-16 — Espaço ou Pasta/Subpasta bloqueia o aspecto para os níveis abaixo. A
 * tela desliga o controle onde a operação recusaria (sem permissão, contêiner
 * inativo, ancestral já bloqueando) e deixa a operação decidir o resto: uma
 * recusa vira `Toast tone="error"` com a frase do domínio, e o interruptor fica
 * onde estava. Gravando, ele fica desligado até o servidor responder.
 */
export function InterruptorDeBloqueio({
  tipo,
  id,
  aspecto,
}: {
  readonly tipo: "space" | "folder";
  readonly id: Id;
  readonly aspecto: ConfigurableAspect;
}) {
  const state = useData((data) => data);
  const { memberId } = useSession();
  const runConfirmado = useRunConfirmado();
  const rotuloId = useId();
  const motivoId = useId();
  const [gravando, setGravando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const container = tipo === "space" ? state.spaces.find((s) => s.id === id) : state.folders.find((f) => f.id === id);
  if (!container) return null;

  const ligado = container.blocks[aspecto] === true;
  const efetivo = effectiveLifecycleOfContainer(state, tipo, id);
  const palavra = palavraDoTipo(state, tipo, id);
  const feminino = tipo === "folder";
  const motivoDePermissao =
    containerAdminRefusal(state, memberId, tipo, id) ??
    (efetivo === "arquivado"
      ? `${palavra} ${feminino ? "arquivada" : "arquivado"}: desarquive antes de editar.`
      : efetivo === "naLixeira"
        ? `${palavra} na lixeira: restaure antes de editar.`
        : undefined);
  const bloqueadoAcima = bloqueioAcima(state, tipo, id, aspecto) !== undefined;

  const alternar = (proximo: boolean): void => {
    setAviso(null);
    setErro(null);
    const { local, confirmado } = runConfirmado((data, me) => setContainerBlock(data, me, tipo, id, aspecto, proximo));
    if (!local.ok) {
      setErro(local.error ?? "Não foi possível concluir a operação.");
      return;
    }
    setGravando(true);
    void confirmado.then((resposta) => {
      setGravando(false);
      if (resposta.ok) setAviso(FRASE_DO_BLOQUEIO[aspecto]?.[proximo ? "bloquear" : "liberar"] ?? "Bloqueio alterado.");
      else setErro(resposta.error ?? "Não foi possível concluir a operação.");
    });
  };

  const desligado = gravando || motivoDePermissao !== undefined || bloqueadoAcima;

  return (
    <>
      <div className="ml-auto flex items-center gap-2">
        <span id={rotuloId} className="app-base" style={{ color: "var(--texto-2)" }}>
          Bloquear para os níveis abaixo
        </span>
        <Toggle
          checked={ligado}
          onChange={alternar}
          labelledBy={rotuloId}
          {...(motivoDePermissao ? { describedBy: motivoId } : {})}
          disabled={desligado}
        />
      </div>
      {motivoDePermissao ? (
        <div id={motivoId} className="basis-full">
          <ReadOnlyNote reason={motivoDePermissao} />
        </div>
      ) : null}
      {aviso ? (
        <div className="basis-full">
          <Toast tone="success" onDismiss={() => setAviso(null)}>
            {aviso}
          </Toast>
        </div>
      ) : null}
      {erro ? (
        <div className="basis-full">
          <Toast tone="error" onDismiss={() => setErro(null)}>
            {erro}
          </Toast>
        </div>
      ) : null}
    </>
  );
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
      {tipo === "list" ? null : <InterruptorDeBloqueio tipo={tipo} id={id} aspecto={aspecto} />}
      {frase ? (
        <div className="basis-full">
          <ReadOnlyNote reason={frase} />
        </div>
      ) : null}
    </div>
  );
}
