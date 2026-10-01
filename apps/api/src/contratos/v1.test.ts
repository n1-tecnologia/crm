/**
 * Prova, lendo as fixtures de `contratos/payment-requests-v1/` (raiz do
 * monorepo — leitura de arquivo, nunca fixture inline, para ser exatamente
 * a mesma matriz que o `financeiro-tria` roda depois de copiar o
 * diretório, Plan 02-26): que os sete métodos do adapter aceitam/rejeitam
 * exatamente o que `EsquemasV1` promete, que todo envelope `erro-*` casa
 * com `CODIGOS_DE_ERRO`, e que a contagem de arquivos por método bate com
 * a matriz — um método que ganhar endpoint sem fixture correspondente faz
 * este teste falhar.
 */

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CODIGOS_DE_ERRO, type CodigoDeErroV1 } from "./erros";
import { EsquemasV1, StatusSolicitacaoV1, type NomeDeEndpointV1 } from "./v1";

const FIXTURES_DIR = fileURLToPath(new URL("../../../../contratos/payment-requests-v1/", import.meta.url));

const METODOS_LEITURA: readonly NomeDeEndpointV1[] = ["getTask", "listPaymentRequestTasks", "getCommentReplies"];
const METODOS_ESCRITA: readonly NomeDeEndpointV1[] = [
  "createComment",
  "addTaskTag",
  "updateTaskDueDate",
  "updateTaskStatus",
];
const TODOS_OS_METODOS: readonly NomeDeEndpointV1[] = [...METODOS_LEITURA, ...METODOS_ESCRITA];

/** Toda categoria que os sete métodos têm — GET e escrita. */
const CATEGORIAS_COMUNS = [
  "sucesso-minimo",
  "sucesso-completo",
  "invalido-campo-obrigatorio-ausente",
  "invalido-enum-desconhecido",
  "erro-401",
  "erro-403",
  "erro-404",
  "erro-429",
  "erro-503",
] as const;

/** Só os quatro métodos de escrita: idempotência é conceito de escrita. */
const CATEGORIAS_DE_ESCRITA = [...CATEGORIAS_COMUNS, "erro-409", "erro-422"] as const;
const CATEGORIAS_DE_REPLAY = ["replay-mesma-chave", "replay-chave-igual-payload-diferente"] as const;

/**
 * Categorias extras que só um método tem, além da matriz comum acima — hoje só
 * `getTask.sucesso-em-revisao` (D5-06, o 5º Status do contrato v1, Phase 5 Plan
 * 05-03). Sem esta lista, "contagem de arquivos bate com a matriz esperada"
 * abaixo falharia para `getTask` ao ganhar esta fixture a mais.
 */
const CATEGORIAS_EXTRAS_POR_METODO: Readonly<Partial<Record<NomeDeEndpointV1, readonly string[]>>> = {
  getTask: ["sucesso-em-revisao"],
  createComment: ["sucesso-pedindo-aprovacao"],
};

function categoriasEsperadas(metodo: NomeDeEndpointV1): readonly string[] {
  const base = METODOS_ESCRITA.includes(metodo) ? [...CATEGORIAS_DE_ESCRITA, ...CATEGORIAS_DE_REPLAY] : CATEGORIAS_COMUNS;
  return [...base, ...(CATEGORIAS_EXTRAS_POR_METODO[metodo] ?? [])];
}

interface Fixture {
  readonly descricao: string;
  readonly requisicao: unknown;
  readonly resposta: { readonly status: number; readonly corpo: unknown };
}

function lerFixture(metodo: string, categoria: string): Fixture {
  const caminho = `${FIXTURES_DIR}${metodo}.${categoria}.json`;
  return JSON.parse(readFileSync(caminho, "utf8")) as Fixture;
}

/** Envelope de erro (§3 do contrato): code presente em CODIGOS_DE_ERRO, status HTTP e retryable batendo com o catálogo. */
function verificarEnvelopeDeErro(fixture: Fixture): void {
  const corpo = fixture.resposta.corpo as { error?: { code?: string; retryable?: boolean } };
  expect(corpo.error, `${fixture.descricao} — corpo sem "error"`).toBeDefined();
  const codigo = corpo.error!.code as CodigoDeErroV1;
  const catalogo = CODIGOS_DE_ERRO[codigo];
  expect(catalogo, `código "${codigo}" não existe em CODIGOS_DE_ERRO`).toBeDefined();
  expect(fixture.resposta.status).toBe(catalogo.status);
  expect(corpo.error!.retryable).toBe(catalogo.retryable);
}

