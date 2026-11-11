/**
 * Repositório de Mensagens (08-12, Task 1), contra o Postgres LOCAL.
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55592/postgres npx vitest run src/repositorios/crm/mensagens.test.ts
 *
 * Canais entram por `semearCanal`, Contato pelo repositório da Fase 7 e as
 * Conversas pelo repositório de Conversas (08-06). A ingestão da `recebida` é o
 * caminho interno: idempotente por (Canal, id externo), com `criado_em` do
 * provedor e a carga bruta guardada fora de toda leitura.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { encerrar, pool } from "../../persistencia/conexao";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal } from "../../testes/banco-crm";
import { criarRepositorioDeContatosPg } from "./contatos";
import { criarRepositorioDeConversasPg } from "./conversas";
import { criarRepositorioDeMensagensPg, type LinhaDeMensagemRecebida } from "./mensagens";

describeComBanco("RepositorioDeMensagens — Postgres local", () => {
  const espacos: string[] = [];
  // Só dentro do `beforeAll`: sem `DATABASE_URL` (CI), `pool()` lança e derrubaria a suíte antes de o `describe.skip` valer.
  let mensagens: ReturnType<typeof criarRepositorioDeMensagensPg>;

  /** Um Espaço com um Contato e uma Conversa em "Comercial" e outra em "Suporte". */
  async function cenario(rotulo: string) {
    const ws = novoEspacoDeTeste(rotulo);
    espacos.push(ws);
    const contato = await criarRepositorioDeContatosPg(pool()).inserir(ws, { nome: "Ana", proprietarioId: "mem_ana", criadoPor: "mem_ana" });
    const abrir = async (nome: string, provedor: string, identificadorExterno: string) => {
      const canalId = await semearCanal(ws, { nome, tipo: "whatsapp", provedor, identificadorExterno, conexao: "conectada" });
      const conversa = await criarRepositorioDeConversasPg(pool()).inserir(ws, {
        canalId,
        contatoId: contato.id,
        titulo: `Ana — ${nome}`,
        filaId: null,
        atribuido: { tipo: "membro", id: "mem_ana" },
        participantes: [],
        criadoPor: { tipo: "member", id: "mem_ana" },
      });
      return { canalId, conversaId: conversa.id };
    };
    const comercial = await abrir("Comercial", "whatsapp-cloud", "+5511977770001");
    const suporte = await abrir("Suporte", "whatsapp-nao-oficial", "+5511977770002");
    return { ws, comercial, suporte };
  }

  const recebida = (conversaId: string, canalId: string, extras: Partial<LinhaDeMensagemRecebida> = {}): LinhaDeMensagemRecebida => ({
    conversaId,
    canalId,
    idExterno: "wamid.1",
    criadoEm: "2026-10-12T10:00:00.000Z",
    conteudo: "Olá",
    anexos: [],
    assunto: null,
    enderecosAdicionais: [],
    remetenteExterno: null,
    identificadorId: null,
    cargaBruta: { entry: [{ changes: [{ value: { text: "Olá, ção" } }] }] },
    ...extras,
  });

  beforeAll(async () => {
    await prepararBancoCrm();
    mensagens = criarRepositorioDeMensagensPg(pool());
  });

  afterAll(async () => {
    for (const ws of espacos) await limparEspaco(ws);
    await encerrar();
  });

  it("grava a recebida uma vez por (Canal, id externo) e devolve undefined na repetição", async () => {
    const { ws, comercial, suporte } = await cenario("idem");

    const primeira = await mensagens.inserirRecebida(ws, recebida(comercial.conversaId, comercial.canalId));
    expect(primeira).toMatchObject({
      direcao: "recebida",
      idExterno: "wamid.1",
      conteudo: "Olá",
      statusEntrega: null,
      ator: { tipo: "integration", id: comercial.canalId },
    });

    const repetida = await mensagens.inserirRecebida(ws, recebida(comercial.conversaId, comercial.canalId));
    expect(repetida).toBeUndefined();
    const contagem = await pool().query<{ n: number }>(
      "select count(*)::int as n from plataforma.mensagens where id_externo = 'wamid.1' and canal_id = $1",
      [comercial.canalId],
    );
    expect(contagem.rows[0]!.n).toBe(1);

    const existente = await mensagens.obterPorIdExterno(ws, comercial.canalId, "wamid.1");
    expect(existente?.id).toBe(primeira!.id);

    // O mesmo id externo em OUTRO Canal é outra Mensagem.
    const noutroCanal = await mensagens.inserirRecebida(ws, recebida(suporte.conversaId, suporte.canalId));
    expect(noutroCanal).toBeDefined();
    expect(noutroCanal!.id).not.toBe(primeira!.id);
  });

  it("guarda a carga bruta como veio (unicode e aninhamento) e só cargaBruta() a lê", async () => {
    const { ws, comercial } = await cenario("carga");
    const carga = { entry: [{ changes: [{ value: { text: "Olá, ção", n: [1, { a: null }] } }] }] };
    const gravada = await mensagens.inserirRecebida(ws, recebida(comercial.conversaId, comercial.canalId, { cargaBruta: carga }));
    expect(gravada).not.toHaveProperty("cargaBruta");
    expect(await mensagens.cargaBruta(ws, gravada!.id)).toEqual(carga);
  });

  it("desempata o mesmo criadoEm por `seq` como NÚMERO, não como texto (99999 antes de 100000)", async () => {
    // `seq` sai como texto (`seq::text as seq`); um `order by ... seq` solto liga a esse alias e ordena "100000" antes de "99999".
    // Os valores são postos à mão e na ordem inversa, para o teste não depender de onde o contador da sequência está.
    const { ws, comercial } = await cenario("seq-numerico");
    const mesmoInstante = "2026-10-12T09:00:00.000Z";
    await pool().query(
      `insert into plataforma.mensagens (workspace_id, conversa_id, canal_id, seq, direcao, ator_tipo, ator_id, conteudo, criado_em)
       overriding system value
       values ($1, $2, $3, 100000, 'interna', 'member', 'mem_ana', 'seis dígitos', $4),
              ($1, $2, $3, 99999, 'interna', 'member', 'mem_ana', 'cinco dígitos', $4)`,
      [ws, comercial.conversaId, comercial.canalId, mesmoInstante],
    );

    const pagina = await mensagens.listar(ws, { conversaId: comercial.conversaId, limite: 50, deslocamento: 0 });
    expect(pagina.itens.map((m) => m.seq)).toEqual([99999, 100000]);
  });

  it("lista por (criado_em, seq) — mesmo criadoEm sai na ordem de inserção — e sem cargaBruta", async () => {
    const { ws, comercial } = await cenario("lista");
    const mesmoInstante = "2026-10-12T09:00:00.000Z";
    const a = await mensagens.inserirRecebida(ws, recebida(comercial.conversaId, comercial.canalId, { idExterno: "wamid.a", criadoEm: mesmoInstante }));
    const b = await mensagens.inserirRecebida(ws, recebida(comercial.conversaId, comercial.canalId, { idExterno: "wamid.b", criadoEm: mesmoInstante }));
    const antes = await mensagens.inserirRecebida(ws, recebida(comercial.conversaId, comercial.canalId, { idExterno: "wamid.c", criadoEm: "2026-10-12T08:00:00.000Z" }));

    const pagina = await mensagens.listar(ws, { conversaId: comercial.conversaId, limite: 50, deslocamento: 0 });
    expect(pagina.total).toBe(3);
    expect(pagina.itens.map((m) => m.id)).toEqual([antes!.id, a!.id, b!.id]);
    for (const item of pagina.itens) expect(item).not.toHaveProperty("cargaBruta");

    const segunda = await mensagens.listar(ws, { conversaId: comercial.conversaId, limite: 1, deslocamento: 1 });
    expect(segunda.itens.map((m) => m.id)).toEqual([a!.id]);
    expect(segunda.total).toBe(3);
  });

  it("registra o momento do provedor em criadoEm e o da plataforma em registradoEm (Pitfall 9)", async () => {
    const { ws, comercial } = await cenario("tempo");
    const m = await mensagens.inserirRecebida(ws, recebida(comercial.conversaId, comercial.canalId, { criadoEm: "2026-01-02T03:04:05.000Z" }));
    expect(m!.criadoEm).toBe("2026-01-02T03:04:05.000Z");
    expect(Date.parse(m!.registradoEm)).toBeGreaterThan(Date.parse("2026-10-01T00:00:00.000Z"));
  });

  it("ultimaRecebidaEm devolve o criadoEm do provedor da recebida mais recente, ou null", async () => {
    const { ws, comercial, suporte } = await cenario("ultima");
    expect(await mensagens.ultimaRecebidaEm(ws, comercial.conversaId)).toBeNull();

    await mensagens.inserirRecebida(ws, recebida(comercial.conversaId, comercial.canalId, { idExterno: "w.1", criadoEm: "2026-10-10T10:00:00.000Z" }));
    await mensagens.inserirRecebida(ws, recebida(comercial.conversaId, comercial.canalId, { idExterno: "w.2", criadoEm: "2026-10-11T11:30:00.000Z" }));
    await mensagens.inserirRecebida(ws, recebida(comercial.conversaId, comercial.canalId, { idExterno: "w.0", criadoEm: "2026-10-09T09:00:00.000Z" }));
    expect(await mensagens.ultimaRecebidaEm(ws, comercial.conversaId)).toBe("2026-10-11T11:30:00.000Z");
    expect(await mensagens.ultimaRecebidaEm(ws, suporte.conversaId)).toBeNull();
  });

  it("WR-04: identificadorDaUltimaRecebida devolve o Identificador da recebida mais recente que tem um, ou null", async () => {
    const { ws, comercial, suporte } = await cenario("identificador");
    expect(await mensagens.identificadorDaUltimaRecebida(ws, comercial.conversaId)).toBeNull();

    await mensagens.inserirRecebida(ws, recebida(comercial.conversaId, comercial.canalId, { idExterno: "i.1", criadoEm: "2026-10-10T10:00:00.000Z", identificadorId: "ident_a" }));
    await mensagens.inserirRecebida(ws, recebida(comercial.conversaId, comercial.canalId, { idExterno: "i.2", criadoEm: "2026-10-11T11:30:00.000Z", identificadorId: "ident_b" }));
    // A mais nova não tem Identificador (Contato novo sem vínculo): a leitura salta para a anterior que tem.
    await mensagens.inserirRecebida(ws, recebida(comercial.conversaId, comercial.canalId, { idExterno: "i.3", criadoEm: "2026-10-12T12:00:00.000Z", identificadorId: null }));
    expect(await mensagens.identificadorDaUltimaRecebida(ws, comercial.conversaId)).toBe("ident_b");
    expect(await mensagens.identificadorDaUltimaRecebida(ws, suporte.conversaId)).toBeNull();
  });

  it("4.4.3: remetenteExternoDaUltimaRecebida devolve o número como o provedor o entregou, da mesma recebida que escolhe o Identificador", async () => {
    const { ws, comercial, suporte } = await cenario("remetente-externo");
    expect(await mensagens.remetenteExternoDaUltimaRecebida(ws, comercial.conversaId)).toBeNull();

    await mensagens.inserirRecebida(ws, recebida(comercial.conversaId, comercial.canalId, { idExterno: "r.1", criadoEm: "2026-10-10T10:00:00.000Z", remetenteExterno: "+5511987654321", identificadorId: "ident_a" }));
    await mensagens.inserirRecebida(ws, recebida(comercial.conversaId, comercial.canalId, { idExterno: "r.2", criadoEm: "2026-10-11T11:30:00.000Z", remetenteExterno: "+551187654321", identificadorId: "ident_a" }));
    // Sem Identificador (Contato novo sem vínculo) e a digitada no celular não contam: a leitura salta para a que tem.
    await mensagens.inserirRecebida(ws, recebida(comercial.conversaId, comercial.canalId, { idExterno: "r.3", criadoEm: "2026-10-12T12:00:00.000Z", remetenteExterno: "+5511900000000", identificadorId: null }));
    expect(await mensagens.remetenteExternoDaUltimaRecebida(ws, comercial.conversaId)).toBe("+551187654321");
    expect(await mensagens.remetenteExternoDaUltimaRecebida(ws, suporte.conversaId)).toBeNull();
  });

  describe("a Mensagem digitada no celular do Canal (4.4.2)", () => {
    const doAparelho = (conversaId: string, canalId: string, extras: Partial<LinhaDeMensagemRecebida> = {}) =>
      recebida(conversaId, canalId, { idExterno: "cel.1", conteudo: "respondi pelo celular", remetenteExterno: "+5511987654321", identificadorId: "ident_x", digitadaNoAparelho: true, ...extras });

    const pendenteDoCrm = (ws: string, conversaId: string, canalId: string, conteudo = "oi") =>
      mensagens.inserir(ws, { conversaId, canalId, direcao: "enviada", ator: { tipo: "member", id: "mem_ana" }, conteudo, statusEntrega: "pendente" });

    it("entra `enviada` pelo Canal como Integração, com o status `enviada` no instante do provedor e sem remetente nem Identificador", async () => {
      const { ws, suporte } = await cenario("cel-entra");
      const gravada = await mensagens.inserirRecebida(ws, doAparelho(suporte.conversaId, suporte.canalId));
      expect(gravada).toMatchObject({
        direcao: "enviada",
        ator: { tipo: "integration", id: suporte.canalId },
        idExterno: "cel.1",
        conteudo: "respondi pelo celular",
        statusEntrega: "enviada",
        statusEntregaEm: "2026-10-12T10:00:00.000Z",
        remetenteExterno: null,
        identificadorId: null,
        criadoEm: "2026-10-12T10:00:00.000Z",
      });
      // Idempotente como a recebida: a segunda entrega do mesmo id externo não grava de novo.
      expect(await mensagens.inserirRecebida(ws, doAparelho(suporte.conversaId, suporte.canalId))).toBeUndefined();
      expect((await mensagens.listar(ws, { conversaId: suporte.conversaId, limite: 50, deslocamento: 0 })).total).toBe(1);
      // Não conta como `recebida`: não abre a janela de 24 h nem escolhe o destino da resposta.
      expect(await mensagens.ultimaRecebidaEm(ws, suporte.conversaId)).toBeNull();
      expect(await mensagens.identificadorDaUltimaRecebida(ws, suporte.conversaId)).toBeNull();
    });

    it("gravarEnvio: se a Evolution devolveu a Mensagem do CRM como 'digitada no celular' antes do aceite, a cópia sai e a do CRM fica com o id", async () => {
      const { ws, suporte } = await cenario("cel-corrida");
      const copia = await mensagens.inserirRecebida(ws, doAparelho(suporte.conversaId, suporte.canalId, { idExterno: "3EB0AA", conteudo: "oi" }));
      const propria = await pendenteDoCrm(ws, suporte.conversaId, suporte.canalId);
      expect(copia).toBeDefined();

      const gravada = await mensagens.gravarEnvio(ws, propria.id, { idExterno: "3EB0AA", em: "2026-10-12T10:00:05.000Z" });
      expect(gravada).toMatchObject({ id: propria.id, idExterno: "3EB0AA", statusEntrega: "enviada", ator: { tipo: "member", id: "mem_ana" } });
      const fio = await mensagens.listar(ws, { conversaId: suporte.conversaId, limite: 50, deslocamento: 0 });
      expect(fio.itens.map((m) => m.id)).toEqual([propria.id]);
      expect(await mensagens.obter(ws, copia!.id)).toBeUndefined();
    });

    it("gravarEnvio sem cópia continua igual: só grava o id e o status", async () => {
      const { ws, suporte } = await cenario("cel-sem-copia");
      const propria = await pendenteDoCrm(ws, suporte.conversaId, suporte.canalId);
      expect(await mensagens.gravarEnvio(ws, propria.id, { idExterno: "3EB0BB", em: "2026-10-12T10:00:05.000Z" })).toMatchObject({ idExterno: "3EB0BB", statusEntrega: "enviada" });
    });

    it("gravarEnvio só desfaz a cópia quando a Mensagem do CRM ainda está `pendente` e a cópia é do Canal como Integração", async () => {
      const { ws, suporte } = await cenario("cel-guardas");
      const copia = await mensagens.inserirRecebida(ws, doAparelho(suporte.conversaId, suporte.canalId, { idExterno: "3EB0CC" }));
      const propria = await pendenteDoCrm(ws, suporte.conversaId, suporte.canalId);
      await mensagens.marcarFalha(ws, propria.id, "falhou antes");
      // Já não é `pendente` (o `update` não vale), então a cópia fica: nada é apagado por uma chamada que não grava nada.
      expect(await mensagens.gravarEnvio(ws, propria.id, { idExterno: "3EB0CC", em: "2026-10-12T10:00:05.000Z" })).toBeUndefined();
      expect(await mensagens.obter(ws, copia!.id)).toBeDefined();
    });

    it("gravarEnvio não apaga a Mensagem de outro Canal com o mesmo id externo", async () => {
      const { ws, comercial, suporte } = await cenario("cel-canais");
      const deOutroCanal = await mensagens.inserirRecebida(ws, doAparelho(comercial.conversaId, comercial.canalId, { idExterno: "3EB0DD" }));
      const propria = await pendenteDoCrm(ws, suporte.conversaId, suporte.canalId);
      expect(await mensagens.gravarEnvio(ws, propria.id, { idExterno: "3EB0DD", em: "2026-10-12T10:00:05.000Z" })).toMatchObject({ idExterno: "3EB0DD" });
      expect(await mensagens.obter(ws, deOutroCanal!.id)).toBeDefined();
    });
  });

  it("não enxerga Mensagens de outro Espaço", async () => {
    const um = await cenario("iso1");
    const outro = await cenario("iso2");
    await mensagens.inserirRecebida(um.ws, recebida(um.comercial.conversaId, um.comercial.canalId));
    const pagina = await mensagens.listar(outro.ws, { conversaId: um.comercial.conversaId, limite: 50, deslocamento: 0 });
    expect(pagina).toEqual({ itens: [], total: 0 });
    expect(await mensagens.obterPorIdExterno(outro.ws, um.comercial.canalId, "wamid.1")).toBeUndefined();
    expect(await mensagens.ultimaRecebidaEm(outro.ws, um.comercial.conversaId)).toBeNull();
    expect(await mensagens.identificadorDaUltimaRecebida(outro.ws, um.comercial.conversaId)).toBeNull();
  });
});
