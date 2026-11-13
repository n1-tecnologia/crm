/**
 * O WhatsApp oficial de ponta a ponta contra o Postgres LOCAL, pelos caminhos da mensageria (Sessão 7, 7.2): conectar pelo
 * token, o webhook assinado entrando na fila `webhooks_recebidos`, o processador de entrada chamando `receberMensagem`, a
 * resposta saindo pelo outbox e pelo worker de saída, os status de entrega, a regra da janela e o que desconectar apaga.
 * A Meta é um cliente falso. NÃO é prova contra a Meta real: a primeira conexão de verdade (7.1) é do dono.
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55750/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55750/postgres \
 *   npx vitest run src/mensageria/provedores/whatsapp-cloud/whatsapp-cloud.test.ts
 */

import { randomBytes, randomInt } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Canal } from "@n1/dominio/crm/canais";
import { FRASE_SO_MODELO_PRIMEIRO } from "@n1/dominio/crm/mensagens";
import type { MembroDaSessao } from "../../../plugins/autenticacao";
import { encerrar, pool } from "../../../persistencia/conexao";
import { criarRepositorioDeCanaisPg } from "../../../repositorios/crm/canais";
import { lerCredencial, type ChavesDoCofre } from "../../../servicos/cofre";
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
import { provedorDeTeste } from "../teste";
import type { RegistroDeProvedores } from "../../registro";
import { ErroDaCloudApi, type ClienteDaCloudApi, type ModeloDaMeta } from "./cliente";
import type { ConfiguracaoDaCloudApi } from "./configuracao";
import { criarServicoDeConexaoDaCloudApi } from "./conexao";
import { criarEntradaDaCloudApi } from "./entrada";
import { criarSincronizadorDeModelos } from "./sincronizacao";
import { CABECALHO_DA_ASSINATURA_DA_META, criarProvedorWhatsAppCloud, FRASE_FORA_DA_JANELA } from "./provedor";
import { numeroPeloId } from "./repositorio";

const CONFIG: ConfiguracaoDaCloudApi = { appSecret: "segredo-do-app-de-teste", versao: "v24.0", graph: "https://graph.facebook.com" };
const CHAVES: ChavesDoCofre = { atual: { versao: 1, chave: randomBytes(32) } };
const TOKEN = "EAAG-token-permanente-que-nunca-aparece-no-banco";
const WABA = "100200300400500";

/** Um número do Canal e um Phone Number ID por teste: o índice do webhook é único na plataforma inteira. */
function numeroNovo() {
  const sufixo = String(randomInt(10_000_000, 99_999_999));
  return { identificador: `+55119${sufixo}`, exibido: `+55 11 9${sufixo.slice(0, 4)}-${sufixo.slice(4)}`, phoneNumberId: `10${randomInt(1_000_000_000, 9_999_999_999)}` };
}

/** A Meta de mentira: o que ela devolve é programável, e o que recebeu fica anotado. */
function metaFalsa(numero: ReturnType<typeof numeroNovo>) {
  const estado = {
    numeroExibido: numero.exibido,
    tokenValido: true,
    indisponivel: false,
    inscricoes: [] as string[],
    enviados: [] as Array<{ token: string; phoneNumberId: string; para: string; texto: string; emRespostaA?: string }>,
    modelosEnviados: [] as Array<{ phoneNumberId: string; para: string; nome: string; idioma: string; variaveis: readonly string[] }>,
    proximoEnvio: undefined as ErroDaCloudApi | undefined,
    contador: 0,
    /** Os modelos que a Meta devolve; a listagem pode falhar. */
    modelosDaMeta: [] as ModeloDaMeta[],
    listagemFalha: undefined as ErroDaCloudApi | undefined,
    listagens: 0,
  };
  const naoUsado = async () => {
    throw new ErroDaCloudApi(400, "não usado neste teste");
  };
  const cliente: ClienteDaCloudApi = {
    enviarTexto: async (token, phoneNumberId, para, texto, opcoes) => {
      if (estado.proximoEnvio) {
        const erro = estado.proximoEnvio;
        estado.proximoEnvio = undefined;
        throw erro;
      }
      estado.enviados.push({ token, phoneNumberId, para, texto, ...(opcoes?.emRespostaA ? { emRespostaA: opcoes.emRespostaA } : {}) });
      estado.contador += 1;
      return { idExterno: `wamid.saida.${estado.contador}.${randomBytes(3).toString("hex")}` };
    },
    enviarMidia: naoUsado,
    enviarModelo: async (_token, phoneNumberId, para, modelo) => {
      if (estado.proximoEnvio) {
        const erro = estado.proximoEnvio;
        estado.proximoEnvio = undefined;
        throw erro;
      }
      estado.modelosEnviados.push({ phoneNumberId, para, nome: modelo.nome, idioma: modelo.idioma, variaveis: modelo.variaveis });
      estado.contador += 1;
      return { idExterno: `wamid.modelo.${estado.contador}.${randomBytes(3).toString("hex")}` };
    },
    marcarComoLida: async () => undefined,
    dadosDoNumero: async () => {
      if (estado.indisponivel) throw new ErroDaCloudApi(0, "Não foi possível falar com o WhatsApp.", undefined, undefined, "rede");
      if (!estado.tokenValido) throw new ErroDaCloudApi(401, "Error validating access token: Session has expired", 190);
      return { numeroExibido: estado.numeroExibido, nomeVerificado: "Tria" };
    },
    inscreverApp: async (_token, wabaId) => {
      estado.inscricoes.push(wabaId);
    },
    lerMidia: naoUsado,
    listarModelos: async () => {
      estado.listagens += 1;
      if (estado.listagemFalha) throw estado.listagemFalha;
      return estado.modelosDaMeta;
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

const agoraEmSegundos = () => Math.floor(Date.now() / 1000);

/** Um evento do webhook, como a Meta manda. */
function evento(phoneNumberId: string, valorDoCampo: Record<string, unknown>) {
  return {
    object: "whatsapp_business_account",
    entry: [{ id: WABA, changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { display_phone_number: "5511977770001", phone_number_id: phoneNumberId }, ...valorDoCampo } }] }],
  };
}
const recebida = (phoneNumberId: string, de: string, id: string, texto: string, em = agoraEmSegundos()) =>
  evento(phoneNumberId, {
    contacts: [{ profile: { name: "Ana Souza" }, wa_id: de }],
    messages: [{ from: de, id, timestamp: String(em), type: "text", text: { body: texto } }],
  });
const statusDe = (phoneNumberId: string, id: string, status: string, em = agoraEmSegundos()) =>
  evento(phoneNumberId, { statuses: [{ id, status, timestamp: String(em), recipient_id: "5511987654321" }] });

