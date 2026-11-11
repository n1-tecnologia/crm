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
    expect(provedor.interpretarChamada({ ...texto, event: "qrcode.updated" }, canal)).toEqual([{ tipo: "ignorado", motivo: "evento_nao_tratado" }]);
    expect(provedor.interpretarChamada({ ...texto, instance: "outra" }, canal)).toEqual([{ tipo: "ignorado", motivo: "evento_nao_tratado" }]);
  });

  it("chaveDaChamada é o key.id do webhook; sem ele, nenhuma", () => {
    expect(provedor.chaveDaChamada?.(texto)).toBe(texto.data.key.id);
    expect(provedor.chaveDaChamada?.({})).toBeUndefined();
    expect(provedor.chaveDaChamada?.(null)).toBeUndefined();
  });

  it("só o messages.upsert tem chave: o tique da mesma Mensagem (entregue, depois lida) repete o id e não pode ser descartado como repetido (4.4.5)", () => {
    for (const nome of ["messages.update", "messages.delete", "messages.edited", "connection.update", "MESSAGES_UPDATE"]) {
      expect(provedor.chaveDaChamada?.({ event: nome, instance: INSTANCIA, data: { key: { id: texto.data.key.id }, keyId: texto.data.key.id } })).toBeUndefined();
    }
    expect(provedor.chaveDaChamada?.({ ...texto, event: "MESSAGES_UPSERT" })).toBe(texto.data.key.id);
    expect(provedor.chaveDaChamada?.({ data: texto.data })).toBeUndefined();
  });

  it("interpretarChamada traduz o tique, a apagada e a editada (4.4.5)", () => {
    const canal = canalDaEvolution();
    const corpo = (event: string, data: unknown) => ({ event, instance: INSTANCIA, data });
    expect(provedor.interpretarChamada(corpo("messages.update", { keyId: "3EB0AA", remoteJid: "5511987654321@s.whatsapp.net", fromMe: true, status: "READ" }), canal)).toMatchObject([
      { tipo: "status", idExterno: "3EB0AA", status: "lida" },
    ]);
    expect(provedor.interpretarChamada(corpo("messages.delete", { remoteJid: "5511987654321@s.whatsapp.net", fromMe: false, id: "3EB0AA", status: "DELETED" }), canal)).toMatchObject([
      { tipo: "exclusao", idExterno: "3EB0AA", porQuem: "remetente_externo" },
    ]);
    expect(provedor.interpretarChamada(corpo("messages.edited", { key: { id: "3EB0AA" }, type: "MESSAGE_EDIT", editedMessage: { conversation: "novo" } }), canal)).toMatchObject([
      { tipo: "edicao", idExterno: "3EB0AA", conteudo: "novo" },
    ]);
  });

  it("o provedor se chama whatsapp-nao-oficial", () => {
    expect(provedor.provedor).toBe("whatsapp-nao-oficial");
  });
});

