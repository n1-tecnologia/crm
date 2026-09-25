/**
 * Prova pura de `classificarLinha` e `resolverAutoriaLegada` — os dez casos
 * (a)-(j) do Plan 02-22, Task 3. Roda sempre, sem `DATABASE_URL`: lê a
 * fixture do disco (`./fixtures/solicitacoes-sanitizadas.json`), nunca abre
 * uma conexão. `lerSolicitacoesLegadas` (I/O real) não tem teste de
 * integração neste plano — o `--apply` do Plan 02-25 é quem exercita isso
 * contra um banco de verdade.
 */

import { describe, expect, it } from "vitest";
import { CAMPOS_SOLICITACAO_DE_PAGAMENTO } from "@n1/dominio/solicitacao-de-pagamento";
import fixture from "./fixtures/solicitacoes-sanitizadas.json";
import { resolverAutoriaLegada } from "./de-para";
import { classificarLinha, type LinhaLegadaBruta } from "./solicitacoes";

const linhas = fixture.linhas as unknown as ReadonlyArray<LinhaLegadaBruta & { readonly id: number }>;

function linha(id: number): LinhaLegadaBruta {
  const encontrada = linhas.find((l) => l.id === id);
  if (!encontrada) throw new Error(`Fixture não tem a linha id=${id}.`);
  return encontrada;
}

/** Varredura recursiva: nenhuma chave/valor de `alvo` pode aparecer em `objeto`. */
function contemChaveOuValor(objeto: unknown, alvo: string): boolean {
  if (objeto === null || objeto === undefined) return false;
  if (typeof objeto === "string") return objeto.includes(alvo);
  if (Array.isArray(objeto)) return objeto.some((item) => contemChaveOuValor(item, alvo));
  if (typeof objeto === "object") {
    return Object.entries(objeto as Record<string, unknown>).some(
      ([chave, valor]) => chave.includes(alvo) || contemChaveOuValor(valor, alvo),
    );
  }
  return false;
}

