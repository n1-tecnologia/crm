/**
 * O conector da Evolution (Sessão 4, 4.2.3 e 4.3.3) contra o Postgres LOCAL e o servidor HTTP FALSO de `testes/servidor-falso.ts`.
 * Nada aqui fala com uma Evolution real nem com o banco do `.env`.
 *
 * O servidor falso responde em FILA (uma resposta por requisição, na ordem): cada teste programa exatamente as chamadas que o
 * fluxo deve fazer, e `recebidas` prova a ordem, o método, o caminho e a `apikey` de cada uma. Uma chamada a mais que a
 * programada recebe 500 `SEM_RESPOSTA_PROGRAMADA` e derruba o teste: o fluxo não pode chamar a Evolution "de sobra".
 */

import { randomBytes } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Canal } from "@n1/dominio/crm/canais";
import { encerrar, pool } from "../../../persistencia/conexao";
import { criarRepositorioDeCanaisPg } from "../../../repositorios/crm/canais";
import { guardarCredencial, lerCredencial, type ChavesDoCofre } from "../../../servicos/cofre";
import { criarServidorFalso, type ServidorFalso } from "../../../testes/servidor-falso";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal } from "../../../testes/banco-crm";
import { TIPO_DO_SEGREDO_DO_WEBHOOK } from "../../provedor";
import { nomeDaInstanciaDoCanal, type LeituraDaConfiguracao } from "./ambiente";
import { criarClienteDaEvolution } from "./cliente";
import { criarConectorDaEvolution, FalhaDoProvedor, FRASE_DE_FALHA_DO_WHATSAPP, type ConectorDaEvolution } from "./conexao";

const chaves: ChavesDoCofre = { atual: { versao: 1, chave: randomBytes(32) } };
const GLOBAL = "chave-global-da-evolution-NUNCA-NO-COFRE";
const URL_PUBLICA = "https://api.n1.teste";
const NUMERO = "+5511987654321";
const TOKEN_GERADO = "tok-gerado-pelo-crm-0001";
const SEGREDO_GERADO = "segredo-do-webhook-gerado-0001";
const QR = Buffer.from("png-do-qr-code-de-teste-0123456789").toString("base64");
const QR_DATA_URL = `data:image/png;base64,${QR}`;

