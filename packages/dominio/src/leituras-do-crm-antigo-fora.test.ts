/**
 * 15-42, UCR-12 (3.5.4, quarta parte) — as derivações do CRM antigo saíram do domínio.
 *
 * O `DataState` ainda tem as oito coleções (o 15-43 as tira), mas nenhuma leitura derivada delas
 * sobra: a Tarefa conversacional, o fio e os Canais da Lista leem o CRM novo por ids e pelas tabelas
 * (`...NasTabelas`). O que o Grupo e o Flow usam (F14-D-05) continua: `tarefasConversacionaisDoContato`,
 * `marcadoresDeCanal`, `rotuloDoCanal`, `textoDoSeparadorDeCanal` e `responseWindowOpenUntil`, que passou
 * a receber o Canal em vez de procurá-lo em `state.channels`.
 *
 * Cada caso lê o módulo (as chaves exportadas) ou o código-fonte, nunca chama o que saiu.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as derive from "./derive";
import * as deriveConversacional from "./derive-conversacional";
import * as deriveFerramentas from "./derive-ferramentas";
import { capacidadesDoCanal } from "./crm/capacidades";
import type { Conversation } from "./types";

const LE_O_CRM_ANTIGO =
  /\b(state|data|estado|s|d)\.(contacts|companies|deals|funnels|channels|contactCompanyLinks|companyCompanyLinks|distinctFromLinks)\b/;

const texto = (arquivo: string): string => readFileSync(fileURLToPath(new URL(arquivo, import.meta.url)), "utf8");

describe("as derivações do CRM antigo saíram (15-42, Task 1)", () => {
  it("derive.ts não exporta mais as leituras de Negócio, Contato, Conversa e Funil antigos", () => {
    const exportadas = Object.keys(derive);
    for (const nome of [
      "contactDisplayRole",
      "principalCompanyId",
      "effectiveProbability",
      "weightedValue",
      "lastInteraction",
      "marketingConsentMissing",
      "duplicateSuspicions",
    ]) {
      expect(exportadas, nome).not.toContain(nome);
    }
  });

  it("derive-conversacional.ts guarda só as derivações por ids e NasTabelas, e as de Grupo/Flow", () => {
    const exportadas = Object.keys(deriveConversacional);
    for (const nome of [
      "contatoDaTarefa",
      "conversaDaTarefa",
      "canalDaTarefa",
      "negocioDaTarefa",
      "canaisQueAlcancam",
      "canaisDaLista",
      "canaisDaListaQueAlcancam",
      "listaSemCanais",
      "canaisDoFio",
      "canaisDeResposta",
      "canalPadraoDeResposta",
      "canalDaAbaInicial",
      "canalPadraoDoTipo",
    ]) {
      expect(exportadas, nome).not.toContain(nome);
    }
    for (const nome of [
      "PAPEL_DO_VINCULO",
      "vinculosDoCrmDaTarefa",
      "tarefasConversacionaisDoContato",
      "canaisDaListaNasTabelas",
      "canaisDaListaQueAlcancamNasTabelas",
      "listaSemCanaisNasTabelas",
      "marcadoresDeCanal",
      "rotuloDoCanal",
      "textoDoSeparadorDeCanal",
    ]) {
      expect(exportadas, nome).toContain(nome);
    }
  });

  it("derive-ferramentas.ts não exporta mais contatosComWhatsApp", () => {
    expect(Object.keys(deriveFerramentas)).not.toContain("contatosComWhatsApp");
  });

  it("nenhum dos três arquivos lê as oito coleções do CRM antigo", () => {
    for (const arquivo of ["./derive.ts", "./derive-conversacional.ts", "./derive-ferramentas.ts"]) {
      expect(LE_O_CRM_ANTIGO.test(texto(arquivo)), arquivo).toBe(false);
    }
  });

  it("responseWindowOpenUntil recebe o Canal (o de plataforma.canais), não o procura em state.channels", () => {
    const recebidaHa30h = new Date(Date.now() - 30 * 3_600_000).toISOString();
    const conversa = { messages: [{ direction: "recebida", createdAt: recebidaHa30h }] } as unknown as Conversation;
    const oficial = { channelType: "whatsapp" as const, provider: "whatsapp-cloud" as const };
    const naoOficial = { channelType: "whatsapp" as const, provider: "whatsapp-nao-oficial" as const };
    const ate = derive.responseWindowOpenUntil(conversa, oficial, capacidadesDoCanal);
    expect(ate?.getTime()).toBe(Date.parse(recebidaHa30h) + 24 * 3_600_000);
    expect(derive.responseWindowOpenUntil(conversa, naoOficial, capacidadesDoCanal)).toBeNull();
    expect(derive.responseWindowOpenUntil(conversa, undefined, capacidadesDoCanal)).toBeNull();
  });
});

/**
 * 15-42, Task 2 — os ramos antigos das operações saíram. Nenhum arquivo de produção do domínio lê as
 * oito coleções (o `DataState` ainda as tem; o 15-43 as tira). O único que as monta é o construtor
 * do CRM antigo de demonstração, que o 15-43 apaga. `conversations` fica só no Grupo e no Flow.
 */
describe("nenhum arquivo de produção do domínio lê o CRM antigo (15-42, Task 2)", () => {
  const RAIZ = fileURLToPath(new URL(".", import.meta.url));
  const arquivos = (pasta: string): string[] =>
    readdirSync(pasta, { withFileTypes: true }).flatMap((e) => {
      const caminho = join(pasta, e.name);
      if (e.isDirectory()) return arquivos(caminho);
      return e.name.endsWith(".ts") && !e.name.endsWith(".test.ts") ? [caminho] : [];
    });
  const producao = arquivos(RAIZ).map((c) => ({ arquivo: relative(RAIZ, c).split(sep).join("/"), texto: readFileSync(c, "utf8") }));

  it("só o construtor do CRM antigo de demonstração ainda cita as coleções", () => {
    const leem = producao.filter((f) => LE_O_CRM_ANTIGO.test(f.texto)).map((f) => f.arquivo).sort();
    expect(leem).toEqual(["seed-crm-antigo.ts"]);
  });

  it("state.conversations só aparece no Grupo, no Flow e no que os dois usam (F14-D-05)", () => {
    // members.ts passa as Conversas de Grupo ao Sucessor (D-15-08) e ia/agentes.ts lê as do Agente; seed-* e
    // o construtor do CRM antigo montam o estado.
    const DE_GRUPO_E_FLOW = ["derive-ferramentas.ts", "operations/members.ts", "operations/ia/agentes.ts", "seed-crm-antigo.ts", "seed-ferramentas.ts"];
    const leem = producao
      .filter((f) => /\b(state|data|estado|s|d)\.conversations\b/.test(f.texto))
      .map((f) => f.arquivo)
      .filter((a) => !a.startsWith("operations/ferramentas/") && !DE_GRUPO_E_FLOW.includes(a))
      .sort();
    expect(leem).toEqual([]);
  });
});
