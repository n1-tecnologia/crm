/**
 * O Instagram de ponta a ponta contra o Postgres LOCAL, pelos caminhos da mensageria (Fase 16): conectar pelo login,
 * o webhook assinado entrando na fila `webhooks_recebidos`, o processador de entrada chamando `receberMensagem`, a
 * resposta saindo pelo outbox e pelo worker de saída, a leitura, e o que desconectar e a desautorização apagam. É o
 * roteiro da Revisão do app (PDF de 23/10), passo a passo, no lado do servidor. A Meta é um cliente falso.
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55433/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55433/postgres \
 *   npx vitest run src/mensageria/provedores/instagram/instagram.test.ts
 */

import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Canal } from "@n1/dominio/crm/canais";
import { FRASE_SO_RESPONDE, fraseDaJanelaBloqueada } from "@n1/dominio/crm/mensagens";
import type { MembroDaSessao } from "../../../plugins/autenticacao";
import { encerrar, pool } from "../../../persistencia/conexao";
import { criarRepositorioDeCanaisPg } from "../../../repositorios/crm/canais";
import type { ChavesDoCofre } from "../../../servicos/cofre";
import { criarAcessoAoCrmPg } from "../../../servicos/crm/acesso";
import { criarServicoDeCanais } from "../../../servicos/crm/canais";
import { criarServicoDeConversas } from "../../../servicos/crm/conversas";
import { criarServicoDeMensagens } from "../../../servicos/crm/mensagens";
import type { ResultadoCrm } from "../../../servicos/crm/resultado";
import { assinaturaDoCorpo } from "../../../testes/assinatura-da-meta";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearMembro } from "../../../testes/banco-crm";
import { criarWorkerDeSaida } from "../../entregar-mensagem";
import { criarProcessadorDeEntrada } from "../../processador-de-entrada";
import type { ChamadaDoWebhook } from "../../provedor";
import { provedorDeTeste } from "../../provedores/teste";
import type { RegistroDeProvedores } from "../../registro";
import { ErroDoInstagram, type ClienteDoInstagram, type ContaDoInstagramNaMeta, type PerfilDoRemetente } from "./cliente";
import type { ConfiguracaoDoInstagram } from "./configuracao";
import { criarServicoDeConexaoDoInstagram } from "./conexao";
import { criarEsquecimentoDoInstagram } from "./desautorizacao";
import { criarEntradaDoInstagram } from "./entrada";
import { CABECALHO_DA_ASSINATURA_DA_META, criarProvedorInstagram, FRASE_SEM_IGSID } from "./provedor";
import { remetentesPg } from "./repositorio";
import { criarTokensPg } from "./token";

const CONFIG: ConfiguracaoDoInstagram = {
  appId: "1234567890",
  appSecret: "segredo-do-app-de-teste",
  segredosDoWebhook: ["segredo-do-app-de-teste"],
  redirectUri: "https://crm.exemplo.test/crm/caixa-de-entrada/configuracoes/canais/instagram/retorno",
  versao: "v24.0",
  enderecos: { autorizar: "https://www.instagram.com/oauth/authorize", api: "https://api.instagram.com", graph: "https://graph.instagram.com" },
};
const CHAVES: ChavesDoCofre = { atual: { versao: 1, chave: randomBytes(32) } };
const TOKEN_LONGO = "IGAA-token-longo-que-nunca-aparece-no-banco";

