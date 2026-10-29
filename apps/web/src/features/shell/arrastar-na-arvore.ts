/**
 * O gesto de arrastar na árvore da Estrutura (D-08, D-09, D-10, D-12; UI-SPEC
 * S1, A1–A4, A8–A10): soltar em cima move, soltar entre irmãos reordena.
 *
 * HTML5 nativo, sem biblioteca (D-12, veredito da RESEARCH §1). Três regras
 * deste arquivo vêm de armadilhas conhecidas:
 *
 * - O item em trânsito vive em estado do hook, nunca no `dataTransfer`: os
 *   navegadores escondem o conteúdo dele em `dragover`, e ler dali deixaria um
 *   arrasto vindo de fora do app (outra aba, um arquivo) virar alvo (T-10-33).
 *   O `dataTransfer` leva só `effectAllowed = "move"` e um tipo MIME próprio.
 * - Quem manda é o domínio. Soltar «dentro» pergunta `recusaDeMover` (a frase vai
 *   ao Toast de erro e nada se move), depois `consequenciasDeMover` (se algo muda
 *   para quem já está lá, abre o diálogo de 10-12; senão move na hora). O sucesso
 *   só é dito depois da resposta do servidor (A4).
 * - Soltar limpa tudo no `dragend` e ao sair da ÁRVORE, nunca por `dragleave` de
 *   cada linha: o `dragleave` dispara ao passar de um filho da linha para outro
 *   e faria o realce piscar (Pitfall 8).
 *
 * Mora fora do `app-shell.tsx` de propósito: o gesto não é da casca.
 */

import { useEffect, useRef, useState, type DragEvent } from "react";
import { containerAdminRefusal, containerPath } from "@n1/dominio/derive";
import {
  consequenciasDeMover,
  moveContainer,
  recusaDeMover,
  recusaDeReordenar,
  reorderContainers,
  type DestinoDeMover,
  type PaiDeConteiner,
} from "@n1/dominio/operations";
import { MEUS_NEGOCIOS_ID } from "@n1/dominio/seed-comercial";
import type { DataState, OperationResult } from "@n1/dominio/state";
import type { Id } from "@n1/dominio/types";
import { frasePronta, type Movel } from "@/features/estrutura/mover-conteiner-dialog";
import { zonaDaSoltura, type Zona } from "./zona-de-soltura";

/** A8 — quanto um contêiner fechado espera sob o ponteiro até abrir sozinho. Tempo de interação, não movimento. */
export const ABRIR_AO_PAIRAR_MS = 600;

/** O tipo MIME próprio: sem ele, o que o navegador arrasta de fora não é reconhecido como nosso. */
export const TIPO_DE_ARRASTO = "application/x-n1-conteiner";

type TipoDoNo = "space" | "folder" | "list";

/** O que uma linha da árvore diz de si ao gesto. */
export interface NoDaArvore {
  readonly tipo: TipoDoNo;
  readonly id: Id;
  readonly paiTipo?: "space" | "folder";
  readonly paiId?: Id;
  readonly aberto: boolean;
  readonly temFilhosVisiveis: boolean;
  /** Abre a linha (contêiner fechado sob o ponteiro, A8). */
  readonly abrir?: () => void;
}

interface Arrastando {
  readonly tipo: TipoDoNo;
  readonly id: Id;
  readonly paiTipo?: "space" | "folder";
  readonly paiId?: Id;
}

interface AlvoDoGesto {
  readonly id: Id;
  readonly zona: Exclude<Zona, null>;
}

/** O que a `TreeRow` aplica na linha e o que ela desenha. */
export interface PropsDeArrasto {
  /** Só quem administra o item arrasta; as outras linhas só recebem a soltura. */
  readonly arrastavel: boolean;
  /** Esta é a linha que está sendo arrastada (60% de opacidade). */
  readonly origem: boolean;
  /** A zona acesa nesta linha, ou `null`. */
  readonly zona: Exclude<Zona, null> | null;
  readonly onDragStart: (evento: DragEvent<HTMLElement>) => void;
  readonly onDragOver: (evento: DragEvent<HTMLElement>) => void;
  readonly onDrop: (evento: DragEvent<HTMLElement>) => void;
  readonly onDragEnd: () => void;
}

type Comando = (estado: DataState, quem: Id) => OperationResult<unknown>;

export interface ParametrosDoArrasto {
  readonly data: DataState;
  readonly memberId: Id;
  /** Há uma gravação em curso na árvore: nenhum arraste novo começa (A4). */
  readonly gravando: boolean;
  /** Os irmãos que a árvore mostra e o Membro alcança (a fatia de `reorderContainers`, 10-04). */
  readonly irmaos: (tipo: TipoDoNo, pai: PaiDeConteiner) => readonly Id[];
  /** Grava por `runConfirmado`: recusa local vai ao Toast de erro; `aoGravar` roda só depois da resposta do servidor. */
  readonly gravar: (comando: Comando, aoGravar?: () => void) => void;
  readonly openMover: (id: Id, destinoId?: Id) => void;
  readonly onErro: (frase: string | null) => void;
  readonly onAviso: (frase: string) => void;
}

