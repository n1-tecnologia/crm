/**
 * Serviço de Canais, Sessão 4 (conectar por QR code, sair da sessão ao desconectar e arquivar, simulação desligável), contra o
 * Postgres LOCAL. O conector da Evolution é FALSO aqui: este arquivo prova a REGRA do serviço (permissão antes de qualquer rede, a
 * Evolution chamada ANTES de a escrita abrir a transação, a falha dela não grava nada, a credencial do cofre apagada só ao
 * arquivar). O conector de verdade tem os testes dele em `mensageria/provedores/evolution/conexao.test.ts`.
 */

import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Canal } from "@n1/dominio/crm/canais";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { TIPO_DO_SEGREDO_DO_WEBHOOK } from "../../mensageria/provedor";
import { FalhaDoProvedor, type ConectorDaEvolution } from "../../mensageria/provedores/evolution/conexao";
import { encerrar, pool } from "../../persistencia/conexao";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearMembro } from "../../testes/banco-crm";
import { guardarCredencial, type ChavesDoCofre } from "../cofre";
import { criarAcessoAoCrmPg } from "./acesso";
import { criarServicoDeCanais, simulacaoDeConexaoPermitida } from "./canais";
import { sucesso, type ResultadoCrm } from "./resultado";

const chaves: ChavesDoCofre = { atual: { versao: 1, chave: randomBytes(32) } };
const sessao = (workspaceId: string, id: string): MembroDaSessao => ({ id, workspaceId, state: "ativo" });

/** Quantas sessões do banco estão no meio de uma transação (fora a desta consulta): uma transação do serviço segurando o Espaço aparece aqui. */
async function transacoesAbertas(): Promise<number> {
  const r = await pool().query<{ n: string }>(
    "select count(*)::text as n from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid() and state like 'idle in transaction%'",
  );
  return Number(r.rows[0]!.n);
}

function valor<T>(resultado: ResultadoCrm<T>): T {
  if (!resultado.ok) throw new Error(`esperava sucesso, veio ${resultado.status} ${resultado.codigo ?? ""}: ${resultado.error}`);
  return resultado.valor;
}

