/**
 * Prova de `evoluirConfiguracaoPorEmpresa` (TEN-01, `05-CONTEXT.md` D5-03;
 * D5-19/WR-05 no fechamento de lacunas, plano 05-20): cria a opção "Marcos
 * Paulo" nos DOIS Campos `Empresa` (`fd_cp_empresa`/`fld_sp_c_empresa`) e as
 * 6 Integrações ausentes, confere as existentes (inclusive `avisosPorCanal`/
 * `statusDeclarados`, WR-05), recusa divergência sem sobrescrever, e — o
 * portão de segurança da fase — nenhuma chave de nenhuma `Integration` do
 * estado casa com o padrão de um segredo (T-5-01).
 *
 * `evoluirConfiguracaoPorEmpresa` agora exige que `fld_sp_c_empresa` (o
 * Campo `Empresa` da Lista de Solicitações) já exista — `buildGestaoBootstrap`
 * NÃO configura essa Lista (só Contas a pagar/Contas a receber), então todo
 * teste que roda o evolver por Empresa precisa de
 * `evoluirConfiguracaoDeSolicitacoes` antes (`estadoBase()` abaixo), exceto o
 * caso que prova a recusa por ausência desse mesmo Campo.
 */

import { describe, expect, it } from "vitest";
import { buildGestaoBootstrap } from "./bootstrap-gestao";
import { CP } from "./operations/financeiro";
import { CATALOGO_CONFIGURACAO_POR_EMPRESA, EMPRESA_NOVA } from "./configuracao-por-empresa";
import { evoluirConfiguracaoPorEmpresa } from "./configuracao-por-empresa-evolver";
import { CATALOGO_SOLICITACAO_DE_PAGAMENTO } from "./solicitacao-de-pagamento";
import { evoluirConfiguracaoDeSolicitacoes } from "./solicitacao-de-pagamento-evolver";
import type { DataState } from "./state";
import type { Id } from "./types";

const ATOR: Id = "mem_maryane";

/** `fld_sp_c_empresa` — o mesmo Campo que `status-por-empresa.test.ts` deriva do catálogo real. */
const CAMPO_EMPRESA_SOLICITACAO: Id = CATALOGO_SOLICITACAO_DE_PAGAMENTO.campos.find((c) => c.rotulo === "Empresa")!.id;

/**
 * O estado que todo teste (menos o de ausência do Campo) parte: Espaço
 * "Gestão" bootstrapado + Lista de Solicitações configurada — os DOIS Campos
 * `Empresa` existem, `fld_sp_c_empresa` já nasce COM "Marcos Paulo" (o
 * catálogo da Solicitação já a tem desde 05-13), `fd_cp_empresa` ainda não
 * (o estado real de `ws_n1`, que o evolver por Empresa existe para
 * consertar).
 */
function estadoBase(): DataState {
  const s = buildGestaoBootstrap({ agora: AGORA });
  const solicitacoes = evoluirConfiguracaoDeSolicitacoes(s, ATOR);
  if (!solicitacoes.ok) throw new Error(`fixture (Solicitações): ${solicitacoes.error}`);
  return s;
}

/** Remove `EMPRESA_NOVA` das opções de UM Campo, simulando o estado real ANTES do evolver corrigir. */
function semEmpresaNovaEm(s: DataState, campoId: Id): void {
  const idx = s.fieldDefinitions.findIndex((f) => f.id === campoId);
  const campo = s.fieldDefinitions[idx]!;
  s.fieldDefinitions[idx] = { ...campo, options: (campo.options ?? []).filter((o) => o !== EMPRESA_NOVA) };
}

const AGORA = "2026-09-24T12:00:00.000Z";

/** T-5-01 — nenhuma chave de `Integration` (ou de qualquer bloco aninhado) pode nomear um segredo. */
const PADRAO_DE_SEGREDO = /app_?key|app_?secret|secret|senha|password|token/i;

/** Percorre recursivamente todas as chaves de um objeto, juntando o caminho para a mensagem de falha. */
function coletarChaves(valor: unknown, caminho: string, achados: string[]): void {
  if (valor === null || typeof valor !== "object") return;
  for (const [chave, sub] of Object.entries(valor as Record<string, unknown>)) {
    if (PADRAO_DE_SEGREDO.test(chave)) achados.push(`${caminho}.${chave}`);
    coletarChaves(sub, `${caminho}.${chave}`, achados);
  }
}

const EMPRESAS_FAMILY_OFFICE = ["EXO Loteamento", "EXO Participações", "Oliveira Participações"];

