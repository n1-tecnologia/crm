/**
 * Regras de Negócio do domínio (07-08, Task 1). Casos (a)-(g): criação com
 * Empresa OU Contato, movimento, ganho e perda com as Regras de encerramento
 * do Funil, reabertura (RN-FUN-14), probabilidade efetiva e edição.
 */

import { describe, expect, it } from "vitest";
import {
  probabilidadeEfetiva,
  validarEdicao,
  validarGanho,
  validarMovimento,
  validarNovoNegocio,
  validarPerda,
  validarReabertura,
  valorPonderado,
  type FunilDeNegocio,
  type Negocio,
  type NovoNegocio,
} from "./negocios";

const novo = (sobre: Partial<NovoNegocio> = {}): NovoNegocio => ({ titulo: "Contrato anual", contatoId: "c1", ...sobre });

const funil = (sobre: Partial<FunilDeNegocio> = {}): FunilDeNegocio => ({ id: "f1", estado: "ativo", ...sobre });

const negocio = (sobre: Partial<Negocio> = {}): Pick<Negocio, "situacao" | "estado" | "funilId" | "valor" | "probabilidade" | "empresaId" | "contatoId"> => ({
  situacao: "aberto",
  estado: "ativo",
  funilId: "f1",
  valor: null,
  probabilidade: null,
  empresaId: null,
  contatoId: "c1",
  ...sobre,
});

describe("validarNovoNegocio (a)", () => {
  it("aceita título com um Contato", () => {
    expect(validarNovoNegocio(novo()).ok).toBe(true);
  });

  it("aceita título com uma Empresa", () => {
    expect(validarNovoNegocio(novo({ contatoId: undefined, empresaId: "e1" })).ok).toBe(true);
  });

  it("recusa título vazio", () => {
    const resultado = validarNovoNegocio(novo({ titulo: "   " }));
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.field).toBe("titulo");
  });

  it("recusa Empresa e Contato juntos", () => {
    const resultado = validarNovoNegocio(novo({ empresaId: "e1", contatoId: "c1" }));
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toBe("Um Negócio é de uma Empresa ou de um Contato.");
  });

  it("recusa nenhum dos dois", () => {
    const resultado = validarNovoNegocio({ titulo: "Sem dono" });
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toBe("Um Negócio é de uma Empresa ou de um Contato.");
  });

  it("valor: '12,50', '-1' e 16 dígitos falham; '1234.5' vale", () => {
    expect(validarNovoNegocio(novo({ valor: "12,50" })).ok).toBe(false);
    expect(validarNovoNegocio(novo({ valor: "-1" })).ok).toBe(false);
    expect(validarNovoNegocio(novo({ valor: "1234567890123456" })).ok).toBe(false);
    expect(validarNovoNegocio(novo({ valor: "1234.5" })).ok).toBe(true);
  });

  it("moeda em minúsculas falha", () => {
    const resultado = validarNovoNegocio(novo({ moeda: "brl" }));
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.field).toBe("moeda");
    expect(validarNovoNegocio(novo({ moeda: "BRL" })).ok).toBe(true);
  });

  it("probabilidade 101 falha; 0 e 100 valem", () => {
    expect(validarNovoNegocio(novo({ probabilidade: 101 })).ok).toBe(false);
    expect(validarNovoNegocio(novo({ probabilidade: 0 })).ok).toBe(true);
    expect(validarNovoNegocio(novo({ probabilidade: 100 })).ok).toBe(true);
  });
});

