/**
 * `de-para-usuarios.ts` — testes puros, sem banco, sem `CLICKUP_API_TOKEN`:
 * provam a FORMA do de-para (os 6 ids de CON-11, a colisão da Maryane, o
 * catálogo das 38+24 `CLICKUP_*`) e a compatibilidade com `inviteMember`,
 * cruzando com o bootstrap de produção real — nunca com uma lista fixa
 * copiada à mão, que poderia divergir do domínio sem que o teste percebesse.
 *
 * A leitura de `../financeiro-tria` (D-DEC-11, só leitura — grep para montar
 * o catálogo abaixo) aconteceu durante a execução deste plano, fora deste
 * arquivo; a prova de que o repositório continuou intocado (`git status
 * --porcelain | wc -l` igual antes e depois) está registrada no SUMMARY do
 * Plan 00-02, não como asserção de teste (não há acesso a outro repositório
 * em tempo de `vitest run`).
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildGestaoBootstrap } from "@n1/dominio/bootstrap-gestao";
import { inviteMember } from "@n1/dominio/operations/members";
import {
  CATALOGO_CLICKUP,
  DE_PARA_USUARIOS,
  entradaPorClickupId,
  type EntradaDeParaUsuario,
} from "./de-para-usuarios";

const IDS_CONHECIDOS = ["81591229", "81581798", "81581826", "81582295", "81581816", "81581802"] as const;

describe("de-para-usuarios — os 6 ids de CON-11 e o catálogo CLICKUP_*", () => {
  it("(a) DE_PARA_USUARIOS tem exatamente 6 entradas, com o conjunto exato de ids de CON-11", () => {
    expect(DE_PARA_USUARIOS).toHaveLength(6);
    expect(new Set(DE_PARA_USUARIOS.map((e) => e.clickupUserId))).toEqual(new Set(IDS_CONHECIDOS));
  });

  it("(b) e-mails RESOLVIDOS contêm @, são minúsculos e únicos, nunca de teste/placeholder; o item em aberto (81581802) é explícito, não inventado", () => {
    const resolvidos = DE_PARA_USUARIOS.filter((e) => e.fonteDoEmail !== "nao-resolvido");
    expect(resolvidos.length).toBeGreaterThan(0);
    for (const entrada of resolvidos) {
      expect(entrada.email).toContain("@");
      expect(entrada.email).toBe(entrada.email.toLowerCase());
      expect(entrada.email.endsWith("@n1.teste")).toBe(false);
      expect(entrada.email).not.toMatch(/example|todo|pendente/i);
    }
    const emails = resolvidos.map((e) => e.email);
    expect(new Set(emails).size).toBe(emails.length);

    // Item em aberto: revisor FO — não encontrado por nenhuma das 3 fontes da
    // Task 1 (RESEARCH.md Open Question 1 não previa esta lacuna específica;
    // ver SUMMARY do Plan 00-02). Sem e-mail inventado: string vazia, que
    // `inviteMember` recusa por si só (não pode virar Membro por acidente).
    const aberto = entradaPorClickupId("81581802");
    expect(aberto?.fonteDoEmail).toBe("nao-resolvido");
    expect(aberto?.email).toBe("");
  });

  it("(c) todo roleIdEsperado existe de fato no bootstrap de produção (buildGestaoBootstrap)", () => {
    const roleIdsReais = new Set(buildGestaoBootstrap({ workspaceId: "ws_teste" }).roles.map((r) => r.id));
    for (const entrada of DE_PARA_USUARIOS) {
      expect(roleIdsReais.has(entrada.roleIdEsperado)).toBe(true);
    }
  });

  it("(d) só 81581816 (Financeiro) tem memberIdConhecido, apontando para o Membro real mem_maryane, com papelNoProcesso financeiro", () => {
    const comMemberId = DE_PARA_USUARIOS.filter((e) => e.memberIdConhecido !== undefined);
    expect(comMemberId).toHaveLength(1);
    expect(comMemberId[0]?.clickupUserId).toBe("81581816");
    expect(comMemberId[0]?.memberIdConhecido).toBe("mem_maryane");
    expect(comMemberId[0]?.papelNoProcesso).toBe("financeiro");

    const state = buildGestaoBootstrap({ workspaceId: "ws_teste" });
    expect(state.members.some((m) => m.id === "mem_maryane")).toBe(true);
  });

  it("(e) entradaPorClickupId resolve papelNoProcesso e devolve undefined para id desconhecido", () => {
    expect(entradaPorClickupId("81591229")?.papelNoProcesso).toBe("aprovador");
    expect(entradaPorClickupId("0")).toBeUndefined();
  });

  it("(f) catálogo: 38 sem prefixo + ≥ 24 variantes MP_/FO_, nomes únicos, forma válida, tenant coerente com o prefixo", () => {
    const semPrefixo = CATALOGO_CLICKUP.filter((v) => v.nome.startsWith("CLICKUP_"));
    expect(semPrefixo).toHaveLength(38);
    expect(CATALOGO_CLICKUP.length).toBeGreaterThanOrEqual(62);

    const nomes = CATALOGO_CLICKUP.map((v) => v.nome);
    expect(new Set(nomes).size).toBe(nomes.length);

    for (const variavel of CATALOGO_CLICKUP) {
      expect(variavel.nome).toMatch(/^(MP_|FO_)?CLICKUP_[A-Z0-9_]+$/);
      if (variavel.nome.startsWith("MP_")) expect(variavel.tenant).toBe("marcos-paulo");
      else if (variavel.nome.startsWith("FO_")) expect(variavel.tenant).toBe("family-office");
      else expect(variavel.tenant).toBe("tria");
    }
  });

  it("(g) entraNoDePara é verdadeiro sse todo id da variável tem entrada em DE_PARA_USUARIOS; token nunca tem valorConhecido", () => {
    for (const variavel of CATALOGO_CLICKUP) {
      if (variavel.tipo === "id-de-usuario" && variavel.clickupUserId) {
        expect(variavel.entraNoDePara).toBe(entradaPorClickupId(variavel.clickupUserId) !== undefined);
      }
      if (variavel.tipo === "ids-de-usuario" && variavel.clickupUserIds) {
        expect(variavel.entraNoDePara).toBe(
          variavel.clickupUserIds.every((id) => entradaPorClickupId(id) !== undefined),
        );
      }
      if (variavel.tipo === "token") {
        expect(variavel.valorConhecido).toBeUndefined();
      }
    }
  });

  it("(h) nenhum segredo no arquivo: nem no conteúdo em memória, nem no texto do próprio arquivo", () => {
    const emMemoria = JSON.stringify({ DE_PARA_USUARIOS, CATALOGO_CLICKUP });
    expect(emMemoria).not.toMatch(/pk_[0-9]{4,}/);
    expect(emMemoria).not.toMatch(/senha|password|secret/i);

    const textoDoArquivo = readFileSync(new URL("./de-para-usuarios.ts", import.meta.url), "utf8");
    expect(textoDoArquivo).not.toMatch(/pk_[0-9]{4,}/);
    expect(textoDoArquivo).not.toMatch(/senha|password|secret/i);
  });

  it("(i) toda entrada é compatível com o segundo argumento de inviteMember (prova de tipo, via typecheck)", () => {
    for (const entrada of DE_PARA_USUARIOS) {
      const input: Parameters<typeof inviteMember>[2] = { email: entrada.email, roleId: entrada.roleIdEsperado };
      expect(input.roleId).toBe(entrada.roleIdEsperado);
    }
    // Também prova que EntradaDeParaUsuario permanece com a forma esperada.
    const amostra: EntradaDeParaUsuario = DE_PARA_USUARIOS[0]!;
    expect(typeof amostra.clickupUserId).toBe("string");
  });

  it("(j) o item em aberto (81581802) não vira Membro por acidente: inviteMember recusa o e-mail vazio", () => {
    const state = buildGestaoBootstrap({ workspaceId: "ws_teste" });
    const proprietaria = state.members.find((m) => m.roleId === "role_prop")!;
    const aberto = entradaPorClickupId("81581802")!;
    const resultado = inviteMember(state, proprietaria.id, { email: aberto.email, roleId: aberto.roleIdEsperado });
    expect(resultado.ok).toBe(false);
  });
});