/** A chamada como a Meta faz: o corpo cru assinado com a chave do app. */
function assinada(corpo: unknown, segredo = CONFIG.appSecret): ChamadaDoWebhook {
  const cru = JSON.stringify(corpo);
  return { cabecalhos: { [CABECALHO_DA_ASSINATURA_DA_META]: assinaturaDoCorpo(cru, segredo) }, corpoCru: Buffer.from(cru), corpo };
}

describeComBanco("WhatsApp oficial pela mensageria: conectar, receber, responder e desconectar (Postgres local)", () => {
  const espacos: string[] = [];
  const acesso = criarAcessoAoCrmPg(pool);
  const canais = criarServicoDeCanais({ pool, acesso });
  const conversas = criarServicoDeConversas({ pool, acesso });
  const mensagens = criarServicoDeMensagens({ pool, acesso });

  async function preparar(rotulo: string, opcoes: { readonly provedor?: "whatsapp-cloud" | "whatsapp-nao-oficial" } = {}) {
    const ws = novoEspacoDeTeste(`wa_${rotulo}`);
    espacos.push(ws);
    await semearMembro(ws, { id: "mem_admin", base: "administrador", state: "ativo" });
    await semearMembro(ws, { id: "mem_ana", base: "membro", state: "ativo" });
    await pool().query("insert into plataforma.workspaces (workspace_id) values ($1) on conflict do nothing", [ws]);
    const numero = numeroNovo();
    const meta = metaFalsa(numero);
    const conexao = criarServicoDeConexaoDaCloudApi({ pool, acesso, configuracao: () => CONFIG, chaves: () => CHAVES, cliente: () => meta.cliente });
    const provedor = criarProvedorWhatsAppCloud({ configuracao: CONFIG, cliente: meta.cliente });
    const registro: RegistroDeProvedores = { teste: provedorDeTeste, porProvedor: { "whatsapp-cloud": provedor } };
    const entrada = criarEntradaDaCloudApi({ pool, chaves: CHAVES, registro });
    const processador = criarProcessadorDeEntrada({ workerId: `teste-wa-entrada-${rotulo}`, pool, chaves: CHAVES, registro });
    const saida = criarWorkerDeSaida({ workerId: `teste-wa-saida-${rotulo}`, workspaceId: ws, chaves: CHAVES, registro });
    const admin = sessao(ws, "mem_admin");
    const canal = valor(
      await canais.criar(admin, { provedor: opcoes.provedor ?? "whatsapp-cloud", nome: "WhatsApp oficial", identificador: numero.identificador }),
    );
    /** O webhook entra na fila e o processador a esvazia. */
    const receber = async (corpo: unknown) => {
      const r = await entrada(assinada(corpo));
      while (await processador.processarUm()) {
        // até a fila esvaziar
      }
      return r;
    };
    const token = { phoneNumberId: numero.phoneNumberId, wabaId: WABA, token: TOKEN };
    return { ws, admin, membro: sessao(ws, "mem_ana"), numero, meta, conexao, entrada, processador, saida, receber, canal, token };
  }
  type Contexto = Awaited<ReturnType<typeof preparar>>;

  async function conectado(rotulo: string) {
    const c = await preparar(rotulo);
    valor(await c.conexao.conectar(c.admin, c.canal.id, c.token));
    return c;
  }

  const filaDe = async (ws: string) =>
    (
      await pool().query<{ estado: string; provedor: string; chave: string | null; resultado: string | null }>(
        "select estado, provedor, chave, resultado from plataforma.webhooks_recebidos where workspace_id = $1 order by recebido_em, id",
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

  describe("conectar pelo token", () => {
    it("só quem administra conecta", async () => {
      const c = await preparar("perm");
      expect(recusado(await c.conexao.conectar(c.membro, c.canal.id, c.token)).status).toBe(403);
    });

    it("guarda a credencial cifrada do provedor, liga o número, inscreve o app na conta e deixa o Canal conectado de verdade", async () => {
      const c = await preparar("conectar");
      const canal = valor(await c.conexao.conectar(c.admin, c.canal.id, c.token));
      expect(canal).toMatchObject({ id: c.canal.id, conexao: "conectada", conexaoSimulada: false });
      expect(c.meta.estado.inscricoes).toEqual([WABA]);

      const numero = await pool().query("select phone_number_id, waba_id, numero_exibido, conectado_por from plataforma.whatsapp_cloud_numeros where workspace_id = $1", [c.ws]);
      expect(numero.rows).toEqual([{ phone_number_id: c.numero.phoneNumberId, waba_id: WABA, numero_exibido: c.numero.exibido, conectado_por: "mem_admin" }]);

      const cofre = await pool().query<{ tipo: string; segredo_cifrado: Buffer }>(
        "select tipo, segredo_cifrado from plataforma.credenciais where workspace_id = $1 and dono_id = $2 and revogado_em is null",
        [c.ws, c.canal.id],
      );
      // O `tipo` é o nome do provedor: é o que `canalParaProvedor` decifra e o que esconde "Simular conexão" (CR-01).
      expect(cofre.rows.map((r) => r.tipo)).toEqual(["whatsapp-cloud"]);
      expect(cofre.rows[0]!.segredo_cifrado.toString("utf8")).not.toContain(TOKEN);
      const decifrada = JSON.parse((await lerCredencial(pool(), CHAVES, { workspaceId: c.ws, donoTipo: "canal", donoId: c.canal.id, tipo: "whatsapp-cloud" }))!);
      expect(decifrada).toEqual({ phoneNumberId: c.numero.phoneNumberId, wabaId: WABA, token: TOKEN });

      expect(await criarRepositorioDeCanaisPg(pool()).ligadoAoProvedor(c.ws, canal)).toBe(true);
      expect(recusado(await canais.simularConexao(c.admin, c.canal.id)).codigo).toBe("TRANSICAO_INVALIDA");
      // A ficha lê o número guardado, e nada que volte da API carrega o token.
      const daFicha = valor(await c.conexao.numero(c.admin, c.canal.id));
      expect(daFicha).toEqual({ phoneNumberId: c.numero.phoneNumberId, wabaId: WABA, numeroExibido: c.numero.exibido });
      expect(JSON.stringify([canal, daFicha])).not.toContain(TOKEN);
    });

    it("token recusado pela Meta: 409 TOKEN_RECUSADO, nada guardado, Canal continua desconectado", async () => {
      const c = await preparar("recusado");
      c.meta.estado.tokenValido = false;
      const r = recusado(await c.conexao.conectar(c.admin, c.canal.id, c.token));
      expect(r).toMatchObject({ status: 409, codigo: "TOKEN_RECUSADO", campo: "token" });
      expect(r.error).not.toContain(TOKEN);
      expect((await pool().query("select 1 from plataforma.whatsapp_cloud_numeros where workspace_id = $1", [c.ws])).rowCount).toBe(0);
      expect((await pool().query("select 1 from plataforma.credenciais where workspace_id = $1", [c.ws])).rowCount).toBe(0);
      expect(valor(await canais.obter(c.admin, c.canal.id)).conexao).toBe("desconectada");
    });

    it("o token é de OUTRO número: recusa, não inscreve o app e não guarda nada", async () => {
      const c = await preparar("outro");
      c.meta.estado.numeroExibido = "+55 21 98888-7777";
      const r = recusado(await c.conexao.conectar(c.admin, c.canal.id, c.token));
      expect(r).toMatchObject({ status: 409, codigo: "NUMERO_DIFERENTE", campo: "phoneNumberId" });
      expect(r.error).toContain("outro número");
      expect(c.meta.estado.inscricoes).toEqual([]);
      expect((await pool().query("select 1 from plataforma.credenciais where workspace_id = $1", [c.ws])).rowCount).toBe(0);
      expect(valor(await canais.obter(c.admin, c.canal.id)).conexao).toBe("desconectada");
    });

    it("o mesmo número do WhatsApp não fica em dois Canais, nem em outro Espaço", async () => {
      const primeiro = await conectado("dono");
      const segundo = await preparar("intruso");
      segundo.meta.estado.numeroExibido = segundo.numero.exibido;
      const r = recusado(await segundo.conexao.conectar(segundo.admin, segundo.canal.id, { ...segundo.token, phoneNumberId: primeiro.numero.phoneNumberId }));
      expect(r.codigo).toBe("NUMERO_EM_OUTRO_CANAL");
      expect((await numeroPeloId(pool(), primeiro.numero.phoneNumberId))?.canalId).toBe(primeiro.canal.id);
    });

    it("a Meta fora do ar: 502 WHATSAPP_INDISPONIVEL, sem gravar", async () => {
      const c = await preparar("fora");
      c.meta.estado.indisponivel = true;
      expect(recusado(await c.conexao.conectar(c.admin, c.canal.id, c.token))).toMatchObject({ status: 502, codigo: "WHATSAPP_INDISPONIVEL" });
      expect(valor(await canais.obter(c.admin, c.canal.id)).conexao).toBe("desconectada");
    });

    it("um Canal que não é do WhatsApp oficial não se conecta por aqui", async () => {
      const c = await preparar("naooficial", { provedor: "whatsapp-nao-oficial" });
      expect(recusado(await c.conexao.conectar(c.admin, c.canal.id, c.token))).toMatchObject({ status: 409, codigo: "PROVEDOR_ERRADO" });
    });

    it("sem a integração configurada, 503 dizendo o que falta", async () => {
      const c = await preparar("semconfig");
      const desligado = criarServicoDeConexaoDaCloudApi({ pool, acesso, configuracao: () => undefined });
      const r = recusado(await desligado.conectar(c.admin, c.canal.id, c.token));
      expect(r).toMatchObject({ status: 503, codigo: "WHATSAPP_OFICIAL_NAO_CONFIGURADO" });
      expect(r.error).toContain("META_APP_SECRET");
    });

    it("conectar de novo com um token novo troca a credencial: fica uma só ativa", async () => {
      const c = await conectado("reconectar");
      await canais.desconectar(c.admin, c.canal.id);
      valor(await c.conexao.conectar(c.admin, c.canal.id, { ...c.token, token: `${TOKEN}-novo` }));
      const ativas = await pool().query("select 1 from plataforma.credenciais where workspace_id = $1 and dono_id = $2 and revogado_em is null", [c.ws, c.canal.id]);
      expect(ativas.rowCount).toBe(1);
    });
  });

  describe("receber pelo webhook da Meta", () => {
    it("a mensagem entra na fila, vira Contato, Conversa e Mensagem, e o nome do perfil é o do Contato", async () => {
      const c = await conectado("receber");
      expect(await c.receber(recebida(c.numero.phoneNumberId, "5511987654321", "wamid.1", "Oi, vocês entregam?"))).toMatchObject({ guardadas: 1 });
      expect((await filaDe(c.ws)).map((l) => [l.provedor, l.chave, l.estado])).toEqual([["whatsapp-cloud", "wamid.1", "processado"]]);

      const contato = await pool().query(
        `select c.nome, c.modo_criacao, i.tipo, i.valor from plataforma.contatos c
           join plataforma.contato_identificadores i on i.workspace_id = c.workspace_id and i.contato_id = c.id
          where c.workspace_id = $1`,
        [c.ws],
      );
      expect(contato.rows).toEqual([{ nome: "Ana Souza", modo_criacao: "automatico_mensagem", tipo: "whatsapp", valor: "+5511987654321" }]);
      const mensagem = await pool().query("select direcao, conteudo, id_externo from plataforma.mensagens where workspace_id = $1", [c.ws]);
      expect(mensagem.rows).toEqual([{ direcao: "recebida", conteudo: "Oi, vocês entregam?", id_externo: "wamid.1" }]);
    });

    it("a mesma entrega de novo não entra na fila; a próxima mensagem vai para a mesma Conversa", async () => {
      const c = await conectado("repetida");
      await c.receber(recebida(c.numero.phoneNumberId, "5511987654321", "wamid.a", "Primeira"));
      expect(await c.receber(recebida(c.numero.phoneNumberId, "5511987654321", "wamid.a", "Primeira"))).toMatchObject({ guardadas: 0, repetidas: 1 });
      await c.receber(recebida(c.numero.phoneNumberId, "5511987654321", "wamid.b", "Segunda"));
      const linhas = await pool().query("select count(distinct conversa_id)::int as conversas, count(*)::int as mensagens from plataforma.mensagens where workspace_id = $1", [c.ws]);
      expect(linhas.rows[0]).toEqual({ conversas: 1, mensagens: 2 });
    });

    it("uma mensagem e um status no mesmo corpo viram duas linhas da fila", async () => {
      const c = await conectado("lote");
      const corpo = evento(c.numero.phoneNumberId, {
        contacts: [{ profile: { name: "Eva" }, wa_id: "5511911112222" }],
        messages: [{ from: "5511911112222", id: "wamid.e1", timestamp: String(agoraEmSegundos()), type: "text", text: { body: "Oi" } }],
        statuses: [{ id: "wamid.antiga", status: "read", timestamp: String(agoraEmSegundos()) }],
      });
      expect(await c.receber(corpo)).toMatchObject({ guardadas: 2 });
      expect((await filaDe(c.ws)).map((l) => l.chave)).toEqual(["wamid.e1", "status:wamid.antiga:read"]);
    });

    it("número que não é de Canal nenhum, assinatura de outra chave e corpo de outro objeto: nada entra na fila", async () => {
      const c = await conectado("ignorar");
      expect(await c.entrada(assinada(recebida("999000111222", "5511987654321", "wamid.x", "Teste")))).toMatchObject({ guardadas: 0, semCanal: 1 });
      expect(await c.entrada(assinada(recebida(c.numero.phoneNumberId, "5511987654321", "wamid.x", "Teste"), "outra-chave"))).toMatchObject({ guardadas: 0, recusadas: 1 });
      expect(await c.entrada(assinada({ object: "instagram", entry: [] }))).toEqual({ guardadas: 0, repetidas: 0, semCanal: 0, recusadas: 0 });
      expect(await filaDe(c.ws)).toEqual([]);
    });

    it("um Canal desconectado ou arquivado não recebe: o número some do índice", async () => {
      const c = await conectado("desligado");
      await canais.desconectar(c.admin, c.canal.id);
      expect(await c.entrada(assinada(recebida(c.numero.phoneNumberId, "5511987654321", "wamid.z", "Teste")))).toMatchObject({ guardadas: 0, semCanal: 1 });
    });
  });

  describe("responder: outbox → worker de saída → provedor", () => {
    async function comConversa(rotulo: string, emSegundos = agoraEmSegundos()) {
      const c = await conectado(rotulo);
      await c.receber(recebida(c.numero.phoneNumberId, "5511987654321", `wamid.${rotulo}`, "Quero um orçamento", emSegundos));
      const conversaId = (await pool().query<{ id: string }>("select id from plataforma.conversas where workspace_id = $1", [c.ws])).rows[0]!.id;
      return { ...c, conversaId };
    }
    const statusEntrega = async (ws: string, id: string) =>
      (await pool().query<{ status_entrega: string; id_externo: string | null; motivo_falha: string | null }>(
        "select status_entrega, id_externo, motivo_falha from plataforma.mensagens where workspace_id = $1 and id = $2",
        [ws, id],
      )).rows[0];

    it("dentro da janela: a resposta nasce pendente, sai pelo número do Contato, fica enviada com o id da Meta, e os status entregue e lida chegam pelo webhook", async () => {
      const c = await comConversa("responder");
      const mensagem = valor(await mensagens.enviar(c.admin, { conversaId: c.conversaId, direcao: "enviada", conteudo: "Claro! Qual o modelo?" }));
      expect(mensagem.statusEntrega).toBe("pendente");
      expect(c.meta.estado.enviados).toEqual([]);

      expect(await c.saida.processarUm()).toBe(true);
      expect(c.meta.estado.enviados).toEqual([{ token: TOKEN, phoneNumberId: c.numero.phoneNumberId, para: "5511987654321", texto: "Claro! Qual o modelo?" }]);
      const enviada = await statusEntrega(c.ws, mensagem.id);
      expect(enviada).toMatchObject({ status_entrega: "enviada" });
      expect(enviada!.id_externo).toMatch(/^wamid\.saida\./);

      await c.receber(statusDe(c.numero.phoneNumberId, enviada!.id_externo!, "delivered"));
      expect(await statusEntrega(c.ws, mensagem.id)).toMatchObject({ status_entrega: "entregue" });
      await c.receber(statusDe(c.numero.phoneNumberId, enviada!.id_externo!, "read"));
      expect(await statusEntrega(c.ws, mensagem.id)).toMatchObject({ status_entrega: "lida" });
      // Um `delivered` que chega depois do `read` nunca rebaixa o status.
      await c.receber(statusDe(c.numero.phoneNumberId, enviada!.id_externo!, "delivered", agoraEmSegundos() + 5));
      expect(await statusEntrega(c.ws, mensagem.id)).toMatchObject({ status_entrega: "lida" });
    });

    it("a Meta recusa fora da janela (131047): a Mensagem fica falhou dizendo que só modelo aprovado sai, sem nova tentativa", async () => {
      const c = await comConversa("falhou");
      c.meta.estado.proximoEnvio = new ErroDaCloudApi(400, "(#131047) Re-engagement message", 131047);
      const mensagem = valor(await mensagens.enviar(c.admin, { conversaId: c.conversaId, direcao: "enviada", conteudo: "Oi" }));
      await c.saida.processarUm();
      expect(await statusEntrega(c.ws, mensagem.id)).toMatchObject({ status_entrega: "falhou", motivo_falha: FRASE_FORA_DA_JANELA });
      expect(c.meta.estado.enviados).toEqual([]);
      expect(await c.saida.processarUm()).toBe(false);
    });

    it("recebida há mais de 24 h: texto livre é recusado antes de gravar (409 JANELA_EXPIRADA, campo modelo)", async () => {
      const c = await comConversa("expirada", agoraEmSegundos() - 30 * 3600);
      const r = recusado(await mensagens.enviar(c.admin, { conversaId: c.conversaId, direcao: "enviada", conteudo: "Ainda está aí?" }));
      expect(r).toMatchObject({ status: 409, codigo: "JANELA_EXPIRADA", campo: "modelo" });
      expect(c.meta.estado.enviados).toEqual([]);
    });

    it("7.2.6: abrir uma Conversa nova pela plataforma com texto livre é recusado (a empresa só abre com modelo aprovado)", async () => {
      const c = await conectado("abrir");
      const contato = await pool().query<{ id: string }>(
        `insert into plataforma.contatos (workspace_id, nome, proprietario_id, criado_por) values ($1, 'Carla', 'mem_admin', 'mem_admin') returning id`,
        [c.ws],
      );
      await pool().query(
        `insert into plataforma.contato_identificadores (workspace_id, contato_id, tipo, valor, principal) values ($1, $2, 'whatsapp', '+5511966665555', true)`,
        [c.ws, contato.rows[0]!.id],
      );
      const r = recusado(await conversas.criar(c.admin, { canalId: c.canal.id, contatoId: contato.rows[0]!.id, mensagem: { conteudo: "Oi, Carla!" } }));
      expect(r).toMatchObject({ status: 409, codigo: "JANELA_EXPIRADA", campo: "modelo" });
      expect(r.error).toMatch(/começar a conversa/);
      expect(FRASE_SO_MODELO_PRIMEIRO).toMatch(/começar a conversa/);
      expect((await pool().query("select 1 from plataforma.conversas where workspace_id = $1", [c.ws])).rowCount).toBe(0);
    });
  });

  describe("modelos de mensagem (7.3)", () => {
    const daMeta = (n: number, extras: Partial<ModeloDaMeta> = {}): ModeloDaMeta => ({
      id: `1900${n}`,
      name: `modelo_${n}`,
      language: "pt_BR",
      category: "UTILITY",
      status: "APPROVED",
      components: [{ type: "BODY", text: "Olá {{1}}" }],
      ...extras,
    });
    const nomes = async (c: Contexto) => valor(await c.conexao.modelos(c.admin, c.canal.id)).itens.map((m) => `${m.nome}:${m.estado}`);

    it("conectar já traz os modelos da conta, com o que é enviável, o motivo da rejeição e o que o CRM ainda não envia", async () => {
      const c = await preparar("modelos_conectar");
      c.meta.estado.modelosDaMeta = [
        daMeta(1),
        daMeta(2, { status: "REJECTED", rejected_reason: "INVALID_FORMAT" }),
        daMeta(3, { components: [{ type: "HEADER", format: "IMAGE" }, { type: "BODY", text: "oi" }] }),
      ];
      valor(await c.conexao.conectar(c.admin, c.canal.id, c.token));
      const { itens, total } = valor(await c.conexao.modelos(c.admin, c.canal.id));
      expect(total).toBe(3);
      const por = (nome: string) => itens.find((m) => m.nome === nome)!;
      expect(por("modelo_1")).toMatchObject({ estado: "aprovado", enviavel: true, motivoDeNaoEnviavel: null, quantidadeDeVariaveis: 1, idNoProvedor: "19001", idioma: "pt_BR", categoria: "utilidade" });
      expect(por("modelo_2")).toMatchObject({ estado: "rejeitado", enviavel: false, motivoDeRejeicao: "INVALID_FORMAT" });
      expect(por("modelo_3")).toMatchObject({ estado: "aprovado", enviavel: false });
      expect(por("modelo_3").motivoDeNaoEnviavel).toMatch(/cabeçalho de imagem/);
    });

    it("sincronizar cria, atualiza e remove: o Canal fica com exatamente o que a Meta tem, e quem fica mantém o id", async () => {
      const c = await preparar("modelos_sync");
      c.meta.estado.modelosDaMeta = [daMeta(1), daMeta(2)];
      valor(await c.conexao.conectar(c.admin, c.canal.id, c.token));
      const antes = valor(await c.conexao.modelos(c.admin, c.canal.id)).itens;
      const idDoUm = antes.find((m) => m.nome === "modelo_1")!.id;

      // Na Meta: o 1 foi pausado, o 2 sumiu e o 4 nasceu (e um modelo de categoria que o CRM não conhece fica de fora).
      c.meta.estado.modelosDaMeta = [daMeta(1, { status: "PAUSED" }), daMeta(4), daMeta(5, { category: "CATEGORIA_NOVA" })];
      const r = valor(await c.conexao.sincronizar(c.admin, c.canal.id));
      expect(r).toEqual({ criados: 1, atualizados: 1, removidos: 1, ignorados: 1 });
      expect(await nomes(c)).toEqual(["modelo_1:pausado", "modelo_4:aprovado"]);
      expect(valor(await c.conexao.modelos(c.admin, c.canal.id)).itens.find((m) => m.nome === "modelo_1")!.id).toBe(idDoUm);
    });

    it("o mesmo nome em dois idiomas são dois modelos; sincronizar de novo não duplica", async () => {
      const c = await preparar("modelos_idioma");
      c.meta.estado.modelosDaMeta = [daMeta(1), daMeta(1, { id: "19099", language: "en_US" })];
      valor(await c.conexao.conectar(c.admin, c.canal.id, c.token));
      valor(await c.conexao.sincronizar(c.admin, c.canal.id));
      expect(await nomes(c)).toEqual(["modelo_1:aprovado", "modelo_1:aprovado"]);
      expect((await pool().query("select count(*)::int as n from plataforma.modelos_de_mensagem where workspace_id = $1", [c.ws])).rows[0]).toEqual({ n: 2 });
    });

    it("a Meta fora do ar na listagem: 502 e NADA é apagado", async () => {
      const c = await preparar("modelos_fora");
      c.meta.estado.modelosDaMeta = [daMeta(1), daMeta(2)];
      valor(await c.conexao.conectar(c.admin, c.canal.id, c.token));
      c.meta.estado.listagemFalha = new ErroDaCloudApi(0, "Não foi possível falar com o WhatsApp.", undefined, undefined, "rede");
      expect(recusado(await c.conexao.sincronizar(c.admin, c.canal.id))).toMatchObject({ status: 502, codigo: "WHATSAPP_INDISPONIVEL" });
      expect(await nomes(c)).toEqual(["modelo_1:aprovado", "modelo_2:aprovado"]);
    });

    it("token recusado na listagem: 409 TOKEN_RECUSADO e a lista fica como estava", async () => {
      const c = await conectado("modelos_token");
      c.meta.estado.modelosDaMeta = [daMeta(1)];
      valor(await c.conexao.sincronizar(c.admin, c.canal.id));
      c.meta.estado.listagemFalha = new ErroDaCloudApi(401, "Error validating access token", 190);
      expect(recusado(await c.conexao.sincronizar(c.admin, c.canal.id))).toMatchObject({ status: 409, codigo: "TOKEN_RECUSADO" });
      expect(await nomes(c)).toEqual(["modelo_1:aprovado"]);
    });

    it("conectar com a listagem falhando continua conectado e sem modelos; depois o botão sincroniza", async () => {
      const c = await preparar("modelos_conecta_falha");
      c.meta.estado.listagemFalha = new ErroDaCloudApi(503, "indisponível");
      expect(valor(await c.conexao.conectar(c.admin, c.canal.id, c.token))).toMatchObject({ conexao: "conectada" });
      expect(await nomes(c)).toEqual([]);

      c.meta.estado.listagemFalha = undefined;
      c.meta.estado.modelosDaMeta = [daMeta(1)];
      expect(valor(await c.conexao.sincronizar(c.admin, c.canal.id))).toMatchObject({ criados: 1 });
      expect(await nomes(c)).toEqual(["modelo_1:aprovado"]);
    });

    it("só quem administra sincroniza; um Membro lê a lista", async () => {
      const c = await conectado("modelos_perm");
      c.meta.estado.modelosDaMeta = [daMeta(1)];
      valor(await c.conexao.sincronizar(c.admin, c.canal.id));
      expect(recusado(await c.conexao.sincronizar(c.membro, c.canal.id)).status).toBe(403);
      expect(valor(await c.conexao.modelos(c.membro, c.canal.id)).total).toBe(1);
    });

    it("Canal desconectado: sincronizar é 409 CANAL_NAO_CONECTADO; Canal que não é do WhatsApp oficial: lista vazia e PROVEDOR_ERRADO", async () => {
      const c = await preparar("modelos_semconexao");
      expect(recusado(await c.conexao.sincronizar(c.admin, c.canal.id))).toMatchObject({ status: 409, codigo: "CANAL_NAO_CONECTADO" });
      const outro = await preparar("modelos_naooficial", { provedor: "whatsapp-nao-oficial" });
      expect(valor(await outro.conexao.modelos(outro.admin, outro.canal.id))).toEqual({ itens: [], total: 0 });
      expect(recusado(await outro.conexao.sincronizar(outro.admin, outro.canal.id))).toMatchObject({ status: 409, codigo: "PROVEDOR_ERRADO" });
    });

    it("um Canal de outro Espaço é 404", async () => {
      const dono = await conectado("modelos_dono");
      const intruso = await preparar("modelos_intruso");
      expect(recusado(await intruso.conexao.modelos(intruso.admin, dono.canal.id)).status).toBe(404);
      expect(recusado(await intruso.conexao.sincronizar(intruso.admin, dono.canal.id)).status).toBe(404);
    });

    it("desconectar o número NÃO apaga os modelos: eles são da conta do WhatsApp Business", async () => {
      const c = await preparar("modelos_desconectar");
      c.meta.estado.modelosDaMeta = [daMeta(1), daMeta(2)];
      valor(await c.conexao.conectar(c.admin, c.canal.id, c.token));
      valor(await canais.desconectar(c.admin, c.canal.id));
      expect(await nomes(c)).toEqual(["modelo_1:aprovado", "modelo_2:aprovado"]);
    });
  });

  describe("enviar e abrir a conversa com modelo (7.3.4)", () => {
    const daMeta = (n: number, extras: Partial<ModeloDaMeta> = {}): ModeloDaMeta => ({
      id: `2000${n}`,
      name: `modelo_${n}`,
      language: "pt_BR",
      category: "UTILITY",
      status: "APPROVED",
      components: [{ type: "BODY", text: "Olá {{1}}, tudo bem?" }],
      ...extras,
    });

    /** Um Canal conectado com quatro modelos: o 1 enviável, o 2 pendente, o 3 de marketing e o 4 com cabeçalho de imagem. */
    async function comModelos(rotulo: string) {
      const c = await preparar(rotulo);
      c.meta.estado.modelosDaMeta = [
        daMeta(1),
        daMeta(2, { status: "PENDING" }),
        daMeta(3, { category: "MARKETING" }),
        daMeta(4, { components: [{ type: "HEADER", format: "IMAGE" }, { type: "BODY", text: "oi" }] }),
      ];
      valor(await c.conexao.conectar(c.admin, c.canal.id, c.token));
      const lista = valor(await c.conexao.modelos(c.admin, c.canal.id)).itens;
      const id = (nome: string) => lista.find((m) => m.nome === nome)!.id;
      const contato = await pool().query<{ id: string }>(
        `insert into plataforma.contatos (workspace_id, nome, proprietario_id, criado_por) values ($1, 'Carla', 'mem_admin', 'mem_admin') returning id`,
        [c.ws],
      );
      await pool().query(
        `insert into plataforma.contato_identificadores (workspace_id, contato_id, tipo, valor, principal) values ($1, $2, 'whatsapp', '+5511966665555', true)`,
        [c.ws, contato.rows[0]!.id],
      );
      return { ...c, id, contatoId: contato.rows[0]!.id };
    }

    const linhaDe = async (ws: string, mensagemId: string) =>
      (await pool().query<{ conteudo: string | null; modelo_usado: unknown; status_entrega: string; id_externo: string | null }>(
        "select conteudo, modelo_usado, status_entrega, id_externo from plataforma.mensagens where workspace_id = $1 and id = $2",
        [ws, mensagemId],
      )).rows[0]!;

    it("abrir a Conversa com modelo: grava o texto preenchido e o modelo_usado, e o worker o envia como modelo (nome, idioma e variáveis)", async () => {
      const c = await comModelos("abrir_modelo");
      const aberta = valor(await conversas.criar(c.admin, { canalId: c.canal.id, contatoId: c.contatoId, mensagem: { conteudo: "", modeloId: c.id("modelo_1"), variaveis: ["  Carla "] } }));
      expect(aberta.primeiraMensagem.statusEntrega).toBe("pendente");
      const gravada = await linhaDe(c.ws, aberta.primeiraMensagem.id);
      expect(gravada.conteudo).toBe("Olá Carla, tudo bem?");
      expect(gravada.modelo_usado).toEqual({ idNoProvedor: "20001", nome: "modelo_1", idioma: "pt_BR", variaveis: ["Carla"] });

      expect(await c.saida.processarUm()).toBe(true);
      expect(c.meta.estado.modelosEnviados).toEqual([{ phoneNumberId: c.numero.phoneNumberId, para: "5511966665555", nome: "modelo_1", idioma: "pt_BR", variaveis: ["Carla"] }]);
      // O texto livre nunca saiu: só o modelo.
      expect(c.meta.estado.enviados).toEqual([]);
      expect(await linhaDe(c.ws, aberta.primeiraMensagem.id)).toMatchObject({ status_entrega: "enviada" });
    });

    it("texto livre ao abrir: 409 JANELA_EXPIRADA, e a recusa traz SÓ os modelos que dá para escolher (aprovado e enviável)", async () => {
      const c = await comModelos("abrir_livre");
      const r = recusado(await conversas.criar(c.admin, { canalId: c.canal.id, contatoId: c.contatoId, mensagem: { conteudo: "Oi, Carla!" } }));
      expect(r).toMatchObject({ status: 409, codigo: "JANELA_EXPIRADA", campo: "modelo" });
      expect(r.modelos?.map((m) => m.nome).sort()).toEqual(["modelo_1", "modelo_3"]);
      expect(r.modelos?.every((m) => m.enviavel)).toBe(true);
      expect((await pool().query("select 1 from plataforma.conversas where workspace_id = $1", [c.ws])).rowCount).toBe(0);
    });

    it.each([
      ["pendente na Meta", "modelo_2"],
      ["com cabeçalho de imagem (o CRM ainda não envia)", "modelo_4"],
    ])("modelo %s: 409 MODELO_INDISPONIVEL e nada nasce", async (_nome, modelo) => {
      const c = await comModelos(`indisp_${modelo}`);
      const r = recusado(await conversas.criar(c.admin, { canalId: c.canal.id, contatoId: c.contatoId, mensagem: { conteudo: "", modeloId: c.id(modelo), variaveis: ["Carla"] } }));
      expect(r).toMatchObject({ status: 409, codigo: "MODELO_INDISPONIVEL", campo: "modeloId" });
      expect((await pool().query("select 1 from plataforma.conversas where workspace_id = $1", [c.ws])).rowCount).toBe(0);
    });

    it("um modelo de OUTRO Canal (ou um id que não existe) nunca serve", async () => {
      const dono = await comModelos("modelo_dono");
      const c = await comModelos("modelo_intruso");
      const alheio = dono.id("modelo_1");
      for (const modeloId of [alheio, "id-que-nao-existe"]) {
        const r = recusado(await conversas.criar(c.admin, { canalId: c.canal.id, contatoId: c.contatoId, mensagem: { conteudo: "", modeloId, variaveis: ["Carla"] } }));
        expect(r).toMatchObject({ status: 409, codigo: "MODELO_INDISPONIVEL" });
      }
    });

    it.each([
      ["variável a menos", []],
      ["variável a mais", ["Carla", "extra"]],
      ["variável vazia", ["   "]],
      ["variável com quebra de linha", ["Carla\nSouza"]],
    ])("%s: 400 VALOR_INVALIDO no campo variaveis", async (_nome, variaveis) => {
      const c = await comModelos(`vars_${variaveis.length}_${_nome.length}`);
      const r = recusado(await conversas.criar(c.admin, { canalId: c.canal.id, contatoId: c.contatoId, mensagem: { conteudo: "", modeloId: c.id("modelo_1"), variaveis } }));
      expect(r).toMatchObject({ status: 400, codigo: "VALOR_INVALIDO", campo: "variaveis" });
    });

    it("responder FORA da janela: texto livre é recusado com a lista de modelos; com modelo, sai", async () => {
      const c = await comModelos("fora_janela");
      await c.receber(recebida(c.numero.phoneNumberId, "5511966665555", "wamid.velha", "Oi", agoraEmSegundos() - 30 * 3600));
      const conversaId = (await pool().query<{ id: string }>("select id from plataforma.conversas where workspace_id = $1", [c.ws])).rows[0]!.id;

      const livre = recusado(await mensagens.enviar(c.admin, { conversaId, direcao: "enviada", conteudo: "Ainda está aí?" }));
      expect(livre).toMatchObject({ status: 409, codigo: "JANELA_EXPIRADA", campo: "modelo" });
      expect(livre.modelos?.map((m) => m.nome).sort()).toEqual(["modelo_1", "modelo_3"]);

      const m = valor(await mensagens.enviar(c.admin, { conversaId, direcao: "enviada", conteudo: "", modeloId: c.id("modelo_1"), variaveis: ["Carla"] }));
      expect(m.conteudo).toBe("Olá Carla, tudo bem?");
      expect(m.modeloUsado).toEqual({ idNoProvedor: "20001", nome: "modelo_1", idioma: "pt_BR", variaveis: ["Carla"] });
      await c.saida.processarUm();
      expect(c.meta.estado.modelosEnviados).toHaveLength(1);
    });

    it("DENTRO da janela o modelo também sai (a escolha é da pessoa), e o texto livre segue livre", async () => {
      const c = await comModelos("dentro_janela");
      await c.receber(recebida(c.numero.phoneNumberId, "5511966665555", "wamid.nova", "Oi"));
      const conversaId = (await pool().query<{ id: string }>("select id from plataforma.conversas where workspace_id = $1", [c.ws])).rows[0]!.id;
      expect(valor(await mensagens.enviar(c.admin, { conversaId, direcao: "enviada", conteudo: "texto livre" })).modeloUsado).toBeNull();
      expect(valor(await mensagens.enviar(c.admin, { conversaId, direcao: "enviada", conteudo: "", modeloId: c.id("modelo_1"), variaveis: ["Carla"] })).modeloUsado).toMatchObject({ nome: "modelo_1" });
    });

    it("a recusa do envio de modelo pela Meta (132001) deixa a Mensagem falhou, sem nova tentativa", async () => {
      const c = await comModelos("meta_recusa");
      c.meta.estado.proximoEnvio = new ErroDaCloudApi(404, "Template name does not exist in the translation", 132001);
      const aberta = valor(await conversas.criar(c.admin, { canalId: c.canal.id, contatoId: c.contatoId, mensagem: { conteudo: "", modeloId: c.id("modelo_1"), variaveis: ["Carla"] } }));
      await c.saida.processarUm();
      const falhou = await linhaDe(c.ws, aberta.primeiraMensagem.id);
      expect(falhou.status_entrega).toBe("falhou");
      expect(await c.saida.processarUm()).toBe(false);
    });

    it("modelo de marketing sem consentimento do Contato: 409 SEM_CONSENTIMENTO, ao abrir e ao responder (3.2.4)", async () => {
      const c = await comModelos("marketing");
      const r = recusado(await conversas.criar(c.admin, { canalId: c.canal.id, contatoId: c.contatoId, mensagem: { conteudo: "", modeloId: c.id("modelo_3"), variaveis: ["Carla"] } }));
      expect(r).toMatchObject({ status: 409, codigo: "SEM_CONSENTIMENTO", campo: "modelo" });
      expect((await pool().query("select 1 from plataforma.conversas where workspace_id = $1", [c.ws])).rowCount).toBe(0);
      // O de utilidade (modelo_1) segue livre para o mesmo Contato.
      valor(await conversas.criar(c.admin, { canalId: c.canal.id, contatoId: c.contatoId, mensagem: { conteudo: "", modeloId: c.id("modelo_1"), variaveis: ["Carla"] } }));
    });

    it("a Conversa que já existe vence a regra do modelo: abrir de novo é CONVERSA_JA_ABERTA, não JANELA_EXPIRADA", async () => {
      const c = await comModelos("ja_aberta");
      valor(await conversas.criar(c.admin, { canalId: c.canal.id, contatoId: c.contatoId, mensagem: { conteudo: "", modeloId: c.id("modelo_1"), variaveis: ["Carla"] } }));
      const r = recusado(await conversas.criar(c.admin, { canalId: c.canal.id, contatoId: c.contatoId, mensagem: { conteudo: "de novo" } }));
      expect(r.codigo).toBe("CONVERSA_JA_ABERTA");
    });

    it("um Canal que não é do WhatsApp oficial não tem modelo: pedir um é 409 MODELO_INDISPONIVEL", async () => {
      const c = await preparar("nao_oficial_modelo", { provedor: "whatsapp-nao-oficial" });
      const contato = await pool().query<{ id: string }>(
        `insert into plataforma.contatos (workspace_id, nome, proprietario_id, criado_por) values ($1, 'Dani', 'mem_admin', 'mem_admin') returning id`,
        [c.ws],
      );
      await pool().query(`insert into plataforma.contato_identificadores (workspace_id, contato_id, tipo, valor, principal) values ($1, $2, 'whatsapp', '+5511955554444', true)`, [c.ws, contato.rows[0]!.id]);
      const r = recusado(await conversas.criar(c.admin, { canalId: c.canal.id, contatoId: contato.rows[0]!.id, mensagem: { conteudo: "", modeloId: "qualquer", variaveis: [] } }));
      expect(r).toMatchObject({ status: 409, codigo: "MODELO_INDISPONIVEL" });
    });
  });

  describe("manter os modelos em dia sozinho (7.3.2)", () => {
    const daMeta = (n: number, extras: Partial<ModeloDaMeta> = {}): ModeloDaMeta => ({
      id: `3000${n}`,
      name: `modelo_${n}`,
      language: "pt_BR",
      category: "UTILITY",
      status: "APPROVED",
      components: [{ type: "BODY", text: "Olá {{1}}" }],
      ...extras,
    });
    const nomesDo = async (c: Contexto) => valor(await c.conexao.modelos(c.admin, c.canal.id)).itens.map((m) => `${m.nome}:${m.estado}`);
    const sincronizadorDe = (c: Contexto) => criarSincronizadorDeModelos({ pool, chaves: () => CHAVES, configuracao: () => CONFIG, cliente: () => c.meta.cliente });
    /** Uma conta (WABA) só deste teste: os outros testes do arquivo deixam Canais conectados na conta de teste comum. */
    const contaUnica = () => String(randomInt(100_000_000_000, 999_999_999_999));
    async function conectadoNaConta(rotulo: string, wabaId: string) {
      const c = await preparar(rotulo);
      valor(await c.conexao.conectar(c.admin, c.canal.id, { ...c.token, wabaId }));
      return c;
    }

    it("o aviso da Meta (daConta) sincroniza o Canal da conta, e só dessa conta", async () => {
      const conta = contaUnica();
      const c = await conectadoNaConta("sinc_conta", conta);
      const outro = await conectadoNaConta("sinc_outra_conta", contaUnica());
      c.meta.estado.modelosDaMeta = [daMeta(1, { status: "PAUSED" })];
      outro.meta.estado.modelosDaMeta = [daMeta(9)];
      const r = await sincronizadorDe(c).daConta(conta);
      expect(r).toEqual({ rodou: true, canais: 1, sincronizados: 1, falhas: 0 });
      expect(await nomesDo(c)).toEqual(["modelo_1:pausado"]);
      expect(await nomesDo(outro)).toEqual([]);
    });

    it("um Canal desconectado, simulado ou arquivado não é sincronizado", async () => {
      const conta = contaUnica();
      const c = await conectadoNaConta("sinc_desligado", conta);
      c.meta.estado.modelosDaMeta = [daMeta(1)];
      expect(c.meta.estado.listagens).toBe(1);
      // Desconectar apaga o número, então a conta nem acha o Canal.
      valor(await canais.desconectar(c.admin, c.canal.id));
      expect(await sincronizadorDe(c).daConta(conta)).toMatchObject({ canais: 0, sincronizados: 0 });
      expect(c.meta.estado.listagens).toBe(1);
    });

    it("um Canal que falha (Meta fora do ar) não segura o outro, e o que falhou mantém a lista que tinha", async () => {
      const a = await conectado("sinc_lote_a");
      const b = await conectado("sinc_lote_b");
      a.meta.estado.modelosDaMeta = [daMeta(1)];
      valor(await a.conexao.sincronizar(a.admin, a.canal.id));
      // Os dois Canais na mesma conta (WABA), cada um com a sua Meta falsa: o cliente é o do Canal `a` na rodada.
      await pool().query("update plataforma.whatsapp_cloud_numeros set waba_id = $2 where workspace_id = any($1::text[])", [[a.ws, b.ws], "555444333222"]);
      a.meta.estado.listagemFalha = new ErroDaCloudApi(503, "indisponível");
      const r = await criarSincronizadorDeModelos({ pool, chaves: () => CHAVES, configuracao: () => CONFIG, cliente: () => a.meta.cliente }).daConta("555444333222");
      expect(r.rodou).toBe(true);
      expect(r.falhas).toBe(2);
      expect(await nomesDo(a)).toEqual(["modelo_1:aprovado"]);
    });

    it("sem a integração configurada ou sem a chave do cofre, não faz nada e não lança", async () => {
      const c = await conectado("sinc_semconfig");
      const semConfig = criarSincronizadorDeModelos({ pool, configuracao: () => undefined });
      expect(await semConfig.daConta(WABA)).toEqual({ rodou: false, canais: 0, sincronizados: 0, falhas: 0 });
      const semCofre = criarSincronizadorDeModelos({
        pool,
        configuracao: () => CONFIG,
        chaves: () => {
          throw new Error("sem COFRE_CHAVE");
        },
      });
      expect(await semCofre.deTodos()).toMatchObject({ rodou: false });
      expect(c.meta.estado.listagens).toBe(1);
    });

    it("a rodada de hora em hora (deTodos) sincroniza todos os Canais reais conectados", async () => {
      const c = await conectado("sinc_todos");
      c.meta.estado.modelosDaMeta = [daMeta(1), daMeta(2)];
      const r = await sincronizadorDe(c).deTodos();
      expect(r.rodou).toBe(true);
      expect(r.sincronizados).toBeGreaterThanOrEqual(1);
      expect(await nomesDo(c)).toEqual(["modelo_1:aprovado", "modelo_2:aprovado"]);
    });
  });

  describe("desconectar e arquivar", () => {
    const sobra = async (c: Contexto) => ({
      numeros: (await pool().query("select 1 from plataforma.whatsapp_cloud_numeros where workspace_id = $1", [c.ws])).rowCount,
      credenciais: (await pool().query("select 1 from plataforma.credenciais where workspace_id = $1 and dono_id = $2", [c.ws, c.canal.id])).rowCount,
    });

    it("desconectar apaga o número e o token do cofre (não só revoga)", async () => {
      const c = await conectado("desconectar");
      expect(await sobra(c)).toEqual({ numeros: 1, credenciais: 1 });
      const canal = valor(await canais.desconectar(c.admin, c.canal.id));
      expect(canal.conexao).toBe("desconectada");
      expect(await sobra(c)).toEqual({ numeros: 0, credenciais: 0 });
    });

    it("arquivar o Canal conectado apaga o número e o token do cofre", async () => {
      const c = await conectado("arquivar");
      valor(await canais.arquivar(c.admin, c.canal.id));
      expect(await sobra(c)).toEqual({ numeros: 0, credenciais: 0 });
    });
  });
});

/** O tipo do Canal que `criar` devolve, só para o `import type` não ficar sem uso quando o teste for pulado. */
export type CanalDoTeste = Canal;
