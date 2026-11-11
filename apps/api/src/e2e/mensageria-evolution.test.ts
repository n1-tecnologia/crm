/**
 * A Evolution, ponta a ponta com o servidor FALSO (16-12, D-16-04, D-16-06, MSG-06), contra o Postgres LOCAL
 * (Docker, porta 55727):
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55727/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55727/postgres npx vitest run src/e2e/mensageria-evolution.test.ts
 *
 * Nunca fala com uma Evolution real: a instância é o servidor HTTP falso de `testes/servidor-falso.ts`. Um Canal REAL
 * (`conexao_simulada = false`) `whatsapp-nao-oficial` guarda no cofre o segredo do webhook e a credencial
 * `{ instancia, apikey }`. Entrada: o `MESSAGES_UPSERT` de texto entra por `POST /webhooks/mensageria/:canalId` e vira
 * Contato, Conversa e Mensagem. Saída: a resposta escrita na Caixa sai por `POST /message/sendText/<instancia>` no falso e
 * a Mensagem fica `enviada` com o `key.id` que a Evolution devolveu. O que a pessoa digita no celular (`fromMe`, 4.4.2) entra no
 * mesmo fio como `enviada` pelo Canal; e, se a Evolution devolver a Mensagem do CRM antes do aceite, o fio fica com uma só.
 */

import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import { buildApp } from "../app";
import { criarWorkerDeSaida } from "../mensageria/entregar-mensagem";
import { criarProcessadorDeEntrada } from "../mensageria/processador-de-entrada";
import { CABECALHO_DO_SEGREDO, TIPO_DO_SEGREDO_DO_WEBHOOK } from "../mensageria/provedor";
import { criarProvedorEvolution } from "../mensageria/provedores/evolution/provedor";
import textoDoCelular from "../mensageria/provedores/evolution/exemplos/texto-do-celular.json";
import texto from "../mensageria/provedores/evolution/exemplos/texto.json";
import { registroPadrao, type RegistroDeProvedores } from "../mensageria/registro";
import { provedorDeTeste } from "../mensageria/provedores/teste";
import { encerrar, pool } from "../persistencia/conexao";
import { guardarCredencial, type ChavesDoCofre } from "../servicos/cofre";
import { criarServidorFalso, type ServidorFalso } from "../testes/servidor-falso";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal, semearMembro } from "../testes/banco-crm";

const chaves: ChavesDoCofre = { atual: { versao: 1, chave: randomBytes(32) } };
const SEGREDO = "s1-do-canal-da-evolution";
const INSTANCIA = "inst-teste";
const APIKEY_DA_INSTANCIA = "tok-inst";
const WHATSAPP_DA_ANA = "+5511987654321";
const MEMBRO = { authorization: "Bearer token-ana" };
const membroBase = buildSeed().members.find((m) => m.id === "mem_maryane")!;

interface Envelope {
  ok: boolean;
  dados?: { id: string; statusEntrega: string | null; conversaId?: string };
  itens?: Array<{
    id: string;
    statusEntrega: string | null;
    idExterno: string | null;
    conteudo: string | null;
    direcao: string;
    motivoFalha: string | null;
    emRespostaAId: string | null;
    reacoes: Array<{ autor: string; emoji: string; em: string }>;
    marcacaoExclusao: { porQuem: string; em: string } | null;
    edicoesExternas: Array<{ conteudoAnterior: string | null; em: string }>;
  }>;
}

