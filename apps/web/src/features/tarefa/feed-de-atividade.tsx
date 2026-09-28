"use client";

/**
 * O painel de Atividade da Tarefa no desenho do ClickUp: o cabeçalho com
 * busca, Observadores e filtro; o Registro de Atividade como linhas discretas
 * (bolinha · quem fez o quê · quando, à direita), com o miolo recolhido em
 * "Mostrar mais"; e tudo encostado embaixo, junto do compositor — a conversa
 * cresce de baixo para cima, como um chat.
 *
 * Os Comentários continuam sendo de `TaskComments` (respostas, resolver,
 * menções); este arquivo só desenha o cabeçalho e o feed de Atividade que
 * entra antes deles, e diz a `TaskComments` o que a busca e o filtro escondem.
 */

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Bell, ChevronRight, ListFilter, Search, X } from "lucide-react";
import type { ActivityRecord, ActorRef } from "@n1/dominio/types";
import { Icone } from "@/features/shell/ui";

export type FiltroDaAtividade = "tudo" | "comentarios" | "atividade";

const ROTULO_DO_FILTRO: Record<FiltroDaAtividade, string> = {
  tudo: "Tudo",
  comentarios: "Só comentários",
  atividade: "Só atividade",
};

/** Sem acento e em minúsculas, para a busca achar "lançado" por "lancado". */
export function normalizarBusca(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR");
}

/** "set 28 às 09:35" — o formato da linha do ClickUp, no fuso do Espaço. */
export function formatarQuando(iso: string, timeZone: string): string {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).formatToParts(new Date(iso));
  const parte = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((p) => p.type === tipo)?.value ?? "";
  const mes = parte("month").replace(".", "").toLocaleLowerCase("pt-BR");
  return `${mes} ${parte("day")} às ${parte("hour")}:${parte("minute")}`;
}

/* ───────────────────────────── Cabeçalho ─────────────────────────────────── */

