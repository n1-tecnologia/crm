/**
 * A entrada do e-mail, ponta a ponta (Fase 17, 17-10, EML-03, EML-04, D-17-08, D-17-09), contra o Postgres LOCAL e os dublês de
 * IMAP e SMTP:
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55757/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55757/postgres npx vitest run src/e2e/email-entrada.test.ts
 *
 * Um Canal de e-mail REAL conectado por senha (`conectarPorSenha`, que grava o cursor no `UIDNEXT`). O leitor abre a sessão IMAP
 * no dublê, o e-mail novo vira linha da fila (`webhooks_recebidos`) e o processador de entrada da Fase 16, acordado pelo leitor,
 * cria Contato, Conversa e Mensagem. Sem ajuda do provedor de teste: o registro só tem o de e-mail.
 */

import { randomBytes } from "node:crypto";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import type { MembroDaSessao } from "../plugins/autenticacao";
import { criarProcessadorDeEntrada } from "../mensageria/processador-de-entrada";
import { criarAcessoDoEmail } from "../mensageria/provedores/email/credencial";
import { criarServicoDeConexaoDoEmail } from "../mensageria/provedores/email/conexao";
import { criarFabricaDeConexao } from "../mensageria/provedores/email/fabrica-de-conexao";
import { criarLeitorDeEmail, type LeitorDeEmail } from "../mensageria/provedores/email/leitor";
import { criarProvedorDeEmail } from "../mensageria/provedores/email/provedor";
import { criarPoliticaDeRede, type Resolvedor } from "../mensageria/provedores/email/rede";
import { lerCursor } from "../mensageria/provedores/email/repositorio";
import { provedorDeTeste } from "../mensageria/provedores/teste";
import { encerrar, pool } from "../persistencia/conexao";
import type { ChavesDoCofre } from "../servicos/cofre";
import { criarAcessoAoCrmPg } from "../servicos/crm/acesso";
import { criarServicoDeCanais } from "../servicos/crm/canais";
import type { ResultadoCrm } from "../servicos/crm/resultado";
import { criarArmazenamentoFalso } from "../testes/armazenamento-falso";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearMembro } from "../testes/banco-crm";
import { iniciarServidorDeEmailFalso, type ServidorDeEmailFalso } from "../testes/servidor-de-email-falso";

const chaves: ChavesDoCofre = { atual: { versao: 1, chave: randomBytes(32) } };
const SENHA = "senha-do-e2e-17-10";
const DOMINIO_DO_CANAL = "caixa.teste";

function valor<T>(resultado: ResultadoCrm<T>): T {
  if (!resultado.ok) throw new Error(`esperava sucesso, veio ${resultado.status} ${resultado.codigo ?? ""}: ${resultado.error}`);
  return resultado.valor;
}

/** Espera até `condicao` devolver verdadeiro (ou lança com o rótulo), olhando de 50 em 50 ms. */
async function ate(rotulo: string, condicao: () => Promise<boolean> | boolean, limiteMs = 10_000): Promise<void> {
  const limite = Date.now() + limiteMs;
  while (Date.now() < limite) {
    if (await condicao()) return;
    await new Promise((resolver) => setTimeout(resolver, 50));
  }
  throw new Error(`não aconteceu a tempo: ${rotulo}`);
}

interface CabecalhosDoEmail {
  readonly de: string;
  readonly para: string;
  readonly assunto: string;
  readonly messageId: string;
  readonly inReplyTo?: string;
  readonly references?: string;
  readonly texto: string;
}

function mime(e: CabecalhosDoEmail): string {
  return [
    `From: ${e.de}`,
    `To: ${e.para}`,
    `Subject: ${e.assunto}`,
    `Message-ID: <${e.messageId}>`,
    ...(e.inReplyTo ? [`In-Reply-To: <${e.inReplyTo}>`] : []),
    ...(e.references ? [`References: ${e.references}`] : []),
    "Date: Thu, 19 Nov 2026 10:00:00 +0000",
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    e.texto,
    "",
  ].join("\r\n");
}

