/**
 * O "@" que menciona Membros ao digitar (Fase 11, D-06). Sai do `CommentComposer`
 * e vira UM hook, que a descrição da Tarefa (`TaskTitleDescriptionEditor`) e o
 * Comentário (`CommentComposer`) usam: a regra do menu — quando abre, quem
 * oferece, como escolhe — e a lista de quem foi mencionado de fato moram aqui,
 * não em três cópias.
 *
 * Fica de fora o `Compositor` da Timeline (`features/tarefa/timeline.tsx`): ele
 * tem estado de envio assíncrono próprio e a Estrutura não o toca nesta fase.
 *
 * A lista mandada ao servidor sai do TEXTO no momento de salvar: quem foi
 * escolhido só conta se o `@Nome` continua escrito, pela mesma régua do domínio
 * (`mencionaNoTexto`, que exige fronteira depois do nome). Tirar o `@Nome` do
 * texto antes de salvar tira o Membro da lista.
 *
 * Só Membro ativo é oferecido; Equipe, Agente, Tarefa e Contato ficam para
 * depois.
 */

import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import { useData } from "@/dados/store";
import { mencionaNoTexto } from "@n1/dominio/descricao-da-tarefa";

/** Sem acento e em minúsculas, para o "@" achar "Galvão" por "galvao". */
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR");
}

/**
 * O "@" em curso: o que vem depois do último "@" antes do cursor (até dois
 * espaços — nomes têm sobrenome). `inicio` é a posição do "@". Sem "@" em curso
 * (ou um "@" no meio de uma palavra, como em e-mail), não há menu.
 */
export function arrobaEmCurso(texto: string, cursor: number): { readonly inicio: number; readonly consulta: string } | null {
  const antes = texto.slice(0, cursor);
  const m = /(^|\s)@([^\s@]*(?:\s[^\s@]*){0,2})$/.exec(antes);
  const consulta = m?.[2];
  return consulta !== undefined ? { inicio: antes.length - consulta.length - 1, consulta } : null;
}

export interface MembroEscolhido {
  readonly id: string;
  readonly nome: string;
}

export function useMencoes(inicial: { readonly texto: string; readonly escolhidos?: ReadonlyArray<MembroEscolhido> }) {
  const members = useData((data) => data.members);
  const [texto, setTexto] = useState(inicial.texto);
  /** Quem foi escolhido pelo "@" — só conta na hora de salvar se o "@Nome" ainda estiver no texto. */
  const [escolhidos, setEscolhidos] = useState<ReadonlyArray<MembroEscolhido>>(inicial.escolhidos ?? []);
  const [cursor, setCursor] = useState(0);
  const [sugestaoAtiva, setSugestaoAtiva] = useState(0);
  const [menuFechado, setMenuFechado] = useState(false);
  const campo = useRef<HTMLTextAreaElement | null>(null);
  /** Ref de callback: o `TextArea` e o `<textarea>` cru a recebem do mesmo jeito. */
  const campoRef = useCallback((elemento: HTMLTextAreaElement | null) => {
    campo.current = elemento;
  }, []);

  const arroba = arrobaEmCurso(texto, cursor);
  const sugestoes =
    arroba && !menuFechado
      ? members
          .filter((m) => m.state === "ativo")
          .filter((m) => normalizar(m.displayName).includes(normalizar(arroba.consulta)))
          .slice(0, 6)
      : [];

  const mencionar = (membro: { readonly id: string; readonly displayName: string }) => {
    if (!arroba) return;
    const antes = texto.slice(0, arroba.inicio);
    const depois = texto.slice(cursor);
    const novoCursor = antes.length + membro.displayName.length + 2;
    setTexto(`${antes}@${membro.displayName} ${depois}`);
    setEscolhidos((atual) => (atual.some((m) => m.id === membro.id) ? atual : [...atual, { id: membro.id, nome: membro.displayName }]));
    setCursor(novoCursor);
    setSugestaoAtiva(0);
    // O cursor volta para depois do nome, e o foco continua no campo.
    requestAnimationFrame(() => {
      const el = campo.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.setSelectionRange(novoCursor, novoCursor);
    });
  };

  const aoMudar = (valor: string, posicao: number) => {
    setTexto(valor);
    setCursor(posicao);
    setSugestaoAtiva(0);
    setMenuFechado(false);
  };

  const aoSelecionar = (posicao: number) => setCursor(posicao);

  /**
   * Com o menu aberto, as setas e o Enter/Tab escolhem e Esc fecha só o menu.
   * Devolve `true` quando tratou a tecla (quem chama não faz mais nada com ela).
   */
  const aoTeclar = (evento: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (sugestoes.length === 0) return false;
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      setSugestaoAtiva((i) => (i + 1) % sugestoes.length);
      return true;
    }
    if (evento.key === "ArrowUp") {
      evento.preventDefault();
      setSugestaoAtiva((i) => (i - 1 + sugestoes.length) % sugestoes.length);
      return true;
    }
    if ((evento.key === "Enter" && !evento.ctrlKey && !evento.metaKey) || evento.key === "Tab") {
      evento.preventDefault();
      const escolhido = sugestoes[sugestaoAtiva];
      if (escolhido) mencionar(escolhido);
      return true;
    }
    if (evento.key === "Escape") {
      evento.preventDefault();
      evento.stopPropagation();
      setMenuFechado(true);
      return true;
    }
    return false;
  };

  /** Quem o texto menciona DE FATO: escolhido cujo `@Nome` continua escrito, com a régua do domínio. */
  const mencoesEfetivas: Array<{ type: "member"; id: string }> = escolhidos
    .filter((m) => mencionaNoTexto(texto, m.nome))
    .map((m) => ({ type: "member", id: m.id }));

  const limpar = () => {
    setTexto("");
    setEscolhidos([]);
    setCursor(0);
    setSugestaoAtiva(0);
    setMenuFechado(false);
  };

  return {
    texto,
    campoRef,
    sugestoes,
    sugestaoAtiva,
    setSugestaoAtiva,
    mencionar,
    aoMudar,
    aoSelecionar,
    aoTeclar,
    mencoesEfetivas,
    limpar,
  };
}
