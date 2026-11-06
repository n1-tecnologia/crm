/**
 * 15-26 (UCR-06, F14-D-06, D-15-14): "Meus negócios" não é mais rota nem árvore
 * do CRM. É o botão "Meus" do quadro de Negócios (`?meus=1`), e o atalho do menu
 * do CRM leva a `/crm/negocios?meus=1`.
 *
 * Este teste LÊ o código-fonte da web (sem navegador, sem banco). A "página 404
 * do app" da borda de UCR-06 é a consequência de não haver arquivo de rota: no
 * App Router, o endereço que nenhum `page.tsx` serve cai no 404 do app. O que o
 * teste prova, então, é a ausência do arquivo e de quem apontava para ele.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const RAIZ = fileURLToPath(new URL(".", import.meta.url));

function ehDeProducao(nome: string): boolean {
  return /\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome);
}

function arquivosDeProducao(pasta: string): string[] {
  const achados: string[] = [];
  for (const entrada of readdirSync(pasta, { withFileTypes: true })) {
    const caminho = join(pasta, entrada.name);
    if (entrada.isDirectory()) achados.push(...arquivosDeProducao(caminho));
    else if (ehDeProducao(entrada.name)) achados.push(caminho);
  }
  return achados;
}

const producao = arquivosDeProducao(RAIZ).map((caminho) => ({
  arquivo: relative(RAIZ, caminho).split(sep).join("/"),
  texto: readFileSync(caminho, "utf8"),
}));

describe("15-26 — Meus negócios não existe mais como rota nem como árvore do CRM", () => {
  it("a leitura do código-fonte achou os arquivos de produção (o teste não passa por não ver nada)", () => {
    expect(producao.length).toBeGreaterThan(100);
    expect(producao.map((f) => f.arquivo)).toContain("app/(shell)/crm/negocios/page.tsx");
  });

  it("não há arquivo de rota sob /crm/meus-negocios (o endereço cai no 404 do app)", () => {
    expect(existsSync(join(RAIZ, "app/(shell)/crm/meus-negocios"))).toBe(false);
    expect(producao.filter((f) => f.arquivo.startsWith("app/(shell)/crm/meus-negocios"))).toEqual([]);
  });

  it("nenhum arquivo de produção aponta para /crm/meus-negocios", () => {
    const citam = producao.filter((f) => f.texto.includes("/crm/meus-negocios")).map((f) => f.arquivo);
    expect(citam, `ainda apontam para a rota apagada: ${citam.join(", ")}`).toEqual([]);
  });

  it("o menu do CRM não desenha mais a árvore (nem o componente) de Meus negócios", () => {
    const casca = producao.find((f) => f.arquivo === "features/shell/app-shell.tsx")?.texto ?? "";
    expect(casca).not.toContain("MeusNegociosNoPainel");
    expect(casca).not.toContain("comMeusNegocios");
    expect(casca).not.toContain("Pastas de Negócios");
  });

  it("o atalho \"Meus negócios\" do menu do CRM leva ao quadro de Negócios com o filtro \"Meus\" ligado", () => {
    const casca = producao.find((f) => f.arquivo === "features/shell/app-shell.tsx")?.texto ?? "";
    expect(casca).toMatch(/href:\s*"\/crm\/negocios\?meus=1",\s*rotulo:\s*"Meus negócios"/);
  });
});