describeComBanco("Fase 17 ponta a ponta: o e-mail que chega na caixa vira Conversa pelo leitor, pela fila e pelo processador", () => {
  const ws = novoEspacoDeTeste("emailentrada");
  const admin: MembroDaSessao = { id: "mem_admin", workspaceId: ws, state: "ativo" };
  const acessoAoCrm = criarAcessoAoCrmPg(pool);
  const canais = criarServicoDeCanais({ pool, acesso: acessoAoCrm });
  const armazenamento = criarArmazenamentoFalso();

  const abertos: Array<{ caixa: ServidorDeEmailFalso; leitor?: LeitorDeEmail }> = [];
  let sequencia = 0;

  beforeAll(async () => {
    await prepararBancoCrm();
    await semearMembro(ws, { id: "mem_admin", base: "administrador", state: "ativo" });
    await pool().query("insert into plataforma.workspaces (workspace_id) values ($1) on conflict do nothing", [ws]);
  });

  afterEach(async () => {
    while (abertos.length > 0) {
      const aberto = abertos.pop()!;
      await aberto.leitor?.parar();
      await aberto.caixa.fechar();
    }
  });

  afterAll(async () => {
    await pool().query("delete from plataforma.integration_outbox where workspace_id = $1", [ws]);
    await pool().query("delete from plataforma.credenciais where workspace_id = $1", [ws]);
    await limparEspaco(ws);
    await encerrar();
  });

  /** Uma caixa nova no dublê e o Canal conectado a ela por senha (cursor no `UIDNEXT`). */
  async function cenario() {
    sequencia += 1;
    const endereco = `vendas${sequencia}@${DOMINIO_DO_CANAL}`;
    const cliente = `cliente${sequencia}@empresa.com`;
    const caixa = await iniciarServidorDeEmailFalso({ usuarios: [{ usuario: endereco, senha: SENHA }] });
    const aberto: { caixa: ServidorDeEmailFalso; leitor?: LeitorDeEmail } = { caixa };
    abertos.push(aberto);
    const resolver = vi.fn<Resolvedor>(async () => [{ address: "127.0.0.1", family: 4 }]);
    const fabrica = criarFabricaDeConexao({
      resolver,
      politica: criarPoliticaDeRede({ permitir: ["127.0.0.1"] }),
      portas: { imap: { [caixa.imap.porta]: "tls" }, smtp: { [caixa.smtp.porta]: "tls" } },
      ca: caixa.ca,
    });
    const acesso = criarAcessoDoEmail({ pool, chaves: () => chaves });
    const provedor = criarProvedorDeEmail({ fabrica, acesso, armazenamento, pool });
    const registro = { teste: provedorDeTeste, porProvedor: { "email-imap-smtp": provedor } } as const;
    const processador = criarProcessadorDeEntrada({ workerId: `teste-email-entrada-${sequencia}`, chaves, registro, armazenamento });

    const canal = valor(await canais.criar(admin, { provedor: "email-imap-smtp", nome: `Vendas ${sequencia}`, identificador: endereco }));
    const conexao = criarServicoDeConexaoDoEmail({ pool, acesso: acessoAoCrm, fabrica, chaves: () => chaves });
    valor(
      await conexao.conectarPorSenha(admin, canal.id, {
        usuario: endereco,
        senha: SENHA,
        imap: { host: "imap.caixa.teste", porta: caixa.imap.porta },
        smtp: { host: "smtp.caixa.teste", porta: caixa.smtp.porta },
      }),
    );

    const criarLeitor = (extras: Parameters<typeof criarLeitorDeEmail>[0] = {}): LeitorDeEmail => {
      const leitor = criarLeitorDeEmail({
        url: process.env.DATABASE_URL!,
        pool,
        fabrica,
        acesso,
        armazenamento,
        chaves,
        aoEnfileirar: () => processador.acordar(),
        intervaloDoSupervisorMs: 200,
        intervaloDeConferenciaMs: 1_000,
        esperaInicialMs: 50,
        ...extras,
      });
      aberto.leitor = leitor;
      return leitor;
    };

    return { ws, canalId: canal.id, endereco, cliente, caixa, fabrica, resolver, acesso, processador, registro, criarLeitor };
  }

  const mensagensDoCanal = async (canalId: string) =>
    (
      await pool().query<{ id: string; direcao: string; id_externo: string | null; conversa_id: string; em_resposta_a_id: string | null; assunto: string | null }>(
        `select id, direcao, id_externo, conversa_id, em_resposta_a_id, assunto from plataforma.mensagens
          where workspace_id = $1 and canal_id = $2 order by criado_em, id`,
        [ws, canalId],
      )
    ).rows;

  const fila = async (canalId: string) =>
    (
      await pool().query<{ estado: string; chave: string }>(
        "select estado, chave from plataforma.webhooks_recebidos where workspace_id = $1 and canal_id = $2 order by recebido_em, id",
        [ws, canalId],
      )
    ).rows;

  it("traçador: um e-mail novo na caixa vira Mensagem recebida numa Conversa do Contato, o cursor avança e a fila fica processada", async () => {
    const c = await cenario();
    const leitor = c.criarLeitor();
    leitor.iniciar();
    await ate("o leitor abriu a sessão do Canal", () => leitor.canaisLidos().includes(c.canalId));

    const uid = await c.caixa.adicionarMensagem(
      c.endereco,
      mime({ de: `Cliente <${c.cliente}>`, para: c.endereco, assunto: "Pedido 42", messageId: `a-${sequencia}@empresa.example`, texto: "Preciso de um orçamento." }),
    );

    await ate("a Mensagem entrou", async () => (await mensagensDoCanal(c.canalId)).length === 1);

    const mensagens = await mensagensDoCanal(c.canalId);
    expect(mensagens[0]).toMatchObject({ direcao: "recebida", id_externo: `a-${sequencia}@empresa.example`, assunto: "Pedido 42" });

    // A Conversa é do Contato `cliente@empresa.com`.
    const dono = (
      await pool().query<{ valor: string }>(
        `select i.valor
           from plataforma.conversas v
           join plataforma.contato_identificadores i on i.workspace_id = v.workspace_id and i.contato_id = v.contato_id
          where v.workspace_id = $1 and v.id = $2`,
        [ws, mensagens[0]!.conversa_id],
      )
    ).rows;
    expect(dono).toEqual([{ valor: c.cliente }]);

    expect(await lerCursor(pool(), ws, c.canalId, "INBOX")).toMatchObject({ proximoUid: uid + 1 });
    await ate("a linha da fila ficou processada", async () => (await fila(c.canalId)).every((linha) => linha.estado === "processado"));
    expect(await fila(c.canalId)).toHaveLength(1);

    await leitor.parar();
    expect(leitor.canaisLidos()).toEqual([]);
    // O dublê não tem mais nenhuma conexão IMAP aberta depois do `parar`.
    await ate("as conexões IMAP fecharam", () => c.caixa.conexoesAbertas().imap === 0, 3_000);
  });
});