describe("provedor da Evolution: conferirConexao (Sessão 4, 4.3.1) — o 'open' do webhook é só um aviso", () => {
  const TOKEN_DA_INSTANCIA = "tok-da-instancia-9z";
  const GLOBAL = "chave-global-9z";
  const canalDoNumero = (): CanalParaProvedor => {
    const base = canalDaEvolution();
    return {
      ...base,
      canal: { ...base.canal, identificadorExterno: "+5511987654321" },
      credencial: JSON.stringify({ instancia: INSTANCIA, apikey: TOKEN_DA_INSTANCIA }),
    };
  };
  const dono = (ownerJid: string | null) => [{ name: INSTANCIA, ownerJid, token: TOKEN_DA_INSTANCIA, connectionStatus: "open" }];

  async function montar(opcoes: { apikeyGlobal?: string } = {}) {
    const falso = await criarServidorFalso();
    const provedor = criarProvedorEvolution({ url: falso.url, timeoutMs: 800, ...(opcoes.apikeyGlobal ? { apikeyGlobal: opcoes.apikeyGlobal } : {}) });
    return { falso, provedor };
  }
  const aberta = (falso: Awaited<ReturnType<typeof criarServidorFalso>>) =>
    falso.enfileirar({ kind: "ok", status: 200, corpo: { instance: { instanceName: INSTANCIA, state: "open" } } });

  it("instância aberta e número do Canal: conectada, 'confirmada'; o dono do número é lido com a chave GLOBAL quando há", async () => {
    const { falso, provedor } = await montar({ apikeyGlobal: GLOBAL });
    aberta(falso);
    falso.enfileirar({ kind: "ok", status: 200, corpo: dono("5511987654321@s.whatsapp.net") });
    expect(await provedor.conferirConexao!(canalDoNumero())).toEqual({ conexao: "conectada", motivo: "confirmada" });
    expect(falso.recebidas[0]!.cabecalhos.apikey).toBe(TOKEN_DA_INSTANCIA);
    expect(falso.recebidas[1]).toMatchObject({ metodo: "GET", cabecalhos: { apikey: GLOBAL } });
    await falso.fechar();
  });

  it("sem a chave global, o dono do número é lido com o token da instância", async () => {
    const { falso, provedor } = await montar();
    aberta(falso);
    falso.enfileirar({ kind: "ok", status: 200, corpo: dono("5511987654321@s.whatsapp.net") });
    expect(await provedor.conferirConexao!(canalDoNumero())).toMatchObject({ conexao: "conectada" });
    expect(falso.recebidas[1]!.cabecalhos.apikey).toBe(TOKEN_DA_INSTANCIA);
    await falso.fechar();
  });

  it("o nono dígito do cadastro e o do WhatsApp podem diferir: ainda é o mesmo número", async () => {
    const { falso, provedor } = await montar({ apikeyGlobal: GLOBAL });
    aberta(falso);
    falso.enfileirar({ kind: "ok", status: 200, corpo: dono("551187654321@s.whatsapp.net") });
    expect(await provedor.conferirConexao!(canalDoNumero())).toMatchObject({ conexao: "conectada" });
    await falso.fechar();
  });

  it("outro número: com_erro 'outro_numero' e o aparelho é tirado da sessão (logout com o token da instância)", async () => {
    const { falso, provedor } = await montar({ apikeyGlobal: GLOBAL });
    aberta(falso);
    falso.enfileirar({ kind: "ok", status: 200, corpo: dono("5521999990000@s.whatsapp.net") });
    falso.enfileirar({ kind: "ok", status: 200, corpo: { status: "SUCCESS" } });
    expect(await provedor.conferirConexao!(canalDoNumero())).toEqual({ conexao: "com_erro", motivo: "outro_numero" });
    expect(falso.recebidas[2]).toMatchObject({ metodo: "DELETE", caminho: `/instance/logout/${INSTANCIA}`, cabecalhos: { apikey: TOKEN_DA_INSTANCIA } });
    await falso.fechar();
  });

  it("outro número e o logout também falha: ainda é com_erro (a falha do logout não esconde o número errado)", async () => {
    const { falso, provedor } = await montar({ apikeyGlobal: GLOBAL });
    aberta(falso);
    falso.enfileirar({ kind: "ok", status: 200, corpo: dono("5521999990000@s.whatsapp.net") });
    falso.enfileirar({ kind: "timeout" });
    expect(await provedor.conferirConexao!(canalDoNumero())).toEqual({ conexao: "com_erro", motivo: "outro_numero" });
    await falso.fechar();
  });

  it("a instância já não está aberta (fechou entre o aviso e a conferência): nada é confirmado e nada é gravado (sem conexao)", async () => {
    const { falso, provedor } = await montar();
    falso.enfileirar({ kind: "ok", status: 200, corpo: { instance: { instanceName: INSTANCIA, state: "close" } } });
    expect(await provedor.conferirConexao!(canalDoNumero())).toEqual({ motivo: "instancia_nao_aberta" });
    await falso.fechar();
  });

  it("a Evolution não informa o dono do número: lança PROVEDOR_INDISPONIVEL (a linha volta à fila), NUNCA devolve conectada", async () => {
    const { falso, provedor } = await montar();
    aberta(falso);
    falso.enfileirar({ kind: "ok", status: 200, corpo: dono(null) });
    await expect(provedor.conferirConexao!(canalDoNumero())).rejects.toMatchObject({ name: "ErroDeProvedor", codigo: "PROVEDOR_INDISPONIVEL" });
    await falso.fechar();
  });

  it("a instância sumiu (fetchInstances sem a instância, ou 404): com_erro 'instancia_inexistente'", async () => {
    const { falso, provedor } = await montar();
    aberta(falso);
    falso.enfileirar({ kind: "ok", status: 200, corpo: [] });
    expect(await provedor.conferirConexao!(canalDoNumero())).toEqual({ conexao: "com_erro", motivo: "instancia_inexistente" });
    falso.enfileirar({ kind: "ok", status: 404, corpo: { error: "Not Found" } });
    expect(await provedor.conferirConexao!(canalDoNumero())).toEqual({ conexao: "com_erro", motivo: "instancia_inexistente" });
    await falso.fechar();
  });

  it("a Evolution recusou a credencial do Canal (401 ou 403): com_erro 'credencial_recusada'", async () => {
    for (const status of [401, 403]) {
      const { falso, provedor } = await montar();
      falso.enfileirar({ kind: "ok", status, corpo: { error: "Unauthorized" } });
      expect(await provedor.conferirConexao!(canalDoNumero())).toEqual({ conexao: "com_erro", motivo: "credencial_recusada" });
      await falso.fechar();
    }
  });

  it("a Evolution fora do ar (5xx, tempo esgotado, conexão recusada): lança PROVEDOR_INDISPONIVEL, nunca decide por ela", async () => {
    const { falso, provedor } = await montar();
    falso.enfileirar({ kind: "ok", status: 500, corpo: { error: "x" } });
    await expect(provedor.conferirConexao!(canalDoNumero())).rejects.toMatchObject({ codigo: "PROVEDOR_INDISPONIVEL" });
    falso.enfileirar({ kind: "timeout" });
    await expect(provedor.conferirConexao!(canalDoNumero())).rejects.toMatchObject({ codigo: "PROVEDOR_INDISPONIVEL" });
    await falso.fechar();
    await expect(provedor.conferirConexao!(canalDoNumero())).rejects.toMatchObject({ codigo: "PROVEDOR_INDISPONIVEL" });
  });

  it("Canal sem credencial: com_erro 'sem_credencial', sem tocar a rede", async () => {
    const { falso, provedor } = await montar();
    expect(await provedor.conferirConexao!({ ...canalDoNumero(), credencial: undefined })).toEqual({ conexao: "com_erro", motivo: "sem_credencial" });
    expect(falso.recebidas).toHaveLength(0);
    await falso.fechar();
  });

  it("nada do resultado carrega a chave global, o token da instância nem o número", async () => {
    const { falso, provedor } = await montar({ apikeyGlobal: GLOBAL });
    aberta(falso);
    falso.enfileirar({ kind: "ok", status: 200, corpo: dono("5521999990000@s.whatsapp.net") });
    falso.enfileirar({ kind: "ok", status: 200, corpo: { status: "SUCCESS" } });
    const resultado = await provedor.conferirConexao!(canalDoNumero());
    expect(JSON.stringify(resultado)).not.toMatch(new RegExp(`${GLOBAL}|${TOKEN_DA_INSTANCIA}|5521999990000|5511987654321`));
    await falso.fechar();
  });
});

