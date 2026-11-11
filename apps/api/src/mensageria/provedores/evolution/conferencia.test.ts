/**
 * A conferência da conexão da Evolution (Sessão 4, 4.3.2) contra o Postgres LOCAL e o servidor HTTP FALSO. O provedor, o cofre, a
 * trava consultiva e a gravação do Canal são os REAIS; só a Evolution é de mentira. Cada teste cria o seu Espaço e o limpa no fim
 * (o banco é compartilhado entre arquivos, e a conferência só olha o Espaço do teste).
 *
 * A fila do servidor falso é FIFO e o provedor de verdade faz as chamadas na ordem do código: `estadoDaConexao` (o estado da
 * instância) e, quando ela está aberta e o banco discorda, `conferirConexao` (o estado de novo e o dono do número).
 */

import { randomBytes } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { encerrar, pool } from "../../../persistencia/conexao";
import { guardarCredencial, type ChavesDoCofre } from "../../../servicos/cofre";
import { criarServidorFalso, type ServidorFalso } from "../../../testes/servidor-falso";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal } from "../../../testes/banco-crm";
import { TIPO_DO_SEGREDO_DO_WEBHOOK } from "../../provedor";
import type { RegistroDeProvedores } from "../../registro";
import { provedorDeTeste } from "../teste";
import { criarConferenciaDaEvolution, type ConferenciaDaEvolution } from "./conferencia";
import { criarProvedorEvolution } from "./provedor";

const chaves: ChavesDoCofre = { atual: { versao: 1, chave: randomBytes(32) } };
const GLOBAL = "chave-global-da-conferencia";
const INSTANCIA = "n1-ws-do-teste-can-1";
const TOKEN = "tok-da-instancia";
const NUMERO = "+5511987654321";
const DONO_CERTO = "5511987654321@s.whatsapp.net";

type Conexao = "conectada" | "desconectada" | "com_erro";