/** A Meta de mentira: o que ela devolve é programável, e o que recebeu fica anotado. */
function metaFalsa() {
  const estado = {
    conta: { contaId: `1784${randomBytes(6).readUIntBE(0, 6)}`, usuario: "loja.n1", nome: "Loja N1", fotoUrl: "https://cdn.exemplo/loja.jpg" } as ContaDoInstagramNaMeta,
    idNoApp: `app_${randomBytes(4).toString("hex")}`,
    perfis: {} as Record<string, PerfilDoRemetente>,
    enviados: [] as Array<{ contaId: string; igsid: string; texto: string }>,
    perfisLidos: 0,
    inscricoes: 0,
    perfilFora: false,
    proximoEnvio: undefined as ErroDoInstagram | undefined,
    contador: 0,
  };
  const cliente: ClienteDoInstagram = {
    urlDeAutorizacao: (state) => `https://www.instagram.com/oauth/authorize?state=${encodeURIComponent(state)}`,
    trocarCodigo: async (codigo) => {
      if (codigo === "usado") throw new ErroDoInstagram(400, "Matching code was not found or was already used");
      return { token: "curto", idNoApp: estado.idNoApp, permissoes: ["instagram_business_basic", "instagram_business_manage_messages"] };
    },
    tokenDeLongaDuracao: async () => ({ token: TOKEN_LONGO, expiraEm: new Date(Date.now() + 60 * 86_400_000).toISOString() }),
    renovarToken: async () => ({ token: TOKEN_LONGO, expiraEm: new Date(Date.now() + 60 * 86_400_000).toISOString() }),
    lerConta: async () => estado.conta,
    inscreverNasMensagens: async () => {
      estado.inscricoes += 1;
    },
    enviarTexto: async (_token, contaId, igsid, texto) => {
      if (estado.proximoEnvio) {
        const erro = estado.proximoEnvio;
        estado.proximoEnvio = undefined;
        throw erro;
      }
      estado.enviados.push({ contaId, igsid, texto });
      estado.contador += 1;
      return { idExterno: `mid.saida.${estado.contador}.${randomBytes(3).toString("hex")}` };
    },
    enviarAnexo: async () => {
      throw new ErroDoInstagram(400, "anexo não usado neste teste");
    },
    lerRemetente: async (_token, igsid) => {
      estado.perfisLidos += 1;
      if (estado.perfilFora) throw new ErroDoInstagram(503, "fora do ar");
      return estado.perfis[igsid] ?? {};
    },
  };
  return { estado, cliente };
}

const sessao = (workspaceId: string, id: string): MembroDaSessao => ({ id, workspaceId, state: "ativo" });

function valor<T>(resultado: ResultadoCrm<T>): T {
  if (!resultado.ok) throw new Error(`esperava sucesso, veio ${resultado.status} ${resultado.codigo ?? ""}: ${resultado.error}`);
  return resultado.valor;
}

function recusado(resultado: ResultadoCrm<unknown>) {
  if (resultado.ok) throw new Error("esperava recusa, veio sucesso");
  return resultado;
}

/** Um evento do webhook, como a Meta manda. */
function evento(contaId: string, ...itens: Record<string, unknown>[]) {
  return { object: "instagram", entry: [{ id: contaId, time: Math.floor(Date.now() / 1000), messaging: itens }] };
}
const direct = (contaId: string, igsid: string, mid: string, texto: string, timestamp = Date.now()) => ({
  sender: { id: igsid },
  recipient: { id: contaId },
  timestamp,
  message: { mid, text: texto },
});

/** A chamada como a Meta faz: o corpo cru assinado com a chave do app. */
function assinada(corpo: unknown, segredo = CONFIG.appSecret): ChamadaDoWebhook {
  const cru = JSON.stringify(corpo);
  return { cabecalhos: { [CABECALHO_DA_ASSINATURA_DA_META]: assinaturaDoCorpo(cru, segredo) }, corpoCru: Buffer.from(cru), corpo };
}

