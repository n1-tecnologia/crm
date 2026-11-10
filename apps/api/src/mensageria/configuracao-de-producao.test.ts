/**
 * A configuração de produção da mensageria (Fase 16, 16-14, T-16-54), sem banco e sem rede: só lê dois arquivos do
 * repositório. O que fecha a lacuna da auditoria de validação (16-VALIDATION.md): o plano 16-14 provava isto só por
 * `grep`, e a unidade de produção é o que impede o worker de entrada e o de saída de subirem sozinhos num deploy.
 *
 * - A unidade `deploy/n1-crm-api.service` fixa `MENSAGERIA_WORKER_ATIVO` e `COLETA_DE_ORFAOS_ATIVA` em `false`: ligar é
 *   um drop-in como root, só do dono. Um valor diferente aqui liga os workers em todo deploy.
 * - O `.env.example` documenta toda variável da mensageria que o código lê, com valor seguro (nunca um endereço ou
 *   uma chave real).
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ_DA_API = join(import.meta.dirname, "..", "..");
const SRC = join(RAIZ_DA_API, "src");

const unidade = readFileSync(join(RAIZ_DA_API, "deploy", "n1-crm-api.service"), "utf8");
const exemplo = readFileSync(join(RAIZ_DA_API, ".env.example"), "utf8");

/** As linhas que valem: sem os comentários (`#`) e sem as linhas em branco. */
const linhasAtivas = (texto: string): string[] =>
  texto
    .split("\n")
    .map((linha) => linha.trim())
    .filter((linha) => linha !== "" && !linha.startsWith("#"));

/** O valor da última atribuição ativa de `nome` (em `NOME=valor` ou `Environment=NOME=valor`), ou `undefined`. */
function valorAtivo(texto: string, nome: string): string | undefined {
  const atribuicoes = linhasAtivas(texto)
    .map((linha) => linha.replace(/^Environment=/, ""))
    .filter((linha) => linha.startsWith(`${nome}=`));
  return atribuicoes.length === 0 ? undefined : atribuicoes[atribuicoes.length - 1]!.slice(nome.length + 1);
}

function arquivosDeCodigo(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return arquivosDeCodigo(caminho);
    return caminho.endsWith(".ts") && !caminho.endsWith(".test.ts") ? [caminho] : [];
  });
}

describe("a unidade de produção (deploy/n1-crm-api.service)", () => {
  it("fixa os dois workers da mensageria em false: ligar é um drop-in do dono", () => {
    expect(valorAtivo(unidade, "MENSAGERIA_WORKER_ATIVO")).toBe("false");
    expect(valorAtivo(unidade, "COLETA_DE_ORFAOS_ATIVA")).toBe("false");
  });

  it("não fixa o tempo real: o padrão do código é ligado e o drop-in o desliga", () => {
    expect(valorAtivo(unidade, "TEMPO_REAL_ATIVO")).toBeUndefined();
  });
});

describe(".env.example documenta a mensageria só com valores seguros", () => {
  it("os workers nascem desligados, o tempo real ligado e os dois endereços vazios", () => {
    expect(valorAtivo(exemplo, "MENSAGERIA_WORKER_ATIVO")).toBe("false");
    expect(valorAtivo(exemplo, "COLETA_DE_ORFAOS_ATIVA")).toBe("false");
    expect(valorAtivo(exemplo, "TEMPO_REAL_ATIVO")).toBe("true");
    expect(valorAtivo(exemplo, "EVOLUTION_URL")).toBe("");
    expect(valorAtivo(exemplo, "API_URL_PUBLICA")).toBe("");
  });

  it("a chave global da Evolution não é variável do runtime e não aparece como atribuição", () => {
    expect(valorAtivo(exemplo, "EVOLUTION_API_KEY")).toBeUndefined();
    expect(valorAtivo(exemplo, "AUTHENTICATION_API_KEY")).toBeUndefined();
  });

  it("toda variável da mensageria que o código lê está no exemplo (ativa ou comentada)", () => {
    const lidas = new Set<string>();
    const arquivos = [...arquivosDeCodigo(join(SRC, "mensageria")), join(SRC, "index.ts")];
    for (const arquivo of arquivos) {
      const codigo = readFileSync(arquivo, "utf8");
      for (const achado of codigo.matchAll(
        /process\.env\.((?:MENSAGERIA_|COLETA_DE_ORFAOS|TEMPO_REAL|EVOLUTION_|API_URL_PUBLICA|UPLOAD_MAX_BYTES_MIDIA)[A-Z0-9_]*)/g,
      )) {
        lidas.add(achado[1]!);
      }
    }
    expect([...lidas].length).toBeGreaterThanOrEqual(4);
    const semDocumentacao = [...lidas].filter((nome) => !new RegExp(`^#?\\s*${nome}=`, "m").test(exemplo));
    expect(semDocumentacao).toEqual([]);
  });
});
