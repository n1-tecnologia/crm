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

import { readFileSync } from "node:fs";
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