export interface ArrastoDaArvore {
  readonly arrastando: Arrastando | null;
  readonly alvo: AlvoDoGesto | null;
  readonly gravando: boolean;
  /** `undefined` quando a linha não participa do gesto (Meus negócios e o que mora nele, A9). */
  readonly propsDaLinha: (no: NoDaArvore) => PropsDeArrasto | undefined;
  /** Para a `<ul>` da árvore: sair dela apaga o realce. */
  readonly propsDaArvore: { readonly onDragLeave: (evento: DragEvent<HTMLElement>) => void };
}

export function useArrastarNaArvore(parametros: ParametrosDoArrasto): ArrastoDaArvore {
  const { data, memberId, gravando, irmaos, gravar, openMover, onErro, onAviso } = parametros;
  const [arrastando, setArrastando] = useState<Arrastando | null>(null);
  const [alvo, setAlvo] = useState<AlvoDoGesto | null>(null);
  // A lógica do gesto lê os espelhos síncronos: um `dragover` pode chegar antes de o React ter commitado o `dragstart`.
  const arrastandoRef = useRef<Arrastando | null>(null);
  const alvoRef = useRef<AlvoDoGesto | null>(null);
  const temporizador = useRef<{ readonly id: Id; readonly handle: ReturnType<typeof setTimeout> } | null>(null);
  const jaAbertos = useRef<Set<Id>>(new Set());

  const pararTemporizador = () => {
    if (temporizador.current) clearTimeout(temporizador.current.handle);
    temporizador.current = null;
  };

  const definirAlvo = (proximo: AlvoDoGesto | null) => {
    const atual = alvoRef.current;
    if (atual?.id === proximo?.id && atual?.zona === proximo?.zona) return;
    alvoRef.current = proximo;
    setAlvo(proximo);
  };

  const limparTudo = () => {
    pararTemporizador();
    jaAbertos.current.clear();
    arrastandoRef.current = null;
    alvoRef.current = null;
    setArrastando(null);
    setAlvo(null);
  };

  // Um arrasto deixado no meio (a árvore saiu da tela) não deixa temporizador vivo.
  useEffect(() => () => pararTemporizador(), []);

  const alvoDoGesto = (no: NoDaArvore, quem: Arrastando) => ({
    tipo: no.tipo,
    id: no.id,
    ...(no.paiTipo ? { paiTipo: no.paiTipo } : {}),
    ...(no.paiId ? { paiId: no.paiId } : {}),
    aberto: no.aberto,
    temFilhosVisiveis: no.temFilhosVisiveis,
    descendenteDoArrastado: no.id !== quem.id && containerPath(data, no.tipo, no.id).some((passo) => passo.id === quem.id),
  });

  const zonaDe = (evento: DragEvent<HTMLElement>, no: NoDaArvore, quem: Arrastando): Zona => {
    const retangulo = evento.currentTarget.getBoundingClientRect();
    return zonaDaSoltura(evento.clientY, retangulo.top, retangulo.height, quem, alvoDoGesto(no, quem));
  };

  /** A8 — contêiner fechado com filhos sob o ponteiro: abre uma vez depois de `ABRIR_AO_PAIRAR_MS`. */
  const armarAbertura = (no: NoDaArvore) => {
    if (temporizador.current && temporizador.current.id !== no.id) pararTemporizador();
    if (no.aberto || !no.temFilhosVisiveis || !no.abrir || jaAbertos.current.has(no.id) || temporizador.current) return;
    const abrir = no.abrir;
    temporizador.current = {
      id: no.id,
      handle: setTimeout(() => {
        temporizador.current = null;
        jaAbertos.current.add(no.id);
        abrir();
      }, ABRIR_AO_PAIRAR_MS),
    };
  };

  const soltarDentro = (quem: Arrastando, no: NoDaArvore) => {
    if (quem.tipo === "space" || no.tipo === "list") return;
    const tipo = quem.tipo;
    const destino: DestinoDeMover = { parentType: no.tipo, parentId: no.id };
    // L1 — a frase do domínio, literal, no Toast; nada se move.
    const recusa = recusaDeMover(data, memberId, tipo, quem.id, destino);
    if (recusa) {
      onErro(recusa);
      return;
    }
    // L2 — se algo muda para o que já está lá, a pessoa decide no diálogo de 10-12.
    const consequencia = consequenciasDeMover(data, tipo, quem.id, destino);
    if (consequencia.conjuntoMuda || consequencia.camposQueSaem.length > 0 || consequencia.tiposQueMudam > 0 || consequencia.linksPublicosRevogados > 0) {
      onErro(null);
      openMover(quem.id, no.id);
      return;
    }
    const pasta = tipo === "folder" ? data.folders.find((f) => f.id === quem.id) : undefined;
    const lista = tipo === "list" ? data.lists.find((l) => l.id === quem.id) : undefined;
    const movel: Movel | undefined = pasta ? { tipo: "folder", item: pasta } : lista ? { tipo: "list", item: lista } : undefined;
    if (!movel) return;
    const nomeDoDestino = (no.tipo === "space" ? data.spaces : data.folders).find((c) => c.id === no.id)?.name ?? "";
    const frase = frasePronta(movel, destino, nomeDoDestino);
    gravar(
      (estado, ator) => moveContainer(estado, ator, tipo, quem.id, destino),
      () => {
        onAviso(frase);
        // O foco vai para a linha movida no lugar novo; se ela não está à vista, para a do destino.
        setTimeout(() => (document.getElementById(`arvore-no-${quem.id}`) ?? document.getElementById(`arvore-no-${no.id}`))?.focus(), 0);
      },
    );
  };

  const soltarEntre = (quem: Arrastando, no: NoDaArvore, zona: "antes" | "depois") => {
    const pai: PaiDeConteiner = quem.tipo === "space" || !quem.paiTipo || !quem.paiId ? null : { type: quem.paiTipo, id: quem.paiId };
    // A fatia: os irmãos que a árvore mostra e o Membro alcança. Os escondidos o domínio deixa na vaga (10-04).
    const grupo = irmaos(quem.tipo, pai);
    if (!grupo.includes(quem.id) || !grupo.includes(no.id)) return;
    const resto = grupo.filter((id) => id !== quem.id);
    const posicao = resto.indexOf(no.id) + (zona === "depois" ? 1 : 0);
    const ids = [...resto.slice(0, posicao), quem.id, ...resto.slice(posicao)];
    if (ids.every((id, i) => id === grupo[i])) return; // soltou onde já estava
    // Reordenar não dá Toast no sucesso: a linha mudar de lugar é o aviso.
    gravar((estado, ator) => reorderContainers(estado, ator, quem.tipo, pai, ids));
  };

  const propsDaLinha = (no: NoDaArvore): PropsDeArrasto | undefined => {
    // A9 — a Pasta «Meus negócios» e o que mora nela ficam fora do gesto, como do menu.
    if (no.tipo !== "space" && containerPath(data, no.tipo, no.id).some((passo) => passo.id === MEUS_NEGOCIOS_ID)) return undefined;
    // Só arrasta quem administra o item (os Espaços: quem reordena Espaços). Receber a soltura vale para todas as outras
    // linhas (A2): a recusa do domínio é o que a pessoa vê.
    const recusaDeArrastar = no.tipo === "space" ? recusaDeReordenar(data, memberId, "space", null) : containerAdminRefusal(data, memberId, no.tipo, no.id);
    const noDeArrasto: Arrastando = {
      tipo: no.tipo,
      id: no.id,
      ...(no.paiTipo ? { paiTipo: no.paiTipo } : {}),
      ...(no.paiId ? { paiId: no.paiId } : {}),
    };

    return {
      arrastavel: recusaDeArrastar === undefined,
      origem: arrastando?.id === no.id,
      zona: alvo?.id === no.id ? alvo.zona : null,
      onDragStart: (evento) => {
        // Sem administrar, ou com uma gravação em curso, o gesto nem começa (A4).
        if (recusaDeArrastar !== undefined || gravando) {
          evento.preventDefault();
          return;
        }
        const transferencia = evento.dataTransfer as DataTransfer | null;
        if (transferencia) {
          transferencia.effectAllowed = "move";
          transferencia.setData(TIPO_DE_ARRASTO, no.id);
        }
        arrastandoRef.current = noDeArrasto;
        setArrastando(noDeArrasto);
      },
      onDragOver: (evento) => {
        const quem = arrastandoRef.current;
        // Sem item em trânsito (arrasto de fora do app) ou gravando, nenhuma zona é aceita (T-10-33, A4).
        if (!quem || gravando) return;
        const zona = zonaDe(evento, no, quem);
        const transferencia = evento.dataTransfer as DataTransfer | null;
        if (zona === null) {
          if (transferencia) transferencia.dropEffect = "none";
          pararTemporizador();
          definirAlvo(null);
          return;
        }
        evento.preventDefault();
        if (transferencia) transferencia.dropEffect = "move";
        definirAlvo({ id: no.id, zona });
        armarAbertura(no);
      },
      onDrop: (evento) => {
        const quem = arrastandoRef.current;
        if (!quem) return;
        evento.preventDefault();
        // O que a pessoa viu aceso é o que acontece; sem isso, a leitura da própria soltura.
        const acesa = alvoRef.current;
        const zona = acesa?.id === no.id ? acesa.zona : zonaDe(evento, no, quem);
        limparTudo();
        if (gravando || zona === null) return;
        if (zona === "dentro") soltarDentro(quem, no);
        else soltarEntre(quem, no, zona);
      },
      onDragEnd: limparTudo,
    };
  };

  const propsDaArvore = {
    onDragLeave: (evento: DragEvent<HTMLElement>) => {
      const para = evento.relatedTarget as Node | null;
      if (para && evento.currentTarget.contains(para)) return;
      pararTemporizador();
      definirAlvo(null);
    },
  };

  return { arrastando, alvo, gravando, propsDaLinha, propsDaArvore };
}
