/**
 * A conexão da caixa de e-mail por senha (Fase 17, 17-05) contra o Postgres LOCAL e os dublês de IMAP e SMTP de 17-02:
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55745/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55745/postgres \
 *   npx vitest run src/mensageria/provedores/email/conexao.test.ts
 *
 * Prova: com a senha certa o serviço abre IMAP e SMTP pela fábrica ANTES de gravar e só então grava, numa transação, a
 * credencial no cofre, a conta, o cursor da INBOX no `UIDNEXT` daquele momento (D-17-08) e o Canal `conectada`,
 * reenfileirando o que esperava (B69); senha errada, SMTP recusado, servidor interno e porta fora da lista não gravam nada;
 * a senha não aparece em nenhuma resposta nem erro; a ficha lê a conta sem segredo.
 */

import { randomBytes } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { Canal } from "@n1/dominio/crm/canais";
import type { MembroDaSessao } from "../../../plugins/autenticacao";
import { encerrar, pool } from "../../../persistencia/conexao";
import { criarRepositorioDeContatosPg } from "../../../repositorios/crm/contatos";
import { criarRepositorioDeConversasPg } from "../../../repositorios/crm/conversas";
import { lerCredencial, type ChavesDoCofre } from "../../../servicos/cofre";
import { criarAcessoAoCrmPg } from "../../../servicos/crm/acesso";
import { criarServicoDeCanais } from "../../../servicos/crm/canais";
import { criarServicoDeMensagens } from "../../../servicos/crm/mensagens";
import type { ResultadoCrm } from "../../../servicos/crm/resultado";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearMembro } from "../../../testes/banco-crm";
import { iniciarServidorDeEmailFalso, PASTA_DE_ENVIADOS_FALSA, type ServidorDeEmailFalso } from "../../../testes/servidor-de-email-falso";
import { criarServicoDeConexaoDoEmail, type DependenciasDoEmail } from "./conexao";
import { TIPO_DA_CREDENCIAL, lerCredencialDoEmail } from "./credencial";
import { criarFabricaDeConexao, type FabricaDeConexao } from "./fabrica-de-conexao";
import { PORTAS_DO_EMAIL, POLITICA_DE_PRODUCAO, criarPoliticaDeRede, type Resolvedor } from "./rede";
import { contaDoCanal, lerCursor } from "./repositorio";

const CHAVES: ChavesDoCofre = { atual: { versao: 1, chave: randomBytes(32) } };
const USUARIO = "vendas@caixa.teste";
const SENHA = "senha-certa-do-teste-17-05";
const ENDERECO = "vendas@caixa.teste";

const sessao = (workspaceId: string, id: string): MembroDaSessao => ({ id, workspaceId, state: "ativo" });

function valor<T>(resultado: ResultadoCrm<T>): T {
  if (!resultado.ok) throw new Error(`esperava sucesso, veio ${resultado.status} ${resultado.codigo ?? ""}: ${resultado.error}`);
  return resultado.valor;
}

function recusado<T>(resultado: ResultadoCrm<T>) {
  if (resultado.ok) throw new Error("esperava recusa, veio sucesso");
  return resultado;
}

const mime = (n: number) => `From: cliente@fora.teste\r\nTo: ${ENDERECO}\r\nSubject: antiga ${n}\r\nMessage-ID: <antiga-${n}@fora.teste>\r\n\r\ncorpo ${n}\r\n`;

