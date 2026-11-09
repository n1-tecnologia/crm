/**
 * O provedor da Evolution contra o conjunto de contrato do 16-02 (16-12, Task 3, MSG-06), com o servidor HTTP FALSO, e os
 * casos que só ele tem: o segredo certo com a instância de outro Canal (D-16-06) e a chave de deduplicação. Sem banco.
 */

import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { Canal } from "@n1/dominio/crm/canais";
import { descreverContratoDoProvedor } from "../../contrato-do-provedor";
import { CABECALHO_DO_SEGREDO, type CanalParaProvedor, type ChamadaDoWebhook } from "../../provedor";
import { criarServidorFalso } from "../../../testes/servidor-falso";
import texto from "./exemplos/texto.json";
import { criarProvedorEvolution } from "./provedor";

const INSTANCIA = "inst-teste";

function canalDaEvolution(): CanalParaProvedor {
  const agora = new Date().toISOString();
  const canal: Canal = {
    id: "canal_contrato_evolution",
    nome: "Evolution",
    tipo: "whatsapp",
    provedor: "whatsapp-nao-oficial",
    identificadorExterno: "+5511977770001",
    conexao: "conectada",
    conexaoSimulada: false,
    conectadaEm: agora,
    estado: "ativo",
    arquivadoEm: null,
    configuradoPor: "mem_teste",
    filaPadraoId: null,
    proprietarioPadraoId: null,
    origemPadraoId: null,
    gruposHabilitados: false,
    criadoPor: "mem_teste",
    criadoEm: agora,
    atualizadoEm: agora,
  };
  return {
    workspaceId: "ws_contrato_evolution",
    canal,
    segredoDoWebhook: randomBytes(16).toString("hex"),
    credencial: JSON.stringify({ instancia: INSTANCIA, apikey: randomBytes(16).toString("hex") }),
  };
}

function chamada(canal: CanalParaProvedor, corpo: unknown = texto): ChamadaDoWebhook {
  return { cabecalhos: { [CABECALHO_DO_SEGREDO]: canal.segredoDoWebhook }, corpoCru: Buffer.from(JSON.stringify(corpo)), corpo };
}

descreverContratoDoProvedor("evolution", async () => {
  const falso = await criarServidorFalso();
  const provedor = criarProvedorEvolution({ url: falso.url, timeoutMs: 2_000 });
  const canal = canalDaEvolution();
  return {
    provedor,
    canal,
    chamadaDeTexto: () => chamada(canal),
    prepararEnvioAceito: async () => {
      falso.enfileirar({ kind: "ok", status: 201, corpo: { key: { remoteJid: "5511987654321@s.whatsapp.net", fromMe: true, id: "3EB0CT" }, status: "PENDING" } });
    },
    prepararMidiaGrande: async (tetoBytes) => {
      // Um base64 que cabe no corte do fluxo mas decodifica acima do teto.
      falso.enfileirar({ kind: "ok", status: 201, corpo: { mimetype: "audio/ogg; codecs=opus", base64: Buffer.alloc(tetoBytes + 1, 1).toString("base64") } });
      return JSON.stringify({ key: texto.data.key, message: { audioMessage: { mimetype: "audio/ogg; codecs=opus", ptt: true } } });
    },
    encerrar: async () => falso.fechar(),
  };
});

describe("provedor da Evolution: o que só ele tem", () => {
  const provedor = criarProvedorEvolution({ url: "http://evolution.exemplo.test:8080" });

  it("o segredo certo com a instância de OUTRO Canal é recusado (D-16-06, T-16-43)", () => {
    const canal = canalDaEvolution();
    expect(provedor.verificarChamada(chamada(canal), canal)).toBe(true);
    expect(provedor.verificarChamada(chamada(canal, { ...texto, instance: "outra" }), canal)).toBe(false);
    expect(provedor.verificarChamada(chamada(canal, null), canal)).toBe(false);
    expect(provedor.verificarChamada(chamada(canal, "texto"), canal)).toBe(false);
  });

  it("sem credencial no Canal não há instância para conferir: recusa, e o corpo vira ignorado", () => {
    const { credencial: _sem, ...semCredencial } = canalDaEvolution();
    expect(provedor.verificarChamada(chamada(semCredencial), semCredencial)).toBe(false);
    expect(provedor.interpretarChamada(texto, semCredencial)).toEqual([{ tipo: "ignorado", motivo: "sem_credencial" }]);
  });

  it("credencial que não é o JSON { instancia, apikey } é tratada como ausente", () => {
    const canal = { ...canalDaEvolution(), credencial: "so-uma-chave" };
    expect(provedor.verificarChamada(chamada(canal), canal)).toBe(false);
  });

  it("interpretarChamada devolve ignorado (nunca lista vazia) para outro evento e para outra instância", () => {
    const canal = canalDaEvolution();
    expect(provedor.interpretarChamada({ ...texto, event: "connection.update" }, canal)).toEqual([{ tipo: "ignorado", motivo: "evento_nao_tratado" }]);
    expect(provedor.interpretarChamada({ ...texto, instance: "outra" }, canal)).toEqual([{ tipo: "ignorado", motivo: "evento_nao_tratado" }]);
  });

  it("chaveDaChamada é o key.id do webhook; sem ele, nenhuma", () => {
    expect(provedor.chaveDaChamada?.(texto)).toBe(texto.data.key.id);
    expect(provedor.chaveDaChamada?.({})).toBeUndefined();
    expect(provedor.chaveDaChamada?.(null)).toBeUndefined();
  });

  it("o provedor se chama whatsapp-nao-oficial", () => {
    expect(provedor.provedor).toBe("whatsapp-nao-oficial");
  });
});
