/**
 * Sessão 4, ponta a ponta: conectar o WhatsApp não oficial PELO CRM, com a Evolution como servidor HTTP FALSO
 * (`testes/servidor-falso.ts`) e o Postgres LOCAL. As rotas, o serviço de Canais, o conector da Evolution, o webhook público, o
 * processador de entrada e o provedor são os REAIS; só a Evolution é de mentira. Nada aqui fala com uma Evolution real.
 *
 * O que este arquivo prova que nenhum teste de unidade prova sozinho:
 *   - `POST /canais/:id/conectar` cria a instância, guarda a credencial cifrada e devolve o QR, e o Canal CONTINUA `desconectada`;
 *   - o `connection.update` `open` chega pela rota pública, e o Canal só vira `conectada` depois de o processador CONFERIR na
 *     Evolution que a instância está aberta e que o número é o do Canal;
 *   - queda vira `com_erro`, aparelho removido (razão 401) vira `desconectada`, e um QR lido por outro número tira o aparelho
 *     da sessão e vira `com_erro`;
 *   - desconectar e arquivar falam com a Evolution ANTES de gravar, e a Evolution fora do ar deixa tudo como estava (502);
 *   - um webhook sem o segredo do Canal não entra.
 */

import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import { buildApp } from "../app";
import { criarProcessadorDeEntrada } from "../mensageria/processador-de-entrada";
import { CABECALHO_DO_SEGREDO } from "../mensageria/provedor";
import { nomeDaInstanciaDoCanal } from "../mensageria/provedores/evolution/ambiente";
import { criarClienteDaEvolution } from "../mensageria/provedores/evolution/cliente";
import { criarConectorDaEvolution } from "../mensageria/provedores/evolution/conexao";
import { criarProvedorEvolution } from "../mensageria/provedores/evolution/provedor";
import type { RegistroDeProvedores } from "../mensageria/registro";
import { provedorDeTeste } from "../mensageria/provedores/teste";
import { encerrar, pool } from "../persistencia/conexao";
import { lerCredencial, type ChavesDoCofre } from "../servicos/cofre";
import { criarServidorFalso, type ServidorFalso } from "../testes/servidor-falso";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal, semearMembro } from "../testes/banco-crm";

const chaves: ChavesDoCofre = { atual: { versao: 1, chave: randomBytes(32) } };
const GLOBAL = "chave-global-da-evolution-do-e2e";
const URL_PUBLICA = "https://api.n1.teste";
const NUMERO_DO_CANAL = "+5511987654321";
const DONO_CERTO = "5511987654321@s.whatsapp.net";
const QR = Buffer.from("png-do-qr-do-e2e-0123456789-abcdef").toString("base64");
const QR_DATA_URL = `data:image/png;base64,${QR}`;
const ADMIN = { authorization: "Bearer token-ana" };
const membroBase = buildSeed().members.find((m) => m.id === "mem_maryane")!;

interface Envelope {
  ok: boolean;
  error?: string;
  codigo?: string;
  dados?: { situacao?: string; qrcode?: { imagem: string; codigoDePareamento?: string }; conexao?: string; simulacaoPermitida?: boolean; ligadoAoProvedor?: boolean };
}

