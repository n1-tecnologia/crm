/**
 * A Nota do Contato (3.2.7): o texto que um Membro deixa na ficha. A regra que a
 * tela pré-valida e o endpoint aplica é a mesma, e `recusaDeNotaNoContato` diz
 * em que estado de Contato nota nenhuma entra (RN-CON-14 e a lixeira).
 */

import { describe, expect, it } from "vitest";
import { LIMITES_CRM } from "./comum";
import { recusaDeNotaNoContato, validarNovaNota } from "./notas";

describe("validarNovaNota", () => {
  it("recusa a nota só com espaços, no campo conteudo", () => {
    expect(validarNovaNota({ conteudo: "   " })).toEqual({
      ok: false,
      error: "Escreva a nota antes de salvar.",
      field: "conteudo",
    });
  });

  it("recusa a nota acima do teto do texto longo, no campo conteudo", () => {
    const r = validarNovaNota({ conteudo: "a".repeat(LIMITES_CRM.textoLongo + 1) });
    expect(!r.ok && r.field).toBe("conteudo");
  });

  it("aceita a nota no teto e devolve o conteúdo aparado (D-04: só texto)", () => {
    const r = validarNovaNota({ conteudo: `  ${"a".repeat(LIMITES_CRM.textoLongo - 2)}  ` });
    expect(r.ok && r.value.conteudo.length).toBe(LIMITES_CRM.textoLongo - 2);
  });
});

describe("recusaDeNotaNoContato", () => {
  it("dá a frase para o Contato mesclado e para o que está na lixeira", () => {
    expect(recusaDeNotaNoContato({ estado: "mesclado" })).toBe(
      "Um Contato mesclado é somente leitura. Escreva a nota no Contato que ficou.",
    );
    expect(recusaDeNotaNoContato({ estado: "na_lixeira" })).toBe("Este Contato está na lixeira. Restaure-o antes de escrever a nota.");
  });

  it("deixa passar o Contato ativo e o arquivado", () => {
    expect(recusaDeNotaNoContato({ estado: "ativo" })).toBeUndefined();
    expect(recusaDeNotaNoContato({ estado: "arquivado" })).toBeUndefined();
  });
});
