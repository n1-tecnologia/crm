/**
 * O provedor de teste contra o conjunto de contrato (16-02, 3.6.1) e os casos que só ele tem: o depósito
 * de mídia em memória e o resultado programado. Sem banco, sem rede.
 */

import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { Canal } from "@n1/dominio/crm/canais";
import { descreverContratoDoProvedor } from "./contrato-do-provedor";
import { CABECALHO_DO_SEGREDO, ErroDeProvedor, type CanalParaProvedor } from "./provedor";
import { criarProvedorDeTeste } from "./provedores/teste";

function canalSimulado(): Canal {
  const agora = new Date().toISOString();
  return {
    id: "canal_contrato",
    nome: "Contrato",
    tipo: "whatsapp",
    provedor: "whatsapp-nao-oficial",
    identificadorExterno: "+5511977770001",
    conexao: "conectada",
    conexaoSimulada: true,
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
}

function canalParaProvedor(): CanalParaProvedor {
  return {
    workspaceId: "ws_contrato",
    canal: canalSimulado(),
    segredoDoWebhook: randomBytes(16).toString("hex"),
    credencial: randomBytes(16).toString("hex"),
  };
}

descreverContratoDoProvedor("teste", async () => {
  const provedor = criarProvedorDeTeste();
  const canal = canalParaProvedor();
  const corpo = {
    eventos: [{ tipo: "mensagem", idExterno: "ext-contrato-1", remetente: { tipo: "whatsapp", valor: "+5511987654321" }, conteudo: "oi" }],
  };
  return {
    provedor,
    canal,
    chamadaDeTexto: () => ({
      cabecalhos: { [CABECALHO_DO_SEGREDO]: canal.segredoDoWebhook },
      corpoCru: Buffer.from(JSON.stringify(corpo)),
      corpo,
    }),
    prepararEnvioAceito: async () => provedor.limpar(),
    prepararMidiaGrande: async (tetoBytes) => {
      provedor.guardarMidia("midia-grande", { bytes: new Uint8Array(tetoBytes + 1), tipoDeMidia: "audio/ogg" });
      return "midia-grande";
    },
    encerrar: async () => provedor.limpar(),
  };
});

describe("provedor de teste: o que só ele tem", () => {
  it("baixarMidia devolve a mídia guardada, no teto ou abaixo dele", async () => {
    const provedor = criarProvedorDeTeste();
    const canal = canalParaProvedor();
    provedor.guardarMidia("m1", { bytes: new Uint8Array([1, 2, 3]), tipoDeMidia: "image/png", nome: "a.png" });
    const midia = await provedor.baixarMidia(canal, "m1", { tetoBytes: 3 });
    expect(Array.from(midia.bytes)).toEqual([1, 2, 3]);
    expect(midia).toMatchObject({ tipoDeMidia: "image/png", nome: "a.png" });
  });

  it("referência desconhecida ou esquecida lança MIDIA_INDISPONIVEL", async () => {
    const provedor = criarProvedorDeTeste();
    const canal = canalParaProvedor();
    await expect(provedor.baixarMidia(canal, "nada", { tetoBytes: 10 })).rejects.toMatchObject({ codigo: "MIDIA_INDISPONIVEL" });
    provedor.guardarMidia("m2", { bytes: new Uint8Array([1]), tipoDeMidia: "image/png" });
    provedor.esquecerMidia("m2");
    await expect(provedor.baixarMidia(canal, "m2", { tetoBytes: 10 })).rejects.toBeInstanceOf(ErroDeProvedor);
  });

  it("enviar devolve os resultados programados, na ordem, e depois volta ao sucesso", async () => {
    const provedor = criarProvedorDeTeste();
    const canal = canalParaProvedor();
    const envio = { mensagemId: "m1", destino: { tipo: "whatsapp", valor: "+5511987654321" }, conteudo: "oi" } as const;
    provedor.programarEnvio(
      { ok: false, transitorio: true, codigo: "TEMPO_ESGOTADO", motivo: "demorou" },
      { ok: false, transitorio: false, ambiguo: true, codigo: "RESPOSTA_PERDIDA", motivo: "sem resposta" },
    );
    expect(await provedor.enviar(canal, envio)).toMatchObject({ ok: false, transitorio: true, codigo: "TEMPO_ESGOTADO" });
    expect(await provedor.enviar(canal, envio)).toMatchObject({ ok: false, ambiguo: true });
    expect(await provedor.enviar(canal, envio)).toMatchObject({ ok: true });
    expect(provedor.enviados).toHaveLength(3);
  });

  it("estadoDaConexao devolve a conexão do Canal", async () => {
    const provedor = criarProvedorDeTeste();
    expect(await provedor.estadoDaConexao(canalParaProvedor())).toBe("conectada");
  });
});
