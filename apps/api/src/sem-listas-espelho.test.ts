/**
 * D-06 (Fase 14): as Listas espelho de Meus negócios foram aposentadas. "Meus
 * negócios" vira o quadro de `/crm/funis/[funil]` com o filtro "meus", a Lista não
 * ganha o campo `funilId` e a regra de formato de id `funilDaLista`
 * (`lst_funil_<x>` ↔ `fnl_<x>`) não é portada: os Funis novos têm id UUID.
 *
 * Este teste LÊ o código-fonte da api (sem banco) e congela a lista de arquivos de
 * produção que HOJE citam `funilDaLista` ou o caminho `iniciar-conversa` (o schema
 * da operação e o registro que o aponta). Código novo da Fase 14 não entra nela.
 * Só os planos de corte (14-16) a encolhem, quando a operação sai; nunca a aumentam.
 *
 * O texto inteiro conta, comentário inclusive. O mesmo teste existe em
 * `packages/dominio/src/sem-listas-espelho.test.ts`.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** Os arquivos de `apps/api/src` que citam as Listas espelho hoje (a lista congelada). */
const CONGELADOS = ["rotas/esquemas-de-argumentos.ts", "rotas/esquemas/iniciar-conversa.ts"] as const;

const CITA_AS_LISTAS_ESPELHO = /funilDaLista|iniciar-conversa/;

const RAIZ = fileURLToPath(new URL(".", import.meta.url));

function arquivosDeProducao(pasta: string): string[] {
  const achados: string[] = [];
  for (const entrada of readdirSync(pasta, { withFileTypes: true })) {
    const caminho = join(pasta, entrada.name);
    if (entrada.isDirectory()) achados.push(...arquivosDeProducao(caminho));
    else if (entrada.name.endsWith(".ts") && !entrada.name.endsWith(".test.ts")) achados.push(caminho);
  }
  return achados;
}

describe("D-06 — nada novo depende das Listas espelho (api)", () => {
  const producao = arquivosDeProducao(RAIZ).map((caminho) => ({
    arquivo: relative(RAIZ, caminho).split(sep).join("/"),
    texto: readFileSync(caminho, "utf8"),
  }));

  it("a leitura do código-fonte achou os arquivos de produção (o teste não passa por não ver nada)", () => {
    expect(producao.length).toBeGreaterThan(50);
    expect(producao.map((f) => f.arquivo)).toContain("rotas/esquemas/iniciar-conversa.ts");
  });

  it("só a lista congelada de hoje cita funilDaLista ou iniciar-conversa", () => {
    const citam = producao.filter((f) => CITA_AS_LISTAS_ESPELHO.test(f.texto)).map((f) => f.arquivo).sort();
    const novos = citam.filter((arquivo) => !(CONGELADOS as readonly string[]).includes(arquivo));
    const sumidos = CONGELADOS.filter((arquivo) => !citam.includes(arquivo));
    expect(
      novos,
      `D-06 (Fase 14): as Listas espelho de Meus negócios foram aposentadas; código novo não depende delas. Só os planos de corte encolhem esta lista. Arquivo(s) novo(s) que as citam: ${novos.join(", ")}`,
    ).toEqual([]);
    expect(
      sumidos,
      `A lista congelada está desatualizada: ${sumidos.join(", ")} deixou(aram) de citar as Listas espelho. Tire-o(s) de CONGELADOS (só encolhe).`,
    ).toEqual([]);
  });
});
