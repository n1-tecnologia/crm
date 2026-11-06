/**
 * Os nomes do CRM novo em lote (15-10, UCR-08): o teto do lote e os tipos de alvo.
 */

import { describe, expect, it } from "vitest";
import { TIPOS_DE_OBJETO_DO_CRM } from "./atividades";
import { NOMES_MAXIMO, type AlvoDoCrm, type NomeDoAlvo } from "./nomes";

describe("nomes do CRM em lote", () => {
  it("o teto do lote é 200 alvos por chamada", () => {
    expect(NOMES_MAXIMO).toBe(200);
  });

  it("o alvo usa os mesmos seis tipos de objeto da Atividade, e o nome pode ser null", () => {
    // `satisfies` prende a compatibilidade em tempo de compilação: um tipo novo na Atividade entra aqui sem migração.
    const alvos = TIPOS_DE_OBJETO_DO_CRM.map((tipo) => ({ tipo, id: `${tipo}-1` }) satisfies AlvoDoCrm);
    const semNome: NomeDoAlvo[] = alvos.map((alvo) => ({ ...alvo, nome: null }));
    expect(TIPOS_DE_OBJETO_DO_CRM).toEqual(["contact", "company", "deal", "conversation", "funnel", "channel"]);
    expect(semNome.every((item) => item.nome === null)).toBe(true);
  });
});
