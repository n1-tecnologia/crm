/**
 * A moldura dos documentos legais públicos (`/privacidade`, `/termos`).
 *
 * Server Component, sem store e sem sessão: o documento se alcança sem login
 * (a Meta e o titular precisam abri-lo antes de ter conta). Os documentos
 * escrevem só o texto — título, seções e listas; a marca, o sumário, a
 * identificação da controladora e a ponte para o outro documento são daqui.
 */

import Link from "next/link";
import type { ReactNode } from "react";
import { Painel } from "@/design/basicos";
import { BrandLockup } from "@/features/shell/brand";
import { EMPRESA, VIGENTE_DESDE } from "./dados-da-empresa";

export type SecaoLegal = {
  readonly id: string;
  readonly titulo: string;
  readonly conteudo: ReactNode;
};

export function DocumentoLegal({
  titulo,
  resumo,
  secoes,
  outro,
}: {
  readonly titulo: string;
  readonly resumo: string;
  readonly secoes: readonly SecaoLegal[];
  /** O documento irmão, para a ponte no fim da página. */
  readonly outro: { readonly href: string; readonly rotulo: string };
}) {
  return (
    <main className="grade-pontos min-h-screen px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <Link href="/entrar" aria-label={`${EMPRESA.produto} — entrar`}>
            <BrandLockup size={28} tone="gradiente" orientacao="horizontal" />
          </Link>
          <Link href="/entrar" className="app-sm hover:underline" style={{ color: "var(--acento)" }}>
            Entrar
          </Link>
        </header>

        <Painel solido className="p-6 sm:p-10">
          <p className="ed-eyebrow">{EMPRESA.produto}</p>
          <h1 className="ed-titulo mt-1" style={{ color: "var(--texto)" }}>
            {titulo}
          </h1>
          <p className="app-meta mt-2">Vigente desde {VIGENTE_DESDE}</p>
          <p className="app-base mt-4" style={{ color: "var(--texto-2)" }}>
            {resumo}
          </p>

          <nav aria-label="Neste documento" className="mt-6 rounded-md p-4" style={{ border: "1px solid var(--linha-sutil)" }}>
            <p className="app-coluna">Neste documento</p>
            <ol className="app-sm mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
              {secoes.map((secao, i) => (
                <li key={secao.id}>
                  <a href={`#${secao.id}`} className="hover:underline" style={{ color: "var(--texto-3)" }}>
                    {i + 1}. {secao.titulo}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="mt-8 flex flex-col gap-8">
            {secoes.map((secao, i) => (
              <section key={secao.id} id={secao.id} aria-labelledby={`${secao.id}-titulo`} className="scroll-mt-6">
                <h2 id={`${secao.id}-titulo`} className="ed-subtitulo" style={{ color: "var(--texto)" }}>
                  {i + 1}. {secao.titulo}
                </h2>
                <div className="app-base mt-3 flex flex-col gap-3" style={{ color: "var(--texto-1)" }}>
                  {secao.conteudo}
                </div>
              </section>
            ))}
          </div>
        </Painel>

        <footer className="app-sm mt-6 flex flex-wrap items-center justify-between gap-2" style={{ color: "var(--texto-3)" }}>
          <span>
            © {EMPRESA.nome}. {EMPRESA.produto}.
          </span>
          <Link href={outro.href} className="hover:underline" style={{ color: "var(--acento)" }}>
            {outro.rotulo}
          </Link>
        </footer>
      </div>
    </main>
  );
}

/** Lista de marcadores dentro de uma seção. */
export function Itens({ children }: { readonly children: ReactNode }) {
  return <ul className="ml-5 flex list-disc flex-col gap-1.5">{children}</ul>;
}

/** Linha de identificação da controladora; some quando o campo não foi preenchido. */
export function Identificacao() {
  const linhas: readonly (readonly [string, string | null])[] = [
    ["Controladora", EMPRESA.razaoSocial ?? EMPRESA.nome],
    ["CNPJ", EMPRESA.cnpj],
    ["Endereço", EMPRESA.endereco],
    ["Encarregado pelo tratamento de dados", EMPRESA.encarregado],
    ["Contato", EMPRESA.emailPrivacidade],
  ];
  return (
    <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[max-content_1fr]">
      {linhas.map(([rotulo, valor]) =>
        valor ? (
          <div key={rotulo} className="contents">
            <dt style={{ color: "var(--texto-3)" }}>{rotulo}</dt>
            <dd>
              {rotulo === "Contato" ? (
                <a href={`mailto:${valor}`} className="hover:underline" style={{ color: "var(--acento)" }}>
                  {valor}
                </a>
              ) : (
                valor
              )}
            </dd>
          </div>
        ) : null,
      )}
    </dl>
  );
}

/** Como falar com a controladora: o e-mail quando existe, a conta quando não. */
export function ComoFalarConosco() {
  return EMPRESA.emailPrivacidade ? (
    <>
      Escreva para{" "}
      <a href={`mailto:${EMPRESA.emailPrivacidade}`} className="hover:underline" style={{ color: "var(--acento)" }}>
        {EMPRESA.emailPrivacidade}
      </a>
      .
    </>
  ) : (
    <>Fale com o responsável pelo seu Espaço de Trabalho ou pelo atendimento que você já usa com a {EMPRESA.nome}.</>
  );
}
