"use client";

/**
 * O QUADRO PADRÃO — a coluna e o cartão de TODO quadro do app (fim de
 * 2026-09-23: "tudo que for quadro, a visualização deve ser igual à da segunda
 * imagem; as exibições devem ser padronizadas" — a segunda imagem era o quadro
 * de Negócios).
 *
 * A COLUNA (`ColunaDeQuadro`): um trilho de largura fixa; no alto, a contagem
 * num selo lavado no acento, o nome (Status ou Etapa) numa pílula da cor dele,
 * o "+", e embaixo o subtítulo (a categoria, e o dinheiro quando há); vazia, um
 * tracejado com "+" que cria ali — ou só o texto, quando não se cria.
 *
 * O CARTÃO (`CartaoDeQuadro`), a anatomia do card de Negócio, em quatro
 * perguntas separadas por linha: QUEM/O QUÊ (o rosto — foto ou ladrilho com o
 * ícone —, o título grande e o subtítulo), COMO ESTÁ (as pílulas), O QUE
 * IMPORTA (o destaque: um ícone num ladrilho, o rótulo e o valor), e COM QUEM
 * (o rodapé em duas colunas rotuladas). Cada quadro só decide o que vai em
 * cada lugar: o Negócio (valor, dono, origem), a Tarefa conversacional (a
 * última mensagem, o responsável, o prazo), a Tarefa (o prazo, o responsável,
 * o progresso) e a Conta (o valor, o vencimento, a contraparte).
 *
 * Só `span`: o cartão é um `<a>` ou um `<button>`, e um botão só aceita
 * conteúdo em linha.
 */

import Link from "next/link";
import { Plus, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Icone, Pilula } from "./ui";

/* ─────────────────────────────── a coluna ─────────────────────────────── */

export function ColunaDeQuadro({
  contagem,
  nome,
  cor,
  mais,
  subtitulo,
  onDrop,
  children,
  rodape,
}: {
  readonly contagem: number;
  /** O Status ou a Etapa. */
  readonly nome: string;
  /** A cor dele (a da pílula); sem cor, a pílula neutra. */
  readonly cor?: string;
  /** O "+" da coluna (`BotaoDeMais`), quando há. */
  readonly mais?: ReactNode;
  /** A categoria, e o dinheiro quando o quadro soma. */
  readonly subtitulo: ReactNode;
  /** Soltar um cartão aqui. */
  readonly onDrop: () => void;
  /** O compositor aberto, o vazio (`VazioDaColuna`) ou os cartões. */
  readonly children: ReactNode;
  /** Uma nota sob a coluna (as exigências da Etapa). */
  readonly rodape?: ReactNode;
}) {
  return (
    <div onDragOver={(event) => event.preventDefault()} onDrop={onDrop} className="trilho flex w-[19.2rem] shrink-0 flex-col p-3">
      <div className="mb-3 flex items-start gap-2.5">
        {/* A contagem em selo: é o que se lê primeiro ao varrer o quadro. */}
        <span
          aria-hidden="true"
          className="app-base app-numero grid shrink-0 place-items-center rounded-[var(--r-controle)]"
          style={{
            width: "var(--controle-h-sm)",
            height: "var(--controle-h-sm)",
            background: "var(--acento-lavado)",
            color: "var(--acento)",
            fontWeight: 600,
          }}
        >
          {contagem}
        </span>
        <span className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 truncate">
            <Pilula {...(cor ? { cor } : {})}>{nome}</Pilula>
            <span className="sr-only">, {contagem}</span>
            {mais}
          </h2>
          <span className="app-meta app-numero block truncate">{subtitulo}</span>
        </span>
      </div>
      <div className="cascata pilha-solta">{children}</div>
      {rodape ? <p className="app-meta mt-2 px-1">{rodape}</p> : null}
    </div>
  );
}

/** A coluna vazia: um tracejado — com "+", que cria ali, quando `onCriar` é dado. */
export function VazioDaColuna({ texto, onCriar }: { readonly texto: string; readonly onCriar?: () => void }) {
  if (!onCriar) {
    return (
      <p className="app-sm grid place-items-center rounded-[var(--r-painel)] border border-dashed border-[var(--linha-forte)] px-2 py-6 text-center text-[var(--texto-3)]">
        {texto}
      </p>
    );
  }
  return (
    <button
      type="button"
      onClick={onCriar}
      className="app-sm grid place-items-center gap-2 rounded-[var(--r-painel)] border border-dashed border-[var(--linha-forte)] px-2 py-6 text-center text-[var(--texto-3)] transition-colors hover:border-[var(--acento)] hover:text-[var(--texto)]"
    >
      <span
        aria-hidden="true"
        className="grid place-items-center rounded-full border border-[var(--linha-forte)]"
        style={{ width: "var(--controle-h-sm)", height: "var(--controle-h-sm)" }}
      >
        <Icone de={Plus} tamanho="sm" />
      </span>
      {texto}
    </button>
  );
}

/* ─────────────────────────────── o cartão ─────────────────────────────── */

/** Uma coluna do rodapé: o rótulo com o ícone, e o valor (com o avatar, quando é gente). */
export type CampoDoCartao = {
  readonly icone: LucideIcon;
  readonly rotulo: string;
  readonly valor: ReactNode;
  readonly avatar?: ReactNode;
  /** O valor apagado (um "—", um "sem data"). */
  readonly vazio?: boolean;
};