describeComBanco("conferência da conexão da Evolution — Postgres local e Evolution falsa", () => {
  let falso: ServidorFalso;
  let registro: RegistroDeProvedores;
  let ws: string;
  let canalId: string;
  const acordou: string[] = [];

  beforeAll(async () => {
    await prepararBancoCrm();
  });
  afterAll(async () => {
    await encerrar();
  });
  beforeEach(async () => {
    falso = await criarServidorFalso();
    registro = { teste: provedorDeTeste, porProvedor: { "whatsapp-nao-oficial": criarProvedorEvolution({ url: falso.url, apikeyGlobal: GLOBAL, timeoutMs: 1_000 }) } };
    acordou.length = 0;
  });
  afterEach(async () => {
    await falso.fechar();
    await pool().query("delete from plataforma.integration_outbox where workspace_id = $1", [ws]);
    await pool().query("delete from plataforma.credenciais where workspace_id = $1", [ws]);
    await limparEspaco(ws);
  });

  async function canal(conexao: Conexao, opcoes: { simulada?: boolean; arquivado?: boolean; credencial?: boolean; pendente?: boolean } = {}) {
    ws = novoEspacoDeTeste("conferencia");
    await pool().query("insert into plataforma.workspaces (workspace_id) values ($1)", [ws]);
    canalId = await semearCanal(ws, {
      nome: "Atendimento",
      tipo: "whatsapp",
      provedor: "whatsapp-nao-oficial",
      identificadorExterno: NUMERO,
      conexao: opcoes.simulada ? "conectada" : conexao,
      conexaoSimulada: opcoes.simulada ?? false,
    });
    if (opcoes.arquivado) {
      await pool().query("update plataforma.canais set estado = 'arquivado', arquivado_em = now(), conexao = 'desconectada', conexao_simulada = false where workspace_id = $1 and id = $2", [ws, canalId]);
    }
    if (opcoes.credencial !== false) {
      const dono = { workspaceId: ws, donoTipo: "canal", donoId: canalId } as const;
      await guardarCredencial(pool(), chaves, { ...dono, tipo: TIPO_DO_SEGREDO_DO_WEBHOOK, segredo: "segredo-1" });
      await guardarCredencial(pool(), chaves, { ...dono, tipo: "whatsapp-nao-oficial", segredo: JSON.stringify({ instancia: INSTANCIA, apikey: TOKEN }) });
    }
    if (opcoes.pendente) {
      const contato = await pool().query<{ id: string }>("insert into plataforma.contatos (workspace_id, nome, proprietario_id, criado_por) values ($1, 'Ana', 'mem_teste', 'mem_teste') returning id", [ws]);
      const conversa = await pool().query<{ id: string }>(
        `insert into plataforma.conversas (workspace_id, canal_id, contato_id, titulo, situacao, criado_por_tipo, criado_por_id) values ($1, $2, $3, 'Conversa', 'aberta', 'system', 'sistema') returning id`,
        [ws, canalId, contato.rows[0]!.id],
      );
      await pool().query(
        `insert into plataforma.mensagens (workspace_id, conversa_id, canal_id, direcao, ator_tipo, ator_id, conteudo, status_entrega) values ($1, $2, $3, 'enviada', 'system', 'sistema', 'esperando o Canal voltar', 'pendente')`,
        [ws, conversa.rows[0]!.id, canalId],
      );
    }
  }

  const conferencia = (extra: { registro?: RegistroDeProvedores } = {}): ConferenciaDaEvolution =>
    criarConferenciaDaEvolution({
      pool: () => pool(),
      chaves: () => chaves,
      registro: () => extra.registro ?? registro,
      somenteDoEspaco: ws,
      acordarSaida: () => acordou.push("saida"),
    });

  const conexaoNoBanco = async () => (await pool().query<{ conexao: string }>("select conexao from plataforma.canais where workspace_id = $1 and id = $2", [ws, canalId])).rows[0]!.conexao;
  const estado = (state: string) => falso.enfileirar({ kind: "ok", status: 200, corpo: { instance: { instanceName: INSTANCIA, state } } });
  const dono = (ownerJid: string | null) => falso.enfileirar({ kind: "ok", status: 200, corpo: [{ name: INSTANCIA, ownerJid, token: TOKEN, connectionStatus: "open" }] });

  it("o banco diz conectada e a Evolution diz que a instância fechou (celular desligado, webhook perdido): com_erro", async () => {
    await canal("conectada");
    estado("close");
    expect(await conferencia().rodarUmaVez()).toEqual({ rodou: true, conferidos: 1, corrigidos: 1, semResposta: 0 });
    expect(await conexaoNoBanco()).toBe("com_erro");
    expect(falso.recebidas.map((r) => `${r.metodo} ${r.caminho}`)).toEqual([`GET /instance/connectionState/${INSTANCIA}`]);
    expect(falso.recebidas[0]!.cabecalhos.apikey).toBe(TOKEN);
  });

  it("'connecting' (a Evolution reconectando) também tira da conta do conectada: com_erro, e o próximo open o recupera", async () => {
    await canal("conectada");
    estado("connecting");
    await conferencia().rodarUmaVez();
    expect(await conexaoNoBanco()).toBe("com_erro");
  });

  it("o banco concorda com a Evolution (conectada e aberta): nada muda e nem o dono do número é consultado", async () => {
    await canal("conectada");
    estado("open");
    expect(await conferencia().rodarUmaVez()).toEqual({ rodou: true, conferidos: 1, corrigidos: 0, semResposta: 0 });
    expect(await conexaoNoBanco()).toBe("conectada");
    expect(falso.recebidas).toHaveLength(1);
  });

  it("com_erro no banco e a instância aberta com o número do Canal (um 'open' se perdeu): confere o número e volta a conectada", async () => {
    await canal("com_erro", { pendente: true });
    estado("open"); // estadoDaConexao
    estado("open"); // conferirConexao: o estado de novo
    dono(DONO_CERTO); // conferirConexao: o dono do número
    expect(await conferencia().rodarUmaVez()).toMatchObject({ rodou: true, corrigidos: 1 });
    expect(await conexaoNoBanco()).toBe("conectada");
    // O Canal que volta reenfileira as Mensagens pendente e acorda o worker de saída.
    expect(acordou).toEqual(["saida"]);
    const fila = await pool().query<{ n: string }>("select count(*)::text as n from plataforma.integration_outbox where workspace_id = $1 and event_type = 'mensagem.enviar.v1'", [ws]);
    expect(fila.rows[0]!.n).toBe("1");
  });

  it("instância aberta com OUTRO número: o aparelho é tirado da sessão e o Canal segue com_erro (nunca conectada)", async () => {
    await canal("com_erro");
    estado("open");
    estado("open");
    dono("5521999990000@s.whatsapp.net");
    falso.enfileirar({ kind: "ok", status: 200, corpo: { status: "SUCCESS" } }); // logout
    await conferencia().rodarUmaVez();
    expect(await conexaoNoBanco()).toBe("com_erro");
    expect(falso.recebidas.at(-1)).toMatchObject({ metodo: "DELETE", caminho: `/instance/logout/${INSTANCIA}` });
  });

  it("a Evolution NÃO respondeu (tempo esgotado ou fora do ar): NADA muda, e o Canal é contado como sem resposta", async () => {
    await canal("conectada");
    falso.enfileirar({ kind: "timeout" });
    expect(await conferencia().rodarUmaVez()).toEqual({ rodou: true, conferidos: 0, corrigidos: 0, semResposta: 1 });
    expect(await conexaoNoBanco()).toBe("conectada");
  });

  it("a instância sumiu da Evolution (404) e o banco diz conectada: com_erro", async () => {
    await canal("conectada");
    falso.enfileirar({ kind: "ok", status: 404, corpo: { error: "Not Found" } });
    expect(await conferencia().rodarUmaVez()).toMatchObject({ conferidos: 1, corrigidos: 1 });
    expect(await conexaoNoBanco()).toBe("com_erro");
  });

  it("a Evolution recusou a credencial do Canal (401) e o banco diz conectada: com_erro", async () => {
    await canal("conectada");
    falso.enfileirar({ kind: "ok", status: 401, corpo: { error: "Unauthorized" } });
    await conferencia().rodarUmaVez();
    expect(await conexaoNoBanco()).toBe("com_erro");
  });

  it("Canal já desconectado e a instância fechada: nada a corrigir (o 'Desconectar' não vira erro)", async () => {
    await canal("desconectada");
    estado("close");
    expect(await conferencia().rodarUmaVez()).toEqual({ rodou: true, conferidos: 1, corrigidos: 0, semResposta: 0 });
    expect(await conexaoNoBanco()).toBe("desconectada");
  });

  it("não confere o que não é da Evolution real: Canal simulado, arquivado ou sem credencial não gera nenhuma chamada", async () => {
    for (const opcoes of [{ simulada: true }, { arquivado: true }, { credencial: false }] as const) {
      await canal("conectada", opcoes);
      expect(await conferencia().rodarUmaVez()).toEqual({ rodou: true, conferidos: 0, corrigidos: 0, semResposta: 0 });
      await falso.fechar();
      await pool().query("delete from plataforma.credenciais where workspace_id = $1", [ws]);
      await limparEspaco(ws);
      falso = await criarServidorFalso();
      registro = { teste: provedorDeTeste, porProvedor: { "whatsapp-nao-oficial": criarProvedorEvolution({ url: falso.url, apikeyGlobal: GLOBAL, timeoutMs: 1_000 }) } };
    }
    expect(falso.recebidas).toHaveLength(0);
  });

  it("sem EVOLUTION_URL não há provedor registrado: a rodada não faz nada (rodou: false)", async () => {
    await canal("conectada");
    expect(await conferencia({ registro: { teste: provedorDeTeste, porProvedor: {} } }).rodarUmaVez()).toEqual({ rodou: false, conferidos: 0, corrigidos: 0, semResposta: 0 });
    expect(await conexaoNoBanco()).toBe("conectada");
  });

  it("duas instâncias da api nunca conferem juntas: com a trava tomada, a outra devolve rodou: false", async () => {
    await canal("conectada");
    const segurando = await pool().connect();
    try {
      await segurando.query("select pg_advisory_lock(hashtext('n1:conferencia-da-evolution'))");
      expect(await conferencia().rodarUmaVez()).toEqual({ rodou: false, conferidos: 0, corrigidos: 0, semResposta: 0 });
      expect(falso.recebidas).toHaveLength(0);
    } finally {
      await segurando.query("select pg_advisory_unlock(hashtext('n1:conferencia-da-evolution'))");
      segurando.release();
    }
  });

  it("iniciar agenda a primeira rodada e parar espera a rodada em voo; chamar iniciar duas vezes é no-op", async () => {
    await canal("conectada");
    estado("close");
    const registrado: string[] = [];
    const agendada = criarConferenciaDaEvolution({
      pool: () => pool(),
      chaves: () => chaves,
      registro: () => registro,
      somenteDoEspaco: ws,
      primeiraRodadaEmMs: 5,
      intervaloMs: 60_000,
      registrar: (_nivel, mensagem, dados) => registrado.push(`${mensagem} ${JSON.stringify(dados)}`),
    });
    agendada.iniciar();
    agendada.iniciar();
    await new Promise((resolver) => setTimeout(resolver, 300));
    await agendada.parar();
    expect(await conexaoNoBanco()).toBe("com_erro");
    expect(registrado).toEqual(['conferência da Evolution concluída {"conferidos":1,"corrigidos":1,"semResposta":0}']);
    // Só contagens no registro: nunca Espaço, Canal, número, instância nem token.
    expect(registrado.join()).not.toMatch(new RegExp(`${ws}|${canalId}|${INSTANCIA}|${TOKEN}|5511987654321`));
  });
});
