"use client";

/**
 * D-10 / D-11 (2.3.3) — "Mover para…": o diálogo que muda uma Pasta, Subpasta
 * ou Lista de lugar, aberto por `?mover=<id>` (e, vindo do arrastar, por
 * `&destino=<id>`), no molde de `useMoveTaskDialog` e `useCreateContainerDialog`.
 *
 * Quem decide é o domínio. As opções do destino chegam desligadas com a frase
 * de `recusaDeMover`, a tabela de Status vem de `consequenciasDeMover` e o
 * gravar é `moveContainer` por `runConfirmado`: o sucesso só aparece depois que
 * o servidor respondeu, porque a cópia local pode não ver todas as Tarefas
 * (Pitfall 6) e o servidor pode recusar o que ela aceitou.
 *
 * O mapeamento de Status é por Status de ORIGEM, não por Tarefa — como em
 * `move-task-dialog.tsx`, que continua com a categoria crua e não é editado
 * aqui (A12): a categoria deste diálogo aparece por extenso.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useData, useRunConfirmado, useSession } from "@/dados/store";
import { containerPath, effectiveContainerConfig, memberReachesContainer } from "@n1/dominio/derive";
import {
  consequenciasDeMover,
  moveContainer,
  recusaDeMover,
  type DestinoDeMover,
  type StatusMapping,
} from "@n1/dominio/operations";
import { STATUS_CATEGORY_LABEL } from "@/features/shell/format";
import { ConfirmDialog, Field, Select, type Option } from "@/features/shell/ui";
import type { ConsequenciasDeMover } from "@n1/dominio/operations";
import type { DataState } from "@n1/dominio/state";
import type { Folder, Id, List } from "@n1/dominio/types";

export const MOVER_PARAM = "mover";
export const DESTINO_PARAM = "destino";

export function useMoverConteinerDialog(): {
  readonly movendo: { readonly id: Id; readonly destinoId?: Id } | null;
  readonly openMover: (id: Id, destinoId?: Id) => void;
  readonly closeMover: () => void;
} {
  const router = useRouter();
  const query = useSearchParams();
  const pathname = typeof window === "undefined" ? "" : window.location.pathname;

  const id = query.get(MOVER_PARAM);
  const destinoId = query.get(DESTINO_PARAM);

  return {
    movendo: id ? { id, ...(destinoId ? { destinoId } : {}) } : null,
    openMover: (alvo, destino) => {
      const next = new URLSearchParams(query.toString());
      next.set(MOVER_PARAM, alvo);
      if (destino) next.set(DESTINO_PARAM, destino);
      else next.delete(DESTINO_PARAM);
      router.replace(`${pathname}?${next}`, { scroll: false });
    },
    closeMover: () => {
      const next = new URLSearchParams(query.toString());
      next.delete(MOVER_PARAM);
      next.delete(DESTINO_PARAM);
      router.replace(next.size > 0 ? `${pathname}?${next}` : pathname, { scroll: false });
    },
  };
}

type Movel = { readonly tipo: "folder"; readonly item: Folder } | { readonly tipo: "list"; readonly item: List };

/** O que o `?mover=` aponta: Pasta, Subpasta ou Lista que o Membro alcança. Id desconhecido não abre nada (T-10-31). */
function acharMovel(state: DataState, memberId: Id, id: Id): Movel | undefined {
  const pasta = state.folders.find((f) => f.id === id);
  if (pasta && memberReachesContainer(state, memberId, "folder", id)) return { tipo: "folder", item: pasta };
  const lista = state.lists.find((l) => l.id === id);
  if (lista && memberReachesContainer(state, memberId, "list", id)) return { tipo: "list", item: lista };
  return undefined;
}

const capitalizar = (texto: string): string => (texto === "" ? texto : texto.charAt(0).toUpperCase() + texto.slice(1));
const categoriaPorExtenso = (categoria: string): string => capitalizar(STATUS_CATEGORY_LABEL[categoria] ?? categoria);

/** Os ids de todas as Pastas abaixo de uma Pasta (ela não vai para dentro de si nem de quem mora nela). */
function pastasAbaixo(state: DataState, pastaId: Id): Set<Id> {
  const abaixo = new Set<Id>();
  const visitar = (paiId: Id) => {
    for (const filha of state.folders) {
      if (filha.parentType === "folder" && filha.parentId === paiId && !abaixo.has(filha.id)) {
        abaixo.add(filha.id);
        visitar(filha.id);
      }
    }
  };
  visitar(pastaId);
  return abaixo;
}

const valorDoDestino = (destino: DestinoDeMover): string => `${destino.parentType}:${destino.parentId}`;