/** O destaque: o que importa no cartão, num ladrilho com ícone. */
export type DestaqueDoCartao = {
  readonly icone: LucideIcon;
  readonly rotulo: string;
  readonly valor: ReactNode;
  /** Ao lado do valor, mais apagado (a probabilidade, há quanto tempo). */
  readonly complemento?: ReactNode;
  /** A cor do ícone (padrão: o acento); um alerta troca a cor. */
  readonly cor?: string;
  /** O valor apagado (sem valor declarado, sem prazo). */
  readonly vazio?: boolean;
};

/** O rosto quando não há foto: o ícone num círculo lavado, do tamanho do avatar grande. */
export function RostoDeIcone({ icone, cor, lavado }: { readonly icone: LucideIcon; readonly cor: string; readonly lavado: string }) {
  return (
    <span aria-hidden="true" className="grid size-16 shrink-0 place-items-center rounded-full" style={{ background: lavado, color: cor }}>
      <Icone de={icone} tamanho="md" />
    </span>
  );
}

export function CartaoDeQuadro({
  href,
  onOpen,
  onDragStart,
  onDragEnd,
  recente = false,
  rosto,
  titulo,
  subtitulo,
  selo,
  pilulas,
  destaque,
  rodape,
}: {
  /** Com `href`, o cartão é um link (o meio-clique abre noutra aba); sem ele, um botão. */
  readonly href?: string;
  /** O clique abre aqui (o painel); com `href`, só o clique simples. */
  readonly onOpen?: () => void;
  readonly onDragStart: () => void;
  readonly onDragEnd: () => void;
  /** O cartão que acabou de nascer ou mudar de coluna: acende em `--acento-lavado` e apaga (`useRecente`). */
  readonly recente?: boolean;
  /** A foto (o `ContactAvatar` grande) ou o `RostoDeIcone`. */
  readonly rosto?: ReactNode;
  readonly titulo: ReactNode;
  readonly subtitulo?: ReactNode;
  /** O selo do ciclo de vida (`StateSeal`), à direita do título. */
  readonly selo?: ReactNode;
  /** As pílulas (o objeto, a temperatura, o Canal, as Tags, os alertas). */
  readonly pilulas?: ReactNode;
  readonly destaque?: DestaqueDoCartao;
  readonly rodape?: readonly [CampoDoCartao, CampoDoCartao];
}) {
  const conteudo = (
    <>
      {/*
        O rosto primeiro, depois o que a coisa é, depois o que importa, depois
        com quem. Cada bloco é separado por linha porque são perguntas
        diferentes.
      */}
      <span className="flex items-start gap-2.5">
        {rosto}
        <span className="min-w-0 flex-1">
          <span className="ed-subtitulo block truncate">{titulo}</span>
          {subtitulo ? (
            <span className="app-base block truncate" style={{ color: "var(--texto-3)" }}>
              {subtitulo}
            </span>
          ) : null}
        </span>
        {selo}
      </span>

      {pilulas ? <span className="mt-3 flex flex-wrap items-center gap-2">{pilulas}</span> : null}

      {destaque ? (
        <span className="mt-3 flex items-center gap-2.5 pt-3" style={{ borderTop: "1px solid var(--linha)" }}>
          <span
            aria-hidden="true"
            className="grid shrink-0 place-items-center rounded-[var(--r-controle)]"
            style={{
              width: "var(--controle-h-sm)",
              height: "var(--controle-h-sm)",
              background: "var(--superficie-2)",
              color: destaque.cor ?? "var(--acento)",
            }}
          >
            <Icone de={destaque.icone} tamanho="sm" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="app-meta block">{destaque.rotulo}</span>
            <span className="app-md app-numero flex min-w-0 items-baseline gap-1.5" style={{ color: destaque.vazio ? "var(--texto-3)" : "var(--texto)" }}>
              <span className="min-w-0 truncate">{destaque.valor}</span>
              {destaque.complemento ? (
                <span className="shrink-0" style={{ fontWeight: 400, color: "var(--texto-3)" }}>
                  {destaque.complemento}
                </span>
              ) : null}
            </span>
          </span>
        </span>
      ) : null}

      {rodape ? (
        <span className="mt-3 grid grid-cols-2 gap-2 pt-3" style={{ borderTop: "1px solid var(--linha)" }}>
          {rodape.map((campo, i) => (
            <span key={campo.rotulo} className={i === 0 ? "min-w-0" : "min-w-0 pl-2"} style={i === 0 ? undefined : { borderLeft: "1px solid var(--linha)" }}>
              <span className="app-meta flex items-center gap-1.5">
                <Icone de={campo.icone} tamanho="xs" />
                {campo.rotulo}
              </span>
              <span className="mt-1 flex min-w-0 items-center gap-1.5">
                {campo.avatar}
                <span className="app-base min-w-0 truncate" style={{ color: campo.vazio ? "var(--texto-3)" : "var(--texto)" }}>
                  {campo.valor}
                </span>
              </span>
            </span>
          ))}
        </span>
      ) : null}
    </>
  );

  // `card-negocio`, não `item-solto`: o arraste briga com o lift do hover.
  const classe = "card-negocio block w-full cursor-grab p-3 text-left active:cursor-grabbing";
  if (href) {
    return (
      <Link
        href={href}
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        {...(onOpen
          ? {
              onClick: (event: React.MouseEvent) => {
                if (event.metaKey || event.ctrlKey || event.button !== 0) return;
                event.preventDefault();
                onOpen();
              },
            }
          : {})}
        className={classe}
        data-recente={recente ? "true" : undefined}
      >
        {conteudo}
      </Link>
    );
  }
  return (
    <button
      type="button"
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className={classe}
      data-recente={recente ? "true" : undefined}
    >
      {conteudo}
    </button>
  );
}
