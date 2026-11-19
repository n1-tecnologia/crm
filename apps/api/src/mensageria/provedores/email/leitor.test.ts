/**
 * O leitor da caixa de e-mail (Fase 17, 17-10, EML-03, EML-07, D-17-08, D-17-09, D-17-20) contra o Postgres LOCAL e os dublês de
 * IMAP e SMTP de 17-02:
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55757/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55757/postgres \
 *   npx vitest run src/mensageria/provedores/email/leitor.test.ts
 *
 * Prova, com servidor de verdade e sem mock do cliente: o que já estava na caixa antes de conectar não entra; reiniciar o leitor
 * não repete; a última mensagem abaixo do cursor não vira linha; UIDVALIDITY novo recomeça sem reimportar; sem IDLE a conferência
 * pega; só um processo lê cada Canal e o outro assume quando o primeiro para; a rede cai e a sessão volta passando pela guarda
 * de novo, com espera crescente; o anexo que o bucket não aceitou segura o cursor; a senha trocada derruba o Canal e para a
 * sessão sem laço; o leitor só liga com o processador (`deveIniciarOLeitorDeEmail`); e o log nunca leva endereço, assunto,
 * corpo nem senha.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ImapFlow } from "imapflow";
import type { MembroDaSessao } from "../../../plugins/autenticacao";
import { encerrar, pool } from "../../../persistencia/conexao";
import { ate, CHAVES_DA_BANCADA, criarBancadaDeEmail, dormir, mime, SENHA_DA_BANCADA } from "../../../testes/bancada-de-email";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearMembro } from "../../../testes/banco-crm";
import { criarFabricaDeConexao } from "./fabrica-de-conexao";
import { criarPoliticaDeRede } from "./rede";
import { guardarCredencialDoEmail, type AcessoDoEmail, criarAcessoDoEmail } from "./credencial";
import { deveIniciarOLeitorDeEmail, FRASE_DA_SENHA_RECUSADA_NA_LEITURA } from "./leitor";
import { lerCursor } from "./repositorio";

describe("deveIniciarOLeitorDeEmail (Pitfall 8, F6)", () => {
  it("com as duas variáveis liga", () => {
    expect(deveIniciarOLeitorDeEmail({ EMAIL_LEITOR_ATIVO: "true", MENSAGERIA_WORKER_ATIVO: "true" })).toEqual({ iniciar: true });
  });

  it("sem MENSAGERIA_WORKER_ATIVO não liga e o motivo cita as duas variáveis", () => {
    const decisao = deveIniciarOLeitorDeEmail({ EMAIL_LEITOR_ATIVO: "true" });
    expect(decisao.iniciar).toBe(false);
    expect(decisao.motivo).toContain("EMAIL_LEITOR_ATIVO");
    expect(decisao.motivo).toContain("MENSAGERIA_WORKER_ATIVO");
    expect(deveIniciarOLeitorDeEmail({ EMAIL_LEITOR_ATIVO: "true", MENSAGERIA_WORKER_ATIVO: "false" }).iniciar).toBe(false);
  });

  it("sem EMAIL_LEITOR_ATIVO não liga, e sem motivo (é o padrão da produção)", () => {
    expect(deveIniciarOLeitorDeEmail({})).toEqual({ iniciar: false });
    expect(deveIniciarOLeitorDeEmail({ MENSAGERIA_WORKER_ATIVO: "true" })).toEqual({ iniciar: false });
    expect(deveIniciarOLeitorDeEmail({ EMAIL_LEITOR_ATIVO: "false", MENSAGERIA_WORKER_ATIVO: "true" })).toEqual({ iniciar: false });
  });
});

describeComBanco("o leitor de e-mail — Postgres local e dublês de IMAP e SMTP", () => {
  const ws = novoEspacoDeTeste("leitoremail");
  const admin: MembroDaSessao = { id: "mem_admin", workspaceId: ws, state: "ativo" };
  const bancada = criarBancadaDeEmail({ ws, admin });
  const { cenario } = bancada;

  beforeAll(async () => {
    await prepararBancoCrm();
    await semearMembro(ws, { id: "mem_admin", base: "administrador", state: "ativo" });
    await pool().query("insert into plataforma.workspaces (workspace_id) values ($1) on conflict do nothing", [ws]);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await bancada.fechar();
  });

  afterAll(async () => {
    await pool().query("delete from plataforma.integration_outbox where workspace_id = $1", [ws]);
    await pool().query("delete from plataforma.credenciais where workspace_id = $1", [ws]);
    await limparEspaco(ws);
    await encerrar();
  });

  const fila = async (canalId: string) =>
    (
      await pool().query<{ estado: string; chave: string; corpo: { ignorado?: string; anexos?: Array<{ baixado?: boolean }>; messageId?: string } }>(
        "select estado, chave, corpo from plataforma.webhooks_recebidos where workspace_id = $1 and canal_id = $2 order by recebido_em, id",
        [ws, canalId],
      )
    ).rows;

  const mensagens = async (canalId: string) =>
    (await pool().query<{ id_externo: string }>("select id_externo from plataforma.mensagens where workspace_id = $1 and canal_id = $2", [ws, canalId])).rows;

  const canalNoBanco = async (canalId: string) =>
    (
      await pool().query<{ conexao: string; motivo_da_queda: string | null }>(
        `select k.conexao, c.motivo_da_queda from plataforma.canais k
           join plataforma.email_contas c on c.workspace_id = k.workspace_id and c.canal_id = k.id
          where k.workspace_id = $1 and k.id = $2`,
        [ws, canalId],
      )
    ).rows[0]!;

  type Cenario = Awaited<ReturnType<typeof cenario>>;
  const novoEmail = (c: Cenario, id: string, extras: { assunto?: string; texto?: string } = {}) =>
    mime({ de: `Cliente <${c.cliente}>`, para: c.endereco, assunto: extras.assunto ?? `Assunto ${id}`, messageId: `${id}@empresa.example`, texto: extras.texto ?? `Texto ${id}.` });

  const conexoesDoLeitorNoBanco = async (nome: string) =>
    Number(
      (await pool().query<{ n: string }>("select count(*)::text as n from pg_stat_activity where application_name = $1", [nome])).rows[0]!.n,
    );

  describe("o que entra e o que não entra", () => {
    it("o histórico da caixa não entra; o e-mail de depois da conexão entra, uma vez só", async () => {
      const c = await cenario({ antigas: 3 });
      const leitor = c.criarLeitor();
      leitor.iniciar();
      await ate("sessão aberta", () => leitor.canaisLidos().includes(c.canalId));
      await c.caixa.adicionarMensagem(c.endereco, novoEmail(c, "quarto"));
      await ate("o quarto entrou", async () => (await fila(c.canalId)).length === 1);
      await dormir(600);

      const linhas = await fila(c.canalId);
      expect(linhas).toHaveLength(1);
      expect(linhas[0]!.chave).toBe(`quarto@empresa.example`);
      expect((await lerCursor(pool(), ws, c.canalId, "INBOX"))!.proximoUid).toBe(5);
    });

    it("parar e iniciar de novo com a mesma caixa não repete linha da fila nem Mensagem", async () => {
      const c = await cenario();
      const primeiro = c.criarLeitor();
      primeiro.iniciar();
      await ate("sessão aberta", () => primeiro.canaisLidos().includes(c.canalId));
      await c.caixa.adicionarMensagem(c.endereco, novoEmail(c, "um"));
      await c.caixa.adicionarMensagem(c.endereco, novoEmail(c, "dois"));
      await ate("os dois entraram", async () => (await mensagens(c.canalId)).length === 2);
      await primeiro.parar();

      const cursorAntes = await lerCursor(pool(), ws, c.canalId, "INBOX");
      const segundo = c.criarLeitor();
      segundo.iniciar();
      await ate("segunda sessão aberta", () => segundo.canaisLidos().includes(c.canalId));
      await dormir(1_500);

      // Conta as linhas, não confia só no `on conflict`: nenhuma linha nova foi sequer tentada.
      expect(await fila(c.canalId)).toHaveLength(2);
      expect(await mensagens(c.canalId)).toHaveLength(2);
      expect(await lerCursor(pool(), ws, c.canalId, "INBOX")).toEqual(cursorAntes);

      await c.caixa.adicionarMensagem(c.endereco, novoEmail(c, "tres"));
      await ate("o terceiro entrou", async () => (await mensagens(c.canalId)).length === 3);
      expect(await fila(c.canalId)).toHaveLength(3);
    });

    it("sem mensagem nova depois do cursor, a leitura que devolve a última mensagem (abaixo do cursor) não insere nada", async () => {
      const c = await cenario({ antigas: 2 });
      const leitor = c.criarLeitor({ intervaloDeConferenciaMs: 200 });
      leitor.iniciar();
      await ate("sessão aberta", () => leitor.canaisLidos().includes(c.canalId));
      // Várias conferências: cada uma lê `3:*`, que o IMAP responde com a mensagem 2 (a última), abaixo do cursor.
      await dormir(1_500);

      expect(await fila(c.canalId)).toHaveLength(0);
      expect((await lerCursor(pool(), ws, c.canalId, "INBOX"))!.proximoUid).toBe(3);
    });

    it("o e-mail acima do teto não é baixado e entra como ignorado", async () => {
      const c = await cenario();
      const baixar = vi.spyOn(ImapFlow.prototype, "fetchOne");
      const leitor = c.criarLeitor();
      leitor.iniciar();
      await ate("sessão aberta", () => leitor.canaisLidos().includes(c.canalId));
      // 51 MiB de texto: acima dos 50 MiB, sem anexo.
      const linha = `${"x".repeat(78)}\r\n`;
      await c.caixa.adicionarMensagem(c.endereco, novoEmail(c, "enorme", { texto: linha.repeat(Math.ceil((51 * 1024 * 1024) / linha.length)) }));
      await ate("a linha entrou", async () => (await fila(c.canalId)).length === 1, 20_000);

      const [linhaDaFila] = await fila(c.canalId);
      expect(linhaDaFila!.corpo.ignorado).toBe("grande_demais");
      expect(linhaDaFila!.chave.startsWith("sem-id:")).toBe(true);
      expect(baixar).not.toHaveBeenCalled();
    }, 40_000);
  });

  describe("UIDVALIDITY", () => {
    it("caixa recriada antes de ler: o cursor recomeça do UIDNEXT novo, as duas mensagens não entram e o fato é registrado", async () => {
      const c = await cenario();
      const antes = (await lerCursor(pool(), ws, c.canalId, "INBOX"))!;
      await c.caixa.adicionarMensagem(c.endereco, novoEmail(c, "ja-1"));
      await c.caixa.adicionarMensagem(c.endereco, novoEmail(c, "ja-2"));
      await c.caixa.recriarCaixa(c.endereco);

      const leitor = c.criarLeitor();
      leitor.iniciar();
      await ate("o fato foi registrado", () => c.registros.some((r) => r.mensagem.includes("uidvalidity mudou")));

      const registro = c.registros.find((r) => r.mensagem.includes("uidvalidity mudou"))!;
      expect(registro.dados).toEqual({ canalId: c.canalId });
      const depois = (await lerCursor(pool(), ws, c.canalId, "INBOX"))!;
      expect(depois.uidValidity).not.toBe(antes.uidValidity);
      expect(depois.proximoUid).toBe(3);
      await dormir(600);
      expect(await fila(c.canalId)).toHaveLength(0);

      // Depois do recomeço, o que chega entra.
      await c.caixa.adicionarMensagem(c.endereco, novoEmail(c, "novo"));
      await ate("o e-mail novo entrou", async () => (await fila(c.canalId)).length === 1);
    });

    it("caixa recriada com o leitor rodando: a sessão cai, volta e não reimporta o que já estava lá", async () => {
      const c = await cenario();
      const leitor = c.criarLeitor();
      leitor.iniciar();
      await ate("sessão aberta", () => leitor.canaisLidos().includes(c.canalId));
      await c.caixa.adicionarMensagem(c.endereco, novoEmail(c, "primeiro"));
      await ate("o primeiro entrou", async () => (await fila(c.canalId)).length === 1);
      const antes = (await lerCursor(pool(), ws, c.canalId, "INBOX"))!;

      await c.caixa.recriarCaixa(c.endereco);
      await ate("o cursor trocou de UIDVALIDITY", async () => (await lerCursor(pool(), ws, c.canalId, "INBOX"))!.uidValidity !== antes.uidValidity);
      await dormir(600);

      expect(await fila(c.canalId)).toHaveLength(1);
      expect(c.registros.some((r) => r.mensagem.includes("uidvalidity mudou"))).toBe(true);
    });
  });

  describe("IDLE, conferência e Canais", () => {
    it("sem IDLE no servidor, a conferência periódica traz o e-mail novo", async () => {
      const c = await cenario({ semIdle: true });
      // A sessão não tem IDLE para avisar: só a conferência de 300 ms (e o poll da biblioteca, de 5 min) traz o e-mail.
      const leitor = c.criarLeitor({ intervaloDeConferenciaMs: 300 });
      leitor.iniciar();
      await ate("sessão aberta", () => leitor.canaisLidos().includes(c.canalId));
      await c.caixa.adicionarMensagem(c.endereco, novoEmail(c, "sem-idle"));
      await ate("o e-mail entrou", async () => (await fila(c.canalId)).length === 1, 5_000);
    });

    it("dois leitores na mesma base: só um lê o Canal; quando ele para, o outro assume no ciclo seguinte do supervisor", async () => {
      const c = await cenario();
      const a = c.criarLeitor();
      const b = c.criarLeitor();
      a.iniciar();
      await ate("A lê o Canal", () => a.canaisLidos().includes(c.canalId));
      b.iniciar();
      await dormir(900); // vários ciclos do supervisor de B

      expect(b.canaisLidos()).toEqual([]);
      expect(c.caixa.conexoesAbertas().imap).toBe(1);

      await a.parar();
      await ate("B assumiu o Canal", () => b.canaisLidos().includes(c.canalId));
      await c.caixa.adicionarMensagem(c.endereco, novoEmail(c, "depois-da-troca"));
      await ate("o e-mail entrou pelo B", async () => (await fila(c.canalId)).length === 1);
    });

    it("uma conexão dedicada por processo, qualquer que seja o número de Canais, e a conexão cair para todas as sessões e as refaz", async () => {
      const um = await cenario();
      const dois = await cenario();
      const nome = `n1-leitor-teste-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
      // Uma fábrica que abre as duas caixas (o certificado de teste é um só por processo).
      const fabrica = criarFabricaDeConexao({
        resolver: async () => [{ address: "127.0.0.1", family: 4 }],
        politica: criarPoliticaDeRede({ permitir: ["127.0.0.1"] }),
        portas: { imap: { [um.caixa.imap.porta]: "tls", [dois.caixa.imap.porta]: "tls" }, smtp: {} },
        ca: um.caixa.ca,
      });
      const leitor = um.criarLeitor({ fabrica, nomeDaAplicacao: nome, filtrarContas: (conta) => [um.canalId, dois.canalId].includes(conta.canalId) });
      leitor.iniciar();
      await ate("as duas caixas lidas", () => leitor.canaisLidos().length === 2);
      expect(await conexoesDoLeitorNoBanco(nome)).toBe(1);

      // A conexão das travas cai: todas as sessões param, as travas voltam e a leitura recomeça.
      await pool().query("select pg_terminate_backend(pid) from pg_stat_activity where application_name = $1", [nome]);
      await ate("as sessões pararam", () => leitor.canaisLidos().length === 0, 3_000);
      await ate("as duas caixas voltaram a ser lidas", () => leitor.canaisLidos().length === 2);
      expect(await conexoesDoLeitorNoBanco(nome)).toBe(1);

      await um.caixa.adicionarMensagem(um.endereco, novoEmail(um, "apos-queda"));
      await ate("o e-mail entrou", async () => (await fila(um.canalId)).length === 1);
    });

    it("o teto de sessões limita quantos Canais um processo lê", async () => {
      const um = await cenario();
      const dois = await cenario();
      const fabrica = criarFabricaDeConexao({
        resolver: async () => [{ address: "127.0.0.1", family: 4 }],
        politica: criarPoliticaDeRede({ permitir: ["127.0.0.1"] }),
        portas: { imap: { [um.caixa.imap.porta]: "tls", [dois.caixa.imap.porta]: "tls" }, smtp: {} },
        ca: um.caixa.ca,
      });
      const leitor = um.criarLeitor({ fabrica, maxSessoes: 1, filtrarContas: (conta) => [um.canalId, dois.canalId].includes(conta.canalId) });
      leitor.iniciar();
      await ate("uma sessão aberta", () => leitor.canaisLidos().length === 1);
      await dormir(700);
      expect(leitor.canaisLidos()).toHaveLength(1);
      expect(um.registros.some((r) => r.mensagem.includes("teto de sessões"))).toBe(true);
    });

    it("o Canal que deixa de estar conectado perde a sessão e a trava no ciclo seguinte", async () => {
      const c = await cenario();
      const leitor = c.criarLeitor();
      leitor.iniciar();
      await ate("sessão aberta", () => leitor.canaisLidos().includes(c.canalId));

      await pool().query("update plataforma.canais set conexao = 'desconectada' where workspace_id = $1 and id = $2", [ws, c.canalId]);
      await ate("a sessão fechou", () => leitor.canaisLidos().length === 0);
      await ate("o IMAP fechou", () => c.caixa.conexoesAbertas().imap === 0, 3_000);
    });
  });

  describe("queda de rede: reconecta, e passa pela guarda de rede de novo", () => {
    it("derrubar as conexões reabre a sessão pela fábrica (e pelo resolvedor) e o Canal segue conectado", async () => {
      const c = await cenario();
      const abrir = vi.spyOn(c.fabrica, "abrirImap");
      const leitor = c.criarLeitor();
      leitor.iniciar();
      await ate("sessão aberta", () => abrir.mock.calls.length === 1 && leitor.canaisLidos().includes(c.canalId));
      const resolvidasAntes = c.resolver.mock.calls.length;

      c.caixa.derrubarConexoes();
      await ate("a sessão reabriu", () => abrir.mock.calls.length >= 2);

      // A guarda de rede (D-17-07) roda dentro de cada `abrirImap`: o resolvedor foi consultado de novo (T-17-48).
      expect(c.resolver.mock.calls.length).toBeGreaterThan(resolvidasAntes);
      expect((await canalNoBanco(c.canalId)).conexao).toBe("conectada");

      await c.caixa.adicionarMensagem(c.endereco, novoEmail(c, "apos-queda-de-rede"));
      await ate("o e-mail entrou depois da reconexão", async () => (await fila(c.canalId)).length === 1);
    });

    it("a espera entre tentativas cresce (e para no teto) enquanto o servidor não responde, sem mudar o estado do Canal", async () => {
      const c = await cenario();
      vi.spyOn(c.fabrica, "abrirImap").mockRejectedValue(Object.assign(new Error("recusada"), { code: "ECONNREFUSED" }));
      const leitor = c.criarLeitor({ esperaInicialMs: 20, esperaMaximaMs: 100 });
      leitor.iniciar();
      const esperas = () => c.registros.filter((r) => r.mensagem === "sessão da caixa de e-mail vai reconectar").map((r) => r.dados?.esperaMs);
      await ate("cinco tentativas", () => esperas().length >= 5);

      expect(esperas().slice(0, 5)).toEqual([20, 40, 80, 100, 100]);
      expect(c.registros.some((r) => r.mensagem === "não conectou à caixa de e-mail" && r.dados?.tipo === "nao_conectou")).toBe(true);
      expect(await canalNoBanco(c.canalId)).toEqual({ conexao: "conectada", motivo_da_queda: null });
    });

    it("a sessão que durou o bastante zera a espera", async () => {
      const c = await cenario();
      const real = c.fabrica.abrirImap.bind(c.fabrica);
      const falha = Object.assign(new Error("recusada"), { code: "ECONNREFUSED" });
      vi.spyOn(c.fabrica, "abrirImap")
        .mockRejectedValueOnce(falha)
        .mockRejectedValueOnce(falha)
        .mockRejectedValueOnce(falha)
        .mockImplementation(real);
      const leitor = c.criarLeitor({ esperaInicialMs: 50, esperaMaximaMs: 10_000, estavelMs: 300 });
      leitor.iniciar();
      await ate("sessão aberta depois de três falhas", () => leitor.canaisLidos().includes(c.canalId) && c.caixa.conexoesAbertas().imap === 1);
      const esperas = () => c.registros.filter((r) => r.mensagem === "sessão da caixa de e-mail vai reconectar").map((r) => r.dados?.esperaMs);
      expect(esperas()).toEqual([50, 100, 200]);

      await dormir(500); // estável
      c.caixa.derrubarConexoes();
      await ate("a sessão caiu e vai reconectar", () => esperas().length === 4);
      // Sem o zeramento seria 400.
      expect(esperas()[3]).toBe(50);
    });

    it("a guarda de rede recusa a reconexão se o endereço passou a apontar para a rede interna, sem tocar o Canal", async () => {
      const c = await cenario();
      const leitor = c.criarLeitor();
      leitor.iniciar();
      await ate("sessão aberta", () => leitor.canaisLidos().includes(c.canalId));
      const conexoesAntes = c.caixa.conexoesImap().length;

      // O DNS agora devolve um endereço interno: toda abertura nova tem de ser recusada.
      c.resolver.mockImplementation(async () => [{ address: "10.0.0.5", family: 4 }]);
      c.caixa.derrubarConexoes();
      await ate("a guarda recusou", () => c.registros.some((r) => r.mensagem === "não conectou à caixa de e-mail" && r.dados?.tipo === "rede_recusada"));
      await dormir(300);

      expect(c.caixa.conexoesImap().length).toBe(conexoesAntes);
      expect((await canalNoBanco(c.canalId)).conexao).toBe("conectada");
    });
  });

  describe("anexo que o bucket não aceitou", () => {
    const comAnexo = readFileSync(join(__dirname, "exemplos", "com-anexo.eml"), "utf8");

    it("falhando duas vezes e depois funcionando: o e-mail entra UMA vez, com o anexo baixado, e o cursor só avança depois", async () => {
      const c = await cenario();
      let falhando = true;
      const subirDeVerdade = c.armazenamento.subir.bind(c.armazenamento);
      vi.spyOn(c.armazenamento, "subir").mockImplementation(async (...args) => {
        if (falhando) throw new Error("bucket fora do ar");
        return subirDeVerdade(...args);
      });
      const cursorInicial = (await lerCursor(pool(), ws, c.canalId, "INBOX"))!;
      const leitor = c.criarLeitor({
        esperaDoAnexoMs: 100,
        registrar: (_nivel, mensagem, dados) => {
          // O bucket "volta" depois da segunda tentativa que falhou: a terceira passa.
          if (mensagem.includes("anexo do e-mail sem bucket") && dados?.tentativa === 2) falhando = false;
        },
      });
      leitor.iniciar();
      await ate("sessão aberta", () => leitor.canaisLidos().includes(c.canalId));
      const uid = await c.caixa.adicionarMensagem(c.endereco, comAnexo);

      await ate("a primeira tentativa falhou", () => c.registros.some((r) => r.mensagem.includes("anexo do e-mail sem bucket") && r.dados?.tentativa === 1));
      // Enquanto o bucket falha, o cursor não passa e a fila não recebe nada.
      expect(await fila(c.canalId)).toHaveLength(0);
      expect(await lerCursor(pool(), ws, c.canalId, "INBOX")).toEqual(cursorInicial);

      await ate("o e-mail entrou", async () => (await fila(c.canalId)).length === 1);
      await dormir(400);
      const linhas = await fila(c.canalId);
      expect(linhas).toHaveLength(1);
      expect(linhas[0]!.corpo.anexos).toHaveLength(1);
      expect(linhas[0]!.corpo.anexos![0]!.baixado).toBe(true);
      expect((await lerCursor(pool(), ws, c.canalId, "INBOX"))!.proximoUid).toBe(uid + 1);
    });

    it("o bucket que não volta em três tentativas deixa o e-mail entrar com o anexo `baixado: false`", async () => {
      const c = await cenario();
      vi.spyOn(c.armazenamento, "subir").mockRejectedValue(new Error("bucket fora do ar"));
      const leitor = c.criarLeitor({ esperaDoAnexoMs: 100 });
      leitor.iniciar();
      await ate("sessão aberta", () => leitor.canaisLidos().includes(c.canalId));
      const uid = await c.caixa.adicionarMensagem(c.endereco, comAnexo);

      await ate("o e-mail entrou", async () => (await fila(c.canalId)).length === 1, 10_000);
      const [linha] = await fila(c.canalId);
      expect(linha!.corpo.anexos![0]!.baixado).toBe(false);
      expect(c.registros.filter((r) => r.mensagem.includes("anexo do e-mail sem bucket"))).toHaveLength(2);
      expect((await lerCursor(pool(), ws, c.canalId, "INBOX"))!.proximoUid).toBe(uid + 1);
    });
  });

  describe("a caixa que recusa a senha cai e para (D-17-20, T-17-46)", () => {
    it("a senha mudou: o Canal passa a desconectada com o motivo, a sessão para e o servidor não recebe mais login", async () => {
      const c = await cenario();
      const leitor = c.criarLeitor({ esperaInicialMs: 30 });
      leitor.iniciar();
      await ate("sessão aberta", () => leitor.canaisLidos().includes(c.canalId));

      c.caixa.trocarSenha(c.endereco, "senha-nova-17-10");
      c.caixa.derrubarConexoes();
      await ate("o Canal caiu", async () => (await canalNoBanco(c.canalId)).conexao === "desconectada");

      expect(await canalNoBanco(c.canalId)).toEqual({ conexao: "desconectada", motivo_da_queda: "O servidor IMAP recusou o usuário ou a senha: conecte a caixa de novo." });
      expect(FRASE_DA_SENHA_RECUSADA_NA_LEITURA).toBe("O servidor IMAP recusou o usuário ou a senha: conecte a caixa de novo.");
      await ate("a sessão foi recolhida", () => leitor.canaisLidos().length === 0);

      // Nenhuma tentativa de login a mais: o servidor do cliente não leva laço (T-17-46).
      const conexoes = c.caixa.conexoesImap().length;
      await dormir(2_500);
      expect(c.caixa.conexoesImap().length).toBe(conexoes);

      // Nem endereço, nem senha, nem o texto do servidor foram para o registro.
      const todos = JSON.stringify(c.registros);
      expect(todos).not.toContain(c.endereco);
      expect(todos).not.toContain(SENHA_DA_BANCADA);
      expect(todos).not.toContain("senha-nova-17-10");

      // Conectar de novo pela ficha, com a senha nova, faz o supervisor voltar a ler no ciclo seguinte.
      await c.conectar("senha-nova-17-10");
      await c.caixa.adicionarMensagem(c.endereco, novoEmail(c, "depois-de-reconectar"));
      await ate("o e-mail de depois da reconexão entrou", async () => (await fila(c.canalId)).length === 1);
      expect((await canalNoBanco(c.canalId)).conexao).toBe("conectada");
    });

    it("acesso recusado pela porta de acesso (OAuth): a mesma queda, com o motivo da porta, e uma tentativa só", async () => {
      const motivo = "O serviço de e-mail retirou a autorização: conecte o Canal de novo pela ficha dele.";
      const acessoParaUsar = vi.fn(async () => ({ ok: false as const, permanente: true, codigo: "AUTORIZACAO_RECUSADA" as const, motivo }));
      const c = await cenario({ acesso: { acessoParaUsar } satisfies AcessoDoEmail });
      const conexoesDoCadastro = c.caixa.conexoesImap().length; // a conexão pela ficha as abriu: o leitor não abre nenhuma
      const leitor = c.criarLeitor({ esperaInicialMs: 30 });
      leitor.iniciar();
      await ate("o Canal caiu", async () => (await canalNoBanco(c.canalId)).conexao === "desconectada");
      await dormir(800);

      expect((await canalNoBanco(c.canalId)).motivo_da_queda).toBe(motivo);
      expect(acessoParaUsar).toHaveBeenCalledTimes(1);
      expect(c.caixa.conexoesImap().length).toBe(conexoesDoCadastro);
    });

    it("OAUTH_NAO_CONFIGURADO só espera e tenta de novo, sem queda", async () => {
      const acessoParaUsar = vi.fn(async () => ({
        ok: false as const,
        permanente: false,
        codigo: "OAUTH_NAO_CONFIGURADO" as const,
        motivo: "O login deste serviço não está configurado na plataforma.",
      }));
      const c = await cenario({ acesso: { acessoParaUsar } });
      const conexoesDoCadastro = c.caixa.conexoesImap().length;
      const leitor = c.criarLeitor({ esperaInicialMs: 20, esperaMaximaMs: 100 });
      leitor.iniciar();
      await ate("tentou várias vezes", () => acessoParaUsar.mock.calls.length >= 4);

      expect(await canalNoBanco(c.canalId)).toEqual({ conexao: "conectada", motivo_da_queda: null });
      expect(c.caixa.conexoesImap().length).toBe(conexoesDoCadastro);
    });

    it("a sessão OAuth recebe o vencimento do token e o `close` da biblioteca reconecta com token novo, sem queda", async () => {
      const renovador = vi.fn(async () => ({ accessToken: "token-2", expiraEm: new Date(Date.now() + 3_600_000).toISOString() }));
      const acesso = criarAcessoDoEmail({ pool, chaves: () => CHAVES_DA_BANCADA, renovadores: { microsoft: renovador } });
      const c = await cenario({ tokens: ["token-1", "token-2"], acesso });
      // O token vence 1,5 s depois da margem de renovação de 5 min: a biblioteca fecha a sessão (`sessionExpires` menos 5 min) em
      // ~1,5 s, e a reconexão cai dentro da margem e renova.
      await guardarCredencialDoEmail(
        pool(),
        CHAVES_DA_BANCADA,
        { workspaceId: ws, canalId: c.canalId },
        {
          v: 1,
          tipo: "oauth",
          servico: "microsoft",
          usuario: c.endereco,
          refreshToken: "refresh-1",
          accessToken: "token-1",
          expiraEm: new Date(Date.now() + 5 * 60_000 + 1_500).toISOString(),
        },
      );
      const abrir = vi.spyOn(c.fabrica, "abrirImap");
      const leitor = c.criarLeitor();
      leitor.iniciar();
      await ate("a sessão reabriu depois do vencimento", () => abrir.mock.calls.length >= 2, 15_000);
      await ate("sessão de pé", () => leitor.canaisLidos().includes(c.canalId) && c.caixa.conexoesAbertas().imap === 1);

      expect(renovador).toHaveBeenCalledTimes(1);
      expect(await canalNoBanco(c.canalId)).toEqual({ conexao: "conectada", motivo_da_queda: null });
      await c.caixa.adicionarMensagem(c.endereco, novoEmail(c, "com-token-novo"));
      await ate("o e-mail entrou", async () => (await fila(c.canalId)).length === 1);
    }, 30_000);
  });

  describe("o que o registro leva", () => {
    it("nunca endereço, assunto, corpo nem senha: só contagens e o id do Canal", async () => {
      const c = await cenario();
      const leitor = c.criarLeitor();
      leitor.iniciar();
      await ate("sessão aberta", () => leitor.canaisLidos().includes(c.canalId));
      await c.caixa.adicionarMensagem(c.endereco, novoEmail(c, "sigilo", { assunto: "Assunto-muito-sigiloso", texto: "Corpo-muito-sigiloso." }));
      await ate("entrou", async () => (await mensagens(c.canalId)).length === 1);
      await leitor.parar();

      const todos = JSON.stringify(c.registros);
      expect(c.registros.length).toBeGreaterThan(0);
      for (const proibido of [c.endereco, c.cliente, "Assunto-muito-sigiloso", "Corpo-muito-sigiloso", SENHA_DA_BANCADA, "empresa.example"]) {
        expect(todos).not.toContain(proibido);
      }
    });
  });
});
