/**
 * Prova de `evoluirConfiguracaoPorEmpresa` (TEN-01, `05-CONTEXT.md` D5-03):
 * cria a opção e as 6 Integrações ausentes, confere as existentes, recusa
 * divergência sem sobrescrever, e — o portão de segurança da fase — nenhuma
 * chave de nenhuma `Integration` do estado casa com o padrão de um segredo
 * (T-5-01).
 */

import { describe, expect, it } from "vitest";
import { buildGestaoBootstrap } from "./bootstrap-gestao";
import { CP } from "./operations/financeiro";
import { CATALOGO_CONFIGURACAO_POR_EMPRESA, EMPRESA_NOVA } from "./configuracao-por-empresa";
import { evoluirConfiguracaoPorEmpresa } from "./configuracao-por-empresa-evolver";
import type { DataState } from "./state";

/**
 * `buildGestaoBootstrap()` já nasce com `EMPRESA_NOVA` nas opções de
 * `fd_cp_empresa` — Task 2 acrescentou "Marcos Paulo" ao seed para que um
 * Espaço NOVO nasça igual ao evoluído. `ws_n1`, porém, já foi bootstrapado
 * ANTES desta fase (sem a opção): os testes de criação abaixo simulam
 * exatamente esse estado — o real, o que o evolver existe para consertar —
 * removendo a opção antes de chamar o evolver.
 */
function semEmpresaNova(s: DataState): void {
  const idx = s.fieldDefinitions.findIndex((f) => f.id === CP.fields.empresa);
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
    const s: DataState = buildGestaoBootstrap({ agora: AGORA });
    const r = evoluirConfiguracaoPorEmpresa(s, "mem_maryane");
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
  it("(c) a primeira evolução cria a opção + 6 Integrações; a segunda é no-op (criados e divergentes vazios)", () => {
    const s = buildGestaoBootstrap({ agora: AGORA });
    semEmpresaNova(s);

    const primeira = evoluirConfiguracaoPorEmpresa(s, "mem_maryane");
    expect(primeira.ok, primeira.ok ? "" : primeira.error).toBe(true);
    if (!primeira.ok) throw new Error("unreachable");
    expect(primeira.value.criados.length).toBeGreaterThanOrEqual(7);
    expect(primeira.value.divergentes).toEqual([]);

    const segunda = evoluirConfiguracaoPorEmpresa(s, "mem_maryane");
    expect(segunda.ok, segunda.ok ? "" : segunda.error).toBe(true);
    if (!segunda.ok) throw new Error("unreachable");
    expect(segunda.value.criados).toEqual([]);
    expect(segunda.value.divergentes).toEqual([]);
  });

  it("(d) 'Marcos Paulo' aparece exatamente uma vez em fd_cp_empresa depois de duas voltas, e as opções anteriores mantêm a ordem", () => {
    const s = buildGestaoBootstrap({ agora: AGORA });
    semEmpresaNova(s);
    const campoAntes = s.fieldDefinitions.find((f) => f.id === CP.fields.empresa)!;
    const opcoesAntes = [...(campoAntes.options ?? [])];
    expect(opcoesAntes).not.toContain("Marcos Paulo");

    evoluirConfiguracaoPorEmpresa(s, "mem_maryane");
    evoluirConfiguracaoPorEmpresa(s, "mem_maryane");

    const campoDepois = s.fieldDefinitions.find((f) => f.id === CP.fields.empresa)!;
    const opcoesDepois = campoDepois.options ?? [];
    expect(opcoesDepois.filter((o) => o === "Marcos Paulo").length).toBe(1);
    expect(opcoesDepois.slice(0, opcoesAntes.length)).toEqual(opcoesAntes);
    expect(opcoesDepois.length).toBe(opcoesAntes.length + 1);
  });

  it("(e) 'int_omie' (a Integração genérica já existente) continua existindo e inalterada depois do evolver", () => {
    const s = buildGestaoBootstrap({ agora: AGORA });
    const antes = s.integrations.find((i) => i.id === "int_omie");
    expect(antes).toBeDefined();
    const copiaAntes = structuredClone(antes);

    evoluirConfiguracaoPorEmpresa(s, "mem_maryane");

    const depois = s.integrations.find((i) => i.id === "int_omie");
    expect(depois).toEqual(copiaAntes);
  });

  it("(f) divergência de omie.contaRotulo é reportada e NADA é sobrescrito", () => {
    const s = buildGestaoBootstrap({ agora: AGORA });
    const primeira = evoluirConfiguracaoPorEmpresa(s, "mem_maryane");
    expect(primeira.ok).toBe(true);

    const integracao = s.integrations.find((i) => i.id === "int_omie_tria")!;
    (integracao.omie as { contaRotulo: string }).contaRotulo = "omie-adulterado";

    const r = evoluirConfiguracaoPorEmpresa(s, "mem_maryane");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.error).toContain("int_omie_tria");
    expect(r.error).toContain("omie-adulterado");

    expect(s.integrations.find((i) => i.id === "int_omie_tria")!.omie!.contaRotulo).toBe("omie-adulterado");
  });

  it("(g) Espaço 'Gestão' ausente recusa apontando o bootstrap da Fase 1", () => {
    const s = buildGestaoBootstrap({ agora: AGORA });
    s.spaces = s.spaces.filter((e) => e.id !== CP.spaceId);
    const r = evoluirConfiguracaoPorEmpresa(s, "mem_maryane");
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
});