export function CabecalhoDaAtividade({
  observadores,
  busca,
  onBusca,
  filtro,
  onFiltro,
  acao,
}: {
  readonly observadores: number;
  readonly busca: string;
  readonly onBusca: (busca: string) => void;
  readonly filtro: FiltroDaAtividade;
  readonly onFiltro: (filtro: FiltroDaAtividade) => void;
  /** O botão de recolher, quando a ficha é conversacional. */
  readonly acao?: ReactNode;
}) {
  const [buscando, setBuscando] = useState(busca !== "");
  const [menuAberto, setMenuAberto] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (buscando) campo.current?.focus();
  }, [buscando]);

  // O menu do filtro fecha ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!menuAberto) return;
    const fora = (event: MouseEvent) => {
      if (menu.current && !menu.current.contains(event.target as Node)) setMenuAberto(false);
    };
    const esc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuAberto(false);
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [menuAberto]);

  return (
    <div className="shrink-0" style={{ borderBottom: "1px solid var(--linha)", background: "var(--superficie-1)" }}>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <h2 className="app-md" style={{ color: "var(--texto)", fontWeight: 600 }}>
          Atividade
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="btn-icone btn-icone-nu"
            aria-label="Buscar na Atividade"
            title="Buscar na Atividade"
            aria-pressed={buscando}
            onClick={() => {
              if (buscando) onBusca("");
              setBuscando((atual) => !atual);
            }}
          >
            <Icone de={Search} tamanho="sm" />
          </button>
          <span
            className="app-sm app-numero inline-flex items-center gap-1 px-1.5"
            title={`${observadores} Observador(es) nesta Tarefa`}
            style={{ color: observadores > 0 ? "var(--sucesso)" : "var(--texto-3)" }}
          >
            <Icone de={Bell} tamanho="sm" />
            {observadores}
          </span>
          <div ref={menu} className="relative">
            <button
              type="button"
              className="btn-icone btn-icone-nu"
              aria-label={`Filtrar a Atividade: ${ROTULO_DO_FILTRO[filtro]}`}
              title={`Filtrar: ${ROTULO_DO_FILTRO[filtro]}`}
              aria-haspopup="menu"
              aria-expanded={menuAberto}
              onClick={() => setMenuAberto((aberto) => !aberto)}
              style={filtro !== "tudo" ? { color: "var(--acento)" } : undefined}
            >
              <Icone de={ListFilter} tamanho="sm" />
            </button>
            {menuAberto ? (
              <div
                role="menu"
                className="absolute right-0 top-full z-20 mt-1 grid min-w-44 gap-0.5 rounded-[var(--r-painel)] p-1"
                style={{ background: "var(--superficie-1)", border: "1px solid var(--linha)", boxShadow: "var(--sombra-suspensa)" }}
              >
                {(Object.keys(ROTULO_DO_FILTRO) as FiltroDaAtividade[]).map((opcao) => (
                  <button
                    key={opcao}
                    type="button"
                    role="menuitemradio"
                    aria-checked={filtro === opcao}
                    className="app-base rounded-[var(--r-controle)] px-2 py-1.5 text-left transition-colors hover:bg-[var(--superficie-hover)]"
                    style={{ color: filtro === opcao ? "var(--acento)" : "var(--texto)" }}
                    onClick={() => {
                      onFiltro(opcao);
                      setMenuAberto(false);
                    }}
                  >
                    {ROTULO_DO_FILTRO[opcao]}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {acao}
        </div>
      </div>
      {buscando ? (
        <div className="flex items-center gap-2 px-4 pb-3">
          <label htmlFor="busca-da-atividade" className="sr-only">
            Buscar na Atividade
          </label>
          <input
            ref={campo}
            id="busca-da-atividade"
            value={busca}
            onChange={(event) => onBusca(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                onBusca("");
                setBuscando(false);
              }
            }}
            placeholder="Buscar em comentários e atividade"
            className="campo flex-1"
          />
          {busca !== "" ? (
            <button type="button" className="btn-icone btn-icone-nu" aria-label="Limpar a busca" onClick={() => onBusca("")}>
              <Icone de={X} tamanho="xs" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ───────────────────────────── Feed ─────────────────────────────────────── */

/** Quantas linhas ficam à mostra no fim quando o miolo está recolhido. */
const VISIVEIS_NO_FIM = 3;

function textoDaLinha(record: ActivityRecord, nome: string, delegado: string | undefined): string {
  const antesDepois = record.before || record.after ? ` (${record.before ?? "—"} → ${record.after ?? "—"})` : "";
  return `${nome}${delegado ? ` em nome de ${delegado}` : ""} ${record.action}${antesDepois}`;
}

export function FeedDeAtividade({
  registros,
  authorLabel,
  timeZone,
  busca,
}: {
  readonly registros: readonly ActivityRecord[];
  readonly authorLabel: (actor: ActorRef) => string;
  readonly timeZone: string;
  readonly busca: string;
}) {
  const [aberto, setAberto] = useState(false);

  const termo = normalizarBusca(busca.trim());
  const linhas = [...registros]
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((record) => {
      // T-02-10 — Ator de integração: só o rótulo da ação, nunca antes/depois.
      const seguro = record.actor.kind === "integration" ? { ...record, before: undefined, after: undefined } : record;
      return {
        record,
        texto: textoDaLinha(seguro, authorLabel(record.actor), record.delegate ? authorLabel(record.delegate) : undefined),
      };
    })
    .filter((linha) => termo === "" || normalizarBusca(linha.texto).includes(termo));

  if (linhas.length === 0) return null;

  // O primeiro (quem criou) e os últimos ficam à mostra; o miolo recolhe.
  const recolhe = !aberto && termo === "" && linhas.length > VISIVEIS_NO_FIM + 2;
  const escondidas = recolhe ? linhas.length - 1 - VISIVEIS_NO_FIM : 0;
  const visiveis = recolhe ? [linhas[0]!, ...linhas.slice(-VISIVEIS_NO_FIM)] : linhas;

  const Linha = ({ linha }: { readonly linha: (typeof linhas)[number] }) => (
    <li className="flex items-start gap-3 py-1.5">
      <span aria-hidden="true" className="app-sm shrink-0 leading-5" style={{ color: "var(--texto-4)" }}>
        •
      </span>
      <span className="app-sm min-w-0 flex-1 leading-5 break-words" style={{ color: "var(--texto-3)" }}>
        {linha.texto}
      </span>
      <time dateTime={linha.record.at} className="app-sm shrink-0 whitespace-nowrap leading-5" style={{ color: "var(--texto-3)" }}>
        {formatarQuando(linha.record.at, timeZone)}
      </time>
    </li>
  );

  return (
    <ol className="grid" aria-label="Registro de Atividade">
      {visiveis.map((linha, indice) => (
        <Fragment key={linha.record.id}>
          <Linha linha={linha} />
          {recolhe && indice === 0 ? (
            <li>
              <button
                type="button"
                onClick={() => setAberto(true)}
                className="app-sm flex items-center gap-3 py-1.5 transition-colors hover:underline"
                style={{ color: "var(--texto-3)" }}
              >
                <Icone de={ChevronRight} tamanho="xs" />
                Mostrar mais <span className="app-numero">({escondidas})</span>
              </button>
            </li>
          ) : null}
        </Fragment>
      ))}
      {aberto && linhas.length > VISIVEIS_NO_FIM + 2 ? (
        <li>
          <button
            type="button"
            onClick={() => setAberto(false)}
            className="app-sm py-1.5 transition-colors hover:underline"
            style={{ color: "var(--texto-3)" }}
          >
            Mostrar menos
          </button>
        </li>
      ) : null}
    </ol>
  );
}