describeComBanco("conexão do e-mail por senha — Postgres local e dublês de IMAP e SMTP", () => {
  const espacos: string[] = [];
  const servidores: ServidorDeEmailFalso[] = [];
  const acesso = criarAcessoAoCrmPg(pool);
  const canais = criarServicoDeCanais({ pool, acesso });
  const mensagens = criarServicoDeMensagens({ pool, acesso });

  beforeAll(async () => {
    await prepararBancoCrm();
  });

  afterEach(async () => {
    while (servidores.length > 0) await servidores.pop()!.fechar();
  });

  afterAll(async () => {
    for (const ws of espacos) {
      await pool().query("delete from plataforma.integration_outbox where workspace_id = $1", [ws]);
      await limparEspaco(ws);
    }
    await encerrar();
  });

  /** Um dublê de caixa com 3 mensagens antigas na INBOX e uma fábrica que só abre `127.0.0.1`, com a CA dele. */
  async function servidor(opcoes: { senha?: string } = {}) {
    const dublê = await iniciarServidorDeEmailFalso({ usuarios: [{ usuario: USUARIO, senha: opcoes.senha ?? SENHA }] });
    servidores.push(dublê);
    for (const n of [1, 2, 3]) await dublê.adicionarMensagem(USUARIO, mime(n));
    const resolver = vi.fn<Resolvedor>(async () => [{ address: "127.0.0.1", family: 4 }]);
    const fabricaReal = criarFabricaDeConexao({
      resolver,
      politica: criarPoliticaDeRede({ permitir: ["127.0.0.1"] }),
      portas: { imap: { [dublê.imap.porta]: "tls" }, smtp: { [dublê.smtp.porta]: "tls" } },
      ca: dublê.ca,
    });
    return { dublê, fabricaReal, resolver };
  }

  async function preparar(rotulo: string, extras: Partial<DependenciasDoEmail> = {}, fabricaDoTeste?: FabricaDeConexao) {
    const ws = novoEspacoDeTeste(`em_${rotulo}`);
    espacos.push(ws);
    await semearMembro(ws, { id: "mem_admin", base: "administrador", state: "ativo" });
    await semearMembro(ws, { id: "mem_ana", base: "membro", state: "ativo" });
    await pool().query("insert into plataforma.workspaces (workspace_id) values ($1) on conflict do nothing", [ws]);
    const caixa = await servidor();
    const fabrica = fabricaDoTeste ?? caixa.fabricaReal;
    const servico = criarServicoDeConexaoDoEmail({ pool, acesso, fabrica, chaves: () => CHAVES, ...extras });
    const admin = sessao(ws, "mem_admin");
    const canal = valor(await canais.criar(admin, { provedor: "email-imap-smtp", nome: "Vendas", identificador: ENDERECO }));
    const entrada = (senha = SENHA) => ({
      usuario: USUARIO,
      senha,
      imap: { host: "imap.caixa.teste", porta: caixa.dublê.imap.porta },
      smtp: { host: "smtp.caixa.teste", porta: caixa.dublê.smtp.porta },
    });
    return { ws, admin, membro: sessao(ws, "mem_ana"), canal, servico, caixa, entrada };
  }

  const canalNoBanco = async (ws: string, id: string) =>
    (await pool().query<{ conexao: string; conexao_simulada: boolean }>("select conexao, conexao_simulada from plataforma.canais where workspace_id = $1 and id = $2", [ws, id])).rows[0]!;

  describe("o traçador: a senha certa deixa o Canal conectado", () => {
    it("grava credencial, conta, cursor no UIDNEXT e o Canal conectada; as 3 mensagens antigas ficam para trás", async () => {
      const c = await preparar("tracador");
      const antes = await c.caixa.fabricaReal.verificarImap({
        host: "imap.caixa.teste",
        porta: c.caixa.dublê.imap.porta,
        auth: { tipo: "senha", usuario: USUARIO, senha: SENHA },
      });

      const canal = valor(await c.servico.conectarPorSenha(c.admin, c.canal.id, c.entrada()));

      expect(canal).toMatchObject({ id: c.canal.id, conexao: "conectada", conexaoSimulada: false });
      expect(await canalNoBanco(c.ws, c.canal.id)).toMatchObject({ conexao: "conectada", conexao_simulada: false });

      const guardada = await lerCredencial(pool(), CHAVES, { workspaceId: c.ws, donoTipo: "canal", donoId: c.canal.id, tipo: TIPO_DA_CREDENCIAL });
      expect(lerCredencialDoEmail(guardada)).toEqual({ v: 1, tipo: "senha", usuario: USUARIO, senha: SENHA });

      const conta = await contaDoCanal(pool(), c.ws, c.canal.id);
      expect(conta).toMatchObject({
        endereco: ENDERECO,
        tipoDeLogin: "senha",
        imap: { host: "imap.caixa.teste", porta: c.caixa.dublê.imap.porta },
        smtp: { host: "smtp.caixa.teste", porta: c.caixa.dublê.smtp.porta },
        pastaEnviados: PASTA_DE_ENVIADOS_FALSA,
        motivoDaQueda: null,
        conectadaPor: "mem_admin",
      });

      const cursor = await lerCursor(pool(), c.ws, c.canal.id, "INBOX");
      expect(cursor).toBeDefined();
      expect(cursor!.proximoUid).toBe(antes.uidNext);
      expect(cursor!.proximoUid).toBeGreaterThan(3);
      expect(cursor!.uidValidity).toBe(antes.uidValidity);
    });

    it("a Mensagem pendente do Canal antes de conectar ganha a linha mensagem.enviar.v1 no mesmo commit", async () => {
      const c = await preparar("pendente");
      const contatos = criarRepositorioDeContatosPg(pool());
      const contato = await contatos.inserir(c.ws, { nome: "Cliente", proprietarioId: "mem_admin", criadoPor: "mem_admin" });
      await contatos.inserirIdentificador(c.ws, contato.id, { tipo: "email", valor: "cliente@fora.teste", principal: true });
      const conversa = await criarRepositorioDeConversasPg(pool()).inserir(c.ws, {
        canalId: c.canal.id,
        contatoId: contato.id,
        titulo: "Cliente",
        filaId: null,
        atribuido: { tipo: "membro", id: "mem_admin" },
        participantes: [],
        criadoPor: { tipo: "member", id: "mem_admin" },
      });
      const escrita = valor(await mensagens.enviar(c.admin, { conversaId: conversa.id, direcao: "enviada", conteudo: "resposta que espera" }));
      expect(escrita.statusEntrega).toBe("pendente");
      const linhas = () =>
        pool().query("select 1 from plataforma.integration_outbox where workspace_id = $1 and aggregate_id = $2", [c.ws, escrita.id]);
      expect((await linhas()).rowCount).toBe(0);

      valor(await c.servico.conectarPorSenha(c.admin, c.canal.id, c.entrada()));

      expect((await linhas()).rowCount).toBe(1);
      const linha = await pool().query<{ status: string; event_type: string }>(
        "select status, event_type from plataforma.integration_outbox where workspace_id = $1 and aggregate_id = $2",
        [c.ws, escrita.id],
      );
      expect(linha.rows[0]).toMatchObject({ status: "pending", event_type: "mensagem.enviar.v1" });
    });
  });

  it("(canal) sem COFRE_CHAVE o serviço responde 503 e nem abre conexão", async () => {
    const c = await preparar("semcofre", {
      chaves: () => {
        throw new Error("COFRE_CHAVE ausente");
      },
    });
    const r = recusado(await c.servico.conectarPorSenha(c.admin, c.canal.id, c.entrada()));
    expect(r.status).toBe(503);
    expect(r.codigo).toBe("COFRE_NAO_CONFIGURADO");
    expect(c.caixa.dublê.conexoesImap()).toHaveLength(0);
  });
  /** Nada de uma conexão que falhou pode ter ficado: cofre, conta, cursor e o Canal como estava. */
  async function nadaGravado(c: { ws: string; canal: Canal }) {
    const cofre = await lerCredencial(pool(), CHAVES, { workspaceId: c.ws, donoTipo: "canal", donoId: c.canal.id, tipo: TIPO_DA_CREDENCIAL });
    expect(cofre).toBeUndefined();
    expect(await contaDoCanal(pool(), c.ws, c.canal.id)).toBeUndefined();
    expect(await lerCursor(pool(), c.ws, c.canal.id, "INBOX")).toBeUndefined();
    expect(await canalNoBanco(c.ws, c.canal.id)).toMatchObject({ conexao: "desconectada", conexao_simulada: false });
  }

  describe("o que recusa não grava nada", () => {
    it("senha errada: 422 do IMAP com a frase fixa, nada gravado e o SMTP nem foi tentado", async () => {
      const c = await preparar("senhaerrada");
      const r = recusado(await c.servico.conectarPorSenha(c.admin, c.canal.id, c.entrada("senha-errada-do-teste")));

      expect(r.status).toBe(422);
      expect(r.codigo).toBe("CONEXAO_RECUSADA");
      expect(r.campo).toBe("imap");
      expect(r.error.startsWith("O servidor IMAP recusou o usuário ou a senha.")).toBe(true);
      expect(r.error).not.toContain("senha-errada-do-teste");
      expect(r.error).not.toContain(SENHA);
      await nadaGravado(c);
      expect(c.caixa.dublê.conexoesSmtp()).toHaveLength(0);
    });

    it("IMAP certo e SMTP recusado: 422 do SMTP e nada gravado", async () => {
      const c = await preparar("smtprecusa");
      c.caixa.dublê.programarSmtp({ tipo: "recusarAuth" });
      const r = recusado(await c.servico.conectarPorSenha(c.admin, c.canal.id, c.entrada()));

      expect(r.status).toBe(422);
      expect(r.codigo).toBe("CONEXAO_RECUSADA");
      expect(r.campo).toBe("smtp");
      expect(r.error.startsWith("O servidor SMTP recusou o usuário ou a senha.")).toBe(true);
      expect(r.error).not.toContain(SENHA);
      await nadaGravado(c);
      // O IMAP foi aberto (e é por isso que o SMTP foi tentado): a ordem é a do plano.
      expect(c.caixa.dublê.conexoesImap().length).toBeGreaterThanOrEqual(1);
    });

    it("host que a produção resolve para 10.0.0.5: recusado antes de qualquer conexão, e a frase não diz host nem IP", async () => {
      const dublê = await iniciarServidorDeEmailFalso({ usuarios: [{ usuario: USUARIO, senha: SENHA }] });
      servidores.push(dublê);
      const resolver = vi.fn<Resolvedor>(async () => [{ address: "10.0.0.5", family: 4 }]);
      const fabricaDeProducao = criarFabricaDeConexao({ resolver, politica: POLITICA_DE_PRODUCAO, portas: PORTAS_DO_EMAIL, ca: dublê.ca });
      const c = await preparar("internoprod", {}, fabricaDeProducao);

      const r = recusado(
        await c.servico.conectarPorSenha(c.admin, c.canal.id, { usuario: USUARIO, senha: SENHA, imap: { host: "imap.interno.teste", porta: 993 }, smtp: { host: "smtp.interno.teste", porta: 465 } }),
      );

      expect(r.status).toBe(422);
      expect(r.campo).toBe("imap");
      expect(r.error).toBe("Este servidor não é permitido: use o endereço público do seu provedor de e-mail.");
      expect(r.error).not.toContain("10.0.0.5");
      expect(resolver).toHaveBeenCalledTimes(1);
      expect(dublê.conexoesImap()).toHaveLength(0);
      expect(dublê.conexoesSmtp()).toHaveLength(0);
      expect(c.caixa.dublê.conexoesImap()).toHaveLength(0);
      await nadaGravado(c);
    });

    it("porta 25 direto no serviço: recusada pela guarda antes de resolver o host", async () => {
      const resolver = vi.fn<Resolvedor>(async () => [{ address: "93.184.216.34", family: 4 }]);
      const fabricaDeProducao = criarFabricaDeConexao({ resolver, politica: POLITICA_DE_PRODUCAO, portas: PORTAS_DO_EMAIL });
      const c = await preparar("porta25", {}, fabricaDeProducao);

      const r = recusado(
        await c.servico.conectarPorSenha(c.admin, c.canal.id, { usuario: USUARIO, senha: SENHA, imap: { host: "imap.exemplo.teste", porta: 25 }, smtp: { host: "smtp.exemplo.teste", porta: 465 } }),
      );

      expect(r.status).toBe(422);
      expect(r.campo).toBe("imap");
      expect(r.error).toBe("Use a porta 993 ou 143 para o IMAP e 465 ou 587 para o SMTP.");
      expect(resolver).not.toHaveBeenCalled();
      expect(c.caixa.dublê.conexoesImap()).toHaveLength(0);
      await nadaGravado(c);
    });

    it("sem predefinição e sem servidores: 422 e nenhuma conexão", async () => {
      const c = await preparar("semservidor");
      const r = recusado(await c.servico.conectarPorSenha(c.admin, c.canal.id, { usuario: USUARIO, senha: SENHA }));
      expect(r.status).toBe(422);
      expect(r.codigo).toBe("SERVIDORES_AUSENTES");
      expect(c.caixa.dublê.conexoesImap()).toHaveLength(0);
    });

    it("Canal de WhatsApp: 409 PROVEDOR_ERRADO; Canal de outro Espaço: 404; Membro sem permissão de conectar: 403", async () => {
      const c = await preparar("recusas");
      const whats = valor(await canais.criar(c.admin, { provedor: "whatsapp-cloud", nome: "Zap", identificador: "+5511977770001" }));
      const errado = recusado(await c.servico.conectarPorSenha(c.admin, whats.id, c.entrada()));
      expect(errado.status).toBe(409);
      expect(errado.codigo).toBe("PROVEDOR_ERRADO");
      expect(errado.error).toBe("Este Canal não é de e-mail.");

      const outro = await preparar("recusas2");
      expect(recusado(await c.servico.conectarPorSenha(outro.admin, c.canal.id, c.entrada())).status).toBe(404);

      const semPermissao = recusado(await c.servico.conectarPorSenha(c.membro, c.canal.id, c.entrada()));
      expect(semPermissao.status).toBe(403);
      expect(semPermissao.codigo).toBe("PERMISSAO");
      expect(c.caixa.dublê.conexoesImap()).toHaveLength(0);
      await nadaGravado(c);
    });
  });

  describe("as predefinições são do servidor", () => {
    it.each([
      ["gmail", { imap: ["imap.gmail.com", 993], smtp: ["smtp.gmail.com", 465] }],
      ["outlook", { imap: ["outlook.office365.com", 993], smtp: ["smtp.office365.com", 587] }],
    ] as const)("%s: a fábrica recebe o host e a porta da tabela, nunca os do cliente", async (nome, esperado) => {
      const imap = vi.fn<FabricaDeConexao["verificarImap"]>(async () => ({ uidValidity: "7", uidNext: 12, pastaEnviados: "Sent" }));
      const smtp = vi.fn<FabricaDeConexao["verificarSmtp"]>(async () => undefined);
      const espiao = { verificarImap: imap, verificarSmtp: smtp } as unknown as FabricaDeConexao;
      const c = await preparar(`pre_${nome}`, {}, espiao);

      const canal = valor(
        await c.servico.conectarPorSenha(c.admin, c.canal.id, {
          usuario: USUARIO,
          senha: SENHA,
          predefinicao: nome,
          // O cliente não pode escolher o host junto com a predefinição: o do servidor vence.
          imap: { host: "imap.do-atacante.teste", porta: 143 },
          smtp: { host: "smtp.do-atacante.teste", porta: 25 },
        }),
      );

      expect(canal.conexao).toBe("conectada");
      expect(imap).toHaveBeenCalledTimes(1);
      expect(imap.mock.calls[0]![0]).toMatchObject({ host: esperado.imap[0], porta: esperado.imap[1] });
      expect(smtp.mock.calls[0]![0]).toMatchObject({ host: esperado.smtp[0], porta: esperado.smtp[1] });
      const conta = await contaDoCanal(pool(), c.ws, c.canal.id);
      expect(conta).toMatchObject({ imap: { host: esperado.imap[0], porta: esperado.imap[1] }, smtp: { host: esperado.smtp[0], porta: esperado.smtp[1] }, pastaEnviados: "Sent" });
      expect((await lerCursor(pool(), c.ws, c.canal.id, "INBOX"))).toMatchObject({ uidValidity: "7", proximoUid: 12 });
    });
  });

  describe("a ficha lê a conta", () => {
    it("sem conta: nula; com a configuração injetada, os botões que o servidor oferece", async () => {
      const c = await preparar("ficha", {
        configuracaoDoOauth: () => ({
          redirectUri: "https://crm.exemplo.test/retorno",
          google: { clientId: "g", clientSecret: "g-segredo" },
        }),
      });
      const antes = valor(await c.servico.conta(c.admin, c.canal.id));
      expect(antes).toEqual({ conta: null, servicosDisponiveis: { google: true, microsoft: false } });

      valor(await c.servico.conectarPorSenha(c.admin, c.canal.id, c.entrada()));
      const depois = valor(await c.servico.conta(c.admin, c.canal.id));
      expect(depois.conta).toMatchObject({ endereco: ENDERECO, tipoDeLogin: "senha", motivoDaQueda: null, caiuEm: null });
      expect(JSON.stringify(depois)).not.toContain(SENHA);
      expect(JSON.stringify(depois)).not.toContain("g-segredo");
    });

    it("Canal de outro provedor: 409; de outro Espaço: 404", async () => {
      const c = await preparar("ficha2");
      const whats = valor(await canais.criar(c.admin, { provedor: "whatsapp-cloud", nome: "Zap", identificador: "+5511977770002" }));
      expect(recusado(await c.servico.conta(c.admin, whats.id)).status).toBe(409);
      const outro = await preparar("ficha3");
      expect(recusado(await c.servico.conta(outro.admin, c.canal.id)).status).toBe(404);
    });
  });
});