describe("classificarLinha", () => {
  it("(a) linhas válidas e completas classificam como valida, com status correto", () => {
    const aprovada = classificarLinha(linha(1));
    expect(aprovada.resultado).toBe("valida");
    expect(aprovada.entrada?.status).toBe("aprovado");

    const naoAprovada = classificarLinha(linha(2));
    expect(naoAprovada.resultado).toBe("valida");
    expect(naoAprovada.entrada?.status).toBe("não aprovado");
  });

  it("(b) TaskID nulo rejeita com motivo taskid_ausente", () => {
    const r = classificarLinha(linha(11));
    expect(r.resultado).toBe("rejeitada");
    expect(r.motivo).toBe("taskid_ausente");
  });

  it("(c) TaskID duplicado: a segunda ocorrência rejeita com motivo taskid_duplicado", () => {
    const primeira = classificarLinha(linha(1));
    expect(primeira.resultado).toBe("valida");
    const vistos = new Set<string>([primeira.entrada!.legacyTaskId]);

    const segunda = classificarLinha(linha(12), vistos);
    expect(segunda.resultado).toBe("rejeitada");
    expect(segunda.motivo).toBe("taskid_duplicado");
  });

  it("(d) Aprovado nulo e Aprovado 'talvez' são sempre ambigua/aprovado_ambiguo, nunca aprovado", () => {
    const nulo = classificarLinha(linha(13));
    expect(nulo.resultado).toBe("ambigua");
    expect(nulo.motivo).toBe("aprovado_ambiguo");

    const foraDoDominio = classificarLinha(linha(14));
    expect(foraDoDominio.resultado).toBe("ambigua");
    expect(foraDoDominio.motivo).toBe("aprovado_ambiguo");
  });

  it("(e) toda linha válida leva as lacunas valor_ausente e documento_ausente, e nenhum Campo Valor/CPF/CNPJ — a origem não tem essas colunas", () => {
    for (const id of [1, 2, 16, 17, 18]) {
      const r = classificarLinha(linha(id));
      expect(r.resultado).toBe("valida");
      expect(r.entrada?.lacunas).toEqual(expect.arrayContaining(["valor_ausente", "documento_ausente"]));
      const rotulosPreenchidos = Object.keys(r.entrada?.campos ?? {}).map(
        (id) => CAMPOS_SOLICITACAO_DE_PAGAMENTO.find((c) => c.id === id)?.rotulo,
      );
      for (const rotulo of ["Valor", "Fornecedor", "CPF", "CNPJ"]) expect(rotulosPreenchidos).not.toContain(rotulo);
    }
  });

  it("(f) created_at ausente: criadaEm indefinido e lacuna data_de_criacao_ausente; Data Vencimento em formato inesperado vira lacuna, sem parse otimista", () => {
    const semData = classificarLinha(linha(19));
    expect(semData.resultado).toBe("valida");
    expect(semData.entrada?.criadaEm).toBeUndefined();
    expect(semData.entrada?.lacunas).toContain("data_de_criacao_ausente");

    const formatoInesperado = classificarLinha(linha(20));
    expect(formatoInesperado.resultado).toBe("valida");
    expect(formatoInesperado.entrada?.lacunas).toContain("data_vencimento_formato_inesperado");
    expect(Object.values(formatoInesperado.entrada?.campos ?? {})).not.toContain("2026-08-20");
    expect(Object.values(formatoInesperado.entrada?.campos ?? {})).not.toContain("20/08/2026");
  });

  it("(g) linhas com app_key/app_secret: o objeto devolvido não contém essas chaves em nenhum nível", () => {
    const comAppKey = classificarLinha(linha(22));
    expect(contemChaveOuValor(comAppKey, "app_key")).toBe(false);
    expect(contemChaveOuValor(comAppKey, "chave-omie-ficticia-nao-real-0001")).toBe(false);

    const comAppSecret = classificarLinha(linha(23));
    expect(contemChaveOuValor(comAppSecret, "app_secret")).toBe(false);
    expect(contemChaveOuValor(comAppSecret, "segredo-omie-ficticio-nao-real-0002")).toBe(false);
  });

  it("(h) comentario com Markdown: resumo preserva o texto byte a byte", () => {
    const original = linha(16).comentario as string;
    const r = classificarLinha(linha(16));
    expect(r.entrada?.resumo).toBe(original);
    expect(r.entrada?.resumo).toContain("\n");
    expect(r.entrada?.resumo).toContain("**Observação**");
  });

  it("(i) linha rejeitada/ambígua nunca carrega o conteúdo do campo problemático — só categorias e TaskID", () => {
    const semCentro = classificarLinha(linha(24));
    expect(semCentro.resultado).toBe("rejeitada");
    expect(semCentro.motivo).toBe("centro_custo_ausente");
    expect((semCentro as { entrada?: unknown }).entrada).toBeUndefined();
    expect(contemChaveOuValor(semCentro, (linha(24).comentario as string))).toBe(false);

    const centroInvalido = classificarLinha(linha(25));
    expect(centroInvalido.resultado).toBe("rejeitada");
    expect(centroInvalido.motivo).toBe("centro_custo_invalido");
    expect(contemChaveOuValor(centroInvalido, "Centro Que Não Existe")).toBe(false);

    const ambigua = classificarLinha(linha(13));
    expect(contemChaveOuValor(ambigua, "aprovado_ambiguo")).toBe(true); // é a categoria, não vazamento
    expect((ambigua as { entrada?: unknown }).entrada).toBeUndefined();
  });
});

describe("resolverAutoriaLegada", () => {
  it("(j) o revisor FO (81581802) é autoria não demonstrável — sem lançar, sem inventar e-mail", () => {
    expect(() => resolverAutoriaLegada("81581802")).not.toThrow();
    expect(resolverAutoriaLegada("81581802")).toBeUndefined();
  });

  it("id conhecido (Maryane, 81581816) resolve para o Membro já existente", () => {
    expect(resolverAutoriaLegada("81581816")).toEqual({ memberId: "mem_maryane" });
  });

  it("id ausente ou desconhecido nunca lança", () => {
    expect(() => resolverAutoriaLegada(undefined)).not.toThrow();
    expect(resolverAutoriaLegada(undefined)).toBeUndefined();
    expect(resolverAutoriaLegada(null)).toBeUndefined();
    expect(resolverAutoriaLegada("id-que-nao-existe")).toBeUndefined();
  });
});
