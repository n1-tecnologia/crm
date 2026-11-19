/**
 * A saída do e-mail, ponta a ponta (Fase 17, 17-09, EML-05, D-17-16), contra o Postgres LOCAL e os dublês de IMAP e SMTP:
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55751/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55751/postgres npx vitest run src/e2e/email-saida.test.ts
 *
 * Um Canal de e-mail REAL (não simulado), conectado por senha, com a conta e a credencial no cofre. A resposta escrita na Caixa
 * entra no outbox como `mensagem.enviar.v1`; o worker de saída a entrega pelo provedor `email-imap-smtp` até o SMTP do dublê, no
 * mesmo fio (Subject, Message-ID, In-Reply-To e References), e a Mensagem fica `enviada` com o `Message-ID` em `id_externo`. Sem
 * ajuda do provedor de teste: o registro só tem o de e-mail.
 */

import { randomBytes } from "node:crypto";
import { simpleParser } from "mailparser";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import type { MembroDaSessao } from "../plugins/autenticacao";
import { criarWorkerDeSaida } from "../mensageria/entregar-mensagem";
import { criarAcessoDoEmail, guardarCredencialDoEmail } from "../mensageria/provedores/email/credencial";
import { criarFabricaDeConexao } from "../mensageria/provedores/email/fabrica-de-conexao";
import { criarProvedorDeEmail } from "../mensageria/provedores/email/provedor";
import { criarPoliticaDeRede, type Resolvedor } from "../mensageria/provedores/email/rede";
import { gravarConta } from "../mensageria/provedores/email/repositorio";
import { provedorDeTeste } from "../mensageria/provedores/teste";
import { encerrar, pool } from "../persistencia/conexao";
import { criarRepositorioDeContatosPg } from "../repositorios/crm/contatos";
import { criarRepositorioDeConversasPg } from "../repositorios/crm/conversas";
import { criarRepositorioDeMensagensPg } from "../repositorios/crm/mensagens";
import type { ChavesDoCofre } from "../servicos/cofre";
import { criarAcessoAoCrmPg } from "../servicos/crm/acesso";
import { criarServicoDeMensagens } from "../servicos/crm/mensagens";
import { criarArmazenamentoFalso } from "../testes/armazenamento-falso";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal, semearMembro } from "../testes/banco-crm";
import { iniciarServidorDeEmailFalso, PASTA_DE_ENVIADOS_FALSA, type ServidorDeEmailFalso } from "../testes/servidor-de-email-falso";

const chaves: ChavesDoCofre = { atual: { versao: 1, chave: randomBytes(32) } };
const SENHA = "senha-do-e2e-17-09";