describe("validarMovimento (b)", () => {
  const etapaDoFunil = { id: "e2", funilId: "f1" };

  it("aceita Etapa do mesmo Funil ativo", () => {
    expect(validarMovimento({ negocio: negocio(), funilDestino: funil(), etapaDestino: etapaDoFunil }).ok).toBe(true);
  });

  it("recusa Negócio ganho (RN-NEG-04)", () => {
    expect(validarMovimento({ negocio: negocio({ situacao: "ganho" }), funilDestino: funil(), etapaDestino: etapaDoFunil }).ok).toBe(false);
  });

  it("recusa Negócio arquivado (RN-NEG-16)", () => {
    expect(validarMovimento({ negocio: negocio({ estado: "arquivado" }), funilDestino: funil(), etapaDestino: etapaDoFunil }).ok).toBe(false);
  });

  it("recusa Funil de destino arquivado (RN-FUN-14)", () => {
    expect(
      validarMovimento({ negocio: negocio(), funilDestino: funil({ estado: "arquivado" }), etapaDestino: etapaDoFunil }).ok,
    ).toBe(false);
  });

  it("recusa Etapa de outro Funil (INV-FUN-06)", () => {
    expect(validarMovimento({ negocio: negocio(), funilDestino: funil(), etapaDestino: { id: "e9", funilId: "f2" } }).ok).toBe(false);
  });

  it("trocar de Funil sem Etapa explícita falha (RN-FUN-15)", () => {
    expect(validarMovimento({ negocio: negocio(), funilDestino: funil({ id: "f2" }), etapaDestino: undefined }).ok).toBe(false);
    expect(validarMovimento({ negocio: negocio(), funilDestino: funil({ id: "f2" }), etapaDestino: { id: "e9", funilId: "f2" } }).ok).toBe(true);
  });
});

describe("validarGanho (c)", () => {
  it("Negócio não aberto ou não ativo falha", () => {
    expect(validarGanho({ negocio: negocio({ situacao: "perdido" }), funil: {}, entrada: {} }).ok).toBe(false);
    expect(validarGanho({ negocio: negocio({ estado: "na_lixeira" }), funil: {}, entrada: {} }).ok).toBe(false);
  });

  it("com exigeValorGanho, sem valor efetivo falha com field valor", () => {
    const resultado = validarGanho({ negocio: negocio(), funil: { exigeValorGanho: true }, entrada: {} });
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.field).toBe("valor");
  });

  it("com exigeValorGanho, valor '0' falha, na entrada ou no Negócio", () => {
    expect(validarGanho({ negocio: negocio(), funil: { exigeValorGanho: true }, entrada: { valor: "0" } }).ok).toBe(false);
    expect(validarGanho({ negocio: negocio({ valor: "0.00" }), funil: { exigeValorGanho: true }, entrada: {} }).ok).toBe(false);
  });

  it("com exigeValorGanho, o valor da entrada ou o do Negócio basta", () => {
    expect(validarGanho({ negocio: negocio(), funil: { exigeValorGanho: true }, entrada: { valor: "500.00" } }).ok).toBe(true);
    expect(validarGanho({ negocio: negocio({ valor: "10.00" }), funil: { exigeValorGanho: true }, entrada: {} }).ok).toBe(true);
  });

  it("sem a regra, ganhar sem valor vale", () => {
    expect(validarGanho({ negocio: negocio(), funil: { exigeValorGanho: false }, entrada: {} }).ok).toBe(true);
  });
});

describe("validarPerda (d)", () => {
  it("com exigeMotivoPerda, motivo ausente ou só espaços falha com field motivoPerda", () => {
    for (const entrada of [{}, { motivoPerda: "" }, { motivoPerda: "   " }]) {
      const resultado = validarPerda({ negocio: negocio(), funil: { exigeMotivoPerda: true }, entrada });
      expect(resultado.ok).toBe(false);
      if (!resultado.ok) expect(resultado.field).toBe("motivoPerda");
    }
  });

  it("com motivo, ou sem a regra, vale", () => {
    expect(validarPerda({ negocio: negocio(), funil: { exigeMotivoPerda: true }, entrada: { motivoPerda: "Preço" } }).ok).toBe(true);
    expect(validarPerda({ negocio: negocio(), funil: { exigeMotivoPerda: false }, entrada: {} }).ok).toBe(true);
  });

  it("Negócio já encerrado falha", () => {
    expect(validarPerda({ negocio: negocio({ situacao: "ganho" }), funil: {}, entrada: {} }).ok).toBe(false);
  });
});