function lerDestino(valor: string): DestinoDeMover | undefined {
  const [parentType, parentId] = valor.split(":");
  if ((parentType !== "space" && parentType !== "folder") || !parentId) return undefined;
  return { parentType, parentId };
}

/** O destino que o `&destino=<id>` aponta, já no formato do `Select` (Espaço ou Pasta). */
function destinoDoId(state: DataState, id: Id | undefined): string {
  if (!id) return "";
  if (state.spaces.some((s) => s.id === id)) return `space:${id}`;
  if (state.folders.some((f) => f.id === id)) return `folder:${id}`;
  return "";
}

/**
 * Os Espaços, Pastas e Subpastas ativos que o Membro alcança, menos o próprio,
 * o que mora dentro dele e o pai atual. Cada um que o domínio recusaria fica
 * desligado dizendo por quê, em vez de sumir (§11).
 */
function opcoesDeDestino(state: DataState, memberId: Id, movel: Movel): Option[] {
  const { tipo, item } = movel;
  const dentro = tipo === "folder" ? pastasAbaixo(state, item.id) : new Set<Id>();
  const nomeDe = (type: "space" | "folder", id: Id): string =>
    containerPath(state, type, id)
      .slice(0, -1)
      .map((node) => node.name)
      .join(" › ");

  const candidatos: DestinoDeMover[] = [
    ...state.spaces
      .filter((s) => s.lifecycle === "ativo" && memberReachesContainer(state, memberId, "space", s.id))
      .map((s): DestinoDeMover => ({ parentType: "space", parentId: s.id })),
    ...state.folders
      .filter(
        (f) =>
          f.lifecycle === "ativo" &&
          f.id !== item.id &&
          !dentro.has(f.id) &&
          memberReachesContainer(state, memberId, "folder", f.id),
      )
      .map((f): DestinoDeMover => ({ parentType: "folder", parentId: f.id })),
  ].filter((d) => !(d.parentType === item.parentType && d.parentId === item.parentId));

  return candidatos.map((destino) => {
    const container = destino.parentType === "space" ? state.spaces.find((s) => s.id === destino.parentId) : state.folders.find((f) => f.id === destino.parentId);
    const recusa = recusaDeMover(state, memberId, tipo, item.id, destino);
    const caminho = nomeDe(destino.parentType, destino.parentId);
    return {
      value: valorDoDestino(destino),
      label: container?.name ?? destino.parentId,
      ...(caminho ? { detail: caminho } : {}),
      ...(recusa ? { disabledReason: recusa } : {}),
    };
  });
}

/**
 * A frase do Toast, pelo caso (UI-SPEC, «Avisos de sucesso»): o caso sai do tipo
 * e do nível de origem e de destino.
 */
function frasePronta(movel: Movel, destino: DestinoDeMover, nomeDoDestino: string): string {
  const { tipo, item } = movel;
  if (tipo === "list") return `Lista ${item.name} movida para ${nomeDoDestino}.`;
  const eraSubpasta = item.parentType === "folder";
  const viraSubpasta = destino.parentType === "folder";
  if (eraSubpasta && !viraSubpasta) return `Subpasta ${item.name} agora é Pasta em ${nomeDoDestino}.`;
  if (!eraSubpasta && viraSubpasta) return `Pasta ${item.name} agora é Subpasta de ${nomeDoDestino}.`;
  return `${eraSubpasta ? "Subpasta" : "Pasta"} ${item.name} movida para ${nomeDoDestino}.`;
}

/** O que a tela lê do destino escolhido: a recusa, as consequências e os Status que ele oferece. */
interface Leitura {
  readonly recusaDoDestino: string | undefined;
  readonly consequencias: ConsequenciasDeMover | undefined;
  readonly statusDoDestino: ReadonlyArray<{ readonly id: Id; readonly name: string; readonly category: string; readonly color: string }>;
}

function lerDestinoEscolhido(state: DataState, memberId: Id, movel: Movel, destino: DestinoDeMover | undefined): Leitura {
  if (!destino) return { recusaDoDestino: undefined, consequencias: undefined, statusDoDestino: [] };
  const recusaDoDestino = recusaDeMover(state, memberId, movel.tipo, movel.item.id, destino);
  const consequencias = recusaDoDestino ? undefined : consequenciasDeMover(state, movel.tipo, movel.item.id, destino);
  const config = effectiveContainerConfig(state, destino.parentType, destino.parentId);
  const statusDoDestino = config ? [...config.statusSet.definitions].sort((a, b) => a.order - b.order) : [];
  return { recusaDoDestino, consequencias, statusDoDestino };
}