describeComBanco("ServicoDeCanais, Sessão 4 — Postgres local e conector falso", () => {
  const espacos: string[] = [];
  /** O que o conector falso recebeu, na ordem; e o que a escrita já tinha gravado QUANDO ele foi chamado. */
  const chamadas: { metodo: string; motivo?: string; conexaoNoBanco?: string; transacoesAbertas?: number }[] = [];
  let falhar = false;

  const conector: ConectorDaEvolution = {
    async conectar(workspaceId, canal) {
      chamadas.push({ metodo: "conectar" });
      return sucesso({ situacao: "aguardando" as const });
    },
    async desligar(workspaceId, canal, motivo) {
      // A prova de "antes da transação": no instante da chamada o Canal ainda está como estava, e não há transação segurando o Espaço.
      const linha = await pool().query<{ conexao: string }>("select conexao from plataforma.canais where workspace_id = $1 and id = $2", [workspaceId, canal.id]);
      chamadas.push({ metodo: "desligar", motivo, conexaoNoBanco: linha.rows[0]!.conexao, transacoesAbertas: await transacoesAbertas() });
      if (falhar) throw new FalhaDoProvedor();
    },
  };

  const servico = criarServicoDeCanais({ pool, acesso: criarAcessoAoCrmPg(pool), conectores: { whatsappNaoOficial: conector } });

  async function espaco(rotulo: string) {
    const ws = novoEspacoDeTeste(rotulo);
    espacos.push(ws);
    await semearMembro(ws, { id: "mem_admin", base: "administrador", state: "ativo" });
    await semearMembro(ws, { id: "mem_ana", base: "membro", state: "ativo" });
    await pool().query("insert into plataforma.workspaces (workspace_id) values ($1) on conflict do nothing", [ws]);
    return { ws, admin: sessao(ws, "mem_admin"), membro: sessao(ws, "mem_ana") };
  }
  type Contexto = Awaited<ReturnType<typeof espaco>>;

  const criarCanal = async (c: Contexto, provedor: "whatsapp-nao-oficial" | "whatsapp-cloud" | "instagram-graph" | "email-imap-smtp", nome: string, identificador: string): Promise<Canal> =>
    valor(await servico.criar(c.admin, { provedor, nome, identificador }));

  async function conexaoNoBanco(ws: string, id: string) {
    return (await pool().query<{ conexao: string; estado: string; conexao_simulada: boolean }>("select conexao, estado, conexao_simulada from plataforma.canais where workspace_id = $1 and id = $2", [ws, id])).rows[0]!;
  }

  async function ligar(ws: string, id: string) {
    const dono = { workspaceId: ws, donoTipo: "canal", donoId: id } as const;
    await guardarCredencial(pool(), chaves, { ...dono, tipo: TIPO_DO_SEGREDO_DO_WEBHOOK, segredo: "segredo-1" });
    await guardarCredencial(pool(), chaves, { ...dono, tipo: "whatsapp-nao-oficial", segredo: JSON.stringify({ instancia: `n1-${ws}-${id}`, apikey: "tok" }) });
  }

  const credenciaisDoCanal = async (ws: string, id: string) =>
    Number((await pool().query<{ n: string }>("select count(*)::text as n from plataforma.credenciais where workspace_id = $1 and dono_id = $2", [ws, id])).rows[0]!.n);

  beforeAll(async () => {
    await prepararBancoCrm();
  });
  afterAll(async () => {
    for (const ws of espacos) {
      await pool().query("delete from plataforma.credenciais where workspace_id = $1", [ws]);
      await pool().query("delete from plataforma.integration_outbox where workspace_id = $1", [ws]);
      await limparEspaco(ws);
    }
    await encerrar();
  });

  describe("o sensor de 'sem transação aberta' enxerga uma transação aberta (para a prova de ordem não ser vácua)", () => {
    it("com uma transação segurando a linha do Espaço o sensor conta 1; fechada, 0", async () => {
      const c = await espaco("sensor");
      const cliente = await pool().connect();
      try {
        await cliente.query("begin");
        await cliente.query("select 1 from plataforma.workspaces where workspace_id = $1 for update", [c.ws]);
        expect(await transacoesAbertas()).toBeGreaterThanOrEqual(1);
        await cliente.query("rollback");
      } finally {
        cliente.release();
      }
      expect(await transacoesAbertas()).toBe(0);
    });
  });

  describe("conectar (4.2.3)", () => {
    it("o Administrador pede o QR: o serviço entrega ao conector (Espaço da sessão e o Canal) e NÃO muda a conexão", async () => {
      const c = await espaco("conectar-ok");
      const canal = await criarCanal(c, "whatsapp-nao-oficial", "Atendimento", "+55 11 97777-0001");
      chamadas.length = 0;
      expect(await servico.conectar(c.admin, canal.id)).toEqual({ ok: true, valor: { situacao: "aguardando" } });
      expect(chamadas.map((x) => x.metodo)).toEqual(["conectar"]);
      expect((await conexaoNoBanco(c.ws, canal.id)).conexao).toBe("desconectada");
    });

    it("o Membro comum recebe 403 ANTES de qualquer rede (B35: só quem administra conecta)", async () => {
      const c = await espaco("conectar-403");
      const canal = await criarCanal(c, "whatsapp-nao-oficial", "Atendimento", "+55 11 97777-0002");
      chamadas.length = 0;
      expect(await servico.conectar(c.membro, canal.id)).toMatchObject({ ok: false, status: 403 });
      expect(chamadas).toEqual([]);
    });

    it("Canal de outro Espaço é 404, nunca 403 (T-08-13), e o conector não é chamado", async () => {
      const a = await espaco("conectar-a");
      const b = await espaco("conectar-b");
      const canal = await criarCanal(a, "whatsapp-nao-oficial", "Atendimento", "+55 11 97777-0003");
      chamadas.length = 0;
      expect(await servico.conectar(b.admin, canal.id)).toMatchObject({ ok: false, status: 404, codigo: "CANAL_NAO_ENCONTRADO" });
      expect(chamadas).toEqual([]);
    });

    it.each([
      ["whatsapp-cloud", "+55 11 97777-0004"],
      ["instagram-graph", "atendimento_ig"],
      ["email-imap-smtp", "atendimento@empresa.com.br"],
    ] as const)("%s não conecta lendo QR code: 409 PROVEDOR_ERRADO, conector intocado", async (provedor, identificador) => {
      const c = await espaco(`conectar-${provedor}`.slice(0, 40));
      const canal = await criarCanal(c, provedor, "Outro", identificador);
      chamadas.length = 0;
      expect(await servico.conectar(c.admin, canal.id)).toMatchObject({ ok: false, status: 409, codigo: "PROVEDOR_ERRADO" });
      expect(chamadas).toEqual([]);
    });

    it("Canal já conectado e Canal arquivado: 409 TRANSICAO_INVALIDA, conector intocado", async () => {
      const c = await espaco("conectar-estados");
      const conectado = await criarCanal(c, "whatsapp-nao-oficial", "Conectado", "+55 11 97777-0005");
      await pool().query("update plataforma.canais set conexao = 'conectada' where workspace_id = $1 and id = $2", [c.ws, conectado.id]);
      const arquivado = await criarCanal(c, "whatsapp-nao-oficial", "Arquivado", "+55 11 97777-0006");
      valor(await servico.arquivar(c.admin, arquivado.id));
      chamadas.length = 0;
      expect(await servico.conectar(c.admin, conectado.id)).toMatchObject({ ok: false, status: 409, codigo: "TRANSICAO_INVALIDA", error: "O Canal já está conectado." });
      expect(await servico.conectar(c.admin, arquivado.id)).toMatchObject({ ok: false, status: 409, codigo: "TRANSICAO_INVALIDA" });
      expect(chamadas).toEqual([]);
    });

    it("sem conector configurado (EVOLUTION_*), 'Conectar' responde 503 dizendo que a integração não está configurada", async () => {
      const c = await espaco("conectar-sem-conector");
      const semConector = criarServicoDeCanais({ pool, acesso: criarAcessoAoCrmPg(pool) });
      const canal = valor(await semConector.criar(c.admin, { provedor: "whatsapp-nao-oficial", nome: "Atendimento", identificador: "+55 11 97777-0007" }));
      expect(await semConector.conectar(c.admin, canal.id)).toMatchObject({ ok: false, status: 503, codigo: "EVOLUTION_NAO_CONFIGURADA" });
    });
  });

  describe("desconectar e arquivar saem da sessão ANTES de gravar (4.3.3)", () => {
    it("desconectar: o conector é chamado com o Canal ainda conectado e SEM transação segurando o Espaço; depois a escrita grava desconectada", async () => {
      const c = await espaco("desconectar-ordem");
      const canal = await criarCanal(c, "whatsapp-nao-oficial", "Atendimento", "+55 11 97777-0010");
      await pool().query("update plataforma.canais set conexao = 'conectada' where workspace_id = $1 and id = $2", [c.ws, canal.id]);
      chamadas.length = 0;
      falhar = false;
      expect(valor(await servico.desconectar(c.admin, canal.id))).toMatchObject({ conexao: "desconectada" });
      expect(chamadas).toEqual([{ metodo: "desligar", motivo: "desconectar", conexaoNoBanco: "conectada", transacoesAbertas: 0 }]);
      expect((await conexaoNoBanco(c.ws, canal.id)).conexao).toBe("desconectada");
    });

    it("a Evolution falha ao desconectar: 502 'Tente de novo' e o Canal CONTINUA conectado (nada é gravado, a revisão não sobe)", async () => {
      const c = await espaco("desconectar-falha");
      const canal = await criarCanal(c, "whatsapp-nao-oficial", "Atendimento", "+55 11 97777-0011");
      await pool().query("update plataforma.canais set conexao = 'conectada' where workspace_id = $1 and id = $2", [c.ws, canal.id]);
      const antes = (await pool().query<{ revisao: string }>("select revisao from plataforma.workspaces where workspace_id = $1", [c.ws])).rows[0]!.revisao;
      chamadas.length = 0;
      falhar = true;
      try {
        expect(await servico.desconectar(c.admin, canal.id)).toMatchObject({
          ok: false,
          status: 502,
          codigo: "EVOLUTION_INDISPONIVEL",
          error: "Não foi possível falar com o WhatsApp. Tente de novo.",
        });
      } finally {
        falhar = false;
      }
      expect((await conexaoNoBanco(c.ws, canal.id)).conexao).toBe("conectada");
      expect((await pool().query<{ revisao: string }>("select revisao from plataforma.workspaces where workspace_id = $1", [c.ws])).rows[0]!.revisao).toBe(antes);
    });

    it("o Membro comum recebe 403 e NENHUMA chamada é feita (permissão antes da rede)", async () => {
      const c = await espaco("desconectar-403");
      const canal = await criarCanal(c, "whatsapp-nao-oficial", "Atendimento", "+55 11 97777-0012");
      await pool().query("update plataforma.canais set conexao = 'conectada' where workspace_id = $1 and id = $2", [c.ws, canal.id]);
      chamadas.length = 0;
      expect(await servico.desconectar(c.membro, canal.id)).toMatchObject({ ok: false, status: 403 });
      expect(await servico.arquivar(c.membro, canal.id)).toMatchObject({ ok: false, status: 403 });
      expect(chamadas).toEqual([]);
    });

    it("não chama a Evolution onde não há aparelho: Canal já desconectado, Canal simulado, Canal de outro provedor ou arquivado", async () => {
      const c = await espaco("desconectar-nada");
      chamadas.length = 0;
      const jaDesconectado = await criarCanal(c, "whatsapp-nao-oficial", "Desconectado", "+55 11 97777-0013");
      expect(await servico.desconectar(c.admin, jaDesconectado.id)).toMatchObject({ ok: false, status: 409, codigo: "TRANSICAO_INVALIDA" });
      const simulado = await criarCanal(c, "whatsapp-nao-oficial", "Simulado", "+55 11 97777-0014");
      valor(await servico.simularConexao(c.admin, simulado.id));
      valor(await servico.desconectar(c.admin, simulado.id));
      const oficial = await criarCanal(c, "whatsapp-cloud", "Oficial", "+55 11 97777-0015");
      valor(await servico.simularConexao(c.admin, oficial.id));
      valor(await servico.desconectar(c.admin, oficial.id));
      valor(await servico.arquivar(c.admin, oficial.id));
      expect(chamadas).toEqual([]);
    });

    it("arquivar: sai da sessão, depois grava arquivado e APAGA a credencial e o segredo do webhook do cofre (e só deste Canal)", async () => {
      const c = await espaco("arquivar-ok");
      const canal = await criarCanal(c, "whatsapp-nao-oficial", "Atendimento", "+55 11 97777-0016");
      const outro = await criarCanal(c, "whatsapp-nao-oficial", "Outro", "+55 11 97777-0017");
      await ligar(c.ws, canal.id);
      await ligar(c.ws, outro.id);
      await pool().query("update plataforma.canais set conexao = 'conectada' where workspace_id = $1 and id = $2", [c.ws, canal.id]);
      chamadas.length = 0;
      expect(valor(await servico.arquivar(c.admin, canal.id))).toMatchObject({ estado: "arquivado", conexao: "desconectada" });
      expect(chamadas).toEqual([{ metodo: "desligar", motivo: "arquivar", conexaoNoBanco: "conectada", transacoesAbertas: 0 }]);
      expect(await credenciaisDoCanal(c.ws, canal.id)).toBe(0);
      expect(await credenciaisDoCanal(c.ws, outro.id)).toBe(2);
    });

    it("a Evolution falha ao arquivar: 502, o Canal continua ativo E a credencial continua no cofre (nada é gravado nem apagado)", async () => {
      const c = await espaco("arquivar-falha");
      const canal = await criarCanal(c, "whatsapp-nao-oficial", "Atendimento", "+55 11 97777-0018");
      await ligar(c.ws, canal.id);
      await pool().query("update plataforma.canais set conexao = 'conectada' where workspace_id = $1 and id = $2", [c.ws, canal.id]);
      falhar = true;
      try {
        expect(await servico.arquivar(c.admin, canal.id)).toMatchObject({ ok: false, status: 502, codigo: "EVOLUTION_INDISPONIVEL" });
      } finally {
        falhar = false;
      }
      expect(await conexaoNoBanco(c.ws, canal.id)).toMatchObject({ estado: "ativo", conexao: "conectada" });
      expect(await credenciaisDoCanal(c.ws, canal.id)).toBe(2);
    });

    it("arquivar um Canal que nunca conectou (sem credencial) funciona e libera o número para outro Canal", async () => {
      const c = await espaco("arquivar-sem-credencial");
      const canal = await criarCanal(c, "whatsapp-nao-oficial", "Atendimento", "+55 11 97777-0019");
      expect(valor(await servico.arquivar(c.admin, canal.id))).toMatchObject({ estado: "arquivado" });
      expect(valor(await servico.criar(c.admin, { provedor: "whatsapp-nao-oficial", nome: "Novo", identificador: "+55 11 97777-0019" }))).toMatchObject({ conexao: "desconectada" });
    });
  });

  describe("a simulação de conexão só existe onde o ambiente a liga (4.3.4)", () => {
    const desligada = criarServicoDeCanais({ pool, acesso: criarAcessoAoCrmPg(pool), simulacaoPermitida: () => false });

    it("simulacaoDeConexaoPermitida: só o valor exato 'true' liga (ausente, vazio, 'false', '1', 'TRUE' desligam)", () => {
      expect(simulacaoDeConexaoPermitida({ PERMITIR_CONEXAO_SIMULADA: "true" })).toBe(true);
      for (const v of [undefined, "", "false", "1", "TRUE", "yes", " true"]) expect(simulacaoDeConexaoPermitida({ PERMITIR_CONEXAO_SIMULADA: v })).toBe(false);
      expect(simulacaoDeConexaoPermitida({})).toBe(false);
    });

    it("desligada: 'Simular conexão' é recusada no serviço (409 SIMULACAO_DESLIGADA) e o Canal não muda; a ficha diz simulacaoPermitida: false", async () => {
      const c = await espaco("simulacao-desligada");
      const canal = valor(await desligada.criar(c.admin, { provedor: "whatsapp-nao-oficial", nome: "Atendimento", identificador: "+55 11 97777-0020" }));
      expect(await desligada.simularConexao(c.admin, canal.id)).toMatchObject({ ok: false, status: 409, codigo: "SIMULACAO_DESLIGADA" });
      expect((await conexaoNoBanco(c.ws, canal.id)).conexao).toBe("desconectada");
      expect(valor(await desligada.obter(c.admin, canal.id))).toMatchObject({ simulacaoPermitida: false, ligadoAoProvedor: false });
    });

    it("ligada: simula como antes e a ficha diz simulacaoPermitida: true", async () => {
      const c = await espaco("simulacao-ligada");
      const ligada = criarServicoDeCanais({ pool, acesso: criarAcessoAoCrmPg(pool), simulacaoPermitida: () => true });
      const canal = valor(await ligada.criar(c.admin, { provedor: "whatsapp-cloud", nome: "Oficial", identificador: "+55 11 97777-0021" }));
      expect(valor(await ligada.simularConexao(c.admin, canal.id))).toMatchObject({ conexao: "conectada", conexaoSimulada: true });
      expect(valor(await ligada.obter(c.admin, canal.id))).toMatchObject({ simulacaoPermitida: true });
    });
  });
});