describeComBanco("Instagram pela mensageria: conectar, receber, responder e desconectar (Postgres local)", () => {
  const espacos: string[] = [];
  const acesso = criarAcessoAoCrmPg(pool);
  const canais = criarServicoDeCanais({ pool, acesso });
  const conversas = criarServicoDeConversas({ pool, acesso });
  const mensagens = criarServicoDeMensagens({ pool, acesso });

  async function preparar(rotulo: string) {
    const ws = novoEspacoDeTeste(`ig_${rotulo}`);
    espacos.push(ws);
    await semearMembro(ws, { id: "mem_admin", base: "administrador", state: "ativo" });
    await semearMembro(ws, { id: "mem_ana", base: "membro", state: "ativo" });
    await pool().query("insert into plataforma.workspaces (workspace_id) values ($1) on conflict do nothing", [ws]);
    const meta = metaFalsa();
    const conexao = criarServicoDeConexaoDoInstagram({ pool, acesso, configuracao: () => CONFIG, chaves: () => CHAVES, cliente: () => meta.cliente });
    const provedor = criarProvedorInstagram({
      configuracao: CONFIG,
      cliente: meta.cliente,
      remetentes: remetentesPg(pool),
      tokens: criarTokensPg({ pool, chaves: () => CHAVES, cliente: meta.cliente }),
    });
    const registro: RegistroDeProvedores = { teste: provedorDeTeste, porProvedor: { "instagram-graph": provedor } };
    const entrada = criarEntradaDoInstagram({ pool, chaves: CHAVES, registro });
    const processador = criarProcessadorDeEntrada({ workerId: `teste-ig-entrada-${rotulo}`, pool, chaves: CHAVES, registro });
    const saida = criarWorkerDeSaida({ workerId: `teste-ig-saida-${rotulo}`, workspaceId: ws, chaves: CHAVES, registro });
    const admin = sessao(ws, "mem_admin");
    const canal = valor(await canais.criar(admin, { provedor: "instagram-graph", nome: "Instagram da loja", identificador: "@Loja.N1" }));
    /** O webhook entra na fila e o processador a esvazia. */
    const receber = async (corpo: unknown) => {
      const r = await entrada(assinada(corpo));
      while (await processador.processarUm()) {
        // até a fila esvaziar
      }
      return r;
    };
    return { ws, admin, membro: sessao(ws, "mem_ana"), meta, conexao, entrada, processador, saida, receber, canal };
  }
  type Contexto = Awaited<ReturnType<typeof preparar>>;

  /** O caminho da tela: iniciar, ir à Meta, voltar com o código e o state. */
  async function conectar(c: Contexto): Promise<Canal> {
    const { url } = valor(await c.conexao.iniciar(c.admin, c.canal.id));
    const state = new URL(url).searchParams.get("state")!;
    return valor(await c.conexao.concluir(c.admin, { codigo: "codigo-bom", state }));
  }

  async function conectado(rotulo: string) {
    const c = await preparar(rotulo);
    await conectar(c);
    return c;
  }

  const filaDe = async (ws: string) =>
    (
      await pool().query<{ estado: string; provedor: string; chave: string | null; resultado: string | null; ultimo_erro: string | null }>(
        "select estado, provedor, chave, resultado, ultimo_erro from plataforma.webhooks_recebidos where workspace_id = $1 order by recebido_em, id",
        [ws],
      )
    ).rows;

  beforeAll(async () => {
    await prepararBancoCrm();
  });

  afterAll(async () => {
    for (const ws of espacos) {
      await pool().query("delete from plataforma.integration_outbox where workspace_id = $1", [ws]);
      await limparEspaco(ws);
    }
    await encerrar();
  });

  describe("conectar pelo login do Instagram", () => {
    it("só quem administra pede a URL; ela carrega um state que volta assinado", async () => {
      const c = await preparar("iniciar");
      expect(recusado(await c.conexao.iniciar(c.membro, c.canal.id)).status).toBe(403);
      const { url } = valor(await c.conexao.iniciar(c.admin, c.canal.id));
      expect(new URL(url).searchParams.get("state")).toMatch(/^[\w-]+\.[\w-]+$/);
    });

    it("a volta guarda a credencial cifrada do provedor, liga a conta, inscreve no webhook e deixa o Canal conectado de verdade", async () => {
      const c = await preparar("concluir");
      const canal = await conectar(c);
      expect(canal).toMatchObject({ id: c.canal.id, conexao: "conectada", conexaoSimulada: false });
      expect(c.meta.estado.inscricoes).toBe(1);

      const conta = await pool().query("select conta_id, id_no_app, usuario, conectada_por from plataforma.instagram_contas where workspace_id = $1", [c.ws]);
      expect(conta.rows).toEqual([{ conta_id: c.meta.estado.conta.contaId, id_no_app: c.meta.estado.idNoApp, usuario: "loja.n1", conectada_por: "mem_admin" }]);
      const cofre = await pool().query<{ tipo: string; segredo_cifrado: Buffer }>(
        "select tipo, segredo_cifrado from plataforma.credenciais where workspace_id = $1 and dono_id = $2 and revogado_em is null",
        [c.ws, c.canal.id],
      );
      // O `tipo` é o nome do provedor: é o que `canalParaProvedor` decifra e o que esconde "Simular conexão" (CR-01).
      expect(cofre.rows.map((r) => r.tipo)).toEqual(["instagram-graph"]);
      expect(cofre.rows[0]!.segredo_cifrado.toString("utf8")).not.toContain(TOKEN_LONGO);
      expect(await criarRepositorioDeCanaisPg(pool()).ligadoAoProvedor(c.ws, canal)).toBe(true);
      expect(recusado(await canais.simularConexao(c.admin, c.canal.id)).codigo).toBe("TRANSICAO_INVALIDA");

      expect(valor(await c.conexao.conta(c.admin, c.canal.id))).toEqual({ usuario: "loja.n1", nome: "Loja N1", fotoUrl: "https://cdn.exemplo/loja.jpg" });
    });

    it("recusa o state de outro Membro, um state forjado e um código já usado", async () => {
      const c = await preparar("estado");
      const { url } = valor(await c.conexao.iniciar(c.admin, c.canal.id));
      const state = new URL(url).searchParams.get("state")!;
      expect(recusado(await c.conexao.concluir(c.membro, { codigo: "codigo-bom", state })).codigo).toBe("ESTADO_INVALIDO");
      expect(recusado(await c.conexao.concluir(c.admin, { codigo: "codigo-bom", state: `${state}x` })).codigo).toBe("ESTADO_INVALIDO");
      const usado = recusado(await c.conexao.concluir(c.admin, { codigo: "usado", state }));
      expect(usado).toMatchObject({ status: 502, codigo: "INSTAGRAM_RECUSOU" });
      expect(usado.error).toContain("already used");
      expect(valor(await canais.obter(c.admin, c.canal.id)).conexao).toBe("desconectada");
    });

    it("entrar com outra conta não conecta e diz qual era a certa", async () => {
      const c = await preparar("outra");
      c.meta.estado.conta = { ...c.meta.estado.conta, usuario: "outra.loja" };
      const { url } = valor(await c.conexao.iniciar(c.admin, c.canal.id));
      const resultado = recusado(await c.conexao.concluir(c.admin, { codigo: "codigo-bom", state: new URL(url).searchParams.get("state")! }));
      expect(resultado.codigo).toBe("CONTA_DIFERENTE");
      expect(resultado.error).toContain("@outra.loja");
      expect(resultado.error).toContain("@loja.n1");
      expect((await pool().query("select 1 from plataforma.instagram_contas where workspace_id = $1", [c.ws])).rowCount).toBe(0);
    });

    it("a mesma conta do Instagram não fica em dois Canais, nem em outro Espaço", async () => {
      const primeiro = await conectado("dona");
      const segundo = await preparar("intrusa");
      segundo.meta.estado.conta = primeiro.meta.estado.conta;
      const { url } = valor(await segundo.conexao.iniciar(segundo.admin, segundo.canal.id));
      const resultado = recusado(await segundo.conexao.concluir(segundo.admin, { codigo: "codigo-bom", state: new URL(url).searchParams.get("state")! }));
      expect(resultado.codigo).toBe("CONTA_EM_OUTRO_CANAL");
    });

    it("sem a integração configurada, 503 dizendo o que falta; com a URI inválida, 503 dizendo o porquê", async () => {
      const c = await preparar("semconfig");
      const desligado = criarServicoDeConexaoDoInstagram({ pool, acesso, configuracao: () => undefined });
      expect(recusado(await desligado.iniciar(c.admin, c.canal.id))).toMatchObject({ status: 503, codigo: "INSTAGRAM_NAO_CONFIGURADO" });
      const quebrado = criarServicoDeConexaoDoInstagram({
        pool,
        acesso,
        configuracao: () => {
          throw new Error("INSTAGRAM_REDIRECT_URI precisa usar https (a Meta recusa http fora do localhost).");
        },
      });
      const recusa = recusado(await quebrado.iniciar(c.admin, c.canal.id));
      expect(recusa).toMatchObject({ status: 503, codigo: "INSTAGRAM_NAO_CONFIGURADO" });
      expect(recusa.error).toContain("INSTAGRAM_REDIRECT_URI");
    });
  });

  describe("receber o Direct: webhook → fila → processador → receberMensagem", () => {
    it("o webhook só guarda na fila; o processador cria o Contato (nome e @ do perfil), a Conversa na Fila e a Mensagem recebida", async () => {
      const c = await conectado("receber");
      const conta = c.meta.estado.conta.contaId;
      c.meta.estado.perfis.igsid_ana = { nome: "Ana Souza", usuario: "Ana.Souza" };

      expect(await c.entrada(assinada(evento(conta, direct(conta, "igsid_ana", "mid.1", "Oi, vocês entregam?"))))).toEqual({
        guardadas: 1,
        repetidas: 0,
        semCanal: 0,
        recusadas: 0,
      });
      expect(await filaDe(c.ws)).toEqual([{ estado: "pendente", provedor: "instagram-graph", chave: "mid.1", resultado: null, ultimo_erro: null }]);
      expect((await pool().query("select 1 from plataforma.mensagens where workspace_id = $1", [c.ws])).rowCount).toBe(0);

      while (await c.processador.processarUm()) {
        // até a fila esvaziar
      }
      expect((await filaDe(c.ws))[0]).toMatchObject({ estado: "processado" });

      const contato = await pool().query(
        `select c.nome, c.modo_criacao, i.tipo, i.valor from plataforma.contatos c
           join plataforma.contato_identificadores i on i.workspace_id = c.workspace_id and i.contato_id = c.id
          where c.workspace_id = $1`,
        [c.ws],
      );
      expect(contato.rows).toEqual([{ nome: "Ana Souza", modo_criacao: "automatico_mensagem", tipo: "instagram", valor: "ana.souza" }]);
      const conversa = await pool().query("select titulo, atribuido_id, criado_por_tipo, situacao from plataforma.conversas where workspace_id = $1", [c.ws]);
      expect(conversa.rows).toEqual([{ titulo: "Ana Souza", atribuido_id: null, criado_por_tipo: "integration", situacao: "aberta" }]);
      const mensagem = await pool().query("select direcao, conteudo, id_externo, remetente_externo from plataforma.mensagens where workspace_id = $1", [c.ws]);
      expect(mensagem.rows).toEqual([{ direcao: "recebida", conteudo: "Oi, vocês entregam?", id_externo: "mid.1", remetente_externo: "ana.souza" }]);
      const remetente = await pool().query("select igsid, usuario, nome from plataforma.instagram_remetentes where workspace_id = $1", [c.ws]);
      expect(remetente.rows).toEqual([{ igsid: "igsid_ana", usuario: "ana.souza", nome: "Ana Souza" }]);
    });

    it("a mesma entrega de novo não entra na fila; a próxima mensagem vai para a mesma Conversa sem ler o perfil outra vez", async () => {
      const c = await conectado("repetida");
      const conta = c.meta.estado.conta.contaId;
      c.meta.estado.perfis.igsid_bruno = { nome: "Bruno", usuario: "bruno" };
      await c.receber(evento(conta, direct(conta, "igsid_bruno", "mid.a", "Primeira")));
      expect(await c.receber(evento(conta, direct(conta, "igsid_bruno", "mid.a", "Primeira")))).toMatchObject({ guardadas: 0, repetidas: 1 });
      await c.receber(evento(conta, direct(conta, "igsid_bruno", "mid.b", "Segunda")));
      expect(c.meta.estado.perfisLidos).toBe(1);
      const linhas = await pool().query("select count(distinct conversa_id)::int as conversas, count(*)::int as mensagens from plataforma.mensagens where workspace_id = $1", [c.ws]);
      expect(linhas.rows[0]).toEqual({ conversas: 1, mensagens: 2 });
    });

    it("dois eventos num corpo só viram duas linhas da fila; o eco do que a conta mandou fica ignorado", async () => {
      const c = await conectado("lote");
      const conta = c.meta.estado.conta.contaId;
      c.meta.estado.perfis.igsid_eva = { nome: "Eva", usuario: "eva" };
      const eco = { sender: { id: conta }, recipient: { id: "igsid_eva" }, timestamp: Date.now(), message: { mid: "mid.eco", text: "pelo app", is_echo: true } };
      expect(await c.receber(evento(conta, direct(conta, "igsid_eva", "mid.e1", "Oi"), eco))).toMatchObject({ guardadas: 2 });
      expect((await filaDe(c.ws)).map((l) => [l.chave, l.estado, l.resultado])).toEqual([
        ["mid.e1", "processado", null],
        ["mid.eco", "processado", "ignorado:eco"],
      ]);
      expect((await pool().query("select 1 from plataforma.mensagens where workspace_id = $1", [c.ws])).rowCount).toBe(1);
    });

    it("quem já tem Contato com aquele @ recebe a mensagem nele, sem Contato novo", async () => {
      const c = await conectado("arroba");
      const conta = c.meta.estado.conta.contaId;
      const cadastrada = await pool().query<{ id: string }>(
        `insert into plataforma.contatos (workspace_id, nome, proprietario_id, criado_por) values ($1, 'Carla cadastrada', 'mem_admin', 'mem_admin') returning id`,
        [c.ws],
      );
      const carlaId = cadastrada.rows[0]!.id;
      await pool().query(
        `insert into plataforma.contato_identificadores (workspace_id, contato_id, tipo, valor, principal) values ($1, $2, 'instagram', 'carla', true)`,
        [c.ws, carlaId],
      );
      c.meta.estado.perfis.igsid_carla = { nome: "Carla", usuario: "carla" };
      await c.receber(evento(conta, direct(conta, "igsid_carla", "mid.c", "Oi")));
      const contatos = await pool().query("select id from plataforma.contatos where workspace_id = $1", [c.ws]);
      expect(contatos.rows.map((r) => r.id)).toEqual([carlaId]);
    });

    it("sem o perfil (a Meta fora do ar) a Mensagem não vira Contato errado: a linha volta à fila e entra na passada seguinte", async () => {
      const c = await conectado("semperfil");
      const conta = c.meta.estado.conta.contaId;
      c.meta.estado.perfilFora = true;
      await c.receber(evento(conta, direct(conta, "igsid_x", "mid.x", "Olá")));
      expect((await filaDe(c.ws))[0]).toMatchObject({ estado: "pendente" });
      expect((await pool().query("select 1 from plataforma.mensagens where workspace_id = $1", [c.ws])).rowCount).toBe(0);

      c.meta.estado.perfilFora = false;
      c.meta.estado.perfis.igsid_x = { nome: "Xavier", usuario: "xavier" };
      await pool().query("update plataforma.webhooks_recebidos set disponivel_em = now() where workspace_id = $1", [c.ws]);
      while (await c.processador.processarUm()) {
        // a passada seguinte
      }
      expect((await filaDe(c.ws))[0]).toMatchObject({ estado: "processado" });
      expect((await pool().query("select remetente_externo from plataforma.mensagens where workspace_id = $1", [c.ws])).rows).toEqual([{ remetente_externo: "xavier" }]);
    });

    it("conta que não é de Canal nenhum, assinatura de outra chave e corpo de outro objeto: nada entra na fila", async () => {
      const c = await conectado("ignorar");
      const conta = c.meta.estado.conta.contaId;
      expect(await c.entrada(assinada(evento("conta_desconhecida", direct("conta_desconhecida", "igsid_y", "mid.y", "Teste"))))).toMatchObject({ guardadas: 0, semCanal: 1 });
      expect(await c.entrada(assinada(evento(conta, direct(conta, "igsid_y", "mid.y", "Teste")), "outra-chave"))).toMatchObject({ guardadas: 0, recusadas: 1 });
      expect(await c.entrada(assinada({ object: "page", entry: [] }))).toEqual({ guardadas: 0, repetidas: 0, semCanal: 0, recusadas: 0 });
      expect(await filaDe(c.ws)).toEqual([]);
    });
  });

  describe("responder pelo Direct: outbox → worker de saída → provedor", () => {
    async function comConversa(rotulo: string, timestamp = Date.now()) {
      const c = await conectado(rotulo);
      c.meta.estado.perfis.igsid_dani = { nome: "Dani", usuario: "dani" };
      await c.receber(evento(c.meta.estado.conta.contaId, direct(c.meta.estado.conta.contaId, "igsid_dani", `mid.${rotulo}`, "Quero um orçamento", timestamp)));
      const conversaId = (await pool().query<{ id: string }>("select id from plataforma.conversas where workspace_id = $1", [c.ws])).rows[0]!.id;
      return { ...c, conversaId };
    }

    const statusDe = async (ws: string, id: string) =>
      (await pool().query<{ status_entrega: string; id_externo: string | null; motivo_falha: string | null }>(
        "select status_entrega, id_externo, motivo_falha from plataforma.mensagens where workspace_id = $1 and id = $2",
        [ws, id],
      )).rows[0];

    it("a resposta nasce pendente, entra no outbox, e o worker a entrega ao IGSID de quem escreveu: enviada, com o id da Meta; a leitura a marca lida", async () => {
      const c = await comConversa("responder");
      const mensagem = valor(await mensagens.enviar(c.admin, { conversaId: c.conversaId, direcao: "enviada", conteudo: "Claro! Qual o modelo?" }));
      expect(mensagem.statusEntrega).toBe("pendente");
      const outbox = await pool().query("select event_type, status from plataforma.integration_outbox where workspace_id = $1", [c.ws]);
      expect(outbox.rows).toEqual([{ event_type: "mensagem.enviar.v1", status: "pending" }]);
      expect(c.meta.estado.enviados).toEqual([]);

      expect(await c.saida.processarUm()).toBe(true);
      expect(c.meta.estado.enviados).toEqual([{ contaId: c.meta.estado.conta.contaId, igsid: "igsid_dani", texto: "Claro! Qual o modelo?" }]);
      const enviada = await statusDe(c.ws, mensagem.id);
      expect(enviada).toMatchObject({ status_entrega: "enviada" });
      expect(enviada!.id_externo).toMatch(/^mid\.saida\./);

      const conta = c.meta.estado.conta.contaId;
      await c.receber(evento(conta, { sender: { id: "igsid_dani" }, recipient: { id: conta }, timestamp: Date.now(), read: { mid: enviada!.id_externo } }));
      expect(await statusDe(c.ws, mensagem.id)).toMatchObject({ status_entrega: "lida" });
    });

    it("se a Meta recusa fora da janela, a Mensagem fica falhou dizendo que só o Contato reabre, sem nova tentativa", async () => {
      const c = await comConversa("falhou");
      c.meta.estado.proximoEnvio = new ErroDoInstagram(400, "This message is sent outside of allowed window.", 10, 2018278);
      const mensagem = valor(await mensagens.enviar(c.admin, { conversaId: c.conversaId, direcao: "enviada", conteudo: "Oi?" }));
      await c.saida.processarUm();
      expect(await statusDe(c.ws, mensagem.id)).toMatchObject({ status_entrega: "falhou", motivo_falha: fraseDaJanelaBloqueada(24) });
    });

    it("passadas 24 h da última mensagem do Contato, a api recusa antes de gravar, dizendo que só ele reabre", async () => {
      const c = await comConversa("janela", Date.now() - 30 * 3_600_000);
      const resultado = recusado(await mensagens.enviar(c.admin, { conversaId: c.conversaId, direcao: "enviada", conteudo: "Ainda está aí?" }));
      expect(resultado).toMatchObject({ status: 409, codigo: "JANELA_EXPIRADA", error: fraseDaJanelaBloqueada(24) });
      expect(c.meta.estado.enviados).toEqual([]);
    });

    it("não se abre Conversa do Instagram pela plataforma: ela nasce quando o Contato escreve", async () => {
      const c = await comConversa("abrir");
      const contatoId = (await pool().query<{ id: string }>("select id from plataforma.contatos where workspace_id = $1", [c.ws])).rows[0]!.id;
      await pool().query("update plataforma.conversas set situacao = 'resolvida', resolvida_em = now() where workspace_id = $1", [c.ws]);
      const resultado = recusado(await conversas.criar(c.admin, { canalId: c.canal.id, contatoId, mensagem: { conteudo: "Oi" } }));
      expect(resultado).toMatchObject({ status: 409, codigo: "CANAL_SO_RESPONDE", error: FRASE_SO_RESPONDE });
    });

    it("sem o IGSID de quem tem o @ (a tabela de quem escreveu foi apagada): falhou, explicando a regra", async () => {
      const c = await comConversa("semigsid");
      await pool().query("delete from plataforma.instagram_remetentes where workspace_id = $1", [c.ws]);
      const mensagem = valor(await mensagens.enviar(c.admin, { conversaId: c.conversaId, direcao: "enviada", conteudo: "Oi" }));
      await c.saida.processarUm();
      expect(await statusDe(c.ws, mensagem.id)).toMatchObject({ status_entrega: "falhou", motivo_falha: FRASE_SEM_IGSID });
    });
  });

  describe("desconectar e a desautorização da Meta apagam a credencial", () => {
    const restos = async (ws: string, canalId: string) => ({
      contas: (await pool().query("select 1 from plataforma.instagram_contas where workspace_id = $1 and canal_id = $2", [ws, canalId])).rowCount,
      remetentes: (await pool().query("select 1 from plataforma.instagram_remetentes where workspace_id = $1 and canal_id = $2", [ws, canalId])).rowCount,
      credenciais: (await pool().query("select 1 from plataforma.credenciais where workspace_id = $1 and dono_id = $2", [ws, canalId])).rowCount,
    });

    async function comQuemEscreveu(rotulo: string) {
      const c = await conectado(rotulo);
      c.meta.estado.perfis.igsid_fe = { nome: "Fê", usuario: "fe" };
      await c.receber(evento(c.meta.estado.conta.contaId, direct(c.meta.estado.conta.contaId, "igsid_fe", `mid.${rotulo}`, "Oi")));
      return c;
    }

    it("desconectar pela ficha apaga a conta ligada, quem escreveu e a credencial, inclusive as revogadas", async () => {
      const c = await comQuemEscreveu("desconectar");
      await conectar(c); // reconectar deixa uma credencial revogada para trás
      expect(await restos(c.ws, c.canal.id)).toEqual({ contas: 1, remetentes: 1, credenciais: 2 });
      valor(await canais.desconectar(c.admin, c.canal.id));
      expect(await restos(c.ws, c.canal.id)).toEqual({ contas: 0, remetentes: 0, credenciais: 0 });
      expect(await criarRepositorioDeCanaisPg(pool()).ligadoAoProvedor(c.ws, c.canal)).toBe(false);
    });

    it("arquivar também apaga", async () => {
      const c = await comQuemEscreveu("arquivar");
      valor(await canais.arquivar(c.admin, c.canal.id));
      expect(await restos(c.ws, c.canal.id)).toEqual({ contas: 0, remetentes: 0, credenciais: 0 });
    });

    it("a desautorização (pelo id do login ou da conta) desconecta o Canal e apaga tudo", async () => {
      const esquecer = criarEsquecimentoDoInstagram({ pool });
      const peloLogin = await comQuemEscreveu("desaut1");
      expect(await esquecer(peloLogin.meta.estado.idNoApp)).toBe(1);
      expect(valor(await canais.obter(peloLogin.admin, peloLogin.canal.id)).conexao).toBe("desconectada");
      expect(await restos(peloLogin.ws, peloLogin.canal.id)).toEqual({ contas: 0, remetentes: 0, credenciais: 0 });

      const pelaConta = await conectado("desaut2");
      expect(await esquecer(pelaConta.meta.estado.conta.contaId)).toBe(1);
      expect(await esquecer("ninguem")).toBe(0);
    });
  });
});