describeComBanco("Sessão 4 ponta a ponta: conectar o WhatsApp não oficial pelo CRM (Evolution falsa)", () => {
  const ws = novoEspacoDeTeste("conexaoevolution");
  let falso: ServidorFalso;
  let registro: RegistroDeProvedores;
  let canalId: string;
  let instancia: string;
  let segredoDoWebhook: string;

  const app = () =>
    buildApp({
      logger: false,
      workspaceId: ws,
      webhooksDeMensageria: { chaves, registro },
      crm: {
        conectoresDeCanal: {
          whatsappNaoOficial: criarConectorDaEvolution({
            pool: () => pool(),
            configuracao: () => ({ ok: true, configuracao: { url: falso.url, apikeyGlobal: GLOBAL, urlPublica: URL_PUBLICA } }),
            chaves: () => chaves,
            cliente: (config) => criarClienteDaEvolution({ url: config.url, timeoutMs: 1_500 }),
          }),
        },
      },
      verificarToken: async (token) => (token === "token-ana" ? { sub: "usuario-ana" } : null),
      resolverMembro: async (_workspaceId, userId) =>
        userId === "usuario-ana" ? { ...membroBase, id: "mem_ana", userId, state: "ativo" as const } : undefined,
    });

  const post = async (url: string) => {
    const resposta = await app().inject({ method: "POST", url, headers: ADMIN });
    return { status: resposta.statusCode, corpo: resposta.json() as Envelope };
  };

  const conexaoDoCanal = async () =>
    (await pool().query<{ conexao: string; conexao_simulada: boolean; estado: string }>("select conexao, conexao_simulada, estado from plataforma.canais where workspace_id = $1 and id = $2", [ws, canalId])).rows[0]!;

  const webhook = (corpo: unknown, cabecalhos: Record<string, string> = { [CABECALHO_DO_SEGREDO]: segredoDoWebhook }) =>
    app().inject({ method: "POST", url: `/webhooks/mensageria/${canalId}`, headers: cabecalhos, payload: corpo as object });

  const eventoDeConexao = (data: unknown, instanciaDoCorpo = instancia) => ({ event: "connection.update", instance: instanciaDoCorpo, data });

  /** Esvazia a fila de entrada como o worker faria: uma linha por vez, até acabar. */
  async function processarTudo(): Promise<number> {
    const processador = criarProcessadorDeEntrada({ workerId: "teste-conexao", chaves, registro });
    let n = 0;
    while (await processador.processarUm()) n += 1;
    return n;
  }

  const filaPendente = async () =>
    Number((await pool().query<{ n: string }>("select count(*)::text as n from plataforma.webhooks_recebidos where workspace_id = $1 and estado = 'pendente'", [ws])).rows[0]!.n);

  /** As duas respostas que `conferirConexao` consome: o estado da instância e o dono do número dela. */
  function programarConferencia(ownerJid: string | null, estado = "open") {
    falso.enfileirar({ kind: "ok", status: 200, corpo: { instance: { instanceName: instancia, state: estado } } });
    if (estado === "open") falso.enfileirar({ kind: "ok", status: 200, corpo: [{ name: instancia, ownerJid, token: "tok", connectionStatus: "open" }] });
  }

  beforeAll(async () => {
    await prepararBancoCrm();
    falso = await criarServidorFalso();
    registro = { teste: provedorDeTeste, porProvedor: { "whatsapp-nao-oficial": criarProvedorEvolution({ url: falso.url, apikeyGlobal: GLOBAL, timeoutMs: 1_500 }) } };
    await semearMembro(ws, { id: "mem_ana", base: "proprietario", state: "ativo" });
    canalId = await semearCanal(ws, {
      nome: "Atendimento",
      tipo: "whatsapp",
      provedor: "whatsapp-nao-oficial",
      identificadorExterno: NUMERO_DO_CANAL,
      conexao: "desconectada",
      configuradoPor: "mem_ana",
    });
    instancia = nomeDaInstanciaDoCanal(ws, canalId);
  });

  beforeEach(() => {
    provedorDeTeste.limpar();
  });

  afterAll(async () => {
    await pool().query("delete from plataforma.webhooks_recebidos where workspace_id = $1", [ws]);
    await pool().query("delete from plataforma.integration_outbox where workspace_id = $1", [ws]);
    await pool().query("delete from plataforma.credenciais where workspace_id = $1", [ws]);
    await limparEspaco(ws);
    await falso.fechar();
    await encerrar();
  });

  it("a ficha diz que a simulação está ligada neste ambiente de teste (e que o Canal ainda não foi ligado a um provedor)", async () => {
    const resposta = await app().inject({ method: "GET", url: `/canais/${canalId}`, headers: ADMIN });
    expect(resposta.statusCode).toBe(200);
    expect((resposta.json() as Envelope).dados).toMatchObject({ conexao: "desconectada", ligadoAoProvedor: false, simulacaoPermitida: true });
  });

  it("1. POST /canais/:id/conectar cria a instância, devolve o QR e o código, guarda a credencial cifrada e NÃO conecta o Canal", async () => {
    falso.enfileirar({ kind: "ok", status: 200, corpo: [] });
    falso.enfileirar({ kind: "ok", status: 201, corpo: { hash: "x", qrcode: { count: 1, base64: QR_DATA_URL, pairingCode: "WZYEH1YY" } } });

    const { status, corpo } = await post(`/canais/${canalId}/conectar`);

    expect(status).toBe(200);
    expect(corpo).toEqual({ ok: true, dados: { situacao: "qrcode", qrcode: { imagem: QR_DATA_URL, codigoDePareamento: "WZYEH1YY" } } });
    expect((await conexaoDoCanal()).conexao).toBe("desconectada");
    const dono = { workspaceId: ws, donoTipo: "canal", donoId: canalId } as const;
    segredoDoWebhook = (await lerCredencial(pool(), chaves, { ...dono, tipo: "webhook_segredo" }))!;
    expect(segredoDoWebhook).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.parse((await lerCredencial(pool(), chaves, { ...dono, tipo: "whatsapp-nao-oficial" }))!)).toMatchObject({ instancia });
    // O webhook que a Evolution recebeu aponta para a rota do Canal e leva o MESMO segredo que o cofre guardou.
    expect(falso.recebidas[1]!.corpo).toMatchObject({ webhook: { url: `${URL_PUBLICA}/webhooks/mensageria/${canalId}`, headers: { [CABECALHO_DO_SEGREDO]: segredoDoWebhook } } });
  });

  it("2. um webhook SEM o segredo do Canal (ou com outro) é recusado e nada entra na fila", async () => {
    const antes = await filaPendente();
    expect((await webhook(eventoDeConexao({ state: "open" }), {})).statusCode).toBe(401);
    expect((await webhook(eventoDeConexao({ state: "open" }), { [CABECALHO_DO_SEGREDO]: "segredo-errado" })).statusCode).toBe(401);
    expect(await filaPendente()).toBe(antes);
    expect((await conexaoDoCanal()).conexao).toBe("desconectada");
  });

  it("3. o aviso 'open' do celular lido CONFERE na Evolution (instância aberta e número do Canal) e só então o Canal fica conectado, não simulado", async () => {
    expect((await webhook(eventoDeConexao({ instance: instancia, state: "open", statusReason: 200 }))).statusCode).toBe(200);
    // O aviso sozinho não muda nada: quem confere é o processador.
    expect((await conexaoDoCanal()).conexao).toBe("desconectada");
    programarConferencia(DONO_CERTO);

    expect(await processarTudo()).toBe(1);

    expect(await conexaoDoCanal()).toMatchObject({ conexao: "conectada", conexao_simulada: false });
    expect(falso.recebidas.slice(-2).map((r) => `${r.metodo} ${r.caminho.split("?")[0]}`)).toEqual([`GET /instance/connectionState/${instancia}`, "GET /instance/fetchInstances"]);
    const linha = (await pool().query<{ estado: string }>("select estado from plataforma.webhooks_recebidos where workspace_id = $1 order by recebido_em desc limit 1", [ws])).rows[0]!;
    expect(linha.estado).toBe("processado");
  });

  it("4. uma queda (close por outra razão que não 401) deixa o Canal com_erro", async () => {
    expect((await webhook(eventoDeConexao({ state: "close", statusReason: 428 }))).statusCode).toBe(200);
    await processarTudo();
    expect((await conexaoDoCanal()).conexao).toBe("com_erro");
  });

  it("5. voltar a abrir, com o número certo, tira o Canal do erro", async () => {
    expect((await webhook(eventoDeConexao({ state: "open" }))).statusCode).toBe(200);
    programarConferencia(DONO_CERTO);
    await processarTudo();
    expect((await conexaoDoCanal()).conexao).toBe("conectada");
  });

  it("6. aparelho removido no celular (close, razão 401) deixa o Canal desconectado, sem chamar a Evolution", async () => {
    const antes = falso.recebidas.length;
    expect((await webhook(eventoDeConexao({ state: "close", statusReason: 401 }))).statusCode).toBe(200);
    await processarTudo();
    expect((await conexaoDoCanal()).conexao).toBe("desconectada");
    expect(falso.recebidas.length).toBe(antes);
  });

  it("7. um close por queda que chega com o Canal já desconectado NÃO vira erro (não há conexão a perder)", async () => {
    expect((await webhook(eventoDeConexao({ state: "close", statusReason: 428 }))).statusCode).toBe(200);
    await processarTudo();
    expect((await conexaoDoCanal()).conexao).toBe("desconectada");
    const linha = (await pool().query<{ resultado: string | null }>("select resultado from plataforma.webhooks_recebidos where workspace_id = $1 order by recebido_em desc limit 1", [ws])).rows[0]!;
    expect(linha.resultado).toContain("ignorado:sem_conexao_a_perder");
  });

  it("8. 'connecting' não muda nada e não chama a Evolution", async () => {
    const antes = falso.recebidas.length;
    expect((await webhook(eventoDeConexao({ state: "connecting" }))).statusCode).toBe(200);
    await processarTudo();
    expect((await conexaoDoCanal()).conexao).toBe("desconectada");
    expect(falso.recebidas.length).toBe(antes);
  });

  it("9. QR lido por OUTRO número: o aparelho é tirado da sessão e o Canal fica com_erro (mesmo vindo de desconectada: a tentativa falhou)", async () => {
    expect((await webhook(eventoDeConexao({ state: "open" }))).statusCode).toBe(200);
    programarConferencia("5521999990000@s.whatsapp.net");
    falso.enfileirar({ kind: "ok", status: 200, corpo: { status: "SUCCESS", error: false } }); // logout
    await processarTudo();
    expect((await conexaoDoCanal()).conexao).toBe("com_erro");
    expect(falso.recebidas.at(-1)).toMatchObject({ metodo: "DELETE", caminho: `/instance/logout/${instancia}` });
    const linha = (await pool().query<{ resultado: string | null }>("select resultado from plataforma.webhooks_recebidos where workspace_id = $1 order by recebido_em desc limit 1", [ws])).rows[0]!;
    expect(linha.resultado).toContain("conexao:outro_numero");
  });

  it("10. um 'open' que a Evolution já não confirma (a instância fechou de novo) não muda o Canal", async () => {
    expect((await webhook(eventoDeConexao({ state: "open" }))).statusCode).toBe(200);
    programarConferencia(null, "close");
    await processarTudo();
    expect((await conexaoDoCanal()).conexao).toBe("com_erro");
  });

  it("11. a Evolution fora do ar na hora de conferir: a linha volta à fila (transitório), e o Canal não é conectado às cegas", async () => {
    expect((await webhook(eventoDeConexao({ state: "open" }))).statusCode).toBe(200);
    falso.enfileirar({ kind: "timeout" });
    await processarTudo();
    expect((await conexaoDoCanal()).conexao).toBe("com_erro");
    const linha = (await pool().query<{ estado: string; tentativas: number }>("select estado, tentativas from plataforma.webhooks_recebidos where workspace_id = $1 order by recebido_em desc limit 1", [ws])).rows[0]!;
    expect(linha.estado).toBe("pendente");
    expect(linha.tentativas).toBeGreaterThanOrEqual(1);
    // Esvazia a fila para os testes seguintes não herdarem a linha.
    await pool().query("update plataforma.webhooks_recebidos set estado = 'processado' where workspace_id = $1 and estado = 'pendente'", [ws]);
  });

  it("12. com o Canal conectado, 'Desconectar' tira o aparelho da sessão ANTES de gravar", async () => {
    await pool().query("update plataforma.canais set conexao = 'conectada' where workspace_id = $1 and id = $2", [ws, canalId]);
    falso.enfileirar({ kind: "ok", status: 200, corpo: { status: "SUCCESS", error: false } });
    const { status, corpo } = await post(`/canais/${canalId}/desconectar`);
    expect(status).toBe(200);
    expect(corpo.ok).toBe(true);
    expect(falso.recebidas.at(-1)).toMatchObject({ metodo: "DELETE", caminho: `/instance/logout/${instancia}` });
    expect((await conexaoDoCanal()).conexao).toBe("desconectada");
  });

  it("13. a Evolution fora do ar ao desconectar: 502 e o Canal continua conectado (nada é gravado)", async () => {
    await pool().query("update plataforma.canais set conexao = 'conectada' where workspace_id = $1 and id = $2", [ws, canalId]);
    falso.enfileirar({ kind: "timeout" });
    const { status, corpo } = await post(`/canais/${canalId}/desconectar`);
    expect(status).toBe(502);
    expect(corpo).toMatchObject({ ok: false, codigo: "EVOLUTION_INDISPONIVEL", error: "Não foi possível falar com o WhatsApp. Tente de novo." });
    expect((await conexaoDoCanal()).conexao).toBe("conectada");
  });

  it("14. arquivar sai da sessão, APAGA a instância do CRM e remove a credencial e o segredo do webhook do cofre", async () => {
    falso.enfileirar({ kind: "ok", status: 200, corpo: { status: "SUCCESS" } });
    falso.enfileirar({ kind: "ok", status: 200, corpo: { status: "SUCCESS" } });
    const { status } = await post(`/canais/${canalId}/arquivar`);
    expect(status).toBe(200);
    expect(falso.recebidas.slice(-2).map((r) => `${r.metodo} ${r.caminho}`)).toEqual([`DELETE /instance/logout/${instancia}`, `DELETE /instance/delete/${instancia}`]);
    expect((await conexaoDoCanal()).estado).toBe("arquivado");
    const restantes = await pool().query<{ n: string }>("select count(*)::text as n from plataforma.credenciais where workspace_id = $1 and dono_id = $2", [ws, canalId]);
    expect(restantes.rows[0]!.n).toBe("0");
  });

  it("15. depois de arquivado, o webhook do Canal já não passa (sem segredo no cofre) e conectar é recusado", async () => {
    expect((await webhook(eventoDeConexao({ state: "open" }))).statusCode).toBe(401);
    const { status, corpo } = await post(`/canais/${canalId}/conectar`);
    expect(status).toBe(409);
    expect(corpo).toMatchObject({ ok: false, codigo: "TRANSICAO_INVALIDA" });
  });
});