describe("validarReabertura (e)", () => {
  const perdido = negocio({ situacao: "perdido" });

  it("Negócio aberto falha", () => {
    expect(validarReabertura({ negocio: negocio(), funil: funil() }).ok).toBe(false);
  });

  it("Negócio arquivado falha", () => {
    expect(validarReabertura({ negocio: negocio({ situacao: "perdido", estado: "arquivado" }), funil: funil() }).ok).toBe(false);
  });

  it("perdido em Funil ativo reabre sem destino", () => {
    expect(validarReabertura({ negocio: perdido, funil: funil() }).ok).toBe(true);
  });

  it("Funil arquivado sem destino falha (RN-FUN-14)", () => {
    expect(validarReabertura({ negocio: perdido, funil: funil({ estado: "arquivado" }) }).ok).toBe(false);
  });

  it("Funil arquivado com destino ativo e Etapa dele vale", () => {
    const destino = { funil: funil({ id: "f2" }), etapa: { id: "e9", funilId: "f2" } };
    expect(validarReabertura({ negocio: perdido, funil: funil({ estado: "arquivado" }), destino }).ok).toBe(true);
  });

  it("destino arquivado ou Etapa de outro Funil falha", () => {
    expect(
      validarReabertura({ negocio: perdido, funil: funil(), destino: { funil: funil({ id: "f2", estado: "arquivado" }), etapa: { id: "e9", funilId: "f2" } } }).ok,
    ).toBe(false);
    expect(
      validarReabertura({ negocio: perdido, funil: funil(), destino: { funil: funil({ id: "f2" }), etapa: { id: "e9", funilId: "f3" } } }).ok,
    ).toBe(false);
  });
});

describe("probabilidadeEfetiva e valorPonderado (f)", () => {
  const etapa = { probabilidadePadrao: 60 };

  it("ganho é 100 e perdido é 0 (INV-NEG-09)", () => {
    expect(probabilidadeEfetiva({ situacao: "ganho", probabilidade: 30 }, etapa)).toBe(100);
    expect(probabilidadeEfetiva({ situacao: "perdido", probabilidade: 30 }, etapa)).toBe(0);
  });

  it("aberto usa a sobrescrita e, sem ela, a da Etapa", () => {
    expect(probabilidadeEfetiva({ situacao: "aberto", probabilidade: 30 }, etapa)).toBe(30);
    expect(probabilidadeEfetiva({ situacao: "aberto", probabilidade: 0 }, etapa)).toBe(0);
    expect(probabilidadeEfetiva({ situacao: "aberto", probabilidade: null }, etapa)).toBe(60);
  });

  it("valorPonderado('1000.00', 30) é 300; sem valor é 0", () => {
    expect(valorPonderado("1000.00", 30)).toBe(300);
    expect(valorPonderado("19.99", 50)).toBe(10);
    expect(valorPonderado(null, 80)).toBe(0);
  });
});

describe("validarEdicao (g)", () => {
  it("Negócio arquivado ou na lixeira falha (RN-NEG-16)", () => {
    expect(validarEdicao(negocio({ estado: "arquivado" }), { titulo: "Novo" }).ok).toBe(false);
    expect(validarEdicao(negocio({ estado: "na_lixeira" }), { titulo: "Novo" }).ok).toBe(false);
  });

  it("edição que deixa Empresa e Contato juntos falha", () => {
    const resultado = validarEdicao(negocio(), { empresaId: "e1" });
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toBe("Um Negócio é de uma Empresa ou de um Contato.");
  });

  it("trocar o dono pelo outro, limpando o primeiro, vale", () => {
    expect(validarEdicao(negocio(), { empresaId: "e1", contatoId: null }).ok).toBe(true);
  });

  it("limpar o único dono falha", () => {
    expect(validarEdicao(negocio(), { contatoId: null }).ok).toBe(false);
  });

  it("edita escalares válidos e recusa título vazio e valor mal formado", () => {
    expect(validarEdicao(negocio(), { titulo: "Outro", valor: "10.50", probabilidade: null }).ok).toBe(true);
    expect(validarEdicao(negocio(), { titulo: "  " }).ok).toBe(false);
    expect(validarEdicao(negocio(), { valor: "10,5" }).ok).toBe(false);
    expect(validarEdicao(negocio(), { valor: null }).ok).toBe(true);
  });
});
