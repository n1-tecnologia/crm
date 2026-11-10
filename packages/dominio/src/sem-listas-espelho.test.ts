/**
 * D-06 (Fase 14): as Listas espelho de Meus negócios foram aposentadas. "Meus
 * negócios" vira o quadro de `/crm/funis/[funil]` com o filtro "meus", a Lista não
 * ganha o campo `funilId` e a regra de formato de id `funilDaLista`
 * (`lst_funil_<x>` ↔ `fnl_<x>`) não é portada: os Funis novos têm id UUID.
 *
 * Este teste LÊ o código-fonte do domínio (sem banco) e congelava a lista de arquivos
 * de produção que citavam `funilDaLista` ou o caminho `iniciar-conversa`. A 15-32 apagou
 * `operations/iniciar-conversa.ts` e tirou as citações de `operations/index.ts` e de
 * `operations/registro.ts`: a lista chegou a zero e o teste continua proibindo qualquer
 * citação nova.
 *
 * O texto inteiro conta, comentário inclusive: citar a regra num comentário já é
 * apontar para ela. O mesmo teste existe em `apps/api/src/sem-listas-espelho.test.ts`.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** Os arquivos de `packages/dominio/src` que citam as Listas espelho hoje: nenhum (15-32). */
const CONGELADOS: readonly string[] = [];

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

describe("D-06 — nada novo depende das Listas espelho (domínio)", () => {
  const producao = arquivosDeProducao(RAIZ).map((caminho) => ({
    arquivo: relative(RAIZ, caminho).split(sep).join("/"),
    texto: readFileSync(caminho, "utf8"),
  }));

  it("a leitura do código-fonte achou os arquivos de produção (o teste não passa por não ver nada)", () => {
    expect(producao.length).toBeGreaterThan(50);
    // Sentinela que continua existindo: o registro de operações, que já citou o módulo apagado.
    expect(producao.map((f) => f.arquivo)).toContain("operations/registro.ts");
    expect(producao.map((f) => f.arquivo)).not.toContain("operations/iniciar-conversa.ts");
  });

  it("nenhum arquivo de produção cita funilDaLista nem iniciar-conversa", () => {
    const citam = producao.filter((f) => CITA_AS_LISTAS_ESPELHO.test(f.texto)).map((f) => f.arquivo).sort();
    const novos = citam.filter((arquivo) => !(CONGELADOS as readonly string[]).includes(arquivo));
    const sumidos = CONGELADOS.filter((arquivo) => !citam.includes(arquivo));
    expect(
      novos,
      `D-06 (Fase 14): as Listas espelho de Meus negócios foram aposentadas; código novo não depende delas. A lista congelada chegou a zero (15-32). Arquivo(s) que as citam: ${novos.join(", ")}`,
    ).toEqual([]);
    expect(
      sumidos,
      `A lista congelada está desatualizada: ${sumidos.join(", ")} deixou(aram) de citar as Listas espelho. Tire-o(s) de CONGELADOS (só encolhe).`,
    ).toEqual([]);
  });
});
