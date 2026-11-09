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
 * a Mensagem fica `enviada` com o `key.id` que a Evolution devolveu.
 */

import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import { buildApp } from "../app";
import { criarWorkerDeSaida } from "../mensageria/entregar-mensagem";
import { criarProcessadorDeEntrada } from "../mensageria/processador-de-entrada";
import { CABECALHO_DO_SEGREDO, TIPO_DO_SEGREDO_DO_WEBHOOK } from "../mensageria/provedor";
import { criarProvedorEvolution } from "../mensageria/provedores/evolution/provedor";
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
  itens?: Array<{ id: string; statusEntrega: string | null; idExterno: string | null; conteudo: string | null; direcao: string; motivoFalha: string | null }>;
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