describe("StatusSolicitacaoV1 — 5º Status (D5-06)", () => {
  it("tem exatamente cinco valores, nesta ordem — os quatro de D-01 mais 'em revisão' por último", () => {
    expect(StatusSolicitacaoV1.options).toEqual(["para fazer", "em aprovação", "não aprovado", "aprovado", "em revisão"]);
  });

  it("rejeita 'em revisao' sem acento — o enum é literal, não normalizado", () => {
    expect(StatusSolicitacaoV1.safeParse("em revisao").success).toBe(false);
  });

  it("aceita 'em revisão' com acento", () => {
    expect(StatusSolicitacaoV1.safeParse("em revisão").success).toBe(true);
  });
});

describe("contrato v1 — matriz de fixtures por método", () => {
  for (const metodo of TODOS_OS_METODOS) {
    const esquema = EsquemasV1[metodo];

    describe(metodo, () => {
      it("contagem de arquivos bate com a matriz esperada", () => {
        const arquivos = readdirSync(FIXTURES_DIR).filter(
          (f) => f.startsWith(`${metodo}.`) && f.endsWith(".json"),
        );
        expect(arquivos.length).toBe(categoriasEsperadas(metodo).length);
      });

      it("sucesso-minimo é aceita pelo schema de resposta", () => {
        const fixture = lerFixture(metodo, "sucesso-minimo");
        const resultado = esquema.resposta.safeParse(fixture.resposta.corpo);
        expect(resultado.success, JSON.stringify(!resultado.success && resultado.error.issues)).toBe(true);
      });

      it("sucesso-completo é aceita pelo schema de resposta", () => {
        const fixture = lerFixture(metodo, "sucesso-completo");
        const resultado = esquema.resposta.safeParse(fixture.resposta.corpo);
        expect(resultado.success, JSON.stringify(!resultado.success && resultado.error.issues)).toBe(true);
      });

      it("invalido-campo-obrigatorio-ausente é rejeitada pelo schema de resposta", () => {
        const fixture = lerFixture(metodo, "invalido-campo-obrigatorio-ausente");
        expect(esquema.resposta.safeParse(fixture.resposta.corpo).success).toBe(false);
      });

      it("invalido-enum-desconhecido é rejeitada pelo schema de resposta", () => {
        const fixture = lerFixture(metodo, "invalido-enum-desconhecido");
        expect(esquema.resposta.safeParse(fixture.resposta.corpo).success).toBe(false);
      });

      for (const categoriaExtra of CATEGORIAS_EXTRAS_POR_METODO[metodo] ?? []) {
        it(`${categoriaExtra} é aceita pelo schema de resposta`, () => {
          const fixture = lerFixture(metodo, categoriaExtra);
          const resultado = esquema.resposta.safeParse(fixture.resposta.corpo);
          expect(resultado.success, JSON.stringify(!resultado.success && resultado.error.issues)).toBe(true);
        });
      }

      for (const codigoHttp of [401, 403, 404, 429, 503] as const) {
        it(`erro-${codigoHttp} casa com o envelope de erro e com retryable de CODIGOS_DE_ERRO`, () => {
          verificarEnvelopeDeErro(lerFixture(metodo, `erro-${codigoHttp}`));
        });
      }

      if (METODOS_ESCRITA.includes(metodo)) {
        for (const codigoHttp of [409, 422] as const) {
          it(`erro-${codigoHttp} casa com o envelope de erro e com retryable de CODIGOS_DE_ERRO`, () => {
            verificarEnvelopeDeErro(lerFixture(metodo, `erro-${codigoHttp}`));
          });
        }

        it("replay-mesma-chave é aceita pelo schema de resposta (mesma resposta gravada, D-09)", () => {
          const fixture = lerFixture(metodo, "replay-mesma-chave");
          expect(esquema.resposta.safeParse(fixture.resposta.corpo).success).toBe(true);
        });

        it("replay-chave-igual-payload-diferente é 409 IDEMPOTENCY_KEY_REUSED", () => {
          const fixture = lerFixture(metodo, "replay-chave-igual-payload-diferente");
          verificarEnvelopeDeErro(fixture);
          const corpo = fixture.resposta.corpo as { error: { code: string } };
          expect(corpo.error.code).toBe("IDEMPOTENCY_KEY_REUSED");
        });
      }
    });
  }
});