describeComBanco("conector da Evolution — Postgres local e Evolution falsa", () => {
  const espacos: string[] = [];
  let falso: ServidorFalso;

  beforeAll(async () => {
    await prepararBancoCrm();
  });
  afterAll(async () => {
    for (const ws of espacos) await limparEspaco(ws);
    await encerrar();
  });
  beforeEach(async () => {
    falso = await criarServidorFalso();
  });
  afterEach(async () => {
    await falso.fechar();
  });

  const configuracao = (): LeituraDaConfiguracao => ({ ok: true, configuracao: { url: falso.url, apikeyGlobal: GLOBAL, urlPublica: URL_PUBLICA } });

  function conector(extra: { configuracao?: () => LeituraDaConfiguracao; chaves?: () => ChavesDoCofre; url?: string } = {}): ConectorDaEvolution {
    return criarConectorDaEvolution({
      pool: () => pool(),
      configuracao: extra.configuracao ?? configuracao,
      chaves: extra.chaves ?? (() => chaves),
      cliente: (config) => criarClienteDaEvolution({ url: extra.url ?? config.url, timeoutMs: 1_500 }),
      gerarToken: () => TOKEN_GERADO,
      gerarSegredo: () => SEGREDO_GERADO,
    });
  }

  async function novoCanal(rotulo: string, opcoes: { identificador?: string; provedor?: string; conexao?: "conectada" | "desconectada" | "com_erro" } = {}) {
    const ws = novoEspacoDeTeste(rotulo);
    espacos.push(ws);
    await pool().query("insert into plataforma.workspaces (workspace_id) values ($1)", [ws]);
    const id = await semearCanal(ws, {
      nome: "WhatsApp do atendimento",
      tipo: "whatsapp",
      provedor: opcoes.provedor ?? "whatsapp-nao-oficial",
      identificadorExterno: opcoes.identificador ?? NUMERO,
      conexao: opcoes.conexao ?? "desconectada",
    });
    return { ws, id };
  }

  async function lerCanal(ws: string, id: string): Promise<Canal> {
    const canal = await criarRepositorioDeCanaisPg(pool()).obter(ws, id);
    if (!canal) throw new Error("Canal sumiu do teste");
    return canal;
  }

  const credencialDoCanal = (ws: string, id: string, tipo: string) =>
    lerCredencial(pool(), chaves, { workspaceId: ws, donoTipo: "canal", donoId: id, tipo });

  /** Grava a ligação como o conector a gravaria (ou como o `canal:ligar-evolution` a gravou). */
  async function ligar(ws: string, id: string, instancia: string, token: string, segredo?: string) {
    const dono = { workspaceId: ws, donoTipo: "canal", donoId: id } as const;
    if (segredo !== undefined) await guardarCredencial(pool(), chaves, { ...dono, tipo: TIPO_DO_SEGREDO_DO_WEBHOOK, segredo });
    await guardarCredencial(pool(), chaves, { ...dono, tipo: "whatsapp-nao-oficial", segredo: JSON.stringify({ instancia, apikey: token }) });
  }

  describe("conectar: a primeira vez", () => {
    it("cria a instância do CRM com o token e o webhook, guarda tudo cifrado no cofre, devolve o QR e NÃO grava conectada", async () => {
      const { ws, id } = await novoCanal("primeira");
      const nome = nomeDaInstanciaDoCanal(ws, id);
      falso.enfileirar({ kind: "ok", status: 200, corpo: [] }); // fetchInstances: não existe
      falso.enfileirar({ kind: "ok", status: 201, corpo: { hash: TOKEN_GERADO, qrcode: { count: 1, base64: QR_DATA_URL, pairingCode: "WZYEH1YY" } } });

      const resultado = await conector().conectar(ws, await lerCanal(ws, id));

      expect(resultado).toEqual({ ok: true, valor: { situacao: "qrcode", qrcode: { imagem: QR_DATA_URL, codigoDePareamento: "WZYEH1YY" } } });
      expect(falso.recebidas.map((r) => `${r.metodo} ${r.caminho}`)).toEqual([`GET /instance/fetchInstances?instanceName=${nome}`, "POST /instance/create"]);
      expect(falso.recebidas.every((r) => r.cabecalhos.apikey === GLOBAL)).toBe(true);
      expect(falso.recebidas[1]!.corpo).toMatchObject({
        instanceName: nome,
        token: TOKEN_GERADO,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
        number: "5511987654321",
        webhook: { url: `${URL_PUBLICA}/webhooks/mensageria/${id}`, headers: { "x-n1-webhook-segredo": SEGREDO_GERADO } },
      });
      // O Canal continua desconectado: só o provedor, pelo webhook, diz que conectou.
      expect((await lerCanal(ws, id)).conexao).toBe("desconectada");
      // O cofre guarda o token da INSTÂNCIA e o segredo do webhook; nunca a chave global.
      expect(JSON.parse((await credencialDoCanal(ws, id, "whatsapp-nao-oficial"))!)).toEqual({ instancia: nome, apikey: TOKEN_GERADO });
      expect(await credencialDoCanal(ws, id, TIPO_DO_SEGREDO_DO_WEBHOOK)).toBe(SEGREDO_GERADO);
      const linhas = await pool().query<{ segredo_cifrado: Buffer }>("select segredo_cifrado from plataforma.credenciais where workspace_id = $1", [ws]);
      for (const { segredo_cifrado } of linhas.rows) expect(segredo_cifrado.toString("utf8")).not.toMatch(new RegExp(`${TOKEN_GERADO}|${SEGREDO_GERADO}|${GLOBAL}`));
      const todas = await pool().query<{ n: string }>("select count(*)::text as n from plataforma.credenciais where workspace_id = $1 and segredo_cifrado::text like $2", [ws, `%${GLOBAL}%`]);
      expect(todas.rows[0]!.n).toBe("0");
    });

    it("a Evolution que ainda não gerou o QR responde 'aguardando' (e a instância fica criada e guardada)", async () => {
      const { ws, id } = await novoCanal("sem-qr");
      falso.enfileirar({ kind: "ok", status: 200, corpo: [] });
      falso.enfileirar({ kind: "ok", status: 201, corpo: { hash: TOKEN_GERADO, qrcode: { count: 0 } } });
      expect(await conector().conectar(ws, await lerCanal(ws, id))).toEqual({ ok: true, valor: { situacao: "aguardando" } });
      expect(await credencialDoCanal(ws, id, "whatsapp-nao-oficial")).toBeDefined();
    });
  });

  describe("conectar: o painel pede outro QR (idempotente)", () => {
    it("com a instância e a credencial já existentes só pede o QR: não cria, não reconfigura o webhook, não troca o segredo", async () => {
      const { ws, id } = await novoCanal("renovar");
      const nome = nomeDaInstanciaDoCanal(ws, id);
      await ligar(ws, id, nome, TOKEN_GERADO, "segredo-que-NAO-pode-mudar");
      falso.enfileirar({ kind: "ok", status: 200, corpo: [{ name: nome, ownerJid: null, token: TOKEN_GERADO, connectionStatus: "close" }] });
      falso.enfileirar({ kind: "ok", status: 200, corpo: { instance: { instanceName: nome, state: "close" } } });
      falso.enfileirar({ kind: "ok", status: 200, corpo: { pairingCode: "ABCD1234", code: "2@x", base64: QR_DATA_URL, count: 4 } });

      const resultado = await conector().conectar(ws, await lerCanal(ws, id));

      expect(resultado).toEqual({ ok: true, valor: { situacao: "qrcode", qrcode: { imagem: QR_DATA_URL, codigoDePareamento: "ABCD1234" } } });
      expect(falso.recebidas.map((r) => `${r.metodo} ${r.caminho.split("?")[0]}`)).toEqual([
        "GET /instance/fetchInstances",
        `GET /instance/connectionState/${nome}`,
        `GET /instance/connect/${nome}`,
      ]);
      // O QR e o estado são da instância: a chamada leva o TOKEN dela, não a chave global.
      expect(falso.recebidas[1]!.cabecalhos.apikey).toBe(TOKEN_GERADO);
      expect(falso.recebidas[2]!.cabecalhos.apikey).toBe(TOKEN_GERADO);
      expect(falso.recebidas[2]!.caminho).toContain("?number=5511987654321");
      expect(await credencialDoCanal(ws, id, TIPO_DO_SEGREDO_DO_WEBHOOK)).toBe("segredo-que-NAO-pode-mudar");
    });

    it("se o segredo do webhook sumiu do cofre, ele se refaz e o webhook é reapontado", async () => {
      const { ws, id } = await novoCanal("sem-segredo");
      const nome = nomeDaInstanciaDoCanal(ws, id);
      await ligar(ws, id, nome, TOKEN_GERADO);
      falso.enfileirar({ kind: "ok", status: 200, corpo: [{ name: nome, ownerJid: null, token: TOKEN_GERADO, connectionStatus: "close" }] });
      falso.enfileirar({ kind: "ok", status: 201, corpo: { webhook: { enabled: true } } });
      falso.enfileirar({ kind: "ok", status: 200, corpo: { instance: { state: "close" } } });
      falso.enfileirar({ kind: "ok", status: 200, corpo: { base64: QR_DATA_URL } });
      const resultado = await conector().conectar(ws, await lerCanal(ws, id));
      expect(resultado.ok).toBe(true);
      expect(falso.recebidas[1]).toMatchObject({ metodo: "POST", caminho: `/webhook/set/${nome}` });
      expect(await credencialDoCanal(ws, id, TIPO_DO_SEGREDO_DO_WEBHOOK)).toBe(SEGREDO_GERADO);
    });
  });

  describe("conectar: a instância já está aberta", () => {
    async function abertaComDono(ownerJid: string | null) {
      const { ws, id } = await novoCanal(`aberta-${ownerJid ?? "sem-dono"}`.slice(0, 40));
      const nome = nomeDaInstanciaDoCanal(ws, id);
      await ligar(ws, id, nome, TOKEN_GERADO, "segredo-1");
      falso.enfileirar({ kind: "ok", status: 200, corpo: [{ name: nome, ownerJid, token: TOKEN_GERADO, connectionStatus: "open" }] }); // fetchInstances (existe)
      falso.enfileirar({ kind: "ok", status: 200, corpo: { instance: { state: "open" } } }); // connectionState
      falso.enfileirar({ kind: "ok", status: 200, corpo: { instance: { state: "open" } } }); // conferirConexao: connectionState
      falso.enfileirar({ kind: "ok", status: 200, corpo: [{ name: nome, ownerJid, token: TOKEN_GERADO, connectionStatus: "open" }] }); // conferirConexao: fetchInstances
      return { ws, id, nome };
    }

    it("o número confere: o Canal é confirmado agora (conectada, não simulada) pelo mesmo caminho do webhook", async () => {
      const { ws, id } = await abertaComDono("5511987654321@s.whatsapp.net");
      const resultado = await conector().conectar(ws, await lerCanal(ws, id));
      expect(resultado.ok).toBe(true);
      if (!resultado.ok || resultado.valor.situacao !== "conectada") throw new Error("esperava conectada");
      expect(resultado.valor.canal).toMatchObject({ id, conexao: "conectada", conexaoSimulada: false });
      expect((await lerCanal(ws, id)).conexao).toBe("conectada");
    });

    it("com o nono dígito diferente do cadastro o número ainda confere (55 11 8765 4321 e 55 11 98765 4321 são o mesmo)", async () => {
      const { ws, id } = await abertaComDono("551187654321@s.whatsapp.net");
      expect((await conector().conectar(ws, await lerCanal(ws, id))).ok).toBe(true);
      expect((await lerCanal(ws, id)).conexao).toBe("conectada");
    });

    it("QR lido por OUTRO número: o aparelho é tirado da sessão, o Canal vira com_erro e a recusa diz isso", async () => {
      const { ws, id, nome } = await abertaComDono("5521999990000@s.whatsapp.net");
      falso.enfileirar({ kind: "ok", status: 200, corpo: { status: "SUCCESS", error: false } }); // logout
      const resultado = await conector().conectar(ws, await lerCanal(ws, id));
      expect(resultado).toMatchObject({ ok: false, status: 409, codigo: "NUMERO_DIFERENTE", error: "Este QR code foi lido por outro número. Leia com o celular do número deste Canal." });
      expect(falso.recebidas.at(-1)).toMatchObject({ metodo: "DELETE", caminho: `/instance/logout/${nome}`, cabecalhos: { apikey: TOKEN_GERADO } });
      expect((await lerCanal(ws, id)).conexao).toBe("com_erro");
    });

    it("a Evolution não informa o dono do número: NUNCA grava conectada às cegas (erro transitório, 502)", async () => {
      const { ws, id } = await abertaComDono(null);
      const resultado = await conector().conectar(ws, await lerCanal(ws, id));
      expect(resultado).toMatchObject({ ok: false, status: 502, codigo: "EVOLUTION_INDISPONIVEL" });
      expect((await lerCanal(ws, id)).conexao).toBe("desconectada");
    });
  });

  describe("conectar: o que dá errado", () => {
    it.each([
      [["EVOLUTION_API_KEY"], "Falta no servidor: EVOLUTION_API_KEY."],
      [["EVOLUTION_URL", "API_URL_PUBLICA"], "Falta no servidor: EVOLUTION_URL, API_URL_PUBLICA."],
    ])("sem a configuração (%j): 503 EVOLUTION_NAO_CONFIGURADA dizendo o que falta, sem chamar a rede", async (faltam, frase) => {
      const { ws, id } = await novoCanal("sem-config");
      const resultado = await conector({ configuracao: () => ({ ok: false, faltam }) }).conectar(ws, await lerCanal(ws, id));
      expect(resultado).toMatchObject({ ok: false, status: 503, codigo: "EVOLUTION_NAO_CONFIGURADA" });
      expect((resultado as { error: string }).error).toContain(frase);
      expect(falso.recebidas).toHaveLength(0);
    });

    it("URL mal formada na configuração: 503 dizendo qual", async () => {
      const { ws, id } = await novoCanal("url-ruim");
      const resultado = await conector({ configuracao: () => ({ ok: false, faltam: [], invalida: "EVOLUTION_URL precisa ser só o endereço." }) }).conectar(ws, await lerCanal(ws, id));
      expect(resultado).toMatchObject({ ok: false, status: 503, codigo: "EVOLUTION_NAO_CONFIGURADA" });
      expect((resultado as { error: string }).error).toContain("EVOLUTION_URL precisa ser só o endereço.");
    });

    it("sem COFRE_CHAVE: 503 COFRE_NAO_CONFIGURADO, sem chamar a rede", async () => {
      const { ws, id } = await novoCanal("sem-cofre");
      const resultado = await conector({ chaves: () => { throw new Error("COFRE_CHAVE ausente"); } }).conectar(ws, await lerCanal(ws, id));
      expect(resultado).toMatchObject({ ok: false, status: 503, codigo: "COFRE_NAO_CONFIGURADO" });
      expect(falso.recebidas).toHaveLength(0);
    });

    it("a Evolution recusa a chave do servidor (401): 503 EVOLUTION_CHAVE_RECUSADA, e a frase não repete a chave", async () => {
      const { ws, id } = await novoCanal("chave-recusada");
      falso.enfileirar({ kind: "ok", status: 401, corpo: { error: "Unauthorized", response: { message: `apikey ${GLOBAL} inválida` } } });
      const resultado = await conector().conectar(ws, await lerCanal(ws, id));
      expect(resultado).toMatchObject({ ok: false, status: 503, codigo: "EVOLUTION_CHAVE_RECUSADA" });
      expect(JSON.stringify(resultado)).not.toContain(GLOBAL);
    });

    it("a Evolution fora do ar (conexão recusada) e o tempo esgotado: 502 'Tente de novo', nada gravado", async () => {
      const { ws, id } = await novoCanal("fora-do-ar");
      const semNinguem = await criarServidorFalso();
      const urlMorta = semNinguem.url;
      await semNinguem.fechar();
      const recusada = await conector({ url: urlMorta, configuracao: () => ({ ok: true, configuracao: { url: urlMorta, apikeyGlobal: GLOBAL, urlPublica: URL_PUBLICA } }) }).conectar(ws, await lerCanal(ws, id));
      expect(recusada).toMatchObject({ ok: false, status: 502, codigo: "EVOLUTION_INDISPONIVEL", error: FRASE_DE_FALHA_DO_WHATSAPP });
      falso.enfileirar({ kind: "timeout" });
      const lenta = await conector().conectar(ws, await lerCanal(ws, id));
      expect(lenta).toMatchObject({ ok: false, status: 502, codigo: "EVOLUTION_INDISPONIVEL" });
      expect(await credencialDoCanal(ws, id, "whatsapp-nao-oficial")).toBeUndefined();
    });

    it("um resto de tentativa anterior (a instância existe e o cofre não a conhece) é APAGADO e recriado, só se for do CRM", async () => {
      const { ws, id } = await novoCanal("resto");
      const nome = nomeDaInstanciaDoCanal(ws, id);
      falso.enfileirar({ kind: "ok", status: 200, corpo: [{ name: nome, ownerJid: null, token: null, connectionStatus: "close" }] }); // existe, token desconhecido
      falso.enfileirar({ kind: "ok", status: 200, corpo: { status: "SUCCESS", error: false } }); // delete
      falso.enfileirar({ kind: "ok", status: 201, corpo: { hash: TOKEN_GERADO, qrcode: { base64: QR_DATA_URL } } }); // create
      const resultado = await conector().conectar(ws, await lerCanal(ws, id));
      expect(resultado.ok).toBe(true);
      expect(falso.recebidas.map((r) => `${r.metodo} ${r.caminho.split("?")[0]}`)).toEqual([
        "GET /instance/fetchInstances",
        `DELETE /instance/delete/${nome}`,
        "POST /instance/create",
      ]);
      expect(falso.recebidas[1]!.cabecalhos.apikey).toBe(GLOBAL);
    });

    it("duas abas criando ao mesmo tempo: o create que perde (403, nome em uso) responde 'aguardando' e a próxima rodada acha a instância", async () => {
      const { ws, id } = await novoCanal("corrida");
      falso.enfileirar({ kind: "ok", status: 200, corpo: [] });
      falso.enfileirar({ kind: "ok", status: 403, corpo: { status: 403, error: "Forbidden", response: { message: ["This name is already in use."] } } });
      expect(await conector().conectar(ws, await lerCanal(ws, id))).toEqual({ ok: true, valor: { situacao: "aguardando" } });
      expect(await credencialDoCanal(ws, id, "whatsapp-nao-oficial")).toBeUndefined();
    });

    it("a instância que o dono ligou à mão e que a Evolution já não conhece: cria a do CRM com o nome n1-... e troca a credencial", async () => {
      const { ws, id } = await novoCanal("manual-sumiu");
      await ligar(ws, id, "instancia-do-dono", "tok-antigo", "segredo-antigo");
      falso.enfileirar({ kind: "ok", status: 200, corpo: [] }); // a do dono sumiu
      falso.enfileirar({ kind: "ok", status: 200, corpo: [] }); // a do CRM ainda não existe
      falso.enfileirar({ kind: "ok", status: 201, corpo: { hash: TOKEN_GERADO, qrcode: { base64: QR_DATA_URL } } });
      expect((await conector().conectar(ws, await lerCanal(ws, id))).ok).toBe(true);
      expect(JSON.parse((await credencialDoCanal(ws, id, "whatsapp-nao-oficial"))!)).toEqual({ instancia: nomeDaInstanciaDoCanal(ws, id), apikey: TOKEN_GERADO });
      expect(falso.recebidas.some((r) => r.caminho.includes("/instance/delete/"))).toBe(false);
    });
  });

  describe("desligar: tira o aparelho da sessão (4.3.3)", () => {
    it("Canal sem credencial: nada a tirar, nenhuma chamada e nenhum cofre exigido", async () => {
      const { ws, id } = await novoCanal("desligar-nunca-conectou");
      await conector({ chaves: () => { throw new Error("COFRE_CHAVE ausente"); } }).desligar(ws, await lerCanal(ws, id), "arquivar");
      expect(falso.recebidas).toHaveLength(0);
    });

    it("desconectar: só 'sair da sessão', com o token da instância; a instância e a credencial ficam (reconectar reaproveita)", async () => {
      const { ws, id } = await novoCanal("desligar-desconectar", { conexao: "conectada" });
      const nome = nomeDaInstanciaDoCanal(ws, id);
      await ligar(ws, id, nome, TOKEN_GERADO, "segredo-1");
      falso.enfileirar({ kind: "ok", status: 200, corpo: { status: "SUCCESS", error: false } });
      await conector().desligar(ws, await lerCanal(ws, id), "desconectar");
      expect(falso.recebidas.map((r) => `${r.metodo} ${r.caminho}`)).toEqual([`DELETE /instance/logout/${nome}`]);
      expect(falso.recebidas[0]!.cabecalhos.apikey).toBe(TOKEN_GERADO);
      expect(await credencialDoCanal(ws, id, "whatsapp-nao-oficial")).toBeDefined();
    });

    it("arquivar uma instância do CRM: sai da sessão e APAGA a instância, esta com a chave global", async () => {
      const { ws, id } = await novoCanal("desligar-arquivar", { conexao: "conectada" });
      const nome = nomeDaInstanciaDoCanal(ws, id);
      await ligar(ws, id, nome, TOKEN_GERADO, "segredo-1");
      falso.enfileirar({ kind: "ok", status: 200, corpo: { status: "SUCCESS", error: false } });
      falso.enfileirar({ kind: "ok", status: 200, corpo: { status: "SUCCESS", error: false } });
      await conector().desligar(ws, await lerCanal(ws, id), "arquivar");
      expect(falso.recebidas.map((r) => `${r.metodo} ${r.caminho} ${r.cabecalhos.apikey === GLOBAL ? "global" : "instancia"}`)).toEqual([
        `DELETE /instance/logout/${nome} instancia`,
        `DELETE /instance/delete/${nome} global`,
      ]);
    });

    it.each(["instancia-do-dono", "numeropvmarcos", "comercial"])(
      "arquivar uma instância que o CRM NÃO criou (%s): só sai da sessão, NUNCA é apagada",
      async (instanciaManual) => {
        const { ws, id } = await novoCanal(`desligar-manual-${instanciaManual}`.slice(0, 40), { conexao: "conectada" });
        await ligar(ws, id, instanciaManual, TOKEN_GERADO, "segredo-1");
        falso.enfileirar({ kind: "ok", status: 200, corpo: { status: "SUCCESS" } });
        await conector().desligar(ws, await lerCanal(ws, id), "arquivar");
        expect(falso.recebidas.map((r) => r.metodo)).toEqual(["DELETE"]);
        expect(falso.recebidas.some((r) => r.caminho.includes("/instance/delete/"))).toBe(false);
      },
    );

    it("a Evolution fora do ar: lança FalhaDoProvedor (a rota devolve 502 e NADA é gravado)", async () => {
      const { ws, id } = await novoCanal("desligar-fora", { conexao: "conectada" });
      await ligar(ws, id, nomeDaInstanciaDoCanal(ws, id), TOKEN_GERADO, "segredo-1");
      falso.enfileirar({ kind: "timeout" });
      await expect(conector().desligar(ws, await lerCanal(ws, id), "desconectar")).rejects.toBeInstanceOf(FalhaDoProvedor);
      falso.enfileirar({ kind: "ok", status: 500, corpo: { error: "x" } });
      await expect(conector().desligar(ws, await lerCanal(ws, id), "desconectar")).rejects.toThrow(FRASE_DE_FALHA_DO_WHATSAPP);
    });

    it.each([401, 403, 404])("credencial recusada ou instância que já não existe (%s) NÃO trava o Canal: a sessão já não é do CRM", async (status) => {
      const { ws, id } = await novoCanal(`desligar-tolera-${status}`, { conexao: "conectada" });
      await ligar(ws, id, nomeDaInstanciaDoCanal(ws, id), TOKEN_GERADO, "segredo-1");
      falso.enfileirar({ kind: "ok", status, corpo: { error: "x" } });
      falso.enfileirar({ kind: "ok", status, corpo: { error: "x" } });
      await expect(conector().desligar(ws, await lerCanal(ws, id), "arquivar")).resolves.toBeUndefined();
    });

    it("sem a chave global (só EVOLUTION_URL) arquivar ainda sai da sessão, e não tenta apagar a instância", async () => {
      const { ws, id } = await novoCanal("desligar-sem-global", { conexao: "conectada" });
      await ligar(ws, id, nomeDaInstanciaDoCanal(ws, id), TOKEN_GERADO, "segredo-1");
      falso.enfileirar({ kind: "ok", status: 200, corpo: { status: "SUCCESS" } });
      const semGlobal = criarConectorDaEvolution({
        pool: () => pool(),
        configuracao: () => ({ ok: false, faltam: ["EVOLUTION_API_KEY"] }),
        chaves: () => chaves,
        cliente: () => criarClienteDaEvolution({ url: falso.url, timeoutMs: 1_500 }),
      });
      // Sem a chave, o cliente cai na EVOLUTION_URL do ambiente; aqui o teste injeta o cliente do servidor falso.
      await semGlobal.desligar(ws, await lerCanal(ws, id), "arquivar");
      expect(falso.recebidas.map((r) => r.metodo)).toEqual(["DELETE"]);
    });
  });
});