describeComBanco("Fase 16 ponta a ponta: a Evolution (servidor falso) entra pelo webhook do Canal e responde por sendText", () => {
  const ws = novoEspacoDeTeste("msgevolution");
  let falso: ServidorFalso;
  let registro: RegistroDeProvedores;
  let canalId: string;

  const app = () =>
    buildApp({
      logger: false,
      workspaceId: ws,
      webhooksDeMensageria: { chaves, registro },
      verificarToken: async (token) => (token === "token-ana" ? { sub: "usuario-ana" } : null),
      resolverMembro: async (_workspaceId, userId) =>
        userId === "usuario-ana" ? { ...membroBase, id: "mem_ana", userId, state: "ativo" as const } : undefined,
    });

  const chamar = (corpo: unknown, cabecalhos: Record<string, string> = { [CABECALHO_DO_SEGREDO]: SEGREDO }) =>
    app().inject({ method: "POST", url: `/webhooks/mensageria/${canalId}`, headers: cabecalhos, payload: corpo as object });

  const linhas = async () =>
    (
      await pool().query<{ estado: string; provedor: string; chave: string | null; corpo: Record<string, unknown>; resultado: string | null }>(
        "select estado, provedor, chave, corpo, resultado from plataforma.webhooks_recebidos where workspace_id = $1 order by recebido_em",
        [ws],
      )
    ).rows;

  beforeAll(async () => {
    await prepararBancoCrm();
    falso = await criarServidorFalso();
    registro = { teste: provedorDeTeste, porProvedor: { "whatsapp-nao-oficial": criarProvedorEvolution({ url: falso.url }) } };
    await semearMembro(ws, { id: "mem_ana", base: "proprietario", state: "ativo" });
    canalId = await semearCanal(ws, {
      nome: "WhatsApp da Evolution",
      tipo: "whatsapp",
      provedor: "whatsapp-nao-oficial",
      identificadorExterno: "+5511977770001",
      conexao: "conectada",
      conexaoSimulada: false,
      configuradoPor: "mem_ana",
    });
    const dono = { workspaceId: ws, donoTipo: "canal", donoId: canalId } as const;
    await guardarCredencial(pool(), chaves, { ...dono, tipo: TIPO_DO_SEGREDO_DO_WEBHOOK, segredo: SEGREDO });
    await guardarCredencial(pool(), chaves, {
      ...dono,
      tipo: "whatsapp-nao-oficial",
      segredo: JSON.stringify({ instancia: INSTANCIA, apikey: APIKEY_DA_INSTANCIA }),
    });
  });

  beforeEach(() => {
    provedorDeTeste.limpar();
  });

  afterAll(async () => {
    await pool().query("delete from plataforma.integration_outbox where workspace_id = $1", [ws]);
    await pool().query("delete from plataforma.credenciais where workspace_id = $1", [ws]);
    await limparEspaco(ws);
    await falso.fechar();
    await encerrar();
  });

  it("o MESSAGES_UPSERT de texto da instância do Canal vira Contato, Conversa aberta e Mensagem com o id da Evolution", async () => {
    const resposta = await chamar(texto);
    expect(resposta.statusCode).toBe(200);
    const gravadas = await linhas();
    expect(gravadas).toHaveLength(1);
    expect(gravadas[0]).toMatchObject({ estado: "pendente", provedor: "whatsapp-nao-oficial", chave: texto.data.key.id });
    expect(JSON.stringify(gravadas[0]!.corpo)).not.toContain("apikey");

    const processador = criarProcessadorDeEntrada({ workerId: "teste-evolution", chaves, registro });
    expect(await processador.processarUm()).toBe(true);
    expect((await linhas())[0]).toMatchObject({ estado: "processado" });

    const contatos = (
      await pool().query<{ valor: string }>(
        `select i.valor from plataforma.contatos c
           join plataforma.contato_identificadores i on i.workspace_id = c.workspace_id and i.contato_id = c.id
          where c.workspace_id = $1 and i.tipo = 'whatsapp'`,
        [ws],
      )
    ).rows;
    expect(contatos).toEqual([{ valor: WHATSAPP_DA_ANA }]);
    const conversas = (await pool().query<{ situacao: string }>("select situacao from plataforma.conversas where workspace_id = $1 and canal_id = $2", [ws, canalId])).rows;
    expect(conversas).toEqual([{ situacao: "aberta" }]);
    const mensagens = (
      await pool().query<{ direcao: string; id_externo: string; conteudo: string }>("select direcao, id_externo, conteudo from plataforma.mensagens where workspace_id = $1", [ws])
    ).rows;
    expect(mensagens).toEqual([{ direcao: "recebida", id_externo: texto.data.key.id, conteudo: "oi" }]);
  });

  it("a resposta escrita na Caixa sai por POST /message/sendText/<instancia> com a apikey da instância, e a Mensagem fica enviada com o key.id", async () => {
    const conversaId = (await pool().query<{ id: string }>("select id from plataforma.conversas where workspace_id = $1 and canal_id = $2", [ws, canalId])).rows[0]!.id;
    falso.enfileirar({ kind: "ok", status: 201, corpo: { key: { remoteJid: "5511987654321@s.whatsapp.net", fromMe: true, id: "3EB0AA" }, status: "PENDING" } });

    const criada = await app().inject({ method: "POST", url: "/mensagens", headers: MEMBRO, payload: { conversaId, direcao: "enviada", conteudo: "olá" } });
    expect(criada.statusCode).toBe(201);
    const id = (criada.json() as Envelope).dados!.id;

    const worker = criarWorkerDeSaida({ workerId: "teste-evolution-saida", workspaceId: ws, chaves, registro });
    expect(await worker.processarUm()).toBe(true);

    expect(falso.recebidas).toHaveLength(1);
    const enviada = falso.recebidas[0]!;
    expect(enviada.metodo).toBe("POST");
    expect(enviada.caminho).toBe(`/message/sendText/${INSTANCIA}`);
    expect(enviada.cabecalhos.apikey).toBe(APIKEY_DA_INSTANCIA);
    expect(enviada.corpo).toEqual({ number: "5511987654321", text: "olá" });

    const lista = await app().inject({ method: "GET", url: `/mensagens?conversaId=${conversaId}`, headers: MEMBRO });
    const depois = (lista.json() as Envelope).itens!.find((m) => m.id === id)!;
    expect(depois).toMatchObject({ statusEntrega: "enviada", idExterno: "3EB0AA" });
  });

  it("a Mensagem digitada no celular (fromMe) entra no mesmo fio como `enviada` pelo Canal, e o pushName do dono do número não vira nome do Contato", async () => {
    const resposta = await chamar(textoDoCelular);
    expect(resposta.statusCode).toBe(200);
    const processador = criarProcessadorDeEntrada({ workerId: "teste-evolution-celular", chaves, registro });
    expect(await processador.processarUm()).toBe(true);
    expect((await linhas()).at(-1)).toMatchObject({ estado: "processado", chave: textoDoCelular.data.key.id });

    const conversas = (await pool().query<{ id: string }>("select id from plataforma.conversas where workspace_id = $1 and canal_id = $2", [ws, canalId])).rows;
    expect(conversas).toHaveLength(1);
    const lista = await app().inject({ method: "GET", url: `/mensagens?conversaId=${conversas[0]!.id}`, headers: MEMBRO });
    const doCelular = (lista.json() as Envelope).itens!.find((m) => m.idExterno === textoDoCelular.data.key.id)!;
    expect(doCelular).toMatchObject({ direcao: "enviada", statusEntrega: "enviada", conteudo: "enviada pelo celular" });

    const nomes = (await pool().query<{ nome: string }>("select nome from plataforma.contatos where workspace_id = $1", [ws])).rows.map((c) => c.nome);
    expect(nomes).not.toContain("Dono do Numero");
  });

  it("se a Evolution devolver a Mensagem do CRM como 'digitada no celular' ANTES do aceite, o fio fica com uma Mensagem só: a do CRM, com o Membro e o id", async () => {
    const conversaId = (await pool().query<{ id: string }>("select id from plataforma.conversas where workspace_id = $1 and canal_id = $2", [ws, canalId])).rows[0]!.id;
    const criada = await app().inject({ method: "POST", url: "/mensagens", headers: MEMBRO, payload: { conversaId, direcao: "enviada", conteudo: "eco do CRM" } });
    expect(criada.statusCode).toBe(201);
    const idDoCrm = (criada.json() as Envelope).dados!.id;

    // O eco chega e é processado primeiro (a Evolution mandou o webhook antes de o worker gravar o aceite).
    const eco = { ...textoDoCelular, data: { ...textoDoCelular.data, key: { ...textoDoCelular.data.key, id: "3EB0EC" }, message: { conversation: "eco do CRM" } } };
    expect((await chamar(eco)).statusCode).toBe(200);
    const processador = criarProcessadorDeEntrada({ workerId: "teste-evolution-eco", chaves, registro });
    expect(await processador.processarUm()).toBe(true);
    const antesDoAceite = (await app().inject({ method: "GET", url: `/mensagens?conversaId=${conversaId}`, headers: MEMBRO })).json() as Envelope;
    expect(antesDoAceite.itens!.filter((m) => m.conteudo === "eco do CRM")).toHaveLength(2);

    falso.enfileirar({ kind: "ok", status: 201, corpo: { key: { remoteJid: "5511987654321@s.whatsapp.net", fromMe: true, id: "3EB0EC" }, status: "PENDING" } });
    const worker = criarWorkerDeSaida({ workerId: "teste-evolution-eco-saida", workspaceId: ws, chaves, registro });
    expect(await worker.processarUm()).toBe(true);

    const depois = (await app().inject({ method: "GET", url: `/mensagens?conversaId=${conversaId}`, headers: MEMBRO })).json() as Envelope;
    const doEco = depois.itens!.filter((m) => m.conteudo === "eco do CRM");
    expect(doEco).toHaveLength(1);
    expect(doEco[0]).toMatchObject({ id: idDoCrm, idExterno: "3EB0EC", statusEntrega: "enviada", motivoFalha: null });
  });

  it("4.4.3: a mesma Ana escrevendo SEM o nono dígito cai no mesmo Contato e na mesma Conversa, e a resposta sai pelo número como o WhatsApp o conhece", async () => {
    const semNove = { ...texto, data: { ...texto.data, key: { ...texto.data.key, id: "3EB0NOVE", remoteJid: "551187654321@s.whatsapp.net" }, message: { conversation: "oi, sem o nove" } } };
    expect((await chamar(semNove)).statusCode).toBe(200);
    const processador = criarProcessadorDeEntrada({ workerId: "teste-evolution-nove", chaves, registro });
    expect(await processador.processarUm()).toBe(true);
    expect((await linhas()).at(-1)).toMatchObject({ estado: "processado", chave: "3EB0NOVE" });

    const contatos = (await pool().query<{ valor: string }>("select valor from plataforma.contato_identificadores where workspace_id = $1 and tipo = 'whatsapp'", [ws])).rows;
    expect(contatos).toEqual([{ valor: WHATSAPP_DA_ANA }]);
    const conversas = (await pool().query<{ id: string }>("select id from plataforma.conversas where workspace_id = $1 and canal_id = $2", [ws, canalId])).rows;
    expect(conversas).toHaveLength(1);
    const conversaId = conversas[0]!.id;
    const recebida = (await app().inject({ method: "GET", url: `/mensagens?conversaId=${conversaId}`, headers: MEMBRO })).json() as Envelope;
    expect(recebida.itens!.find((m) => m.idExterno === "3EB0NOVE")).toMatchObject({ direcao: "recebida", conteudo: "oi, sem o nove" });

    falso.enfileirar({ kind: "ok", status: 201, corpo: { key: { remoteJid: "551187654321@s.whatsapp.net", fromMe: true, id: "3EB0NV2" }, status: "PENDING" } });
    const criada = await app().inject({ method: "POST", url: "/mensagens", headers: MEMBRO, payload: { conversaId, direcao: "enviada", conteudo: "respondendo sem o nove" } });
    expect(criada.statusCode).toBe(201);
    const worker = criarWorkerDeSaida({ workerId: "teste-evolution-nove-saida", workspaceId: ws, chaves, registro });
    expect(await worker.processarUm()).toBe(true);
    expect(falso.recebidas.at(-1)!.corpo).toEqual({ number: "551187654321", text: "respondendo sem o nove" });
  });

  describe("o que muda uma Mensagem que já existe (4.4.5)", () => {
    const conversaId = async () => (await pool().query<{ id: string }>("select id from plataforma.conversas where workspace_id = $1 and canal_id = $2", [ws, canalId])).rows[0]!.id;
    const fio = async () => ((await app().inject({ method: "GET", url: `/mensagens?conversaId=${await conversaId()}`, headers: MEMBRO })).json() as Envelope).itens!;
    const da = async (idExterno: string) => (await fio()).find((m) => m.idExterno === idExterno)!;

    /** O que a Evolution manda, chamado e processado: o webhook grava na fila e o processador aplica. */
    async function entregar(corpo: unknown) {
      expect((await chamar(corpo)).statusCode).toBe(200);
      const processador = criarProcessadorDeEntrada({ workerId: "teste-evolution-4-4-5", chaves, registro });
      expect(await processador.processarUm()).toBe(true);
      return (await linhas()).at(-1)!;
    }
    const evento = (nome: string, data: unknown) => ({ event: nome, instance: INSTANCIA, data });
    const upsert = (id: string, message: unknown, chave: Record<string, unknown> = {}) => ({
      ...texto,
      data: { ...texto.data, key: { ...texto.data.key, id, ...chave }, message, messageTimestamp: Math.floor(Date.now() / 1000) },
    });

    it("os tiques de uma Mensagem do CRM: SERVER_ACK, DELIVERY_ACK e READ chegam com o MESMO keyId e nenhum é descartado como repetido", async () => {
      const id = (await app().inject({ method: "POST", url: "/mensagens", headers: MEMBRO, payload: { conversaId: await conversaId(), direcao: "enviada", conteudo: "tique" } })).json() as Envelope;
      falso.enfileirar({ kind: "ok", status: 201, corpo: { key: { remoteJid: "5511987654321@s.whatsapp.net", fromMe: true, id: "3EB0TQ" }, status: "PENDING" } });
      const worker = criarWorkerDeSaida({ workerId: "teste-evolution-tique-saida", workspaceId: ws, chaves, registro });
      expect(await worker.processarUm()).toBe(true);
      expect(await da("3EB0TQ")).toMatchObject({ id: id.dados!.id, statusEntrega: "enviada" });

      const tique = (status: string) => evento("messages.update", { keyId: "3EB0TQ", remoteJid: "5511987654321@s.whatsapp.net", fromMe: true, status, instanceId: "i" });
      expect(await entregar(tique("DELIVERY_ACK"))).toMatchObject({ estado: "processado", chave: null });
      expect(await da("3EB0TQ")).toMatchObject({ statusEntrega: "entregue" });
      expect(await entregar(tique("READ"))).toMatchObject({ estado: "processado", chave: null });
      expect(await da("3EB0TQ")).toMatchObject({ statusEntrega: "lida" });
      // O tique que chega atrasado nunca desfaz o que já foi lido.
      expect(await entregar(tique("DELIVERY_ACK"))).toMatchObject({ estado: "processado", resultado: expect.stringContaining("status_atrasado") });
      expect(await da("3EB0TQ")).toMatchObject({ statusEntrega: "lida" });
    });

    it("o tique também vale para a Mensagem que o dono digitou no celular", async () => {
      const antes = await da(textoDoCelular.data.key.id);
      expect(antes.statusEntrega).toBe("enviada");
      await entregar(evento("messages.update", { keyId: textoDoCelular.data.key.id, remoteJid: "5511987654321@s.whatsapp.net", fromMe: true, status: "READ" }));
      expect((await da(textoDoCelular.data.key.id)).statusEntrega).toBe("lida");
    });

    it("o tique de uma Mensagem que o CRM não tem fica registrado como sem Mensagem e não grava nada", async () => {
      const linha = await entregar(evento("messages.update", { keyId: "3EB0NAOTEM", remoteJid: "5511987654321@s.whatsapp.net", fromMe: true, status: "READ" }));
      expect(linha).toMatchObject({ estado: "processado", resultado: expect.stringContaining("status_sem_mensagem") });
    });

    it("a reação do Contato entra no registro da Mensagem reagida, sem criar Mensagem, e trocá-la acrescenta", async () => {
      const antes = (await fio()).length;
      await entregar(upsert("3EB0RE01", { reactionMessage: { key: { remoteJid: "5511987654321@s.whatsapp.net", fromMe: true, id: "3EB0TQ" }, text: "👍", senderTimestampMs: Date.now() } }));
      expect((await da("3EB0TQ")).reacoes).toMatchObject([{ autor: "contato", emoji: "👍" }]);
      await entregar(upsert("3EB0RE02", { reactionMessage: { key: { remoteJid: "5511987654321@s.whatsapp.net", fromMe: true, id: "3EB0TQ" }, text: "", senderTimestampMs: Date.now() + 1000 } }));
      const depois = await da("3EB0TQ");
      expect(depois.reacoes.map((r) => r.emoji)).toEqual(["👍", ""]);
      expect((await fio()).length).toBe(antes);
    });

    it("a reação dada no celular do Canal tem o autor `canal`", async () => {
      await entregar(upsert("3EB0RE03", { reactionMessage: { key: { remoteJid: "5511987654321@s.whatsapp.net", fromMe: false, id: texto.data.key.id }, text: "🙏", senderTimestampMs: Date.now() } }, { fromMe: true }));
      expect((await da(texto.data.key.id)).reacoes).toMatchObject([{ autor: "canal", emoji: "🙏" }]);
    });

    it("a edição do Contato (messages.edited) troca o conteúdo da `recebida` e guarda o anterior; o mesmo evento como messages.update não é tique", async () => {
      await entregar(upsert("3EB0ED01", { conversation: "versão 1" }));
      const edicao = { key: { remoteJid: "5511987654321@s.whatsapp.net", fromMe: false, id: "3EB0ED01" }, type: "MESSAGE_EDIT", editedMessage: { conversation: "versão 2" }, timestampMs: String(Date.now()) };
      expect(await entregar(evento("messages.edited", edicao))).toMatchObject({ estado: "processado" });
      expect(await da("3EB0ED01")).toMatchObject({ conteudo: "versão 2", edicoesExternas: [{ conteudoAnterior: "versão 1" }] });

      // A Evolution manda a mesma edição também como messages.update com um status de enfeite.
      const comoStatus = evento("messages.update", { keyId: "3EB0ED01", remoteJid: "5511987654321@s.whatsapp.net", fromMe: false, status: "SERVER_ACK", message: { editedMessage: { message: { conversation: "versão 2" } } } });
      expect(await entregar(comoStatus)).toMatchObject({ estado: "processado", resultado: expect.stringContaining("edicao_no_status") });
      expect(await da("3EB0ED01")).toMatchObject({ conteudo: "versão 2" });
    });

    it("a Mensagem apagada pelo Contato ganha a Marcação de exclusão e o conteúdo continua guardado; a revogação que vem por messages.edited não a duplica", async () => {
      await entregar(upsert("3EB0DE01", { conversation: "vou me arrepender" }));
      expect(await entregar(evento("messages.delete", { remoteJid: "5511987654321@s.whatsapp.net", fromMe: false, id: "3EB0DE01", status: "DELETED" }))).toMatchObject({ estado: "processado" });
      expect(await da("3EB0DE01")).toMatchObject({ conteudo: "vou me arrepender", marcacaoExclusao: { porQuem: "remetente_externo" } });

      const revogacao = evento("messages.edited", { key: { remoteJid: "5511987654321@s.whatsapp.net", fromMe: false, id: "3EB0DE01" }, type: "REVOKE" });
      expect(await entregar(revogacao)).toMatchObject({ estado: "processado", resultado: expect.stringContaining("revogacao") });
      expect(await entregar(evento("messages.delete", { remoteJid: "5511987654321@s.whatsapp.net", fromMe: false, id: "3EB0DE01", status: "DELETED" }))).toMatchObject({ resultado: expect.stringContaining("exclusao_sem_efeito") });
    });

    it("a resposta do Contato que cita uma Mensagem liga à citada", async () => {
      const alvo = await da("3EB0TQ");
      await entregar(upsert("3EB0CT01", { extendedTextMessage: { text: "sobre aquilo", contextInfo: { stanzaId: "3EB0TQ", participant: "5511977770001@s.whatsapp.net", quotedMessage: { conversation: "tique" } } } }));
      expect(await da("3EB0CT01")).toMatchObject({ conteudo: "sobre aquilo", emRespostaAId: alvo.id });
    });

    it("a resposta escrita na Caixa a uma Mensagem sai com `quoted`: o id da Evolution da Mensagem respondida, o chat e o texto", async () => {
      const alvo = await da("3EB0CT01");
      falso.enfileirar({ kind: "ok", status: 201, corpo: { key: { remoteJid: "5511987654321@s.whatsapp.net", fromMe: true, id: "3EB0QR01" }, status: "PENDING" } });
      const criada = await app().inject({ method: "POST", url: "/mensagens", headers: MEMBRO, payload: { conversaId: await conversaId(), direcao: "enviada", conteudo: "combinado", emRespostaAId: alvo.id } });
      expect(criada.statusCode).toBe(201);
      const worker = criarWorkerDeSaida({ workerId: "teste-evolution-citacao-saida", workspaceId: ws, chaves, registro });
      expect(await worker.processarUm()).toBe(true);
      expect(falso.recebidas.at(-1)!.corpo).toEqual({
        number: "5511987654321",
        text: "combinado",
        quoted: { key: { id: "3EB0CT01", remoteJid: "5511987654321@s.whatsapp.net", fromMe: false }, message: { conversation: "sobre aquilo" } },
      });
      expect(await da("3EB0QR01")).toMatchObject({ emRespostaAId: alvo.id });
    });
  });

  it("o mesmo corpo com a instância de OUTRO Canal recebe 401 e nada é gravado", async () => {
    const antes = (await linhas()).length;
    const resposta = await chamar({ ...texto, instance: "outra" });
    expect(resposta.statusCode).toBe(401);
    expect(resposta.json()).toEqual({ ok: false, error: "Não autorizado." });
    expect(await linhas()).toHaveLength(antes);
  });

  it("sem o segredo do Canal a Evolution também recebe 401", async () => {
    const resposta = await chamar(texto, {});
    expect(resposta.statusCode).toBe(401);
  });

  it("registroPadrao() liga whatsapp-nao-oficial à Evolution só quando EVOLUTION_URL existe", () => {
    const anterior = process.env.EVOLUTION_URL;
    try {
      delete process.env.EVOLUTION_URL;
      expect(registroPadrao().porProvedor["whatsapp-nao-oficial"]).toBeUndefined();
      process.env.EVOLUTION_URL = "http://evolution.exemplo.test:8080";
      expect(registroPadrao().porProvedor["whatsapp-nao-oficial"]?.provedor).toBe("whatsapp-nao-oficial");
    } finally {
      if (anterior === undefined) delete process.env.EVOLUTION_URL;
      else process.env.EVOLUTION_URL = anterior;
    }
  });
});
