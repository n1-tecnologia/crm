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

import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import type { MembroDaSessao } from "../plugins/autenticacao";
import { criarWorkerDeSaida } from "../mensageria/entregar-mensagem";
import { lerCursor } from "../mensageria/provedores/email/repositorio";
import { encerrar, pool } from "../persistencia/conexao";
import { criarServicoDeMensagens } from "../servicos/crm/mensagens";
import { ate, CHAVES_DA_BANCADA, criarBancadaDeEmail, DOMINIO_DA_BANCADA, mime, valor } from "../testes/bancada-de-email";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearMembro } from "../testes/banco-crm";

describeComBanco("Fase 17 ponta a ponta: o e-mail que chega na caixa vira Conversa pelo leitor, pela fila e pelo processador", () => {
  const ws = novoEspacoDeTeste("emailentrada");
  const admin: MembroDaSessao = { id: "mem_admin", workspaceId: ws, state: "ativo" };
  const bancada = criarBancadaDeEmail({ ws, admin });
  const { cenario } = bancada;

  beforeAll(async () => {
    await prepararBancoCrm();
    await semearMembro(ws, { id: "mem_admin", base: "administrador", state: "ativo" });
    await pool().query("insert into plataforma.workspaces (workspace_id) values ($1) on conflict do nothing", [ws]);
  });

  afterEach(async () => {
    await bancada.fechar();
  });

  afterAll(async () => {
    await pool().query("delete from plataforma.integration_outbox where workspace_id = $1", [ws]);
    await pool().query("delete from plataforma.credenciais where workspace_id = $1", [ws]);
    await limparEspaco(ws);
    await encerrar();
  });

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

    const idA = `a-${c.canalId}@empresa.example`;
    const uid = await c.caixa.adicionarMensagem(
      c.endereco,
      mime({ de: `Cliente <${c.cliente}>`, para: c.endereco, assunto: "Pedido 42", messageId: idA, texto: "Preciso de um orçamento." }),
    );

    await ate("a Mensagem entrou", async () => (await mensagensDoCanal(c.canalId)).length === 1);

    const mensagens = await mensagensDoCanal(c.canalId);
    expect(mensagens[0]).toMatchObject({ direcao: "recebida", id_externo: idA, assunto: "Pedido 42" });

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

  it("EML-04: a troca de três e-mails fica numa Conversa só, e a resposta pela Caixa sai com In-Reply-To e References certos", async () => {
    const c = await cenario();
    const leitor = c.criarLeitor();
    leitor.iniciar();
    await ate("o leitor abriu a sessão do Canal", () => leitor.canaisLidos().includes(c.canalId));

    // 1. O cliente escreve (A).
    const idA = `a-${c.canalId}@empresa.example`;
    await c.caixa.adicionarMensagem(c.endereco, mime({ de: `Cliente <${c.cliente}>`, para: c.endereco, assunto: "Pedido 42", messageId: idA, texto: "Preciso de um orçamento." }));
    await ate("A entrou", async () => (await mensagensDoCanal(c.canalId)).length === 1);
    const conversaId = (await mensagensDoCanal(c.canalId))[0]!.conversa_id;

    // 2. A resposta escrita na Caixa (B) sai pelo outbox, no mesmo fio.
    const servico = criarServicoDeMensagens({ pool, acesso: bancada.acessoAoCrm });
    const resposta = valor(await servico.enviar(admin, { conversaId, direcao: "enviada", conteudo: "Segue o orçamento." }));
    const worker = criarWorkerDeSaida({
      workerId: `teste-email-entrada-saida-${c.canalId}`,
      workspaceId: ws,
      chaves: CHAVES_DA_BANCADA,
      registro: c.registro,
      armazenamento: c.armazenamento,
    });
    expect(await worker.processarUm()).toBe(true);
    expect(c.caixa.entregues).toHaveLength(1);
    const enviado = c.caixa.entregues[0]!.dados.toString("utf8");
    const idB = `n1.${resposta.id}@${DOMINIO_DA_BANCADA}`;
    expect(enviado).toMatch(new RegExp(`^Message-ID: <${idB.replace(/\./g, "\\.")}>\\r?$`, "m"));
    expect(enviado).toMatch(new RegExp(`^In-Reply-To: <${idA.replace(/\./g, "\\.")}>\\r?$`, "m"));
    expect(enviado).toMatch(new RegExp(`^References: <${idA.replace(/\./g, "\\.")}>\\r?$`, "m"));

    // 3. O cliente responde à resposta (C), com o fio que o e-mail dele carrega.
    const idC = `c-${c.canalId}@empresa.example`;
    await c.caixa.adicionarMensagem(
      c.endereco,
      mime({ de: `Cliente <${c.cliente}>`, para: c.endereco, assunto: "Re: Re: Pedido 42", messageId: idC, inReplyTo: idB, references: `<${idA}> <${idB}>`, texto: "Fechado, pode mandar." }),
    );
    await ate("C entrou", async () => (await mensagensDoCanal(c.canalId)).some((m) => m.id_externo === idC));

    const todas = await mensagensDoCanal(c.canalId);
    expect(todas).toHaveLength(3);
    // Uma Conversa só, com as três Mensagens.
    expect(new Set(todas.map((m) => m.conversa_id)).size).toBe(1);
    expect(todas.map((m) => m.id_externo).sort()).toEqual([idA, idB, idC].sort());
    // C responde a B (a Mensagem que a Caixa mandou).
    expect(todas.find((m) => m.id_externo === idC)).toMatchObject({ direcao: "recebida", em_resposta_a_id: resposta.id });
    const conversas = (await pool().query("select id from plataforma.conversas where workspace_id = $1 and canal_id = $2", [ws, c.canalId])).rows;
    expect(conversas).toHaveLength(1);
  }, 30_000);
});