function descricaoDe(state: DataState, movel: Movel): string {
  if (movel.tipo === "folder") {
    const sub = movel.item.parentType === "folder";
    return `${sub ? "A Subpasta" : "A Pasta"}, as Listas e as Tarefas dela mudam de lugar juntas.`;
  }
  const tarefas = state.tasks.filter((t) => t.listId === movel.item.id).length;
  if (tarefas === 0) return "A Lista muda de lugar.";
  if (tarefas === 1) return "A Lista e a sua Tarefa mudam de lugar juntas.";
  return `A Lista e as suas ${tarefas} Tarefas mudam de lugar juntas.`;
}

const plural = (n: number, singular: string, varios: string): string => `${n} ${n === 1 ? singular : varios}`;

/**
 * Montado uma vez na casca. `onDone` recebe a frase do Toast de sucesso; sem
 * ele o diálogo move do mesmo jeito e só não avisa.
 */
export function MoverConteinerDialog({
  onDone,
}: {
  readonly onDone?: (message: string, movidoId: Id) => void;
} = {}) {
  const { movendo, closeMover } = useMoverConteinerDialog();
  const state = useData((data) => data);
  const { memberId } = useSession();
  if (!movendo) return null;
  const movel = acharMovel(state, memberId, movendo.id);
  if (!movel) return null;
  return (
    <DialogoDeMover
      // Outro item, outro diálogo: o destino e o mapeamento de um não valem para o outro.
      key={movendo.id}
      movel={movel}
      destinoInicial={destinoDoId(state, movendo.destinoId)}
      onClose={closeMover}
      {...(onDone ? { onDone } : {})}
    />
  );
}