describeComBanco("Fase 17 ponta a ponta: a resposta escrita na Caixa sai pelo SMTP da caixa, no mesmo fio", () => {
  const ws = novoEspacoDeTeste("emailsaida");
  const membro: MembroDaSessao = { id: "mem_ana", workspaceId: ws, state: "ativo" };
  const servico = criarServicoDeMensagens({ pool, acesso: criarAcessoAoCrmPg(pool) });
  let caixa: ServidorDeEmailFalso;
  let canalId: string;
  let sequencia = 0;
  /** Um endereço por caso: o Canal ativo tem nome e identificador únicos no Espaço. */
  let ENDERECO_DO_CANAL = "";
  let CLIENTE = "";
  const DOMINIO_DO_CANAL = "caixa.teste";
  let conversaId: string;

  const armazenamento = criarArmazenamentoFalso();
  const registroDeEmail = () => {
    const fabrica = criarFabricaDeConexao({
      resolver: vi.fn<Resolvedor>(async () => [{ address: "127.0.0.1", family: 4 }]),
      politica: criarPoliticaDeRede({ permitir: ["127.0.0.1"] }),
      portas: { imap: { [caixa.imap.porta]: "tls" }, smtp: { [caixa.smtp.porta]: "tls" } },
      ca: caixa.ca,
    });
    const provedor = criarProvedorDeEmail({ fabrica, acesso: criarAcessoDoEmail({ pool, chaves: () => chaves }), armazenamento, pool });
    return { teste: provedorDeTeste, porProvedor: { "email-imap-smtp": provedor } } as const;
  };
  const worker = () => criarWorkerDeSaida({ workerId: "teste-email-saida", workspaceId: ws, chaves, registro: registroDeEmail(), armazenamento });

  const mensagem = async (id: string) =>
    (
      await pool().query<{ status_entrega: string; id_externo: string | null; motivo_falha: string | null }>(
        "select status_entrega, id_externo, motivo_falha from plataforma.mensagens where workspace_id = $1 and id = $2",
        [ws, id],
      )
    ).rows[0]!;

  beforeAll(async () => {
    await prepararBancoCrm();
    await semearMembro(ws, { id: "mem_ana", base: "membro", state: "ativo" });
    await pool().query("insert into plataforma.workspaces (workspace_id) values ($1) on conflict do nothing", [ws]);
  });

  beforeEach(async () => {
    sequencia += 1;
    ENDERECO_DO_CANAL = `vendas${sequencia}@${DOMINIO_DO_CANAL}`;
    CLIENTE = `cliente${sequencia}@empresa.com`;
    caixa = await iniciarServidorDeEmailFalso({ usuarios: [{ usuario: ENDERECO_DO_CANAL, senha: SENHA }] });
    canalId = await semearCanal(ws, {
      nome: `Vendas ${sequencia}`,
      tipo: "email",
      provedor: "email-imap-smtp",
      identificadorExterno: ENDERECO_DO_CANAL,
      conexao: "conectada",
      conexaoSimulada: false,
      configuradoPor: "mem_ana",
    });
    await gravarConta(pool(), {
      workspaceId: ws,
      canalId,
      endereco: ENDERECO_DO_CANAL,
      tipoDeLogin: "senha",
      imap: { host: "imap.caixa.teste", porta: caixa.imap.porta },
      smtp: { host: "smtp.caixa.teste", porta: caixa.smtp.porta },
      appendEnviados: "nao",
      pastaEnviados: PASTA_DE_ENVIADOS_FALSA,
      conectadaPor: "mem_ana",
    });
    await guardarCredencialDoEmail(pool(), chaves, { workspaceId: ws, canalId }, { v: 1, tipo: "senha", usuario: ENDERECO_DO_CANAL, senha: SENHA });

    const contatos = criarRepositorioDeContatosPg(pool());
    const contato = await contatos.inserir(ws, { nome: "Cliente", proprietarioId: "mem_ana", criadoPor: "mem_ana" });
    const identificador = await contatos.inserirIdentificador(ws, contato.id, { tipo: "email", valor: CLIENTE, principal: true });
    const conversa = await criarRepositorioDeConversasPg(pool()).inserir(ws, {
      canalId,
      contatoId: contato.id,
      titulo: "Cliente",
      filaId: null,
      atribuido: { tipo: "membro", id: "mem_ana" },
      participantes: [],
      criadoPor: { tipo: "member", id: "mem_ana" },
    });
    conversaId = conversa.id;
    await criarRepositorioDeMensagensPg(pool()).inserirRecebida(ws, {
      conversaId,
      canalId,
      idExterno: "a@x",
      criadoEm: new Date().toISOString(),
      conteudo: "Preciso de um orçamento.",
      anexos: [],
      assunto: "Pedido 42",
      enderecosAdicionais: [],
      remetenteExterno: CLIENTE,
      identificadorId: identificador.id,
      cargaBruta: null,
    });
  });

  afterEach(async () => {
    await caixa.fechar();
  });

  afterAll(async () => {
    await pool().query("delete from plataforma.integration_outbox where workspace_id = $1", [ws]);
    await pool().query("delete from plataforma.credenciais where workspace_id = $1", [ws]);
    await limparEspaco(ws);
    await encerrar();
  });

  async function escrever(conteudo: string) {
    const resposta = await servico.enviar(membro, { conversaId, direcao: "enviada", conteudo });
    if (!resposta.ok) throw new Error(`esperava sucesso, veio ${resposta.status}: ${resposta.error}`);
    return resposta.valor;
  }

  it("a resposta sem assunto sai pelo worker até o SMTP, no mesmo fio, e a Mensagem fica enviada com o Message-ID", async () => {
    const criada = await escrever("Segue o orçamento.");
    expect(criada.statusEntrega).toBe("pendente");

    expect(await worker().processarUm()).toBe(true);

    expect(caixa.entregues).toHaveLength(1);
    const entrega = caixa.entregues[0]!;
    expect(entrega.envelope).toEqual({ de: ENDERECO_DO_CANAL, para: [CLIENTE] });
    expect(entrega.usuario).toBe(ENDERECO_DO_CANAL);

    const idEsperado = `n1.${criada.id}@${DOMINIO_DO_CANAL}`;
    const texto = entrega.dados.toString("utf8");
    expect(texto).toMatch(/^Subject: Re: Pedido 42\r?$/m);
    expect(texto).toMatch(new RegExp(`^Message-ID: <${idEsperado.replace(/\./g, "\\.")}>\\r?$`, "m"));
    expect(texto).toMatch(/^In-Reply-To: <a@x>\r?$/m);
    expect(texto).toMatch(/^References: <a@x>\r?$/m);
    expect(texto).toContain(`From: ${ENDERECO_DO_CANAL}`);

    const lido = await simpleParser(entrega.dados);
    expect(lido.text?.trim()).toBe("Segue o orçamento.");
    expect(lido.html).toContain("Segue o orçamento.");
    expect(lido.messageId).toBe(`<${idEsperado}>`);

    expect(await mensagem(criada.id)).toMatchObject({ status_entrega: "enviada", id_externo: idEsperado });
  });

  it("o provedor de teste nunca é usado: o Canal é real", async () => {
    provedorDeTeste.limpar();
    await escrever("Olá.");
    await worker().processarUm();
    expect(provedorDeTeste.enviados).toHaveLength(0);
    expect(caixa.entregues).toHaveLength(1);
  });

  it("o id_externo já está gravado quando o servidor responde de forma ambígua, e nada é reenviado sozinho", async () => {
    const criada = await escrever("Pode ter saído.");
    caixa.programarSmtp({ tipo: "mudoNoData" });
    const w = criarWorkerDeSaida({
      workerId: "teste-email-saida-ambiguo",
      workspaceId: ws,
      chaves,
      armazenamento,
      registro: {
        teste: provedorDeTeste,
        porProvedor: {
          "email-imap-smtp": criarProvedorDeEmail({
            fabrica: criarFabricaDeConexao({
              resolver: async () => [{ address: "127.0.0.1", family: 4 }],
              politica: criarPoliticaDeRede({ permitir: ["127.0.0.1"] }),
              portas: { imap: { [caixa.imap.porta]: "tls" }, smtp: { [caixa.smtp.porta]: "tls" } },
              ca: caixa.ca,
              tempos: { envio: { conectarMs: 5_000, saudacaoMs: 5_000, socketMs: 1_500 } },
            }),
            acesso: criarAcessoDoEmail({ pool, chaves: () => chaves }),
            armazenamento,
            pool,
          }),
        },
      },
    });

    expect(await w.processarUm()).toBe(true);

    expect(await mensagem(criada.id)).toMatchObject({
      status_entrega: "falhou",
      id_externo: `n1.${criada.id}@${DOMINIO_DO_CANAL}`,
      motivo_falha: "Sem confirmação do servidor de e-mail: confira em Enviados antes de tentar de novo.",
    });
    expect(caixa.entregues).toHaveLength(1);
    await pool().query("update plataforma.integration_outbox set available_at = now() where workspace_id = $1 and aggregate_id = $2", [ws, criada.id]);
    expect(await w.processarUm()).toBe(false);
    expect(caixa.entregues).toHaveLength(1);
  }, 20_000);
});