describe("evoluirConfiguracaoPorEmpresa — portão de segurança (T-5-01)", () => {
  it("(a) nenhuma chave de nenhuma Integration do estado casa com o padrão de segredo, depois de evoluir", () => {
    const s = estadoBase();
    const r = evoluirConfiguracaoPorEmpresa(s, ATOR);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);

    const achados: string[] = [];
    for (const integracao of s.integrations) {
      coletarChaves(integracao, `integrations[${integracao.id}]`, achados);
    }
    expect(achados).toEqual([]);
  });

  it("(b) cada integration.omie.contaRotulo do catálogo é uma string não vazia", () => {
    for (const linha of CATALOGO_CONFIGURACAO_POR_EMPRESA) {
      expect(typeof linha.contaRotulo).toBe("string");
      expect(linha.contaRotulo.length).toBeGreaterThan(0);
    }
  });
});

describe("evoluirConfiguracaoPorEmpresa — criar-ou-conferir idempotente", () => {
  it("(c) estado sem 'Marcos Paulo' em NENHUM dos dois Campos: primeira evolução cria as DUAS opções + 6 Integrações (>= 8); a segunda é no-op", () => {
    const s = estadoBase();
    semEmpresaNovaEm(s, CP.fields.empresa);
    semEmpresaNovaEm(s, CAMPO_EMPRESA_SOLICITACAO);

    const primeira = evoluirConfiguracaoPorEmpresa(s, ATOR);
    expect(primeira.ok, primeira.ok ? "" : primeira.error).toBe(true);
    if (!primeira.ok) throw new Error("unreachable");
    expect(primeira.value.criados.length).toBeGreaterThanOrEqual(8);
    expect(primeira.value.criados).toContain(`${CP.fields.empresa}:${EMPRESA_NOVA}`);
    expect(primeira.value.criados).toContain(`${CAMPO_EMPRESA_SOLICITACAO}:${EMPRESA_NOVA}`);
    expect(primeira.value.divergentes).toEqual([]);

    const segunda = evoluirConfiguracaoPorEmpresa(s, ATOR);
    expect(segunda.ok, segunda.ok ? "" : segunda.error).toBe(true);
    if (!segunda.ok) throw new Error("unreachable");
    expect(segunda.value.criados).toEqual([]);
    expect(segunda.value.divergentes).toEqual([]);
  });

  it("(c') estado já com 'Marcos Paulo' em fld_sp_c_empresa (seed pós-05-13) e sem em fd_cp_empresa: só a opção de Contas a pagar é criada; a outra entra em conferidos", () => {
    const s = estadoBase();
    semEmpresaNovaEm(s, CP.fields.empresa);
    // fld_sp_c_empresa NÃO é tocado — nasce com "Marcos Paulo" pelo próprio catálogo da Solicitação.

    const r = evoluirConfiguracaoPorEmpresa(s, ATOR);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.value.criados).toContain(`${CP.fields.empresa}:${EMPRESA_NOVA}`);
    expect(r.value.criados).not.toContain(`${CAMPO_EMPRESA_SOLICITACAO}:${EMPRESA_NOVA}`);
    expect(r.value.conferidos).toContain(`${CAMPO_EMPRESA_SOLICITACAO}:${EMPRESA_NOVA}`);
  });

  it("(d) 'Marcos Paulo' aparece exatamente uma vez em CADA Campo depois de duas voltas, e as opções anteriores mantêm a ordem", () => {
    const s = estadoBase();
    semEmpresaNovaEm(s, CP.fields.empresa);
    semEmpresaNovaEm(s, CAMPO_EMPRESA_SOLICITACAO);

    const antesPorCampo = new Map<Id, readonly string[]>();
    for (const campoId of [CP.fields.empresa, CAMPO_EMPRESA_SOLICITACAO]) {
      const campo = s.fieldDefinitions.find((f) => f.id === campoId)!;
      const opcoes = [...(campo.options ?? [])];
      expect(opcoes).not.toContain(EMPRESA_NOVA);
      antesPorCampo.set(campoId, opcoes);
    }

    evoluirConfiguracaoPorEmpresa(s, ATOR);
    evoluirConfiguracaoPorEmpresa(s, ATOR);

    for (const campoId of [CP.fields.empresa, CAMPO_EMPRESA_SOLICITACAO]) {
      const opcoesAntes = antesPorCampo.get(campoId)!;
      const campoDepois = s.fieldDefinitions.find((f) => f.id === campoId)!;
      const opcoesDepois = campoDepois.options ?? [];
      expect(opcoesDepois.filter((o) => o === EMPRESA_NOVA).length).toBe(1);
      expect(opcoesDepois.slice(0, opcoesAntes.length)).toEqual(opcoesAntes);
      expect(opcoesDepois.length).toBe(opcoesAntes.length + 1);
    }
  });

  it("(e) 'int_omie' (a Integração genérica já existente) continua existindo e inalterada depois do evolver", () => {
    const s = estadoBase();
    const antes = s.integrations.find((i) => i.id === "int_omie");
    expect(antes).toBeDefined();
    const copiaAntes = structuredClone(antes);

    evoluirConfiguracaoPorEmpresa(s, ATOR);

    const depois = s.integrations.find((i) => i.id === "int_omie");
    expect(depois).toEqual(copiaAntes);
  });

  it("(f) divergência de omie.contaRotulo é reportada e NADA é sobrescrito", () => {
    const s = estadoBase();
    const primeira = evoluirConfiguracaoPorEmpresa(s, ATOR);
    expect(primeira.ok).toBe(true);

    const integracao = s.integrations.find((i) => i.id === "int_omie_tria")!;
    (integracao.omie as { contaRotulo: string }).contaRotulo = "omie-adulterado";

    const r = evoluirConfiguracaoPorEmpresa(s, ATOR);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.error).toContain("int_omie_tria");
    expect(r.error).toContain("omie-adulterado");

    expect(s.integrations.find((i) => i.id === "int_omie_tria")!.omie!.contaRotulo).toBe("omie-adulterado");
  });

  it("(g) Espaço 'Gestão' ausente recusa apontando o bootstrap da Fase 1", () => {
    const s = buildGestaoBootstrap({ agora: AGORA });
    s.spaces = s.spaces.filter((e) => e.id !== CP.spaceId);
    const r = evoluirConfiguracaoPorEmpresa(s, ATOR);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.error).toContain("Fase 1");
  });

  it("(h) statusDeclarados contém 'em revisão' exatamente nas três Empresas do Family Office, e em nenhuma outra", () => {
    for (const linha of CATALOGO_CONFIGURACAO_POR_EMPRESA) {
      const declaraRevisao = (linha.statusDeclarados ?? []).includes("em revisão");
      expect(declaraRevisao).toBe(EMPRESAS_FAMILY_OFFICE.includes(linha.empresa));
    }
  });

  it("(i) Espaço sem a Lista de Solicitações (fld_sp_c_empresa ausente) recusa mandando rodar solicitacoes:configurar, e NÃO cria o Campo", () => {
    const s = buildGestaoBootstrap({ agora: AGORA });
    expect(s.fieldDefinitions.some((f) => f.id === CAMPO_EMPRESA_SOLICITACAO)).toBe(false);

    const r = evoluirConfiguracaoPorEmpresa(s, ATOR);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.error).toContain("solicitacoes:configurar");

    expect(s.fieldDefinitions.some((f) => f.id === CAMPO_EMPRESA_SOLICITACAO)).toBe(false);
  });

  it("(j) avisosPorCanal.whatsapp adulterado do Marcos Paulo é recusado (WR-05), e o valor adulterado permanece no estado", () => {
    const s = estadoBase();
    const primeira = evoluirConfiguracaoPorEmpresa(s, ATOR);
    expect(primeira.ok, primeira.ok ? "" : primeira.error).toBe(true);

    const mp = s.integrations.find((i) => i.id === "int_omie_marcos_paulo")!;
    (mp as unknown as { avisosPorCanal: { whatsapp: string[] } }).avisosPorCanal = { whatsapp: ["mari"] };

    const r = evoluirConfiguracaoPorEmpresa(s, ATOR);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.error).toContain("int_omie_marcos_paulo.avisosPorCanal");

    expect(s.integrations.find((i) => i.id === "int_omie_marcos_paulo")!.avisosPorCanal).toEqual({ whatsapp: ["mari"] });
  });

  it("(k) Integração do Family Office SEM statusDeclarados diverge e é recusada (WR-05)", () => {
    const s = estadoBase();
    const primeira = evoluirConfiguracaoPorEmpresa(s, ATOR);
    expect(primeira.ok, primeira.ok ? "" : primeira.error).toBe(true);

    const idx = s.integrations.findIndex((i) => i.id === "int_omie_exo_loteamento");
    const atual = s.integrations[idx]!;
    const { statusDeclarados: _remover, ...semStatus } = atual;
    s.integrations[idx] = semStatus as typeof atual;

    const r = evoluirConfiguracaoPorEmpresa(s, ATOR);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.error).toContain("int_omie_exo_loteamento.statusDeclarados");
  });

  it("(l) Integração da Tria (sem avisosPorCanal no catálogo) permanece SEM o campo no estado e é conferida sem divergência (ausente = ausente)", () => {
    const s = estadoBase();
    const primeira = evoluirConfiguracaoPorEmpresa(s, ATOR);
    expect(primeira.ok, primeira.ok ? "" : primeira.error).toBe(true);

    const tria = s.integrations.find((i) => i.id === "int_omie_tria")!;
    expect(tria.avisosPorCanal).toBeUndefined();

    const segunda = evoluirConfiguracaoPorEmpresa(s, ATOR);
    expect(segunda.ok, segunda.ok ? "" : segunda.error).toBe(true);
    if (!segunda.ok) throw new Error("unreachable");
    expect(segunda.value.conferidos).toContain("int_omie_tria");
    expect(segunda.value.divergentes).toEqual([]);
  });
});