describe("provedor da Evolution: a resposta citada (4.4.4)", () => {
  async function enviarCitando(envio: Partial<Parameters<ReturnType<typeof criarProvedorEvolution>["enviar"]>[1]>) {
    const falso = await criarServidorFalso();
    try {
      const provedor = criarProvedorEvolution({ url: falso.url, timeoutMs: 2_000 });
      falso.enfileirar({ kind: "ok", status: 201, corpo: { key: { remoteJid: "5511987654321@s.whatsapp.net", fromMe: true, id: "3EB0CI" }, status: "PENDING" } });
      const r = await provedor.enviar(canalDaEvolution(), { mensagemId: "m1", destino: { tipo: "whatsapp", valor: "+5511987654321" }, conteudo: "certo, combinado", ...envio });
      return { r, corpo: falso.recebidas[0]!.corpo };
    } finally {
      await falso.fechar();
    }
  }

  it("a resposta a uma Mensagem do Contato leva quoted: o id dela, o chat, fromMe falso e o texto que aparece na citação", async () => {
    const { r, corpo } = await enviarCitando({ emRespostaAIdExterno: "3EB0QQ", emRespostaADetalhes: { nossa: false, texto: "posso ligar amanhã?" } });
    expect(r).toMatchObject({ ok: true, idExterno: "3EB0CI" });
    expect(corpo).toEqual({
      number: "5511987654321",
      text: "certo, combinado",
      quoted: { key: { id: "3EB0QQ", remoteJid: "5511987654321@s.whatsapp.net", fromMe: false }, message: { conversation: "posso ligar amanhã?" } },
    });
  });

  it("a resposta a uma Mensagem que NÓS mandamos leva fromMe verdadeiro", async () => {
    const { corpo } = await enviarCitando({ emRespostaAIdExterno: "3EB0NN", emRespostaADetalhes: { nossa: true, texto: "oi" } });
    expect(corpo).toMatchObject({ quoted: { key: { id: "3EB0NN", fromMe: true } } });
  });

  it("sem citação o corpo é o de sempre", async () => {
    const { corpo } = await enviarCitando({});
    expect(corpo).toEqual({ number: "5511987654321", text: "certo, combinado" });
  });
});