function DialogoDeMover({
  movel,
  destinoInicial,
  onClose,
  onDone,
}: {
  readonly movel: Movel;
  readonly destinoInicial: string;
  readonly onClose: () => void;
  readonly onDone?: (message: string, movidoId: Id) => void;
}) {
  const state = useData((data) => data);
  const runConfirmado = useRunConfirmado();
  const { memberId } = useSession();
  const [destinoEscolhido, setDestinoEscolhido] = useState(destinoInicial);
  const [mapeamento, setMapeamento] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [gravando, setGravando] = useState(false);
  // Quando o servidor responde, a resposta muda o estado ANTES de este diálogo fechar: o movido já está no
  // destino e qualquer leitura nova diria "Já está aqui." Por isso o que a tela mostra fica congelado
  // no instante de gravar.
  const [congelado, setCongelado] = useState<Leitura | null>(null);

  const { tipo, item } = movel;
  const destino = lerDestino(destinoEscolhido);
  const opcoes = opcoesDeDestino(state, memberId, movel);

  // O que o domínio diz do destino já escolhido (também o que veio pelo endereço, que ninguém filtrou).
  const { recusaDoDestino, consequencias, statusDoDestino } = congelado ?? lerDestinoEscolhido(state, memberId, movel, destino);

  const precisaMapear = consequencias?.conjuntoMuda === true;
  const emUso = precisaMapear ? (consequencias?.statusEmUso ?? []) : [];
  const semDestino = emUso.filter((s) => !mapeamento[s.statusId]);

  const nomeDoDestino = destino
    ? ((destino.parentType === "space" ? state.spaces : state.folders).find((c) => c.id === destino.parentId)?.name ?? "")
    : "";

  const motivoParaNaoMover =
    gravando
      ? "Movendo…"
      : destino === undefined
        ? "Escolha o destino."
        : (recusaDoDestino ?? (semDestino.length > 0 ? `${semDestino.length} Status de origem ainda sem destino.` : undefined));

  const camposQueSaem = consequencias?.camposQueSaem ?? [];
  const tiposQueMudam = consequencias?.tiposQueMudam ?? 0;
  const linksRevogados = consequencias?.linksPublicosRevogados ?? 0;
  const valores = consequencias?.valoresAfetados ?? 0;
  const mostraAviso = camposQueSaem.length > 0 || tiposQueMudam > 0 || linksRevogados > 0;

  const fechar = () => {
    if (gravando) return; // fecha só depois da resposta do servidor
    onClose();
  };

  const confirmar = () => {
    if (!destino || gravando) return;
    const entradas: StatusMapping[] = emUso
      .filter((s) => mapeamento[s.statusId])
      .map((s) => ({ fromStatusId: s.statusId, toStatusId: mapeamento[s.statusId] as string }));
    const mensagem = frasePronta(movel, destino, nomeDoDestino);
    const leitura = { recusaDoDestino, consequencias, statusDoDestino };
    const { local, confirmado } = runConfirmado((data, quem) => moveContainer(data, quem, tipo, item.id, destino, entradas));
    if (!local.ok) {
      setErro(local.error);
      return;
    }
    setErro(null);
    setCongelado(leitura);
    setGravando(true);
    void confirmado.then((resposta) => {
      setGravando(false);
      setCongelado(null);
      if (!resposta.ok) {
        // A recusa do servidor (corrida, ou o que a cópia local não via): o diálogo fica, com os campos.
        setErro(resposta.error);
        return;
      }
      onClose();
      onDone?.(mensagem, item.id);
      // O foco volta à linha movida no lugar novo; se ela não está à vista, à do destino.
      // Depois do `opener.focus()` do diálogo, que roda ao fechar.
      setTimeout(() => {
        const alvo = document.getElementById(`arvore-no-${item.id}`) ?? document.getElementById(`arvore-no-${destino.parentId}`);
        alvo?.focus();
      }, 0);
    });
  };

  return (
    <ConfirmDialog
      open
      title={`Mover “${item.name}”`}
      description={descricaoDe(state, movel)}
      confirmLabel="Mover"
      confirmCarregando={gravando}
      {...(motivoParaNaoMover ? { confirmDisabledReason: motivoParaNaoMover } : {})}
      onConfirm={confirmar}
      onCancel={fechar}
    >
      <div className="grid gap-3">
        <Field label="Destino">
          {(id) => (
            <Select
              id={id}
              value={destinoEscolhido}
              onChange={(valor) => {
                setDestinoEscolhido(valor);
                setMapeamento({});
                setErro(null);
              }}
              options={opcoes}
              searchable
              placeholder="Escolher destino"
              semOpcoes="Nenhum destino disponível."
            />
          )}
        </Field>

        {precisaMapear ? (
          <div>
            <p className="app-sm mb-1.5" style={{ color: "var(--texto-3)" }}>
              O destino usa outro Conjunto de Status. Escolha onde cada Status em uso passa a ficar.
            </p>
            <div className="grid gap-2">
              {emUso.map((origem) => {
                const escolhido = statusDoDestino.find((d) => d.id === mapeamento[origem.statusId]);
                const categoriaMuda = escolhido !== undefined && escolhido.category !== origem.categoria;
                const dica = categoriaMuda
                  ? `${origem.tarefas} ${origem.tarefas === 1 ? "Tarefa passa" : "Tarefas passam"} de ${categoriaPorExtenso(origem.categoria)} para ${categoriaPorExtenso(escolhido.category)}`
                  : `Categoria de origem: ${categoriaPorExtenso(origem.categoria)}`;
                return (
                  <Field key={origem.statusId} label={`${origem.nome} · ${plural(origem.tarefas, "Tarefa", "Tarefas")}`} hint={dica}>
                    {(id) => (
                      <Select
                        id={id}
                        value={mapeamento[origem.statusId] ?? ""}
                        onChange={(valor) => setMapeamento((atual) => ({ ...atual, [origem.statusId]: valor }))}
                        options={statusDoDestino.map((definicao) => ({
                          value: definicao.id,
                          label: definicao.name,
                          detail: categoriaPorExtenso(definicao.category),
                          color: definicao.color,
                        }))}
                        placeholder="Escolher Status"
                      />
                    )}
                  </Field>
                );
              })}
            </div>
          </div>
        ) : null}

        {mostraAviso ? (
          <div
            className="app-base grid gap-1 rounded-[var(--r-controle)] px-3 py-2"
            style={{ background: "var(--aviso-lavado)", color: "var(--aviso)" }}
          >
            {camposQueSaem.length > 0 ? (
              <>
                <p>Campos que deixam de valer: {camposQueSaem.map((campo) => campo.nome).join(", ")}.</p>
                <p>
                  {valores} {valores === 1 ? "Valor fica arquivado" : "Valores ficam arquivados"} nas Tarefas. Nada é apagado.
                </p>
              </>
            ) : null}
            {tiposQueMudam > 0 ? (
              <p>
                {tiposQueMudam} {tiposQueMudam === 1 ? "Tarefa passa" : "Tarefas passam"} ao primeiro Tipo de Tarefa do destino.
              </p>
            ) : null}
            {linksRevogados > 0 ? (
              <p>
                {linksRevogados} {linksRevogados === 1 ? "link público é revogado" : "links públicos são revogados"}: o destino não permite compartilhamento público.
              </p>
            ) : null}
          </div>
        ) : null}

        {erro ?? recusaDoDestino ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            {erro ?? recusaDoDestino}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
